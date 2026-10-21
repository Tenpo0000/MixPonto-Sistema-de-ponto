const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '../src');

function ambiente() {
    const nodes = new Map(), creates = [], writes = [], messages = [];
    let falharAcesso = false, falharCadastro = false;
    const state = {
        funcionarios: { f1: { nome: 'Ana', cpf: '11122233344', matricula: '1', admissao: '2020-01-01', status: 'ativo', empresaId: 'e', departamentoId: 'd', cargoId: 'c', horarioId: 'h', preservado: true } },
        cargos: { c: { nome: 'Cargo' } }, departamentos: { d: { nome: 'Setor' } }, horarios: { h: { dias: [] } },
        mobileAcessos: {}, credenciaisApp: {}
    };
    const node = (id) => {
        if (!nodes.has(id)) nodes.set(id, { value: '', dataset: {}, events: {}, addEventListener(event, action) { this.events[event] = action; } });
        return nodes.get(id);
    };
    const context = vm.createContext({
        state, console, Date, Object, Array, Number, String, fotoLocal: v=> typeof v==='string' && v.startsWith('data:image/') ? v : '',
        location: { hash: '#funcionario' },
        window: { fb: { auth: { currentUser: { uid: 'owner' } }, db: {} } },
        $: node, $$: () => [],
        esc: (v) => String(v || '').replace(/</g, '&lt;'),
        dateKey: (d) => d.toISOString().slice(0, 10),
        lista: (o) => Object.entries(o || {}).map(([id, value]) => ({ id, ...value })),
        itens: (key) => Object.entries(state[key] || {}).map(([id, value]) => ({ id, ...value })),
        empresasDisponiveis: () => [{ id: 'e', nome: 'Empresa' }],
        empresaPorId: () => ({ id: 'e' }),
        carregado: () => true, cabecalho: () => '',
        campo: (nome) => `<input name="${nome}">`, opcoes: () => '',
        normalizarCartao: (value) => value || '', validarCartao: () => '',
        inicioJornada: () => '08:00', fimJornada: () => '17:00',
        novoId: () => 'new', erroForm: (_, text) => messages.push(text),
        executar: async (_, action) => { await action(); return true; },
        salvarFuncionarioComCartao: async (id, value) => {
            if (falharCadastro) throw new Error('Sem conexão');
            const copy = JSON.parse(JSON.stringify(value));
            writes.push({ id, value: copy });
            state.funcionarios[id] = copy;
        },
        createEmployeeAccess: async (value) => {
            creates.push(value);
            if (falharAcesso) throw new Error('Falha de confirmação');
            return { uid: 'worker', email: value.email };
        },
        revokeMobile: async () => {}, toast: (text) => messages.push(text),
        FormData: class { constructor(form) { return Object.entries(form.values)[Symbol.iterator](); } }
    });
    const source = fs.readFileSync(path.join(root, 'pages/funcionario.js'), 'utf8')
        .replace(/^import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?/gm, '').replace(/export /g, '');
    vm.runInContext(source + '\nthis.api={view,bind,editarFuncionario,novoFuncionario};', context);
    context.api.editarFuncionario('f1');
    context.api.bind({ render() {} });
    node('#func-form').values = { ...state.funcionarios.f1 };
    return {
        ...context.api, node, state, creates, writes, messages,
        async salvar() { await node('#func-form').events.submit({ preventDefault() {} }); },
        falharAcesso(value) { falharAcesso = value; },
        falharCadastro(value) { falharCadastro = value; }
    };
}

