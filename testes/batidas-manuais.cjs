const test = require('node:test'),
    assert = require('node:assert/strict'),
    vm = require('node:vm'),
    fs = require('node:fs'),
    path = require('node:path');
const root = path.join(__dirname, '../src');
function modulo(c, file, names) {
    const s = fs
        .readFileSync(path.join(root, file), 'utf8')
        .replace(/^import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?/gm, '')
        .replace(/export /g, '');
    return vm.runInContext(`(()=>{${s}\nreturn {${names.join(',')}};})()`, c);
}
function contexto() {
    const writes = [],
        nodes = new Map(),
        errors = [];
    let modal,
        pedeConfirmacao = 0,
        confirmar = true,
        fechado = 0,
        renders = 0,
        falhar = false;
    const c = vm.createContext({
        console,
        Date,
        Object,
        Array,
        Set,
        Math,
        Number,
        String,
        dateKey: (d) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        parseKey: (k) => new Date(k + 'T12:00:00'),
        pad: (n) => String(n).padStart(2, '0'),
        lista: (o) => Object.entries(o || {}).map(([id, v]) => ({ id, ...v })),
        porNome: (a, b) => a.nome.localeCompare(b.nome),
        esc: (s) => String(s ?? ''),
        fmtData: (d) => d.toISOString().slice(0, 10),
        fmtHora: (ts) => new Date(ts).toTimeString().slice(0, 5),
        fmtMin: (n) => String(n),
        MESES: Array(12).fill('Mês'),
        DIAS: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        carregado: () => true,
        location: { hash: '#movimentacoes' },
        itens: (n) => Object.entries(c.state[n] || {}).map(([id, v]) => ({ id, ...v })),
        bindIr() {},
        vazio: () => '',
        vazioInicialBotoes: '',
        toast: (m) => errors.push(m),
        erroForm: (f, m) => errors.push(m),
        confirm: () => {
            pedeConfirmacao++;
            return confirmar;
        },
        FormData: class {
            constructor(f) {
                return Object.entries(f.values || {})[Symbol.iterator]();
            }
        },
        $: (s) => {
            if (!nodes.has(s))
                nodes.set(s, {
                    events: {},
                    dataset: {},
                    addEventListener(e, fn) {
                        this.events[e] = fn;
                    },
                    insertAdjacentHTML() {}
                });
            return nodes.get(s);
        },
        $$: () => [],
        document: { getElementById: () => ({}) },
        abrirModal: (o) => {
            modal = o;
            o.aoAbrir?.({});
        },
        fecharModal: () => {
            fechado++;
        },
        executar: async (f, acao) => {
            try {
                await acao();
                return true;
            } catch (e) {
                errors.push(e.message);
                return false;
            }
        },
        db: {
            update: async (m) => {
                if (falhar) throw Error('Sem rede');
                writes.push(JSON.parse(JSON.stringify(m)));
                for (const [p, v] of Object.entries(m)) {
                    const ks = p.split('/');
                    let o = c.state;
                    for (const k of ks.slice(0, -1)) o = o[k] ||= {};
                    if (v === null) delete o[ks.at(-1)];
                    else o[ks.at(-1)] = v;
                }
            }
        }
    });
    Object.assign(c, modulo(c, 'core/jornada.js', ['totalJornada', 'inicioJornada', 'fimJornada']));
    Object.assign(c, modulo(c, 'core/controle-ponto.js', ['inicioControle', 'erroDataPonto']));
    Object.assign(
        c,
        modulo(c, 'core/state.js', [
            'state',
            'cfg',
            'funcionariosAtivos',
            'batidas',
            'analisarDia',
            'resumoMes',
            'sequencia',
            'cargaPrevista',
            'horarioDoDia'
        ])
    );
    Object.assign(
        c,
        modulo(c, 'core/calculos.js', ['resumoPeriodo', 'datasPeriodo', 'formatoTempo'])
    );
    Object.assign(
        c,
        modulo(c, 'core/batidas-manuais.js', [
            'obterManual',
            'editarBatidaManual',
            'excluirBatidaManual'
        ])
    );
    c.state.funcionarios.f = {
        nome: 'Maria',
        status: 'ativo',
        admissao: '2026-10-01',
        dataInicioPonto: '2026-10-01'
    };
    const manual = (hora) => ({
        timestamp: new Date('2026-10-16T' + hora + ':00').toISOString(),
        nome: 'Maria',
        manual: true,
        motivo: 'Inclusão inicial'
    });
    c.state.registros['2026-10-16'] = { f: { m1: manual('08:00'), m2: manual('12:00') } };
    c.state.ajustes['2026-10-16'] = { f: { tipo: 'Justificativa preservada' } };
    const api = modulo(c, 'pages/movimentacoes.js', [
        'mov',
        'view',
        'editarManual',
        'excluirManual',
        'gerenciarManuais'
    ]);
    api.mov.uid = 'f';
    api.mov.inicio = '2026-10-16';
    api.mov.fim = '2026-10-16';
    return {
        c,
        api,
        writes,
        nodes,
        errors,
        modal: () => modal,
        confirmacoes: () => pedeConfirmacao,
        fechados: () => fechado,
        renders: () => renders,
        render: () => {
            renders++;
        },
        confirmar: (v) => {
            confirmar = v;
        },
        falhar: () => {
            falhar = true;
        },
        manual
    };
}
test('edição atualiza só a batida manual e recalcula o total do dia', async () => {
    const a = contexto(),
        antes = JSON.stringify(a.c.state.ajustes),
        f = { id: 'f', ...a.c.state.funcionarios.f };
    assert.equal(a.c.analisarDia(f, '2026-10-16').total, 240);
    await a.c.editarBatidaManual(
        'f',
        '2026-10-16',
        'm2',
        '2026-10-16',
        '13:00',
        'Horário corrigido'
    );
    assert.equal(a.c.analisarDia(f, '2026-10-16').total, 300);
    assert.equal(a.c.state.registros['2026-10-16'].f.m2.motivo, 'Horário corrigido');
    assert.equal(Object.keys(a.writes[0]).length, 1);
    assert.equal(JSON.stringify(a.c.state.ajustes), antes);
    assert(a.c.state.registros['2026-10-16'].f.m1);
});
test('alterar a data move a mesma batida em um único lote', async () => {
    const a = contexto();
    await a.c.editarBatidaManual('f', '2026-10-16', 'm1', '2026-10-17', '08:30', 'Data corrigida');
    assert.equal(a.writes.length, 1);
    assert.equal(a.writes[0]['registros/2026-10-16/f/m1'], null);
    assert(a.writes[0]['registros/2026-10-17/f/m1']);
    assert(a.c.state.registros['2026-10-16'].f.m2);
});
test('rejeita horário próximo, data bloqueada, motivo vazio e alteração de RFID', async () => {
    const a = contexto();
    await assert.rejects(
        a.c.editarBatidaManual('f', '2026-10-16', 'm2', '2026-10-16', '08:03', 'Teste'),
        /5 minutos/
    );
    await assert.rejects(
        a.c.editarBatidaManual('f', '2026-10-16', 'm2', '2026-09-30', '13:00', 'Teste'),
        /antes da admissão/
    );
    await assert.rejects(
        a.c.editarBatidaManual('f', '2026-10-16', 'm2', '2026-10-16', '13:00', ''),
        /motivo/
    );
    a.c.state.registros['2026-10-16'].f.rfid = { ...a.manual('17:00'), manual: false };
    await assert.rejects(
        a.c.editarBatidaManual('f', '2026-10-16', 'rfid', '2026-10-16', '18:00', 'Teste'),
        /Somente inclusões/
    );
    await assert.rejects(a.c.excluirBatidaManual('f', '2026-10-16', 'rfid'), /Somente inclusões/);
    assert.equal(a.writes.length, 0);
});
test('exclusão remove apenas uma batida e preserva as demais e as justificativas', async () => {
    const a = contexto();
    a.c.state.registros['2026-10-16'].f.rfid = { ...a.manual('17:00'), manual: false };
    await a.c.excluirBatidaManual('f', '2026-10-16', 'm1');
    assert.deepEqual(a.writes[0], { 'registros/2026-10-16/f/m1': null });
    assert(a.c.state.registros['2026-10-16'].f.m2);
    assert(a.c.state.registros['2026-10-16'].f.rfid);
    assert(a.c.state.ajustes['2026-10-16'].f);
    await assert.rejects(a.c.excluirBatidaManual('f', '2026-10-16', 'm1'), /não está mais/);
});
test('ações aparecem por batida manual e a lista permite acessar a quinta batida', () => {
    const a = contexto();
    a.c.state.registros['2026-10-16'].f = {};
    for (let i = 0; i < 5; i++)
        a.c.state.registros['2026-10-16'].f['m' + i] = a.manual(
            `${String(8 + i).padStart(2, '0')}:00`
        );
    const html = a.api.view();
    assert.match(html, /data-editar-manual="m0"/);
    assert.match(html, /data-excluir-manual="m0"/);
    assert.match(html, /data-gerenciar-manuais/);
    a.api.gerenciarManuais('f', '2026-10-16', a.render);
    assert.match(a.modal().corpo, /data-editar-manual="m4"/);
    assert.match(a.modal().corpo, /data-excluir-manual="m4"/);
});
test('modal salva correção e mantém aberto quando o horário é inválido', async () => {
    const a = contexto();
    a.api.editarManual('f', '2026-10-16', 'm2', a.render);
    assert.match(a.modal().corpo, /Editar|Horário/);
    a.nodes.get('form').values = { data: '2026-10-16', hora: '08:01', motivo: 'Teste' };
    await a.nodes.get('[data-gravar]').events.click();
    assert.equal(a.fechados(), 0);
    assert.equal(a.writes.length, 0);
    a.nodes.get('form').values.hora = '13:00';
    await a.nodes.get('[data-gravar]').events.click();
    assert.equal(a.fechados(), 1);
    assert.equal(a.renders(), 1);
});
test('exclusão pede confirmação; cancelar não grava e falha de rede não remove', async () => {
    const a = contexto();
    a.confirmar(false);
    await a.api.excluirManual('f', '2026-10-16', 'm1', a.render);
    assert.equal(a.confirmacoes(), 1);
    assert.equal(a.writes.length, 0);
    a.confirmar(true);
    a.falhar();
    await a.api.excluirManual('f', '2026-10-16', 'm1', a.render);
    assert(a.c.state.registros['2026-10-16'].f.m1);
    assert.equal(a.fechados(), 0);
    assert.match(a.errors.at(-1), /Sem rede/);
});
