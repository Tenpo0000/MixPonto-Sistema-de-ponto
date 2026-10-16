import { empresasDisponiveis } from '../core/empresas.js';
import { $, $$, esc, dateKey, fmtData, parseKey, lista, porNome } from '../core/utils.js';
import { state } from '../core/state.js';
import { carregado, itens } from '../core/cadastros.js';
import { resumoPeriodo, datasPeriodo, formatoTempo } from '../core/calculos.js';
import { baixarExcel, imprimirTabela } from '../core/exportacoes.js';
import { abrirModal, toast } from '../core/ui.js';

const hoje = dateKey(new Date());
let params = { inicio: hoje.slice(0, 7) + '-01', fim: hoje, setor: '', incluirDesligados: false };
let selecionadas = new Set(['normais', 'extras', 'faltas', 'noturno']);
const COLUNAS = [
    {
        id: 'normais',
        nome: 'Horas Normais',
        descricao: 'Tempo dentro da carga prevista',
        rotulo: 'Horas normais',
        tempo: true
    },
    {
        id: 'extras',
        nome: 'Horas Extras',
        descricao: 'Excedente diário de jornada',
        rotulo: 'Horas excedentes',
        tempo: true
    },
    {
        id: 'faltas',
        nome: 'Faltas',
        descricao: 'Ausências sem abono',
        rotulo: 'Faltas',
        tempo: false
    },
    {
        id: 'carga',
        nome: 'Carga Horária',
        descricao: 'Jornada prevista no período',
        rotulo: 'Carga prevista',
        tempo: true
    },
    {
        id: 'noturno',
        nome: 'Adicional Noturno',
        descricao: 'Horas entre 22h e 5h; sem valor monetário',
        rotulo: 'Horas noturnas (22h–5h)',
        tempo: true
    },
    {
        id: 'saldo',
        nome: 'Banco de Horas',
        descricao: 'Saldo aritmético dos dias anteriores',
        rotulo: 'Saldo de horas até ontem',
        tempo: true
    },
    {
        id: 'atrasoMin',
        nome: 'Atrasos',
        descricao: 'Minutos após a entrada prevista',
        rotulo: 'Tempo de atraso',
        tempo: true
    },
    {
        id: 'dsr',
        nome: 'DSR',
        descricao: 'Indisponível: faltam regras de remuneração',
        rotulo: 'DSR',
        indisponivel: true
    },
    {
        id: 'interjornada',
        nome: 'Interjornada',
        descricao: 'Intervalos abaixo do parâmetro de 11h',
        rotulo: 'Intervalos entre jornadas <11h',
        tempo: false
    }
];

function pronto() {
    return carregado(
        'funcionarios',
        'registros',
        'ajustes',
        'feriados',
        'config',
        'horarios',
        'empresa',
        'empresas',
        'departamentos'
    );
}
const cols = () => COLUNAS.filter((c) => !c.indisponivel && selecionadas.has(c.id));

function texto() {
    return `Sua seleção inclui ${cols().length} colunas para o período de ${params.inicio ? fmtData(parseKey(params.inicio)) : '—'} a ${params.fim ? fmtData(parseKey(params.fim)) : '—'}.`;
}

export function view() {
    return `
        <div class="mov-page">
            <div class="breadcrumb">
                <span>Movimentações</span>
                <span>›</span>
                <span class="destacado">Relatório de cálculos</span>
            </div>
            <div class="cabecalho-pagina">
                <div>
                    <h1>Gerar Relatório de Cálculos</h1>
                    <p>Selecione os parâmetros e as colunas desejadas para exportação.</p>
                </div>
                <div class="botoes-acao">
                    <button class="btn btn-secundario" id="rel-excel">Gerar Excel</button>
                    <button class="btn btn-primario" id="rel-pdf">Gerar PDF</button>
                </div>
            </div>
            <form id="rel-form" novalidate>
                <div class="mov-rel-grid">
                    <section class="mov-card mov-periodo">
                        <h2>Período</h2>
                        <label class="cad-campo">
                            <span>Data Início</span>
                            <input type="date" name="inicio" value="${params.inicio}" />
                        </label>
                        <label class="cad-campo">
                            <span>Data Fim</span>
                            <input type="date" name="fim" value="${params.fim}" />
                        </label>
                        <label class="cad-campo">
                            <span>Unidade / Setor</span>
                            <select name="setor">
                                <option value="">Todos os Setores</option>
                                ${empresasDisponiveis()
                                    .map(
                                        (e) => `
                                            <option
                                                value="empresa:${esc(e.id)}"
                                                ${params.setor === 'empresa:' + e.id ? 'selected' : ''}
                                            >
                                                ${esc(e.nome)}
                                            </option>
                                        `
                                    )
                                    .join('')}${itens('departamentos')
                                    .map(
                                        (d) => `
                                            <option
                                                value="departamento:${esc(d.id)}"
                                                ${params.setor === 'departamento:' + d.id ? 'selected' : ''}
                                            >
                                                ${esc(d.nome)}
                                            </option>
                                        `
                                    )
                                    .join('')}
                            </select>
                        </label>
                        <label class="mov-check-simples">
                            <input
                                type="checkbox"
                                name="incluirDesligados"
                                ${params.incluirDesligados ? 'checked' : ''}
                            />
                            Incluir desligados
                        </label>
                    </section>
                    <section class="mov-card mov-colunas">
                        <header>
                            <h2>Colunas do Relatório</h2>
                            <button type="button" class="mov-link" id="rel-todas">
                                Selecionar Todas
                            </button>
                        </header>
                        <div class="mov-colunas-grid">
                            ${COLUNAS.map(
                                (c) => `
                                    <label
                                        class="mov-coluna ${c.indisponivel ? 'mov-indisponivel' : ''}"
                                    >
                                        <input
                                            type="checkbox"
                                            data-coluna="${c.id}"
                                            ${selecionadas.has(c.id) ? 'checked' : ''}
                                            ${c.indisponivel ? 'disabled' : ''}
                                        />
                                        <span>
                                            <strong>${c.nome}</strong>
                                            <small>${c.descricao}</small>
                                        </span>
                                    </label>
                                `
                            ).join('')}
                        </div>
                        <footer>
                            <p>As colunas serão exportadas na ordem acima.</p>
                            <button type="button" class="mov-link" id="rel-limpar">
                                Limpar Seleção
                            </button>
                        </footer>
                    </section>
                </div>
                <p class="erro" id="rel-erro" role="alert" tabindex="-1" hidden></p>
                <section class="mov-exportar">
                    <div>
                        <h2>${pronto() ? 'Pronto para exportar' : 'Carregando dados…'}</h2>
                        <p id="rel-resumo">${texto()}</p>
                    </div>
                    <div class="botoes-acao">
                        <button type="button" class="btn btn-secundario" id="rel-previa">
                            Visualizar Prévia
                        </button>
                        <button type="submit" class="btn btn-primario">
                            Gerar Relatório Agora
                        </button>
                    </div>
                </section>
            </form>
            <p class="mov-nota">
                Relatório de tempo, sem cálculo de remuneração. O saldo considera dias anteriores a
                hoje; justificativas com abono cobrem a jornada prevista sem adicionar horas
                trabalhadas. DSR depende de regras ainda não cadastradas.
            </p>
        </div>
    `;
}