test('campos de acesso ficam no cadastro e senhas não entram no FormData do funcionário', () => {
    const a = ambiente();
    const html = a.view();
    assert.match(html, /Acesso pelo aplicativo/);
    for (const id of ['func-mobile-email', 'func-mobile-senha', 'func-mobile-confirmar']) {
        const input = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0];
        assert.ok(!/\sname=/.test(input));
    }
    a.novoFuncionario();
    assert.match(a.view(), /O vínculo é salvo ao clicar em Salvar Funcionário/);
    assert.ok(!a.view().match(/<input[^>]*id="func-mobile-email"[^>]*disabled/));
});
test('Salvar Funcionário mantém e-mail sem reter ou restaurar senha', async () => {
    const a = ambiente();
    a.node('#func-mobile-email').value = 'ana@example.com';
    a.node('#func-mobile-senha').value = 'Test-only-123!';
    a.node('#func-mobile-confirmar').value = 'Test-only-123!';
    await a.salvar();
    assert.equal(a.creates.length, 1);
    assert.equal(a.creates[0].fid, 'f1');
    assert.equal(a.creates[0].email, 'ana@example.com');
    assert.equal(a.creates[0].auth.currentUser.uid, 'owner');
    assert.ok(!a.view().includes('Test-only-123!'));
    assert.equal(a.state.funcionarios.f1.emailApp, 'ana@example.com');
    assert.equal(a.state.funcionarios.f1.appAuthUid, 'worker');
    assert.match(a.view(), /Senhas não podem ser recuperadas/);
    assert.match(a.view(), /id="func-mobile-senha" type="password"/);
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    assert.equal(a.node('#func-mobile-email').value, 'ana@example.com');
    assert.equal(a.node('#func-mobile-senha').value, '');
    assert.equal(a.node('#func-mobile-confirmar').value, '');
    await a.salvar();
    assert.equal(a.creates.length, 1, 'salvar sem senha não deve reautenticar nem recriar o vínculo');
});
test('confirmação divergente não cria login e não grava funcionário', async () => {
    const a = ambiente();
    a.node('#func-mobile-senha').value = 'Password-A1!';
    a.node('#func-mobile-confirmar').value = 'Password-B2!';
    await a.salvar();
    assert.equal(a.creates.length, 0);
    assert.equal(a.writes.length, 0);
    assert.match(a.messages.at(-1), /mesma senha/);
});
test('novo funcionário e acesso são criados no mesmo salvamento sem exigir reabrir', async () => {
    const a = ambiente();
    a.novoFuncionario();
    a.bind({ render() {} });
    a.node('#func-form').values = { ...a.state.funcionarios.f1, nome: 'Bia', cpf: '22233344455', matricula: '2' };
    a.node('#func-mobile-email').value = 'bia@example.com';
    a.node('#func-mobile-senha').value = a.node('#func-mobile-confirmar').value = 'Test-only-123!';
    await a.salvar();
    assert.equal(a.writes[0].id, 'new');
    assert.equal(a.creates[0].fid, 'new');
    assert.equal(a.state.funcionarios.new.emailApp, 'bia@example.com');
    a.editarFuncionario('new');
    assert.match(a.view(), /bia@example.com/);
});
test('salvar sem nova senha preserva o acesso e não tenta criar outro login', async () => {
    const a = ambiente();
    Object.assign(a.state.funcionarios.f1, { emailApp: 'ana@example.com', appAuthUid: 'worker' });
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    await a.salvar();
    assert.equal(a.creates.length, 0);
    assert.equal(a.writes[0].value.emailApp, 'ana@example.com');
    assert.equal(a.writes[0].value.appAuthUid, 'worker');
    assert.match(a.view(), /vínculo de acesso foi mantido sem guardar a senha/);
});

test('alterar cadastro não reativa acesso revogado; botão específico libera novamente', async () => {
    const a = ambiente();
    Object.assign(a.state.funcionarios.f1, { emailApp: 'ana@example.com', appAuthUid: 'worker' });
    a.state.mobileAcessos.worker = { funcionarioId: 'f1', email: 'ana@example.com', ativo: false };
    a.state.credenciaisApp.f1 = { email: 'ana@example.com', authUid: 'worker', senha: 'Persisted-123!' };
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    await a.salvar();
    assert.equal(a.creates.length, 0);
    assert.match(a.view(), /Salvar e liberar acesso novamente/);
    a.node('#func-mobile-senha').value = a.node('#func-mobile-confirmar').value = 'Current-123!';
    await a.node('#func-form').events.submit({ preventDefault() {}, submitter: { id: 'func-mobile-liberar' } });
    assert.equal(a.creates.length, 1);
});

test('cópia legada nunca preenche senha ao reabrir o cadastro', () => {
    const a = ambiente();
    Object.assign(a.state.funcionarios.f1, { emailApp: 'ana@example.com', appAuthUid: 'worker' });
    a.state.credenciaisApp.f1 = { email: 'ana@example.com', authUid: 'worker', senha: 'Persisted-123!' };
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    assert.equal(a.node('#func-mobile-senha').value, '');
    a.novoFuncionario();
    a.bind({ render() {} });
    assert.equal(a.node('#func-mobile-senha').value, '');
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    assert.equal(a.node('#func-mobile-senha').value, '');
});

