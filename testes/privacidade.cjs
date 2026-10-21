const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../src');

test('políticas são preliminares, identificam campos ausentes e preservam direitos obrigatórios', () => {
    const policy = JSON.parse(fs.readFileSync(path.join(root, 'legal/politicas.json'), 'utf8'));
    assert.equal(policy.estado, 'preliminar');
    assert.equal(policy.responsavel.nome, '');
    assert.equal(policy.responsavel.emailPrivacidade, '');
    for (const id of ['privacidade', 'termos', 'cookies', 'reembolso', 'direitos', 'acessibilidade', 'licencas'])
        assert.ok(policy.documentos.some(d => d.id === id));
    assert.match(JSON.stringify(policy), /art\. 49/);
    assert.match(JSON.stringify(policy), /não.*certificação/);
});

test('não instala tracking, fonte externa ou armazenamento de senha no cadastro', () => {
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'style.css'), 'utf8'), /fonts\.googleapis/);
    const access = fs.readFileSync(path.join(root, 'core/mobile-access.js'), 'utf8');
    assert.doesNotMatch(access, /credenciaisApp|senha:\s*credentials/);
    const employee = fs.readFileSync(path.join(root, 'pages/funcionario.js'), 'utf8');
    assert.doesNotMatch(employee, /state\.credenciaisApp|credencialSalva/);
    const notice = fs.readFileSync(path.join(root, 'legal/privacidade.js'), 'utf8');
    assert.doesNotMatch(notice, /createElement\(['"]script|gtag\(|fbq\(/);
});

test('fotos aceitam somente dados raster locais, nunca URLs externas ou SVG', () => {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'core/imagens.js'), 'utf8').replace('export ', '') + '\nthis.safe=fotoLocal;', context);
    assert.equal(context.safe('https://example.com/pixel.png'), '');
    assert.equal(context.safe('data:image/svg+xml;base64,PHN2Zz4='), '');
    assert.equal(context.safe('data:image/jpeg;base64,YWJj'), 'data:image/jpeg;base64,YWJj');
    assert.equal(context.safe('data:image/png;base64,' + 'x'.repeat(2_000_000)), '');
});

function luminance(hex) {
    const v = hex.match(/[a-f0-9]{2}/gi).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
}
test('cores de texto e botões principais novos têm contraste mínimo de 4.5 para 1', () => {
    for (const [fg, bg] of [['263650', 'ffffff'], ['52647c', 'ffffff'], ['52647c', 'f4f7fb'], ['ffffff', '1658bb'], ['064eb2', 'ffffff'], ['5b4100', 'fff9e8'], ['ffffff', '2458d3']]) {
        const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
        assert.ok((a + .05) / (b + .05) >= 4.5, `${fg}/${bg}`);
    }
});

test('sobreposição contém Tab, fecha com Escape e restaura foco e inert anteriores', () => {
    const handlers = {};
    const doc = { activeElement: null, body: { children: [] }, addEventListener(key, fn) { handlers[key] = fn; }, removeEventListener(key) { delete handlers[key]; } };
    const original = { isConnected: true, closest: () => null, focus() { doc.activeElement = this; } };
    doc.activeElement = original;
    const buttons = [0, 1].map(() => ({ closest: () => null, getClientRects: () => [{}], focus() { doc.activeElement = this; } }));
    const background = { inert: false, contains: () => false };
    const container = { isConnected: true, getAttribute: () => null, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => buttons, contains: el => buttons.includes(el) };
    doc.body.children = [background, container];
    const context = vm.createContext({ document: doc, queueMicrotask: fn => fn() });
    vm.runInContext(fs.readFileSync(path.join(root, 'core/foco.js'), 'utf8').replace('export ', '') + '\nthis.trap=conterFoco;', context);
    let closed = 0;
    const dispose = context.trap(container, () => closed++);
    assert.equal(background.inert, true);
    assert.equal(doc.activeElement, buttons[0]);
    buttons[1].focus(); handlers.keydown({ key: 'Tab', preventDefault() {} });
    assert.equal(doc.activeElement, buttons[0]);
    handlers.keydown({ key: 'Tab', shiftKey: true, preventDefault() {} });
    assert.equal(doc.activeElement, buttons[1]);
    handlers.focusin({ target: original });
    assert.equal(doc.activeElement, buttons[0], 'foco externo é recuperado sem depender de inert');
    handlers.keydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    assert.equal(closed, 1);
    dispose(); assert.equal(background.inert, false); assert.equal(doc.activeElement, original);
    dispose(); assert.equal(doc.activeElement, original, 'limpeza duplicada não interfere no foco');
});

