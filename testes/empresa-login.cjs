const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function load(empresas = []) {
    const nodes = { 'sessao-empresa': { replaceChildren() {}, add() {} }, 'sessao-id-empresa': {} };
    const stored = new Map();
    const context = vm.createContext({ empresasDisponiveis: () => empresas, state: { carregados: {} }, toast() {},
        window: { fb: { contaAtiva: { id: 'UID-titular', permissao: 'visualizador' } } },
        document: { getElementById: id => nodes[id] }, Option: function(nome, id) { this.value = id; },
        sessionStorage: { getItem: k => stored.get(k), setItem: (k, v) => stored.set(k, v) } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core/empresa-id.js'), 'utf8').replace(/export /g, ''), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core/empresa-login.js'), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '') +
        '\nthis.api={codigoLoginEmpresa,publicarIdEmpresa,preencherEmpresaHeader};', context);
    return { ...context.api, context, nodes };
}
test('cabeçalho mostra o ID do cadastro da empresa e permite escolher outra', () => {
    const { preencherEmpresaHeader, nodes, context } = load([{ id: '-empresa-A', codigoApp: '1', nome: 'A' }, { id: '-empresa-B', codigoApp: '2', nome: 'B' }]);
    preencherEmpresaHeader();
    assert.equal(nodes['sessao-id-empresa'].textContent, '1');
    assert.equal(nodes['sessao-empresa'].hidden, false);
    nodes['sessao-empresa'].value = '-empresa-B';
    nodes['sessao-empresa'].onchange();
    assert.equal(nodes['sessao-id-empresa'].textContent, '2');
    assert.equal(context.window.fb.empresaAtiva.codigo, '2');
});
test('gera o primeiro ID como 1 em lote atômico sem usar o UID ou push ID', async () => {
    const { publicarIdEmpresa } = load();
    let changes;
    const codigo = await publicarIdEmpresa({ db: {}, ref: (_, p) => p, get: async p => ({ val: () => p === 'sequenciaEmpresas' ? null : { nome: 'A' } }), update: async (_, value) => { changes = value; } }, 'UID-titular', { id: '-empresa-A' });
    assert.equal(codigo, '1');
    assert.equal(changes['empresasPorId/1'].contaId, 'UID-titular');
    assert.equal(changes['empresasPorId/1'].empresaId, '-empresa-A');
    assert.equal(changes.sequenciaEmpresas, 1);
    assert.equal(changes['contas/UID-titular/empresas/-empresa-A/codigoApp'], '1');
});
test('cadastro antigo recebe o próximo número e não é renumerado ao reabrir', async () => {
    const { publicarIdEmpresa } = load();
    let changes, codigoApp = '-codigo-legado', writes = 0;
    const fb = { db: {}, ref: (_, p) => p, get: async p => ({ val: () => p === 'sequenciaEmpresas' ? 1 : { nome: 'Antiga', codigoApp } }), update: async (_, v) => { changes = v; writes++; codigoApp = v['contas/UID-titular/empresa/codigoApp']; } };
    const codigo = await publicarIdEmpresa(fb, 'UID-titular', { id: 'padrao' });
    assert.equal(codigo, '2');
    assert.equal(changes['contas/UID-titular/empresa/codigoApp'], codigo);
    await publicarIdEmpresa(fb, 'UID-titular', { id: 'padrao', codigoApp: codigo });
    assert.equal(writes, 1);
    assert.equal(Object.keys(changes).length, 3);
});

test('sessão trocada não grava ID em outra conta', async () => {
    const { publicarIdEmpresa } = load();
    let writes = 0;
    const fb = { contaAtiva: { id: 'outra' }, update: async () => { writes++; } };
    await assert.rejects(publicarIdEmpresa(fb, 'UID-titular', { id: '-empresa-A' }), /sessão mudou/);
    assert.equal(writes, 0);
});
