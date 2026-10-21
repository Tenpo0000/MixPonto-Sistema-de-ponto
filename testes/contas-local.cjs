const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core/contas.js'), 'utf8').replace(/export /g, '') +
    '\nthis.api={chaveEmail,contasDisponiveis,salvarUsuarioComAcesso};', context);
const { chaveEmail, contasDisponiveis, salvarUsuarioComAcesso } = context.api;
const user = (uid='shared') => ({ uid, getIdToken: async () => 'firebase-id-token' });
context.AbortSignal = { timeout: () => undefined };

test('mesmo login usa descoberta autenticada sem consultar índice global no banco', async () => {
    context.fetch = async (url, options) => {
        assert.equal(url, '/api/contas');
        assert.equal(options.headers.Authorization, 'Bearer firebase-id-token');
        return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ contas: [
            { id: 'A', nome: 'A', permissao: 'rh' }, { id: 'B', nome: 'B', permissao: 'administrador' },
        ] }) };
    };
    const contas = await contasDisponiveis({ get: () => { throw Error('não deve consultar raiz'); } }, user());
    assert.equal(contas.map(c => c.id).join(','), 'A,B');
});

test('serviço indisponível informa configuração pendente sem fallback para dados globais', async () => {
    context.fetch = async () => ({ ok: false });
    await assert.rejects(contasDisponiveis({}, user('owner')), /serviço \/api\/contas/);
});

test('descoberta usa endpoint configurado e descarta identificadores inválidos', async () => {
    context.fetch = async url => {
        assert.equal(url, 'https://api.example/api/contas');
        return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ contas: [
            { id: '../outra', permissao: 'administrador' }, { id: 'A', nome: 'A', permissao: 'visualizador' },
        ] }) };
    };
    assert.equal((await contasDisponiveis({ contasApiUrl: 'https://api.example/api/contas' }, user())).length, 1);
});

test('troca de e-mail exige revogação explícita e não escreve permissões pelo cliente', async () => {
    const fb = {auth:{currentUser:{uid:'owner'}}};
    await assert.rejects(salvarUsuarioComAcesso(fb,'owner','p',{email:'old@example.com'},{email:'new@example.com'}), /Revogue/);
});

test('troca usa endpoint do destino com token sem reaproveitar autorização anterior',async()=>{
    context.fetch=async(url,options)=>{
        assert.equal(url,'/api/contas/B');assert.equal(options.cache,'no-store');
        assert.equal(options.headers.Authorization,'Bearer firebase-id-token');
        return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({contas:[{id:'B',nome:'B',permissao:'visualizador'}]})};
    };
    assert.equal((await contasDisponiveis({},user(),'B'))[0].permissao,'visualizador');
    await assert.rejects(contasDisponiveis({},user(),'../A'));
});
