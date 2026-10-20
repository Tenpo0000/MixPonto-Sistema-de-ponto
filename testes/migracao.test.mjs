import test from 'node:test';
import assert from 'node:assert/strict';
import { migrarIsolamento } from '../firebase/migrar-isolamento.mjs';
test('migração move os quatro nós para as contas e mantém IDs, senha, histórico e contador', () => {
    const input = { contas: {
        A: { meta: { ownerUid: 'A' }, usuarios: { p: { email: 'shared@example.com', permissao: 'rh', status: 'ativo' } }, funcionarios: { f: { empresaId: '-empresa' } }, credenciaisApp: { f: { senha: 'teste-local' } }, registros: { dia: { f: {} } } },
        B: { usuarios: { q: { email: 'shared@example.com', permissao: 'visualizador', status: 'bloqueado' } }, funcionarios: { g: {} } },
    }, acessosContas: { 'shared@example%2Ecom': { A: { usuarioId: 'p' }, B: { usuarioId: 'q', status: 'ativo' } } },
        titularesAutorizados: { A: true, B: true }, acessosMobile: { worker: { empresaUid: 'A', funcionarioId: 'f', ativo: true } },
        solicitacoesMobile: { worker: { email: 'worker@example.com', criadoEm: 1 } }, empresasPorId: { 1: { contaId: 'A', empresaId: '-empresa' } }, sequenciaEmpresas: 1 };
    const original = structuredClone(input), { dados, relatorio } = migrarIsolamento(input);
    assert.deepEqual(input, original);
    assert.deepEqual(Object.keys(dados).sort(), ['contas','empresasPorId','sequenciaEmpresas']);
    assert.equal(dados.contas.A.titularesAutorizados.A, true);
    assert.equal(dados.contas.A.acessosContas['shared@example%2Ecom'].permissao, 'rh');
    assert.equal(dados.contas.B.acessosContas['shared@example%2Ecom'].status, 'bloqueado');
    assert.equal(dados.contas.A.acessosMobile.worker.funcionarioId, 'f');
    assert.equal(dados.contas.B.acessosMobile, undefined);
    assert.equal(dados.contas.A.solicitacoesMobile.worker.email, 'worker@example.com');
    assert.deepEqual(dados.contas.A.credenciaisApp, input.contas.A.credenciaisApp);
    assert.deepEqual(dados.contas.A.registros, input.contas.A.registros);
    assert.deepEqual(dados.empresasPorId, input.empresasPorId); assert.equal(dados.sequenciaEmpresas, 1);
    assert.equal(relatorio.pendencias.length, 0);
    assert.deepEqual(migrarIsolamento(dados).dados, dados);
});
test('migração preserva revogação local e separa solicitações sem empresa para revisão', () => {
    const input = { contas: { A: { funcionarios: { f: {} }, acessosMobile: { worker: { empresaUid: 'A', funcionarioId: 'f', ativo: false } } } },
        acessosMobile: { worker: { empresaUid: 'A', funcionarioId: 'f', ativo: true } }, solicitacoesMobile: { orphan: { email: 'orphan@example.com' } } };
    const { dados, relatorio } = migrarIsolamento(input);
    assert.equal(dados.contas.A.acessosMobile.worker.ativo, false);
    assert.equal(relatorio.pendencias[0].origem, 'solicitacoesMobile/orphan');
    assert.equal(relatorio.avisos.length, 1);
    assert.equal(dados.contas.A.solicitacoesMobile, undefined);
});
