import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { descobrirContas } from '../descoberta.mjs';
import { criarHandler } from '../http.mjs';

function fixture() {
    const data = {};
    for (const id of ['A','B','C']) {
        data[`contas/${id}/meta`] = { ownerUid: id };
        data[`contas/${id}/titularesAutorizados/${id}`] = true;
        data[`contas/${id}/acessosContas/shared@example%2Ecom`] = { usuarioId: 'p', email: 'shared@example.com', status: id === 'C' ? 'bloqueado' : 'ativo', permissao: 'visualizador', nomeConta: `Empresa ${id}` };
        data[`contas/${id}/usuarios/p`] = { email: 'shared@example.com', status: 'ativo', permissao: 'visualizador', senha: 'NAO-RETORNAR' };
    }
    const paths = [];
    return { data, paths, store: { listAccountIds: async () => ['A','B','C'], get: async path => { paths.push(path); return data[path] ?? null; } } };
}
test('mesmo login descobre empresas em outro dispositivo sem índice global nem dados privados', async () => {
    const f = fixture(), identity = { uid: 'shared', email: 'shared@example.com', email_verified: true };
    const first = await descobrirContas(f.store, identity), second = await descobrirContas(f.store, identity);
    assert.deepEqual(first.map(c => c.id), ['A','B']); assert.deepEqual(first, second);
    assert.ok(f.paths.every(p => p.startsWith('contas/')));
    assert.ok(!JSON.stringify(first).includes('NAO-RETORNAR'));
    f.data['contas/A/usuarios/p'].status = 'bloqueado';
    assert.deepEqual((await descobrirContas(f.store, identity)).map(c => c.id), ['B']);
});
test('e-mail sem confirmação, perfil divergente e titular desativado não geram acesso', async () => {
    const f = fixture();
    assert.deepEqual(await descobrirContas(f.store, { uid: 'shared', email: 'shared@example.com', email_verified: false }), []);
    f.data['contas/A/usuarios/p'].email = 'outra@example.com';
    f.data['contas/B/titularesAutorizados/B'] = false;
    assert.deepEqual(await descobrirContas(f.store, { uid: 'shared', email: 'shared@example.com', email_verified: true }), []);
    assert.deepEqual((await descobrirContas(f.store, { uid: 'A', email_verified: false })).map(c => c.id), ['A']);
});
test('descoberta expõe um código por conta sem depender de quantas empresas ela contém', async () => {
    const f = fixture();
    f.data['contas/A/meta'].codigoApp = '1';
    f.data['contas/A/empresas'] = { e1: { nome: 'Um' }, e2: { nome: 'Dois' } };
    const result = await descobrirContas(f.store, { uid: 'A', email_verified: false });
    assert.equal(result.length, 1); assert.equal(result[0].codigoApp, '1');
});

test('troca consulta somente o destino, verifica permissão atual e não enumera outras contas',async()=>{
    const f=fixture(), identity={uid:'shared',email:'shared@example.com',email_verified:true};
    f.store.listAccountIds=()=>{throw Error('Não deve enumerar todas as contas na troca.');};
    assert.deepEqual((await descobrirContas(f.store,identity,'A')).map(c=>c.id),['A']);
    assert.ok(f.paths.every(p=>p.startsWith('contas/A/')));
    f.data['contas/A/usuarios/p'].status='bloqueado';
    assert.deepEqual(await descobrirContas(f.store,identity,'A'),[]);
    assert.deepEqual(await descobrirContas(f.store,identity,'../B'),[]);
    assert.deepEqual(await descobrirContas(f.store,identity,'C'),[]);
});
test('servidor bloqueia autenticação de emulador em configuração de produção', () => {
    const env = { ...process.env, FIREBASE_PROJECT_ID: 'mixponto-ffe50', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' };
    delete env.FIREBASE_DATABASE_EMULATOR_HOST;
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { env, encoding: 'utf8', timeout: 5000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Use os dois emuladores juntos/);
});
test('API exige token, rejeita origem e UID informados pelo cliente e não publica arquivos privados', async t => {
    const f = fixture(); let verified;
    const server = createServer(criarHandler({ store: f.store, allowedOrigins: ['https://site.example'],
        siteRoot: fileURLToPath(new URL('../../', import.meta.url)),
        verifyToken: async token => { verified = token; if (token !== 'valid') throw Error('invalid'); return { uid: 'shared', email: 'shared@example.com', email_verified: true }; } }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base + '/api/contas')).status, 401);
    assert.equal((await fetch(base + '/api/contas', { headers: { Authorization: 'Bearer forged' } })).status, 401);
    assert.equal((await fetch(base + '/api/contas?uid=A', { headers: { Authorization: 'Bearer valid' } })).status, 400);
    assert.equal((await fetch(base + '/api/contas', { headers: { Origin: 'https://evil.example', Authorization: 'Bearer valid' } })).status, 403);
    const response = await fetch(base + '/api/contas', { headers: { Origin: 'https://site.example', Authorization: 'Bearer valid' } });
    assert.equal(response.status, 200); assert.equal(verified, 'valid');
    assert.deepEqual((await response.json()).contas.map(c => c.id), ['A','B']);
    const headers={Authorization:'Bearer valid'};
    assert.deepEqual((await (await fetch(base+'/api/contas/A',{headers})).json()).contas.map(c=>c.id),['A']);
    assert.deepEqual((await (await fetch(base+'/api/contas/C',{headers})).json()).contas,[]);
    assert.equal((await fetch(base+'/api/contas/A?uid=other',{headers})).status,400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(base + '/servidor/.env.example')).status, 404);
    assert.equal((await fetch(base + '/src/index.html')).status, 200);
});