test('fechar uma sobreposição antes da microtarefa não rouba o foco depois', () => {
    const queued = [];
    let focused = 0;
    const doc = { activeElement: null, body: { children: [] }, addEventListener() {}, removeEventListener() {} };
    const container = { isConnected: true, getAttribute: () => null, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], focus() { focused++; } };
    doc.body.children = [container];
    const context = vm.createContext({ document: doc, queueMicrotask: fn => queued.push(fn) });
    vm.runInContext(fs.readFileSync(path.join(root, 'core/foco.js'), 'utf8').replace('export ', '') + '\nthis.trap=conterFoco;', context);
    context.trap(container, () => {})();
    queued.forEach(fn => fn());
    assert.equal(focused, 0);
});

function estadoPedidos() {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'legal/pedido-estado.js'), 'utf8').replace('export ', '') + '\nthis.create=criarEstadoPedidos;', context);
    let count = 0;
    return context.create(() => `pedido-${++count}`);
}

test('repetição mantém protocolo, edição cria outro e confirmação antiga não apaga tentativa nova', () => {
    const state = estadoPedidos();
    const data = { uid: 'user-a', conta: 'conta-a', tipo: 'acesso', detalhes: 'Dados necessários' };
    const first = state.tentar(data);
    assert.equal(state.tentar({ ...data }), first);
    const edited = state.tentar({ ...data, detalhes: 'Texto corrigido' });
    assert.notEqual(edited.id, first.id);
    state.confirmar(first);
    assert.equal(state.tentar({ ...data, detalhes: 'Texto corrigido' }), edited);
    state.confirmar(edited);
    assert.notEqual(state.tentar(data).id, first.id);
});

test('mudança de sessão invalida tentativas e consultas antigas', () => {
    const state = estadoPedidos();
    const data = { uid: 'user-a', conta: 'conta-a' };
    const first = state.tentar(data);
    const revision = state.sessao();
    const query = state.iniciarConsulta();
    state.mudarSessao();
    assert.notEqual(state.sessao(), revision);
    assert.equal(state.consultaAtual(query), false);
    assert.notEqual(state.tentar(data), first);
    const newer = state.iniciarConsulta();
    assert.equal(state.consultaAtual(newer), true);
    state.iniciarConsulta();
    assert.equal(state.consultaAtual(newer), false);
});

async function iniciarCanal({ get, descobrir = async () => ({ contas: [] }), persistir = async () => {} } = {}) {
    const criar = tag => ({ tag, children: [], value: '', disabled: false, textContent: '', addEventListener() {},
        append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, focus() {} });
    const nodes = Object.fromEntries(['pedido', 'resultado', 'pedidos', 'enviar', 'consultar', 'modelo', 'sessao'].map(id => [id, criar(id)]));
    nodes.pedido.elements = { conta: criar('input'), tipo: criar('select'), detalhes: criar('textarea') };
    nodes.pedido.elements.conta.value = '1'; nodes.pedido.elements.tipo.value = 'acesso';
    const reads = [], writes = [];
    const fb = { db: {}, auth: { currentUser: { uid: 'titular-a' } }, ref: (_, path) => path,
        get: async path => { reads.push(path); return { val: () => path.startsWith('contasPorId/') ? { contaId: 'conta-a' } : {}, exists: () => false, ...await get?.(path) }; },
        set: async (path, value) => { writes.push({ path, value }); },
        update: async (path, value) => { writes.push({ path, value }); },
        setPersistence: persistir, onAuthStateChanged(_, callback) { this.authChanged = callback; callback(this.auth.currentUser); },
    };
    const context = vm.createContext({ window: { fb }, document: { getElementById: id => nodes[id], createElement: criar },
        localStorage: { getItem: () => null }, serverTimestamp: () => ({ '.sv': 'timestamp' }),
        contasDisponiveis: descobrir, criarEstadoPedidos: estadoPedidos });
    const source = fs.readFileSync(path.join(root, 'legal/direitos.js'), 'utf8').replace(/^import .*;\r?\n/gm, '');
    await vm.runInContext(`(async () => {${source}\n})()`, context);
    return { nodes, fb, reads, writes };
}