test('cópia antiga de outro login não é exibida e senha antiga precisa ser informada uma vez', async () => {
    const a = ambiente();
    Object.assign(a.state.funcionarios.f1, { emailApp: 'ana@example.com', appAuthUid: 'worker' });
    a.state.credenciaisApp.f1 = { email: 'outro@example.com', authUid: 'other', senha: 'Other-123!' };
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    assert.equal(a.node('#func-mobile-senha').value, '');
    assert.match(a.view(), /Senhas não podem ser recuperadas/);
    a.node('#func-mobile-senha').value = a.node('#func-mobile-confirmar').value = 'Current-123!';
    await a.salvar();
    assert.equal(a.creates.length, 1);
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    assert.equal(a.node('#func-mobile-senha').value, '');
});
test('falha no acesso mantém formulário e permite repetir o mesmo funcionário sem duplicação', async () => {
    const a = ambiente();
    a.novoFuncionario();
    a.bind({ render() {} });
    a.node('#func-form').values = { ...a.state.funcionarios.f1, cpf: '22233344455', matricula: '2' };
    a.node('#func-mobile-email').value = 'bia@example.com';
    a.node('#func-mobile-senha').value = a.node('#func-mobile-confirmar').value = 'Test-only-123!';
    a.falharAcesso(true);
    await a.salvar();
    assert.match(a.view(), /cadastro foi salvo, mas o acesso ao aplicativo não foi confirmado/);
    a.falharAcesso(false);
    await a.salvar();
    assert.deepEqual(a.writes.map((item) => item.id), ['new', 'new']);
    assert.equal(a.state.funcionarios.new.emailApp, 'bia@example.com');
    assert.equal(a.creates[1].password, a.creates[0].password);
});
test('redesenhar formulário durante a digitação não apaga os campos de acesso', () => {
    const a = ambiente();
    for (const [id, value] of [['#func-mobile-email', 'ana@example.com'], ['#func-mobile-senha', 'Test-only-123!'], ['#func-mobile-confirmar', 'Test-only-123!']]) {
        a.node(id).value = value;
        a.node(id).events.input({ target: { value } });
    }
    a.node('#func-mobile-senha').value = '';
    a.bind({ render() {} });
    assert.equal(a.node('#func-mobile-email').value, 'ana@example.com');
    assert.equal(a.node('#func-mobile-senha').value, 'Test-only-123!');
    assert.equal(a.node('#func-mobile-confirmar').value, 'Test-only-123!');
});
test('não salva um email de login diferente sem configurar sua senha', async () => {
    const a = ambiente();
    Object.assign(a.state.funcionarios.f1, { emailApp: 'ana@example.com', appAuthUid: 'worker' });
    a.editarFuncionario('f1');
    a.bind({ render() {} });
    a.node('#func-mobile-email').value = 'outro@example.com';
    await a.salvar();
    assert.equal(a.writes.length, 0);
    assert.match(a.messages.at(-1), /preencha também a senha/);
});
test('falha ao salvar cadastro não cria conta nem informa sucesso', async () => {
    const a = ambiente();
    a.node('#func-mobile-email').value = 'ana@example.com';
    a.node('#func-mobile-senha').value = a.node('#func-mobile-confirmar').value = 'Test-only-123!';
    a.falharCadastro(true);
    await a.salvar();
    assert.equal(a.creates.length, 0);
    assert.match(a.view(), /Não foi possível salvar o cadastro/);
});
test('salvar funcionário preserva campos existentes e rejeita credenciais mesmo se injetadas no formulário', async () => {
    const a = ambiente();
    a.node('#func-form').values = {
        ...a.state.funcionarios.f1, senha: 'SECRET', password: 'SECRET', mobileEmail: 'ana@example.com'
    };
    await a.node('#func-form').events.submit({ preventDefault() {} });
    assert.equal(a.writes.length, 1);
    assert.equal(a.writes[0].value.preservado, true);
    assert.ok(!JSON.stringify(a.writes).includes('SECRET'));
    assert.equal(a.writes[0].value.mobileEmail, undefined);
});
test('coleção compartilhada une RFID e app sem colisão, sem alterar fontes e sem liberar edição manual', async () => {
    const file = path.join(root, 'core/registros-integrados.js');
    const source = fs.readFileSync(file, 'utf8').replace('./batidas.mjs', pathToFileURL(path.join(root, 'core/batidas.mjs')).href);
    const { registrosIntegrados } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const legacy = { '2026-10-20': { f1: { same: { timestamp: '2026-10-20T08:00:00', nome: 'Ana' } } } };
    const mobile = { f1: { same: { timestamp: Date.parse('2026-10-20T20:00:00Z'), authUid: 'worker', origem: 'android' } } };
    const before = JSON.stringify([legacy, mobile]);
    const merged = registrosIntegrados(legacy, mobile)['2026-10-20'].f1;
    assert.equal(Object.keys(merged).length, 2);
    assert.equal(merged.same.timestamp, '2026-10-20T11:00:00.000Z');
    assert.equal(merged.mobile_same.timestamp, '2026-10-20T20:00:00.000Z');
    assert.equal(merged.mobile_same.manual, false);
    assert.equal(JSON.stringify([legacy, mobile]), before);
});
