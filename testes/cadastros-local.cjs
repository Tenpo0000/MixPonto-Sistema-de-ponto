const test = require('node:test'),
    assert = require('node:assert/strict'),
    vm = require('node:vm'),
    fs = require('node:fs'),
    path = require('node:path');
const root = path.join(__dirname, '../src');
function carregar(context, arquivo) {
    let s = fs
        .readFileSync(path.join(root, arquivo), 'utf8')
        .replace(/^import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?/gm, '')
        .replace(/export /g, '');
    vm.runInContext(s, context);
}
function ambiente(pagina, seed = {}) {
    const state = {
            empresa: {},
            empresas: {},
            funcionarios: {},
            feriados: {},
            horarios: {},
            ...seed
        },
        writes = [],
        eventos = {},
        nodes = [];
    let html = '',
        api;
    const set = async (p, v) => {
        writes.push([p, JSON.parse(JSON.stringify(v))]);
        const ks = p.split('/');
        if (ks.length === 1) state[p] = v;
        else {
            state[ks[0]] ||= {};
            if (v === null) delete state[ks[0]][ks[1]];
            else state[ks[0]][ks[1]] = v;
        }
    };
    const c = vm.createContext({
        state,
        console,
        location: { hash: '#' + pagina },
        window: { addEventListener: (e, f) => (eventos[e] = f) },
        db: {
            set,
            remove: (p) => set(p, null),
            novoId: () => '-novo',
            update: async (m) => {
                for (const [p, v] of Object.entries(m)) await set(p, v);
            }
        },
        toast() {},
        confirm: () => true,
        ICONES: {},
        carregado: () => true,
        novoId: () => '-novo',
        gravar: set,
        esc: (v) => String(v ?? '').replace(/</g, '&lt;'),
        cabecalho: (g, t, d, a) => `
            <h1>${t}</h1>
            <p>${d}</p>
            ${a}
        `,
        semDados: (v) => `
            <p>${v}</p>
        `,
        aguarde: () => '',
        campo: (nome, rotulo, valor = '', opts = '') => `
            <label>
                ${rotulo}
                <input name="${nome}" value="${valor}" ${opts} />
            </label>
        `,
        itens: (n) => Object.entries(state[n] || {}).map(([id, v]) => ({ id, ...v })),
        chave: (s) => String(s).toLowerCase(),
        funcionariosAtivos: () => [],
        diaUtil: () => true,
        fmtData: (d) => d.toISOString().slice(0, 10),
        parseKey: (s) => new Date(s + 'T12:00:00Z'),
        dateKey: (d) => d.toISOString().slice(0, 10),
        $: (s) =>
            s === '#view'
                ? { scrollTop: 0 }
                : nodes.find((n) =>
                      s.startsWith('#')
                          ? n.id === s.slice(1)
                          : s.startsWith('[name=')
                            ? n.name === s.slice(6, -1)
                            : false
                  ) || null,
        $$: (s) => (s.startsWith('[data-') ? nodes.filter((n) => s.slice(1, -1) in n.attrs) : [])
    });
    carregar(c, 'core/jornada.js');
    carregar(c, 'core/empresas.js');
    carregar(c, 'core/feriados-nacionais.js');
    carregar(c, `pages/${pagina}.js`);
    api = vm.runInContext('({view,bind})', c);
    function render() {
        html = api.view();
        nodes.length = 0;
        for (const tag of html.matchAll(/<[^/!][^>]*>/g)) {
            const attrs = {};
            for (const a of tag[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
            const n = {
                attrs,
                id: attrs.id,
                name: attrs.name,
                value: attrs.value || '',
                dataset: {},
                events: {},
                focus() {},
                removeAttribute() {},
                setAttribute() {},
                addEventListener(t, f) {
                    this.events[t] = f;
                }
            };
            for (const [k, v] of Object.entries(attrs))
                if (k.startsWith('data-'))
                    n.dataset[k.slice(5).replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = v;
            nodes.push(n);
        }
        api.bind({ render });
    }
    render();
    return {
        state,
        writes,
        c,
        render,
        html: () => html,
        get: (s) => c.$(s),
        async click(s) {
            assert(c.$(s), s);
            await c.$(s).events.click({});
        },
        all: (s) => c.$$(s)
    };
}
test('empresas preserva cadastro antigo, abre lista, cria empresa e retorna à lista', async () => {
    const a = ambiente('empresa', { empresa: { nome: 'Legada', documento: '111.111.111-11' } });
    assert.match(a.html(), /Legada/);
    assert(!a.get('#emp-form'));
    await a.click('#emp-nova');
    assert(a.get('#emp-form'));
    const dados = {
        nome: 'Unidade nova',
        documento: '22222222222',
        cep: '44000000',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Feira de Santana',
        uf: 'BA',
        responsavel: 'Maria',
        cargo: 'Gestora',
        email: 'maria@example.com'
    };
    for (const [name, value] of Object.entries(dados))
        a.get('#emp-form').events.input({ target: { name, value, removeAttribute() {} } });
    await a.get('#emp-form').events.submit({ preventDefault() {} });
    assert.equal(a.state.empresas['-novo'].nome, 'Unidade nova');
    assert.equal(a.state.empresa.nome, 'Legada');
    assert(!a.get('#emp-form'));
    assert.match(a.html(), /Unidade nova/);
    const antigo = a.all('[data-emp-editar]').find((n) => n.dataset.empEditar === 'padrao');
    await antigo.events.click({});
    assert(a.get('#emp-form'));
    await a.click('#emp-cancelar');
    assert(!a.get('#emp-form'));
});
test('empresa vinculada não pode ser excluída', async () => {
    const a = ambiente('empresa', {
        empresas: { e: { nome: 'Empresa' } },
        funcionarios: { f: { empresaId: 'e' } }
    });
    await a.all('[data-emp-excluir]')[0].events.click({});
    assert.equal(a.writes.length, 0);
});
test('horário abre lista; novo começa semanal, permite carga e retorna depois de salvar', async () => {
    const a = ambiente('horario');
    assert(!a.get('#hor-nome'));
    await a.click('#hor-novo');
    assert(a.get('#hor-tab-semanal'));
    a.get('#hor-nome').events.input({ target: { value: 'Jornada nova' } });
    const carga = a.all('[data-modo]').find((n) => n.dataset.modo === 'carga');
    await carga.events.click({});
    assert(a.get('#hor-carga'));
    await a.click('#hor-salvar');
    assert.equal(a.state.horarios['-novo'].modo, 'carga');
    assert.equal(a.state.horarios['-novo'].nome, 'Jornada nova');
    assert(!a.get('#hor-nome'));
    assert.match(a.html(), /Jornada nova/);
    await a.all('[data-hor-editar]')[0].events.click({});
    assert(a.get('#hor-carga'));
    await a.click('#hor-cancelar');
    assert(!a.get('#hor-nome'));
});
test('horário vinculado a funcionário desligado também não pode ser excluído', async () => {
    const a = ambiente('horario', {
        horarios: { h: { nome: 'Jornada' } },
        funcionarios: { f: { horarioId: 'h', status: 'desligado' } }
    });
    await a.all('[data-hor-excluir]')[0].events.click({});
    assert.equal(a.writes.length, 0);
});
test('formulário soma 36 horas quando sexta-feira tem apenas 08h–12h e salva', async () => {
    const a = ambiente('horario');
    await a.click('#hor-novo');
    a.get('#hor-nome').events.input({ target: { value: 'Jornada parcial' } });
    for (const chave of ['4,2', '4,3']) {
        const input = a.all('[data-hora]').find((n) => n.dataset.hora === chave);
        input.value = '';
        input.events.input();
    }
    assert.equal(a.get('#hor-semana').textContent, '36:00');
    await a.click('#hor-salvar');
    assert.equal(a.state.horarios['-novo'].dias[4].horarios[2], '');
    assert.equal(a.state.horarios['-novo'].dias[4].horarios[3], '');
});
test('importação nacional valida ano e calcula Paixão para 2026 e 2027', () => {
    const c = vm.createContext({});
    carregar(c, 'core/feriados-nacionais.js');
    assert.equal(vm.runInContext('feriadosNacionais(2026).length', c), 9);
    assert.equal(
        vm.runInContext(
            "feriadosNacionais(2026,true).find(f=>f.origem==='religioso-local').data",
            c
        ),
        '2026-04-03'
    );
    assert.equal(
        vm.runInContext(
            "feriadosNacionais(2027,true).find(f=>f.origem==='religioso-local').data",
            c
        ),
        '2027-03-26'
    );
    assert.throws(() => vm.runInContext('feriadosNacionais(2023)', c), /2024/);
    assert.equal(
        vm.runInContext('feriadosNacionais(2026).some(f=>/Carnaval|Corpus/.test(f.descricao))', c),
        false
    );
});
test('importação preserva cadastro manual, evita repetição e não sobrescreve importação editada', () => {
    const c = vm.createContext({});
    carregar(c, 'core/feriados-nacionais.js');
    assert.equal(
        vm.runInContext(
            "planejarImportacao(2026,false,{manual:{data:'2026-01-01',empresaId:''}}).filter(f=>!f.existente).length",
            c
        ),
        8
    );
    assert.equal(
        vm.runInContext(
            "planejarImportacao(2026,false,{'nacional_2026-01-01':{data:'2026-01-02',descricao:'Editado'}}).filter(f=>!f.existente).length",
            c
        ),
        8
    );
    assert.equal(
        vm.runInContext(
            "planejarImportacao(2026,false,{local:{data:'2026-01-01',empresaId:'e1'}}).filter(f=>!f.existente).length",
            c
        ),
        9
    );
    assert.equal(
        vm.runInContext(
            'planejarImportacao(2026,false,Object.fromEntries(feriadosNacionais(2026).map(f=>[f.data,f]))).filter(f=>!f.existente).length',
            c
        ),
        0
    );
});
test('tela de feriados apresenta prévia e importa sem substituir o registro manual', async () => {
    const a = ambiente('feriado', {
        feriados: {
            manual: { data: '2026-01-01', descricao: 'Descrição personalizada', empresaId: '' }
        }
    });
    assert(!a.get('#fer-import-form'));
    await a.click('#fer-importar');
    assert(a.get('#fer-import-form'));
    a.get('[name=ano]').events.change({ target: { value: '2026' } });
    assert.match(a.html(), /Importar 8 feriados/);
    await a.get('#fer-import-form').events.submit({ preventDefault() {} });
    assert.equal(Object.keys(a.state.feriados).length, 9);
    assert.equal(a.state.feriados.manual.descricao, 'Descrição personalizada');
    const gravacoes = a.writes.length;
    await a.click('#fer-importar');
    assert.match(a.html(), /Importar 0 feriados/);
    await a.get('#fer-import-form').events.submit({ preventDefault() {} });
    assert.equal(a.writes.length, gravacoes);
});
