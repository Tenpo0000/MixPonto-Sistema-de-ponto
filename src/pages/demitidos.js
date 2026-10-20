import { $, $$, esc, dateKey, fmtData, parseKey, iniciais, corAvatar } from '../core/utils.js';
import { state, funcionariosAtivos } from '../core/state.js';
import {
    listaDesligamentos,
    validarDesligamento,
    desligar,
    reativar
} from '../core/desligamentos.js';
import { carregado, campo, opcoes, executar, erroForm, exportarCSV } from '../core/cadastros.js';
import { abrirModal, fecharModal, toast } from '../core/ui.js';

let pagina = 0,
    rascunho = { admissao: '', demissao: '', status: '' },
    filtros = { ...rascunho },
    ocupado = false;
const data = (v) => (v ? fmtData(parseKey(v)) : 'Não informada');

function filtrados() {
    return listaDesligamentos().filter(
        (e) =>
            (!filtros.admissao || e.admissao === filtros.admissao) &&
            (!filtros.demissao || e.demissao === filtros.demissao) &&
            (!filtros.status || e.status === filtros.status)
    );
}

function cabecalho() {
    return `
        <div class="breadcrumb">
            <span>Movimentações</span>
            <span>›</span>
            <span class="destacado">Funcionários demitidos</span>
        </div>
        <div class="cabecalho-pagina">
            <div>
                <h1>Funcionários Demitidos</h1>
                <p>Histórico e gerenciamento de desligamentos da organização.</p>
            </div>
            <div class="botoes-acao">
                <button class="btn btn-secundario" id="dem-exportar">Exportar Relatório</button>
                <button class="btn btn-primario" id="dem-novo">+ Novo Registro</button>
            </div>
        </div>
    `;
}

