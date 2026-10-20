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
    assert(e.includes('await publicarIdEmpresa(window.fb, window.fb.contaAtiva.id'));
    assert(!e.includes('fb.set('));
});
test('regras negam raiz e dependem de auth.uid, não de permissão editável', () => {
    const r = JSON.parse(
        fs.readFileSync(path.resolve(root, '../firebase/database.rules.json'), 'utf8')
    ).rules;
    assert.equal(r['.read'], false);
    assert.equal(r['.write'], false);
    for (const op of ['.read', '.write']) {
        const [variavel, conta] = Object.entries(r.contas).find(([key]) => key.startsWith('$'));
        const expr = conta[op];
        const avaliar = (auth, uid, titular = true) => Function('auth', variavel, 'root', 'return ' + expr)(
            auth && { ...auth, token: { email: null } }, uid, { child: () => ({ child: () => ({ val: () => titular }) }) }
        );
        assert.equal(avaliar(null, 'A'), false);
        assert.equal(avaliar({ uid: 'A' }, 'A'), true);
        assert.equal(avaliar({ uid: 'A' }, 'B'), false);
        assert.equal(avaliar({ uid: 'A' }, 'A', false), false);
    }
});
test('inicialização cria apenas o espaço da conta e não sobrescreve dados existentes', async () => {
    const dados = {},
        calls = [];
    const fb = {
        ref: (db, p) => p,
        db: {},
        get: async (p) => ({
            val: () => dados[p.split('/')[1]]?.meta ?? null,
            exists: () => {
                const uid = p.split('/')[1];
                return !!dados[uid]?.meta;
            }
        }),
        runTransaction: async (p, fn) => {
            calls.push(p);
            const [, uid, ...partes] = p.split('/');
            const next = fn(partes.reduce((v, k) => v?.[k], dados[uid]) ?? null);
            if (next === undefined) return;
            if (!partes.length) dados[uid] = next;
            else {
                let alvo = dados[uid] ||= {};
                for (const k of partes.slice(0, -1)) alvo = alvo[k] ||= {};
                alvo[partes.at(-1)] = next;
            }
        }
    };
    const context = vm.createContext({ window: { fb }, document: {}, console });
    let src = fs
        .readFileSync(path.join(root, 'bootstrap.js'), 'utf8')
        .replace(/^import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?/gm, '')
        .replace(/export async function/g, 'async function');
    vm.runInContext(src + '\nthis.seed=prepararConta;', context);
    await context.seed({ uid: 'A', email: 'a@example.com', displayName: 'A' });
    await context.seed({ uid: 'B', email: 'b@example.com', displayName: 'B' });
    assert.equal(dados.A.meta.ownerUid, 'A');
    assert.equal(dados.B.meta.ownerUid, 'B');
    assert.equal(dados.A.preferencias.A.perfil.email, 'a@example.com');
    assert(!dados.A.preferencias.B);
    dados.A.funcionarios = { f: { nome: 'Preservar' } };
    await context.seed({ uid: 'A', email: 'a@example.com' });
    assert.equal(dados.A.funcionarios.f.nome, 'Preservar');
    assert.deepEqual(calls, ['contas/A', 'contas/A/meta/ownerUid', 'contas/B', 'contas/B/meta/ownerUid']);
    dados.C = { funcionarios: { f: { nome: 'Legado' } }, meta: { criadoEm: 'antigo' } };
    await context.seed({ uid: 'C' });
    assert.equal(dados.C.meta.ownerUid, 'C');
    assert.equal(dados.C.meta.criadoEm, 'antigo');
    assert.equal(dados.C.funcionarios.f.nome, 'Legado');
    dados.D = { funcionarios: { f: { nome: 'Sem meta' } } };
    await context.seed({ uid: 'D' });
    assert.equal(dados.D.meta.ownerUid, 'D');
    assert.equal(dados.D.funcionarios.f.nome, 'Sem meta');
    assert.equal(dados.D.config, undefined);
    dados.E = { meta: { ownerUid: 'outro' } };
    await assert.rejects(context.seed({ uid: 'E' }), /titular registrado/);
    assert.equal(dados.E.meta.ownerUid, 'outro');
});
