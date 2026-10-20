const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core/contas.js'), 'utf8').replace(/export /g, '') +
    '\nthis.api={chaveEmail,contasDisponiveis,salvarUsuarioComAcesso};', context);
const { chaveEmail, contasDisponiveis, salvarUsuarioComAcesso } = context.api;
const denied = () => Object.assign(Error('permission denied'), { code: 'permission_denied' });

test('mesmo login descobre duas contas ativas e ignora a conta bloqueada', async () => {
    const user = { uid: 'shared', email: 'Shared@example.com', emailVerified: true };
    const fb = { db: {}, ref: (_, p) => p, get: async (p) => {
        if (p.startsWith('contas/shared')) throw denied();
        assert.equal(p, `acessosContas/${chaveEmail(user.email)}`);
        return { val: () => ({ A: { nomeConta: 'A', status: 'ativo', permissao: 'rh' }, B: { nomeConta: 'B', status: 'ativo', permissao: 'administrador' }, C: { status: 'bloqueado' } }) };
    } };
    const contas = await contasDisponiveis(fb, user);
    assert.equal(contas.map((item) => item.id).join(','), 'A,B');
});

test('e-mail não confirmado não consulta nem aceita convites de outras empresas', async () => {
    const paths = [];
    const fb = { db: {}, ref: (_, p) => p, get: async (p) => { paths.push(p); throw denied(); } };
    const contas = await contasDisponiveis(fb, { uid: 'shared', email: 'shared@example.com', emailVerified: false });
    assert.equal(contas.length, 0);
    assert.ok(paths.every((p) => !p.startsWith('acessosContas/')));
});

test('titular existente continua acessando a conta durante a atualização das regras', async () => {
    const fb = { db: {}, ref: (_, p) => p, get: async (p) => {
        if (p.endsWith('/meta')) return { val: () => ({ ownerUid: 'owner' }) };
        if (p.endsWith('/empresa')) return { val: () => ({ nome: 'Empresa' }) };
        throw denied();
    } };
    const contas = await contasDisponiveis(fb, { uid: 'owner', email: 'owner@example.com', emailVerified: true });
    assert.equal(contas[0].id, 'owner');
    assert.equal(contas[0].titular, true);
});

test('troca de e-mail remove convite antigo no mesmo lote do perfil e do novo convite', async () => {
    let changes;
    const fb = { auth: { currentUser: { uid: 'owner' } }, db: {}, ref: (_, p) => p,
        update: async (_, value) => { changes = value; } };
    await salvarUsuarioComAcesso(fb, 'owner', 'perfil', { email: 'old@example.com' }, {
        nome: 'Usuário', email: 'new@example.com', permissao: 'visualizador', status: 'bloqueado',
    }, 'Empresa');
    assert.equal(changes[`acessosContas/${chaveEmail('old@example.com')}/owner`], null);
    assert.equal(changes[`acessosContas/${chaveEmail('new@example.com')}/owner`].status, 'bloqueado');
    assert.equal(changes['contas/owner/usuarios/perfil'].email, 'new@example.com');
});