test('falha na API mantém consulta pessoal estritamente no caminho do UID autenticado', async () => {
    const channel = await iniciarCanal({ descobrir: async () => { throw Error('API indisponível'); }, get: path =>
        path.endsWith('/privacidade/titular-a') ? { val: () => ({ protocolo: { tipo: 'acesso', status: 'recebida', criadoEm: 1 } }) } : {} });
    await channel.nodes.consultar.onclick();
    assert.deepEqual(channel.reads, ['contasPorId/1', 'contas/conta-a/privacidade/titular-a']);
    assert.equal(channel.nodes.pedidos.children.length, 1);
    assert.match(channel.nodes.resultado.textContent, /própria identidade/);
});

test('troca de identidade durante leitura impede gravação e mensagem de outro titular', async () => {
    let release;
    const delayed = new Promise(resolve => { release = resolve; });
    const channel = await iniciarCanal({ get: path => path.startsWith('contasPorId/') ? delayed : {} });
    channel.nodes.pedido.elements.detalhes.value = 'Contexto privado do titular A';
    const submit = channel.nodes.pedido.onsubmit({ preventDefault() {} });
    channel.fb.auth.currentUser = { uid: 'titular-b' };
    channel.fb.authChanged(channel.fb.auth.currentUser);
    release({}); await submit;
    assert.equal(channel.writes.length, 0);
    assert.equal(channel.nodes.resultado.textContent, '');
    assert.equal(channel.nodes.pedido.elements.detalhes.value, '');
});

test('resposta administrativa aparece apenas em pedido recebido e verifica sessão novamente', async () => {
    const channel = await iniciarCanal({ descobrir: async () => [{ id: 'conta-a', permissao: 'administrador' }], get: path =>
        path.endsWith('/privacidade') ? { val: () => ({ requerente: {
            aberto: { tipo: 'correcao', status: 'recebida', criadoEm: 1 },
            encerrado: { tipo: 'acesso', status: 'respondida', resposta: 'Concluído', criadoEm: 1 },
        } }) } : {} });
    await channel.nodes.consultar.onclick();
    const [open, closed] = channel.nodes.pedidos.children;
    assert.equal(closed.children.filter(node => node.tag === 'button').length, 0);
    const input = open.children.find(node => node.tag === 'label').children[0];
    const button = open.children.find(node => node.tag === 'button');
    input.value = 'Resposta fundamentada';
    channel.fb.auth.currentUser = { uid: 'titular-b' };
    channel.fb.authChanged(channel.fb.auth.currentUser);
    await button.onclick();
    assert.equal(channel.writes.length, 0);
});

test('persistência negada não impede observar a sessão e habilitar o canal', async () => {
    const channel = await iniciarCanal({ persistir: async () => { throw Error('Armazenamento bloqueado'); } });
    assert.equal(channel.nodes.enviar.disabled, false);
    assert.equal(typeof channel.fb.authChanged, 'function');
});

test('protocolo existente com conteúdo diferente nunca é confirmado como pedido enviado', async () => {
    const channel = await iniciarCanal({ get: path => path.startsWith('contasPorId/') ? {} : {
        exists: () => true, val: () => ({ tipo: 'correcao', detalhes: 'outro conteúdo' })
    } });
    channel.nodes.pedido.elements.detalhes.value = 'Meu pedido';
    await channel.nodes.pedido.onsubmit({ preventDefault() {} });
    assert.equal(channel.writes.length, 0);
    assert.match(channel.nodes.resultado.textContent, /Não foi possível confirmar/);
    assert.equal(channel.nodes.pedido.elements.detalhes.value, 'Meu pedido');
});
