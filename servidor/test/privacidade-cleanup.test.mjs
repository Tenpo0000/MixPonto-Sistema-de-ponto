import test from 'node:test';
import assert from 'node:assert/strict';
import { inventariarCopias, bloquearELimpar } from '../privacidade-cleanup.mjs';

test('inventário remove somente campos de senha conhecidos e não inclui seus valores', () => {
    const inventory = inventariarCopias({ a: { credenciaisApp: { f: { senha: 'SEGREDO' } },
        funcionarios: { f: { email: 'worker@example.com', senha: 'SEGREDO', mobilePassword: 'SEGREDO', status: 'ativo' } },
        usuarios: { u: { password: 'SEGREDO' } }, registros: { dia: { entrada: '08:00' } } } });
    assert.equal(inventory.copies, 1);
    assert.equal(inventory.legacy, 3);
    assert.equal(Object.keys(inventory.changes).length, 4);
    assert.ok(!JSON.stringify(inventory).includes('SEGREDO'));
    assert.ok(!JSON.stringify(inventory).includes('registros'));
});

test('limpeza inventaria após bloquear clientes e verifica novamente todas as contas', async () => {
    const order = [];
    let data = {};
    const result = await bloquearELimpar({
        publish: async () => { order.push('block'); data = { newAccount: { credenciaisApp: { f: { senha: 'SEGREDO' } } } }; },
        readAccounts: async () => { order.push('read'); return data; },
        removePaths: async changes => { order.push('remove'); assert.deepEqual(changes, { 'contas/newAccount/credenciaisApp': null }); data = {}; },
    });
    assert.equal(result.copies, 1);
    assert.deepEqual(order, ['block', 'read', 'remove', 'read']);
});

test('bloqueio recusado não lê nem remove dados; cópias restantes impedem sucesso', async () => {
    let touched = false;
    await assert.rejects(bloquearELimpar({ publish: async () => { throw Error('negado'); },
        readAccounts: async () => { touched = true; }, removePaths: async () => { touched = true; } }));
    assert.equal(touched, false);
    await assert.rejects(bloquearELimpar({ publish: async () => {},
        readAccounts: async () => ({ a: { credenciaisApp: 'cópia inválida' } }), removePaths: async () => {} }), /Ainda existem/);
});
