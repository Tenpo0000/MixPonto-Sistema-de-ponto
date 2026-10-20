const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
function load(meta = {}) {
    const campo = {}, state = { meta, carregados: {} };
    const context = vm.createContext({ state, toast() {}, document: { getElementById: () => campo },
        window: { fb: { contaAtiva: { id: 'owner', permissao: 'visualizador' } } } });
    for (const file of ['conta-id.js','conta-header.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core', file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);
    return { ...vm.runInContext('({publicarIdConta,preencherContaHeader})', context), context, campo };
}
test('cabeçalho mostra o ID da conta independentemente dos cadastros de empresa', () => {
    const { preencherContaHeader, campo, context } = load({ codigoApp: '1' });
    context.state.empresas = { A: { codigoApp: '7' }, B: { codigoApp: '8' } };
    preencherContaHeader(); assert.equal(campo.textContent, '1');
    assert.equal(context.window.fb.contaAtiva.codigoApp, '1');
});
test('numera somente a conta e grava índice sem empresaId', async () => {
    const { publicarIdConta } = load(); let changes;
    const fb = { db: {}, ref: (_, p) => p, get: async p => ({ val: () => p === 'sequenciaContas' ? null : { ownerUid: 'owner' } }), update: async (_, v) => { changes = v; } };
    assert.equal(await publicarIdConta(fb, 'owner'), '1');
    assert.equal(changes['contasPorId/1'].contaId, 'owner');
    assert.equal(Object.keys(changes['contasPorId/1']).join(','), 'contaId');
    assert.equal(changes['contas/owner/meta/codigoApp'], '1');
    assert.equal(changes.sequenciaContas, 1);
    assert.equal(Object.keys(changes).length, 3);
});
test('conta numerada não consome outro ID ao reabrir', async () => {
    const { publicarIdConta } = load(); let writes = 0;
    const fb = { db: {}, ref: (_, p) => p, get: async () => ({ val: () => ({ ownerUid: 'owner', codigoApp: '1' }) }), update: async () => { writes++; } };
    assert.equal(await publicarIdConta(fb, 'owner'), '1'); assert.equal(writes, 0);
});
test('sessão trocada não numera outra conta', async () => {
    const { publicarIdConta } = load();
    await assert.rejects(publicarIdConta({ contaAtiva: { id: 'other' } }, 'owner'), /sessão mudou/);
});
test('concorrência entre leitura do cadastro e contador não consome um segundo número', async () => {
    const { publicarIdConta } = load(); let reads = 0, writes = 0;
    const fb = { db: {}, ref: (_, p) => p, get: async p => ({ val: () => p === 'sequenciaContas' ? 1 : (++reads === 1 ? { ownerUid: 'owner' } : { ownerUid: 'owner', codigoApp: '1' }) }),
        update: async () => { writes++; throw Error('permission denied'); } };
    assert.equal(await publicarIdConta(fb, 'owner'), '1'); assert.equal(writes, 1);
});