function preparar() {
    if (!pronto()) throw Error('Aguarde o carregamento dos dados.');
    datasPeriodo(params.inicio, params.fim);
    const colunas = cols();
    if (!colunas.length) throw Error('Selecione pelo menos uma coluna.');
    const funcionarios = lista(state.funcionarios)
        .filter(
            (f) =>
                (params.incluirDesligados || f.status !== 'desligado') &&
                (!params.setor ||
                    (params.setor === 'empresa:padrao' && f.empresaId === 'padrao') ||
                    (params.setor.startsWith('departamento:') &&
                        (f.departamentoId === params.setor.slice(13) ||
                            (!f.departamentoId &&
                                f.departamento ===
                                    state.departamentos?.[params.setor.slice(13)]?.nome))))
        )
        .sort(porNome);
    if (!funcionarios.length)
        throw Error('Nenhum funcionário encontrado para os filtros selecionados.');
    const cabecalhos = ['Funcionário', 'Matrícula', 'CPF', ...colunas.map((c) => c.rotulo)];
    const linhas = funcionarios.map((f) => {
        const r = resumoPeriodo(f, params.inicio, params.fim);
        return [
            f.nome,
            f.matricula || '',
            f.cpf || '',
            ...colunas.map((c) => (c.tempo ? formatoTempo(r[c.id]) : r[c.id]))
        ];
    });
    return { cabecalhos, linhas };
}

function acao(tipo) {
    try {
        const { cabecalhos, linhas } = preparar();
        $('#rel-erro').hidden = true;
        const nota = `Período: ${fmtData(parseKey(params.inicio))} a ${fmtData(parseKey(params.fim))}. Tempos em HH:MM. Saldo até os dias anteriores a hoje. Sem valores de remuneração.`;
        if (tipo === 'excel')
            baixarExcel(`relatorio-${params.inicio}-${params.fim}.xlsx`, [
                ['Relatório de Cálculos'],
                [nota],
                cabecalhos,
                ...linhas
            ]);
        else if (tipo === 'pdf') imprimirTabela('Relatório de Cálculos', cabecalhos, linhas, nota);
        else
            abrirModal({
                titulo: 'Prévia do relatório',
                largo: true,
                corpo: `
                    <p class="dica">
                        ${esc(nota)} ${linhas.length} funcionários. Exibindo até 20; a exportação
                        inclui todos.
                    </p>
                    <div class="cad-tabela-wrap">
                        <table class="cad-tabela">
                            <thead>
                                <tr>
                                    ${cabecalhos
                                        .map(
                                            (c) => `
                                                <th>${esc(c)}</th>
                                            `
                                        )
                                        .join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${linhas
                                    .slice(0, 20)
                                    .map(
                                        (l) => `
                                            <tr>
                                                ${l
                                                    .map(
                                                        (v) => `
                                                            <td>${esc(v)}</td>
                                                        `
                                                    )
                                                    .join('')}
                                            </tr>
                                        `
                                    )
                                    .join('')}
                            </tbody>
                        </table>
                    </div>
                `
            });
    } catch (e) {
        const el = $('#rel-erro');
        el.hidden = false;
        el.textContent = e.message;
        el.focus();
    }
}

export function bind({ render }) {
    const form = $('#rel-form');
    const atualizar = (e) => {
        if (e.target.name in params)
            params[e.target.name] =
                e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        if (e.target.dataset.coluna) {
            if (e.target.checked) selecionadas.add(e.target.dataset.coluna);
            else selecionadas.delete(e.target.dataset.coluna);
        }
        $('#rel-resumo').textContent = texto();
    };
    form.addEventListener('input', atualizar);
    form.addEventListener('change', atualizar);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        acao('excel');
    });
    $('#rel-todas').addEventListener('click', () => {
        selecionadas = new Set(COLUNAS.filter((c) => !c.indisponivel).map((c) => c.id));
        render();
    });
    $('#rel-limpar').addEventListener('click', () => {
        selecionadas.clear();
        render();
    });
    $('#rel-excel').addEventListener('click', () => acao('excel'));
    $('#rel-pdf').addEventListener('click', () => acao('pdf'));
    $('#rel-previa').addEventListener('click', () => acao('previa'));
}
