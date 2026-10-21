const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/bootstrap.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export async function iniciar', 'async function iniciar')
    .replace("await import('./app.js');", 'await carregarApp();');

function ambiente(storage = new Map([['mixponto-conta-user', 'A']]), error = null) {
    const nodes = new Map(), events = {}, calls = { signOut: 0, reload: 0, reads: [], loaded: 0, descobertas: [], convites: 0 };
    const element = () => ({ hidden: false, value: '', textContent: '',
        classList: { toggle() {} }, addEventListener() {}, setAttribute() {}, before() {},
        replaceChildren() {}, add() {}, appendChild() {} });
    const get = selector => {
        if (!nodes.has(selector)) nodes.set(selector, element());
        return nodes.get(selector);
    };
    get('#auth-tela').hidden = true;
    get('#app-shell').hidden = true;
    const user = { uid: 'user', email: 'user@example.com', emailVerified: true };
    let authCallback;
    const fb = { auth: { currentUser: user }, db: {}, ref: (_, p) => p,
        get: async p => { calls.reads.push(p); if (error) throw error; return { val: () => ({ ownerUid: 'titular' }) }; },
        signOut: async () => { calls.signOut++; }, setPersistence: async () => {},
        onAuthStateChanged: (_, cb) => { authCallback = cb; } };
    const context = vm.createContext({
        window: { fb, dispatchEvent() {}, addEventListener(name, fn) { events[name]=fn; } },
        document: { querySelector: get, createElement: element },
        location: { reload: () => calls.reload++ }, console: { error() {} },
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
        sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
        Date, atualizarSeletorContas() {},
        Event: function() {}, Option: function(text, value) { return { text, value }; }, setInterval() {},
        gestaoApi: async () => {calls.convites++;return {};}, abrirGestao() {}, carregarApp: async () => calls.loaded++,
        contasDisponiveis: async (_, user, contaId) => { calls.descobertas.push(contaId);if(error)throw error;return (contaId ? [contaId] : ['A','B']).map(id => ({ id, nome: id, codigoApp: id === 'A' ? '1' : '2', permissao: 'administrador' })); }
    });
    vm.runInContext(source + '\nthis.abrir=abrir; this.iniciar=iniciar;', context);
    return { context, fb, calls, get, user, callback: () => authCallback, storage, events };
}

test('HTML aguarda restaurar a sessão antes de mostrar qualquer formulário de login', () => {
    const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
    assert.match(html, /<section id="auth-tela"[^>]* hidden>/);
    assert.match(html, /id="sessao-carregando"/);
});

test('troca A para B preserva a identidade e carrega B sem mostrar login', async () => {
    const a = ambiente();
    await a.context.abrir(a.user);
    a.get('#sessao-conta').value = 'B';
    a.get('#sessao-conta').onchange();
    assert.equal(a.get('#auth-tela').hidden, true);
    assert.equal(a.get('#sessao-carregando').hidden, false);
    assert.equal(a.calls.signOut, 0);
    assert.equal(a.calls.reload, 1);
    const b = ambiente(a.storage);
    assert.equal(b.get('#auth-tela').hidden, true);
    await b.context.abrir(b.user);
    assert.equal(b.fb.contaAtiva.id, 'B');
    assert.deepEqual(b.calls.reads, []);
    assert.equal(b.get('#auth-tela').hidden, true);
    assert.equal(b.get('#app-shell').hidden, false);
    assert.equal(b.get('#sessao-carregando').hidden, true);
    assert.equal(b.calls.signOut, 0);
    assert.equal(b.calls.convites,0);
    assert.equal(b.calls.descobertas[0],'B');
});

test('falha no acesso à conta não encerra o login e permite escolher outra conta', async () => {
    const a = ambiente(undefined, Object.assign(Error('permission_denied'), { code: 'permission_denied' }));
    await a.context.abrir(a.user);
    assert.equal(a.calls.signOut, 0);
    assert.equal(a.fb.auth.currentUser.uid, 'user');
    assert.equal(a.get('#auth-form').hidden, true);
    assert.equal(a.get('#auth-compartilhado').hidden, false);
    assert.equal(a.get('#sessao-carregando').hidden, true);
    assert.equal(a.storage.has('mixponto-conta-user'), false);
    assert.equal(a.calls.loaded, 0);
});

test('formulário de login aparece quando o Firebase confirma ausência de sessão', async () => {
    const a = ambiente();
    a.fb.auth.currentUser = null;
    await a.context.iniciar();
    a.callback()(null);
    assert.equal(a.get('#auth-tela').hidden, false);
    assert.equal(a.get('#auth-form').hidden, false);
    assert.equal(a.get('#auth-compartilhado').hidden, true);
    assert.equal(a.get('#sessao-carregando').hidden, true);
});

test('voltar da gestão atualiza a escolha de contas em segundo plano sem tela de carregamento', async () => {
    const a=ambiente(new Map());
    await a.context.iniciar();
    a.get('#sessao-carregando').hidden=true;
    a.get('#auth-tela').hidden=false;
    await a.events['mixponto:gestao-atualizada']();
    assert.equal(a.get('#sessao-carregando').hidden,true);
    assert.equal(a.get('#auth-form').hidden,true);
    assert.equal(a.get('#auth-compartilhado').hidden,false);
    assert.equal(a.calls.reload,0);
    assert.equal(a.calls.signOut,0);
});