export function view() {
    const pronto = carregado('funcionarios', 'desligamentos'),
        todos = listaDesligamentos(),
        mes = dateKey(new Date()).slice(0, 7),
        mesCount = todos.filter((e) => (e.demissao || '').startsWith(mes)).length,
        reativados = todos.filter((e) => e.status === 'reativado').length,
        rows = filtrados();
    pagina = Math.min(pagina, Math.max(0, Math.ceil(rows.length / 5) - 1));
    const visiveis = rows.slice(pagina * 5, pagina * 5 + 5);
    const completos = todos.filter((e) => e.admissao && e.demissao && e.demissao >= e.admissao),
        media = completos.length
            ? completos.reduce(
                  (n, e) => n + (parseKey(e.demissao) - parseKey(e.admissao)) / 86400000 / 365.25,
                  0
              ) / completos.length
            : null;
    return `
        <div class="mov-page">
            ${cabecalho()}
            <div class="mov-kpis mov-kpis-tres">
                <section class="mov-kpi">
                    <div>
                        <h3>Total de desligamentos</h3>
                        <strong>${todos.length}</strong>
                    </div>
                </section>
                <section class="mov-kpi">
                    <div>
                        <h3>Desligamentos no Mês</h3>
                        <strong>${mesCount}</strong>
                    </div>
                </section>
                <section class="mov-kpi">
                    <div>
                        <h3>Taxa de Reativação</h3>
                        <strong>
                            ${todos.length ? ((100 * reativados) / todos.length).toFixed(1) : '0.0'}%
                        </strong>
                    </div>
                </section>
            </div>
            <form class="mov-filtros" id="dem-filtros">
                <fieldset class="cad-fieldset mov-filtros-grid" ${!pronto ? 'disabled' : ''}>
                    ${campo('admissao', 'Data de Admissão', rascunho.admissao, 'type="date"')}${campo('demissao', 'Data de Demissão', rascunho.demissao, 'type="date"')}
                    <label class="cad-campo">
                        <span>Status do Desligamento</span>
                        <select name="status">
                            <option value="">Todos os Status</option>
                            <option
                                value="desligado"
                                ${rascunho.status === 'desligado' ? 'selected' : ''}
                            >
                                Desligado
                            </option>
                            <option
                                value="reativado"
                                ${rascunho.status === 'reativado' ? 'selected' : ''}
                            >
                                Reativado
                            </option>
                        </select>
                    </label>
                    <button class="btn btn-primario" type="submit">Filtrar</button>
                    <button
                        class="btn btn-secundario"
                        type="button"
                        id="dem-limpar"
                        aria-label="Limpar filtros"
                    >
                        Limpar
                    </button>
                </fieldset>
            </form>
            <section class="cad-card cad-lista">
                <div class="cad-tabela-wrap">
                    <table class="cad-tabela mov-tabela">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>CPF</th>
                                <th>Admissão</th>
                                <th>Demissão</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${
                                !pronto
                                    ? '<tr><td colspan="6">Carregando histórico…</td></tr>'
                                    : !visiveis.length
                                      ? '<tr><td colspan="6">Nenhum desligamento encontrado.</td></tr>'
                                      : visiveis
                                            .map((e) => {
                                                const f = state.funcionarios[e.uid];
                                                return `
                                                    <tr data-busca>
                                                        <td>
                                                            <div class="mov-pessoa">
                                                                <span
                                                                    class="mov-avatar"
                                                                    style="background:${corAvatar(e.nome)}"
                                                                >
                                                                    ${
                                                                        f?.foto
                                                                            ? `
                                                                                  <img
                                                                                      src="${esc(f.foto)}"
                                                                                      alt=""
                                                                                  />
                                                                              `
                                                                            : esc(iniciais(e.nome))
                                                                    }
                                                                </span>
                                                                <div>
                                                                    <strong>${esc(e.nome)}</strong>
                                                                    <small>
                                                                        ${esc(e.cargo || '—')}
                                                                    </small>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>${esc(e.cpf)}</td>
                                                        <td>${data(e.admissao)}</td>
                                                        <td class="mov-vermelho">
                                                            ${data(e.demissao)}
                                                        </td>
                                                        <td>
                                                            <span
                                                                class="mov-badge ${e.status === 'reativado' ? 'mov-badge-verde' : 'mov-badge-vermelho'}"
                                                            >
                                                                ${e.status === 'reativado' ? 'REATIVADO' : 'DESLIGADO'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div class="acoes-linha">
                                                                <button
                                                                    class="btn-ajustar"
                                                                    data-dem-detalhes="${esc(e.id)}"
                                                                >
                                                                    Detalhes
                                                                </button>
                                                                ${
                                                                    e.status === 'desligado' &&
                                                                    f?.status === 'desligado'
                                                                        ? `
                                                                              <button
                                                                                  class="btn btn-secundario cad-btn-peq"
                                                                                  data-dem-reativar="${esc(e.id)}"
                                                                                  ${ocupado ? 'disabled' : ''}
                                                                              >
                                                                                  Reativar
                                                                              </button>
                                                                          `
                                                                        : ''
                                                                }
                                                            </div>
                                                        </td>
                                                    </tr>
                                                `;
                                            })
                                            .join('')
                            }
                        </tbody>
                    </table>
                </div>
                <footer class="cad-paginacao">
                    <span>
                        Mostrando
                        ${visiveis.length ? pagina * 5 + 1 : 0}–${pagina * 5 + visiveis.length} de
                        ${rows.length} registros
                    </span>
                    <div>
                        <button
                            class="btn btn-secundario cad-btn-peq"
                            id="dem-anterior"
                            ${pagina === 0 ? 'disabled' : ''}
                        >
                            Anterior
                        </button>
                        <span>${pagina + 1}</span>
                        <button
                            class="btn btn-secundario cad-btn-peq"
                            id="dem-proximo"
                            ${(pagina + 1) * 5 >= rows.length ? 'disabled' : ''}
                        >
                            Próximo
                        </button>
                    </div>
                </footer>
            </section>
            <div class="mov-insights">
                <section class="mov-insight">
                    <h2>Insight de RH</h2>
                    <p>
                        ${media === null ? 'Cadastre as datas de admissão e demissão para acompanhar o tempo de permanência.' : `O tempo médio de permanência dos ${completos.length} registros com datas completas é de ${media.toFixed(1)} anos.`}
                    </p>
                    <small>
                        A taxa de reativação usa os desligamentos registrados neste sistema.
                    </small>
                </section>
                <section class="mov-insight-escuro">
                    <h3>Histórico preservado</h3>
                    <p>O desligamento mantém o cadastro e os registros de ponto do colaborador.</p>
                </section>
            </div>
        </div>
    `;
}

export function registrarDemissao(uid = '', aoSalvar) {
    if (!carregado('funcionarios', 'desligamentos')) return toast('Aguarde o carregamento.');
    const ativos = funcionariosAtivos();
    if (!ativos.length) return toast('Não há funcionários ativos para desligar.');
    abrirModal({
        titulo: 'Registrar desligamento',
        corpo: `
            <label class="cad-campo">
                <span>Funcionário</span>
                <select name="uid">
                    ${opcoes(ativos, uid)}
                </select>
            </label>
            ${campo('demissao', 'Data da Demissão', dateKey(new Date()), 'type="date" required')}
            <label class="cad-campo">
                <span>Motivo / observação</span>
                <textarea name="motivo" rows="3" maxlength="1500" required></textarea>
            </label>
            <p class="dica">
                O funcionário deixa a lista de ativos e seu histórico de ponto é mantido.
            </p>
            <p class="erro" data-erro hidden></p>
        `,
        aoAbrir: (c) => {
            const form = $('form', c);
            $('.modal-rodape', c).insertAdjacentHTML(
                'beforeend',
                '<button type="button" class="btn btn-primario" data-salvar-dem>Salvar Registro</button>'
            );
            const salvar = async () => {
                if (form.dataset.salvando) return;
                const d = Object.fromEntries(new FormData(form)),
                    erro = validarDesligamento(d.uid, d.demissao);
                if (erro) return erroForm(form, erro);
                if (!d.motivo.trim()) return erroForm(form, 'Informe o motivo do desligamento.');
                if (
                    await executar(
                        form,
                        () => desligar(d.uid, d.demissao, d.motivo),
                        'Desligamento registrado.'
                    )
                ) {
                    fecharModal();
                    pagina = 0;
                    rascunho = { admissao: '', demissao: '', status: '' };
                    filtros = { ...rascunho };
                    if (location.hash === '#demitidos') aoSalvar?.();
                    else location.hash = 'demitidos';
                }
            };
            $('[data-salvar-dem]', c).addEventListener('click', salvar);
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                salvar();
            });
        }
    });
}

