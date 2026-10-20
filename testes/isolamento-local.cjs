const test = require('node:test'),
    assert = require('node:assert/strict'),
    vm = require('node:vm'),
    fs = require('node:fs'),
    path = require('node:path');
const root = path.resolve(__dirname, '../src');
function carregar(uid, conta) {
    const chamadas = [],
        callbacks = [],
        eventos = {};
    const fb = {
        ...(conta ? { contaAtiva: { id: conta } } : {}),
        auth: { currentUser: uid ? { uid } : null },
        db: {},
        ref: (db, p) => ({ path: p }),
        onValue: (r, cb) => {
            callbacks.push(cb);
            chamadas.push(['listen', r.path]);
            return () => chamadas.push(['off', r.path]);
        },
        set: async (r, v) => chamadas.push(['set', r.path, v]),
        push: (r) => ({ path: r.path + '/novo', key: 'novo' }),
        remove: async (r) => chamadas.push(['remove', r.path]),
        update: async (r, v) => chamadas.push(['update', r.path, v])
    };
    const c = vm.createContext({
        window: { fb, addEventListener: (t, fn) => (eventos[t] = fn) },
        toast() {},
        console
    });
    const src = fs
        .readFileSync(path.join(root, 'core/db.js'), 'utf8')
        .replace(/^import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?/gm, '')
        .replace(/export const/g, 'const');
    vm.runInContext(src + '\nthis.dbTest=db;', c);
    return { fb, db: c.dbTest, chamadas, callbacks, eventos };
}
test('não inicializa sem autenticação', () =>
    assert.throws(() => carregar(null), /Entre na sua conta/));
test('leituras, gravações e lotes ficam no UID capturado', async () => {
    const a = carregar('empresaA'),
        b = carregar('empresaB');
    a.db.listen('funcionarios', () => {});
    await a.db.set('empresa', { nome: 'A' });
    await b.db.set('empresa', { nome: 'B' });
    await a.db.update({ 'funcionarios/f/status': 'desligado', 'desligamentos/e': { uid: 'f' } });
    assert.equal(a.chamadas[0][1], 'contas/empresaA/funcionarios');
    assert.equal(a.chamadas[1][1], 'contas/empresaA/empresa');
    assert.equal(b.chamadas[0][1], 'contas/empresaB/empresa');
    assert.equal(a.chamadas[2][1], 'contas/empresaA');
    assert.equal(a.db.novoId('cargos'), 'novo');
});
test('rejeita travessia, caminho absoluto e sessão trocada', async () => {
    const a = carregar('A');
    assert.throws(() => a.db.set('../B/empresa', {}), /inválido/);
    assert.throws(() => a.db.set('/contas/B/empresa', {}), /inválido/);
    await assert.rejects(a.db.update({ '../B': {} }), /inválido/);
    a.fb.auth.currentUser = { uid: 'B' };
    assert.throws(() => a.db.set('empresa', {}), /sessão/);
});

test('usuário compartilhado usa a empresa escolhida e callbacks antigos param após troca', async () => {
    const a = carregar('usuario', 'empresaA');
    let recebidos = 0;
    a.db.listen('funcionarios', () => recebidos++);
    await a.db.set('empresa', { nome: 'A' });
    assert.equal(a.chamadas[0][1], 'contas/empresaA/funcionarios');
    assert.equal(a.chamadas[1][1], 'contas/empresaA/empresa');
    a.fb.contaAtiva.id = 'empresaB';
    a.callbacks[0]({ val: () => ({}) });
    assert.equal(recebidos, 0);
    assert.throws(() => a.db.set('empresa', {}), /sessão/);
});
test('callbacks antigos não entregam dados após troca de conta', () => {
    const a = carregar('A');
    let recebidos = 0;
    a.db.listen('empresa', () => recebidos++);
    a.callbacks[0]({ val: () => ({ nome: 'A' }) });
    a.fb.auth.currentUser = { uid: 'B' };
    a.callbacks[0]({ val: () => ({ nome: 'A' }) });
    assert.equal(recebidos, 1);
    a.eventos['mixponto:encerrar']();
    assert(a.chamadas.some((c) => c[0] === 'off'));
});
test('novoId/gravar e cadastro de empresa usam apenas a camada isolada', () => {
    const h = fs.readFileSync(path.join(root, 'core/cadastros.js'), 'utf8'),
        e = fs.readFileSync(path.join(root, 'pages/empresa.js'), 'utf8');
    assert(h.includes('return db.novoId(path)'));
    assert(h.includes('return db.set(path, val)'));
    assert(e.includes("await db.set(editId === 'padrao' ? 'empresa'"));
    assert(!e.includes('fb.set('));
});
test('regras negam raiz e dependem de auth.uid, não de permissão editável', () => {
    const r = JSON.parse(
        fs.readFileSync(path.resolve(root, '../firebase/database.rules.json'), 'utf8')
    ).rules;
    assert.equal(r['.read'], false);
    assert.equal(r['.write'], false);
    const conta = r.contas.$empresa;
    assert.equal(conta['.write'], false);
    assert.equal(conta.usuarios['.write'], false);
    assert.equal(conta.auditoria['.write'], false);
    assert.match(conta['.read'], /meta\/ownerUid/);

});
test('login descobre contas sem criar espaco pelo UID no cliente', () => {
    const source=fs.readFileSync(path.join(root,'bootstrap.js'),'utf8');
    assert.equal(source.includes('prepararConta'),false);
    assert.equal(source.includes('fb.runTransaction'),false);
    assert.ok(source.includes("gestaoApi('/aceitar',{})"));
});
