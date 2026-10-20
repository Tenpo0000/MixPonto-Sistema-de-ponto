import test from 'node:test';
import assert from 'node:assert/strict';
import { migrarIdsContas } from '../firebase/migrar-ids-contas.mjs';
test('duas empresas dentro da mesma conta viram um único ID e próxima conta recebe 2', () => {
    const original = { contas: { A: { meta: { ownerUid: 'A' }, empresas: { e1: { codigoApp: '1', nome: 'Um' }, e2: { codigoApp: '2', nome: 'Dois' } }, funcionarios: { f: { empresaId: 'e2' } }, registros: { dia: { f: { ponto: 1 } } } } }, empresasPorId: [null, { contaId: 'A', empresaId: 'e1' }, { contaId: 'A', empresaId: 'e2' }], sequenciaEmpresas: 2 };
    const { dados } = migrarIdsContas(original);
    assert.deepEqual(dados.contasPorId, { 1: { contaId: 'A' } });
    assert.equal(dados.sequenciaContas, 1);
    assert.equal(dados.contas.A.meta.codigoApp, '1');
    assert.deepEqual(dados.contas.A.funcionarios, original.contas.A.funcionarios);
    assert.deepEqual(dados.contas.A.registros, original.contas.A.registros);
    assert.equal(dados.contas.A.empresas.e2.codigoApp, undefined);
    assert.equal(original.contas.A.empresas.e2.codigoApp, '2');
    assert.equal(dados.empresasPorId, undefined);
    assert.deepEqual(migrarIdsContas(dados).dados, dados);
    dados.contas.B = { meta: { ownerUid: 'B' }, empresas: {} };
    const next = migrarIdsContas(dados).dados;
    assert.equal(next.contas.B.meta.codigoApp, '2'); assert.equal(next.sequenciaContas, 2);
});
test('migração não aceita códigos duplicados de contas', () => {
    assert.throws(() => migrarIdsContas({ contas: { A: { meta: { ownerUid: 'A', codigoApp: '1' } }, B: { meta: { ownerUid: 'B', codigoApp: '1' } } } }), /duplicado/);
});