export function bind({ render }) {
    $('#dem-novo').addEventListener('click', () => registrarDemissao('', render));
    const form = $('#dem-filtros');
    form.addEventListener('input', (e) => {
        if (e.target.name in rascunho) rascunho[e.target.name] = e.target.value;
    });
    form.addEventListener('change', (e) => {
        if (e.target.name in rascunho) rascunho[e.target.name] = e.target.value;
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        filtros = { ...rascunho };
        pagina = 0;
        render();
    });
    $('#dem-limpar').addEventListener('click', () => {
        rascunho = { admissao: '', demissao: '', status: '' };
        filtros = { ...rascunho };
        pagina = 0;
        render();
    });
    $('#dem-anterior').addEventListener('click', () => {
        pagina--;
        render();
    });
    $('#dem-proximo').addEventListener('click', () => {
        pagina++;
        render();
    });
    $('#dem-exportar').addEventListener('click', () => {
        if (!carregado('desligamentos', 'funcionarios')) return toast('Aguarde o carregamento.');
        exportarCSV('desligamentos.csv', [
            ['Nome', 'CPF', 'Admissão', 'Demissão', 'Status', 'Motivo'],
            ...filtrados().map((e) => [e.nome, e.cpf, e.admissao, e.demissao, e.status, e.motivo])
        ]);
    });
    $$('[data-dem-detalhes]').forEach((b) =>
        b.addEventListener('click', () => {
            const e = listaDesligamentos().find((e) => e.id === b.dataset.demDetalhes);
            if (!e) return;
            abrirModal({
                titulo: 'Detalhes do desligamento',
                corpo: `
                    <p><strong>${esc(e.nome)}</strong></p>
                    <p class="cad-espaco">
                        Admissão: ${data(e.admissao)}
                        <br />
                        Demissão: ${data(e.demissao)}
                    </p>
                    <p class="cad-espaco">
                        ${esc(e.motivo || 'Motivo não informado no cadastro anterior.')}
                    </p>
                    ${
                        e.reativadoEm
                            ? `
                                  <p class="cad-espaco">Reativado em ${data(e.reativadoEm)}</p>
                              `
                            : ''
                    }
                `
            });
        })
    );
    $$('[data-dem-reativar]').forEach((b) =>
        b.addEventListener('click', async () => {
            if (ocupado) return;
            const e = listaDesligamentos().find((e) => e.id === b.dataset.demReativar);
            if (!e || !confirm(`Reativar ${e.nome}?`)) return;
            ocupado = true;
            render();
            try {
                await reativar(e);
                toast('Funcionário reativado.');
            } catch (err) {
                toast(err.message || 'Não foi possível reativar.', 'erro');
            } finally {
                ocupado = false;
                render();
            }
        })
    );
}
