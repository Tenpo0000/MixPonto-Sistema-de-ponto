import { obterManual, editarBatidaManual, excluirBatidaManual } from '../core/batidas-manuais.js';
import { inicioControle, erroDataPonto } from '../core/controle-ponto.js';

import {
    MESES,
    DIAS,
    $,
    $$,
    pad,
    esc,
    dateKey,
    parseKey,
    fmtMin,
    fmtHora,
    fmtData,
    lista,
    porNome
} from '../core/utils.js';
import { state, funcionariosAtivos, batidas, analisarDia, sequencia } from '../core/state.js';
import { toast, abrirModal, fecharModal } from '../core/ui.js';
import { vazio, vazioInicialBotoes, bindIr } from '../core/componentes.js';
import { itens, novoId, gravar, executar, erroForm, carregado } from '../core/cadastros.js';
import { resumoPeriodo, datasPeriodo, formatoTempo } from '../core/calculos.js';
import { imprimirTabela } from '../core/exportacoes.js';
import { db } from '../core/db.js';

export const mov = { uid: null, inicio: null, fim: null };
let filtroPeriodo = { inicio: '', fim: '' },
    erroPeriodo = '',
    paginaPeriodo = 0,
    ultimoContexto = '';
const TAMANHO_PAGINA = 100;
const todosFuncionarios = () => lista(state.funcionarios).sort(porNome);
const cel = (b, dia) =>
    b
        ? `${fmtHora(b.timestamp)}${
              b.manual === true
                  ? `
                        <span class="badge">Manual</span>
                        <span class="mov-acoes-manual">
                            <button
                                type="button"
                                class="btn-ajustar"
                                data-editar-manual="${esc(b.id)}"
                                data-dia="${dia}"
                                aria-label="Editar inclusão manual das ${fmtHora(b.timestamp)}"
                            >
                                Editar
                            </button>
                            <button
                                type="button"
                                class="btn btn-perigo cad-btn-peq"
                                data-excluir-manual="${esc(b.id)}"
                                data-dia="${dia}"
                                aria-label="Excluir inclusão manual das ${fmtHora(b.timestamp)}"
                            >
                                Excluir
                            </button>
                        </span>
                    `
                  : ''
          }`
        : '<span class="mudo">-----</span>';

function linha(a) {
    const bs = a.bs;
    let cls = '',
        cols,
        total,
        just = '<span class="mudo">—</span>',
        acao = '';
    const manual = bs.find((b) => b.manual && b.motivo);
    if (manual)
        just = `
            <span class="link-acao">${esc(manual.motivo)}</span>
        `;
    if (a.ajuste)
        just = `
            <span class="link-acao">${esc(a.ajuste.tipo)}</span>
            ${
                a.ajuste.obs
                    ? `
                          <span class="obs">${esc(a.ajuste.obs)}</span>
                      `
                    : ''
            }${a.contarComoFalta ? '<span class="obs">Conta como falta</span>' : ''}
        `;
    if (a.tipo === 'trabalho') {
        cols = `
            <td class="${a.atraso ? 'atraso' : ''}">
                ${cel(bs[0], a.key)}${a.atraso ? '<span class="obs">Atraso</span>' : ''}
            </td>
            ${[1, 2, 3]
                .map(
                    (i) => `
                        <td>${cel(bs[i], a.key)}</td>
                    `
                )
                .join('')}
        `;
        total = `
            <td class="total">
                ${fmtMin(a.total)}${bs.length % 2 ? '<span class="obs">em andamento</span>' : ''}${
                    bs.length > 4
                        ? `
                              <span class="obs">${bs.length} batidas no total</span>
                          `
                        : ''
                }
            </td>
        `;
        acao = '<button class="btn-ajustar" data-ajustar>Ajustar</button>';
    } else {
        const rotulo = {
            falta: 'FALTA',
            justificado: a.contarComoFalta ? 'FALTA' : 'JUSTIFICADO',
            feriado: 'FERIADO',
            folga: 'FOLGA',
            pendente: '-----',
            futuro: '-----',
            antes: 'ANTERIOR AO CADASTRO',
            apos: 'DESLIGADO'
        }[a.tipo];
        cols = `
            <td class="${a.tipo === 'falta' || a.contarComoFalta ? 'falta' : 'mudo'}">${rotulo}</td>
            ${'<td class="mudo">-----</td>'.repeat(3)}
        `;
        total = `
            <td class="total ${a.tipo === 'falta' || a.contarComoFalta ? 'negativo' : 'neutro'}">
                00:00
            </td>
        `;
        if (['falta', 'justificado', 'pendente'].includes(a.tipo))
            acao = '<button class="btn-ajustar" data-ajustar>Ajustar</button>';
        if (a.tipo === 'falta' || a.contarComoFalta) cls = 'linha-falta';
        if (a.tipo === 'feriado')
            just = `
                <span class="mudo">${esc(a.feriado.descricao)}</span>
            `;
        if (['folga', 'futuro', 'antes', 'apos'].includes(a.tipo)) cls = 'linha-apagada';
    }
    if (bs.some((b) => b.manual === true))
        acao += `
            <button type="button" class="btn-ajustar" data-gerenciar-manuais="${a.key}">
                Inclusões manuais
            </button>
        `;
    return `
        <tr class="${cls}" data-key="${a.key}">
            <td class="dia">
                <span class="numero">
                    ${pad(a.date.getDate())} ${MESES[a.date.getMonth()].slice(0, 3)}
                </span>
                <small>${DIAS[a.date.getDay()]}</small>
            </td>
            ${cols}${total}
            <td>${just}</td>
            <td class="acoes-col">${acao}</td>
        </tr>
    `;
}

export function view() {
    if (!carregado('funcionarios', 'registros'))
        return '<p class="cad-vazio">Carregando cartão ponto…</p>';
    const funcs = todosFuncionarios();
    if (!funcs.length)
        return `
            <div class="mov-page">
                ${vazio('Nenhum funcionário cadastrado', 'Cadastre um funcionário para ver o cartão ponto.', vazioInicialBotoes)}
            </div>
        `;
    if (!funcs.some((f) => f.id === mov.uid))
        mov.uid = funcs.find((f) => f.status !== 'desligado')?.id || funcs[0].id;
    const f = { id: mov.uid, ...state.funcionarios[mov.uid] },
        inicio = inicioControle(f),
        hoje = dateKey(new Date());
    if (!inicio)
        return '<p class="cad-vazio">Informe uma data de admissão válida em <a href="#cadastro">Cadastro → Funcionário</a> para consultar o cartão ponto.</p>';
    const contexto = mov.uid + '|' + inicio;
    if (ultimoContexto && ultimoContexto !== contexto) {
        mov.inicio = null;
        mov.fim = null;
        filtroPeriodo = { inicio: '', fim: '' };
        paginaPeriodo = 0;
    }
    ultimoContexto = contexto;
    if (!mov.inicio || !mov.fim) {
        mov.inicio = inicio;
        mov.fim = hoje < inicio ? inicio : hoje;
    }
    if (!filtroPeriodo.inicio && !filtroPeriodo.fim)
        filtroPeriodo = { inicio: mov.inicio, fim: mov.fim };
    const keys = datasPeriodo(mov.inicio, mov.fim, Infinity),
        dias = keys.map((k) => analisarDia(f, k)),
        r = resumoPeriodo(f, mov.inicio, mov.fim, Infinity),
        fechado = mov.fim < hoje,
        semanas = new Set();
    for (const a of dias) {
        if (!a.bs.length) continue;
        const d = new Date(a.date);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        semanas.add(dateKey(d));
    }
    const media = semanas.size ? formatoTempo(r.total / semanas.size) : '00:00';
    const paginas = Math.max(1, Math.ceil(dias.length / TAMANHO_PAGINA));
    paginaPeriodo = Math.min(paginaPeriodo, paginas - 1);
    const visiveis = dias.slice(
        paginaPeriodo * TAMANHO_PAGINA,
        (paginaPeriodo + 1) * TAMANHO_PAGINA
    );
    return `
        <div class="mov-page">
            <div class="breadcrumb">
                <span>Movimentações</span>
                <span>›</span>
                <span class="destacado">Cartão ponto</span>
            </div>
            <div class="cabecalho-pagina">
                <div>
                    <h1>Cartão Ponto</h1>
                    <p>
                        Período: ${fmtData(parseKey(mov.inicio))} até ${fmtData(parseKey(mov.fim))}
                        — ${esc(f.nome)}
                    </p>
                </div>
                <div class="botoes-acao">
                    <button
                        class="btn btn-primario"
                        id="btn-incluir"
                        ${f.status === 'desligado' || mov.fim < inicio ? 'disabled' : ''}
                    >
                        Inclusão Manual
                    </button>
                    <button class="btn btn-secundario" id="btn-pdf">Exportar PDF</button>
                </div>
            </div>
            <form id="mov-periodo" class="mov-seletores" novalidate>
                <label class="cad-campo">
                    <span>Funcionário</span>
                    <select id="sel-func">
                        ${funcs
                            .map(
                                (a) => `
                                    <option
                                        value="${esc(a.id)}"
                                        ${a.id === mov.uid ? 'selected' : ''}
                                    >
                                        ${esc(a.nome)}${a.status === 'desligado' ? ' (desligado)' : ''}
                                    </option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
                <label class="cad-campo">
                    <span>Data inicial</span>
                    <input
                        type="date"
                        id="sel-inicio"
                        name="inicio"
                        value="${esc(filtroPeriodo.inicio)}"
                        required
                    />
                </label>
                <label class="cad-campo">
                    <span>Data final</span>
                    <input
                        type="date"
                        id="sel-fim"
                        name="fim"
                        value="${esc(filtroPeriodo.fim)}"
                        required
                    />
                </label>
                <button class="btn btn-primario" type="submit">Filtrar período</button>
            </form>
            <p class="erro" id="mov-periodo-erro" role="alert" ${erroPeriodo ? '' : 'hidden'}>
                ${esc(erroPeriodo)}
            </p>
            <p class="mov-nota">
                Data de admissão do funcionário: ${fmtData(parseKey(inicio))}. Datas anteriores
                ficam bloqueadas para lançamentos e não geram faltas.
            </p>
            <div class="mov-kpis mov-kpis-limpos">
                <section class="mov-kpi">
                    <div>
                        <h3>Total de Horas</h3>
                        <strong>${formatoTempo(r.total)}</strong>
                        <small>${formatoTempo(r.extras)} excedentes no período</small>
                    </div>
                </section>
                <section class="mov-kpi">
                    <div>
                        <h3>Saldo de Horas</h3>
                        <strong>${r.saldo >= 0 ? '+' : ''}${formatoTempo(r.saldo)}</strong>
                        <small>Saldo do período até os dias anteriores a hoje</small>
                    </div>
                </section>
                <section class="mov-kpi">
                    <div>
                        <h3>Faltas / Atrasos</h3>
                        <strong>${r.faltas} / ${r.atrasos}</strong>
                        <small>${r.justificadas} ausências justificadas</small>
                    </div>
                </section>
                <section class="mov-kpi">
                    <div>
                        <h3>Status do Período</h3>
                        <span class="mov-badge">${fechado ? 'PERÍODO PASSADO' : 'EM ABERTO'}</span>
                        <small>
                            ${fechado ? 'Período anterior à data atual' : 'O período inclui hoje ou datas futuras'}
                        </small>
                    </div>
                </section>
            </div>
            <section class="cad-card cad-lista mov-cartao">
                <div class="cad-tabela-wrap">
                    <table class="tabela-registros mov-tabela">
                        <thead>
                            <tr>
                                <th>Dia</th>
                                <th>Entrada 1</th>
                                <th>Saída 1</th>
                                <th>Entrada 2</th>
                                <th>Saída 2</th>
                                <th>Total</th>
                                <th>Justificativa / observação</th>
                                <th class="acoes-col">Ações</th>
                            </tr>
                        </thead>
                        <tbody>${visiveis.map(linha).join('')}</tbody>
                    </table>
                </div>
                <footer class="cad-paginacao">
                    <span>
                        Exibindo
                        ${paginaPeriodo * TAMANHO_PAGINA + 1}–${Math.min((paginaPeriodo + 1) * TAMANHO_PAGINA, dias.length)}
                        de ${dias.length} dias: ${fmtData(parseKey(mov.inicio))} até
                        ${fmtData(parseKey(mov.fim))}
                    </span>
                    ${
                        paginas > 1
                            ? `
                                  <div>
                                      <button
                                          type="button"
                                          class="btn btn-secundario cad-btn-peq"
                                          id="mov-anterior"
                                          ${paginaPeriodo === 0 ? 'disabled' : ''}
                                      >
                                          Anterior
                                      </button>
                                      <span>${paginaPeriodo + 1} / ${paginas}</span>
                                      <button
                                          type="button"
                                          class="btn btn-secundario cad-btn-peq"
                                          id="mov-proximo"
                                          ${paginaPeriodo + 1 >= paginas ? 'disabled' : ''}
                                      >
                                          Próximo
                                      </button>
                                  </div>
                              `
                            : ''
                    }
                </footer>
            </section>
            <div class="mov-estatisticas">
                <section class="mov-card">
                    <h3>Média de Horas Semanais</h3>
                    <strong>${media}</strong>
                    <small>Semanas do período com registro</small>
                </section>
                <section class="mov-card">
                    <h3>Chegadas Atrasadas</h3>
                    <strong>${r.atrasos}</strong>
                    <small>${formatoTempo(r.atrasoMin)} de atraso no período</small>
                </section>
                <section class="mov-card">
                    <h3>Sequência de Presença</h3>
                    <strong>
                        ${sequencia(f)}
                        <span>dias seguidos</span>
                    </strong>
                    <small>Dias úteis consecutivos até hoje</small>
                </section>
            </div>
            <p class="mov-nota">
                O histórico começa na admissão. Os totais e o PDF consideram todo o intervalo
                selecionado; a tabela mostra até 100 dias por página. Saldo aritmético de tempo, sem
                aplicação de adicionais ou regras de remuneração.
                ${r.incompletos ? `${r.incompletos} dias possuem batidas sem par; apenas pares completos entram nas horas trabalhadas.` : 'As justificativas com abono cobrem a carga prevista no saldo dos dias anteriores.'}
            </p>
        </div>
    `;
}

function formulario(titulo, corpo, salvar, aoAbrir) {
    return abrirModal({
        titulo,
        corpo: `${corpo}<p class="erro" data-erro hidden></p>`,
        aoAbrir: (c) => {
            const form = $('form', c);
            $('.modal-rodape', c).insertAdjacentHTML(
                'beforeend',
                '<button type="button" class="btn btn-primario" data-gravar>Salvar</button>'
            );
            const fn = async () => {
                if (!form.dataset.salvando) await salvar(form, c);
            };
            $('[data-gravar]', c).addEventListener('click', fn);
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                fn();
            });
            aoAbrir?.(c);
        }
    });
}

function inclusao() {
    if (!carregado('registros', 'funcionarios')) return toast('Aguarde o carregamento.');
    const ativos = funcionariosAtivos(),
        selecionado = state.funcionarios[mov.uid];
    if (!selecionado || selecionado.status === 'desligado')
        return toast('Selecione um funcionário ativo.', 'erro');
    const hoje = dateKey(new Date()),
        minimo = inicioControle(selecionado);
    if (!minimo) return toast('Informe a data de admissão no cadastro do funcionário.', 'erro');
    const data = [minimo, hoje >= mov.inicio && hoje <= mov.fim ? hoje : mov.inicio].sort().at(-1);
    formulario(
        'Inclusão manual de ponto',
        `
            <div class="grupo-formulario">
                <label>
                    Funcionário
                    <select name="uid">
                        ${ativos
                            .map(
                                (a) => `
                                    <option
                                        value="${esc(a.id)}"
                                        ${a.id === mov.uid ? 'selected' : ''}
                                    >
                                        ${esc(a.nome)}
                                    </option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
            </div>
            <div class="grupo-formulario">
                <label>
                    Data
                    <input type="date" name="data" min="${minimo}" value="${data}" />
                </label>
            </div>
            <div class="linha-formulario">
                ${['Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2']
                    .map(
                        (t, i) => `
                            <div class="grupo-formulario">
                                <label>
                                    ${t}
                                    <input type="time" name="t${i}" />
                                </label>
                            </div>
                        `
                    )
                    .join('')}
            </div>
            <div class="grupo-formulario">
                <label>
                    Motivo da inclusão
                    <textarea name="motivo" rows="3" maxlength="1000"></textarea>
                </label>
            </div>
            <p class="dica">
                As batidas existentes são mantidas. Deixe em branco os horários que não quiser
                incluir.
            </p>
        `,
        async (form) => {
            const d = Object.fromEntries(new FormData(form)),
                horas = [d.t0, d.t1, d.t2, d.t3].filter(Boolean);
            const bloqueio = erroDataPonto(state.funcionarios[d.uid], d.data);
            if (bloqueio) return erroForm(form, bloqueio);
            if (state.funcionarios[d.uid]?.status === 'desligado')
                return erroForm(form, 'Este funcionário está desligado.');
            if (!d.data || dateKey(new Date(d.data + 'T12:00:00')) !== d.data)
                return erroForm(form, 'Informe uma data válida.');
            if (!state.funcionarios[d.uid] || !horas.length || !d.motivo.trim())
                return erroForm(form, 'Informe funcionário, pelo menos um horário e o motivo.');
            const novas = horas.map((h) => new Date(`${d.data}T${h}:00`)),
                todas = [
                    ...batidas(d.uid, d.data).map((b) => new Date(b.timestamp)),
                    ...novas
                ].sort((a, b) => a - b);
            for (let i = 1; i < todas.length; i++)
                if ((todas[i] - todas[i - 1]) / 60000 < 5)
                    return erroForm(
                        form,
                        'Precisa haver pelo menos 5 minutos entre uma batida e outra.'
                    );

            const pendentes = novas.map((dt) => [
                novoId(`registros/${d.data}/${d.uid}`),
                {
                    nome: state.funcionarios[d.uid].nome,
                    timestamp: dt.toISOString(),
                    manual: true,
                    motivo: d.motivo.trim()
                }
            ]);
            if (
                await executar(
                    form,
                    () =>
                        db.update(
                            Object.fromEntries(
                                pendentes.map(([id, val]) => [
                                    `registros/${d.data}/${d.uid}/${id}`,
                                    val
                                ])
                            )
                        ),
                    'Ponto incluído.'
                )
            ) {
                mov.uid = d.uid;
                if (d.data < mov.inicio || d.data > mov.fim) {
                    mov.inicio = d.data;
                    mov.fim = d.data;
                    filtroPeriodo = { inicio: d.data, fim: d.data };
                }
                fecharModal();
            }
        },
        (c) => {
            $('[name=uid]', c)?.addEventListener('change', (e) => {
                const input = $('[name=data]', c),
                    limite = inicioControle(state.funcionarios[e.target.value]);
                input.min = limite;
                if (input.value < limite) input.value = limite;
            });
        }
    );
}

function ajuste(key) {
    if (!carregado('justificativas', 'ajustes', 'funcionarios'))
        return toast('Aguarde o carregamento das justificativas.');
    const uid = mov.uid,
        f = state.funcionarios[uid],
        bloqueio = erroDataPonto(f, key);
    if (bloqueio) return toast(bloqueio, 'erro');
    const atual = state.ajustes?.[key]?.[uid],
        js = itens('justificativas');
    formulario(
        `Ajustar ponto – ${fmtData(parseKey(key))}`,
        `
            <p class="dica">${esc(f.nome)}</p>
            ${
                atual
                    ? `
                          <p class="dica">
                              Justificativa registrada: ${esc(atual.tipo)}. O histórico é preservado
                              até você substituir ou remover este ajuste.
                          </p>
                      `
                    : ''
            }
            <div class="grupo-formulario">
                <label>
                    Tipo de ajuste
                    <select name="justificativa" ${js.length ? '' : 'disabled'}>
                        <option value="">
                            ${js.length ? 'Selecione a justificativa' : 'Nenhuma justificativa cadastrada'}
                        </option>
                        ${js
                            .map(
                                (j) => `
                                    <option
                                        value="${esc(j.id)}"
                                        ${atual?.justificativaId === j.id ? 'selected' : ''}
                                    >
                                        ${esc(j.abreviacao)} —
                                        ${esc(j.nome)}${j.contarComoFalta ? ' (conta como falta)' : ''}
                                    </option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
            </div>
            <div class="grupo-formulario">
                <label>
                    Observação
                    <textarea name="obs" rows="3" maxlength="1500">${esc(atual?.obs)}</textarea>
                </label>
            </div>
            ${atual ? '<button class="btn btn-perigo" type="button" data-remover-ajuste>Remover ajuste</button>' : ''}
            <p class="dica">
                <a href="#justificativa" data-cadastrar-just>Cadastre justificativas</a>
                para disponibilizar motivos. Para corrigir uma batida manual existente, use Editar
                junto ao horário.
            </p>
        `,
        async (form) => {
            const erro = erroDataPonto(state.funcionarios[uid], key);
            if (erro) return erroForm(form, erro);
            const d = Object.fromEntries(new FormData(form)),
                j = state.justificativas[d.justificativa];
            if (!j) return erroForm(form, 'Selecione uma justificativa cadastrada e disponível.');
            const val = {
                justificativaId: d.justificativa,
                tipo: j.nome,
                abreviacao: j.abreviacao,
                contarComoFalta: !!j.contarComoFalta,
                obs: (d.obs || '').trim()
            };
            if (await executar(form, () => gravar(`ajustes/${key}/${uid}`, val), 'Ajuste salvo.'))
                fecharModal();
        },
        (c) => {
            if (!js.length) $('[data-gravar]', c).disabled = true;
        }
    );
    $('[data-cadastrar-just]')?.addEventListener('click', fecharModal);
    $('[data-remover-ajuste]')?.addEventListener('click', async () => {
        const form = $('#modal-container form'),
            erro = erroDataPonto(state.funcionarios[uid], key);
        if (erro) return erroForm(form, erro);
        if (await executar(form, () => gravar(`ajustes/${key}/${uid}`, null), 'Ajuste removido.'))
            fecharModal();
    });
}
const excluindoManuais = new Set();

function ligarAcoesManuais(raiz, uid, render) {
    if (!raiz) return;
    $$('[data-editar-manual]', raiz).forEach((b) =>
        b.addEventListener('click', () =>
            editarManual(uid, b.dataset.dia, b.dataset.editarManual, render)
        )
    );
    $$('[data-excluir-manual]', raiz).forEach((b) =>
        b.addEventListener('click', () =>
            excluirManual(uid, b.dataset.dia, b.dataset.excluirManual, render)
        )
    );
}

function editarManual(uid, dia, id, render) {
    if (!carregado('funcionarios', 'registros')) return toast('Aguarde o carregamento.');
    let registro;
    try {
        registro = obterManual(uid, dia, id);
    } catch (e) {
        return toast(e.message, 'erro');
    }
    const f = state.funcionarios[uid];
    formulario(
        'Editar inclusão manual',
        `
            <p class="dica">${esc(f.nome)}</p>
            <div class="linha-formulario">
                <div class="grupo-formulario">
                    <label>
                        Data
                        <input
                            type="date"
                            name="data"
                            min="${inicioControle(f)}"
                            value="${dia}"
                            required
                        />
                    </label>
                </div>
                <div class="grupo-formulario">
                    <label>
                        Horário
                        <input
                            type="time"
                            name="hora"
                            value="${fmtHora(registro.timestamp)}"
                            required
                        />
                    </label>
                </div>
            </div>
            <div class="grupo-formulario">
                <label>
                    Motivo da inclusão
                    <textarea name="motivo" rows="3" maxlength="1000" required>
${esc(registro.motivo || '')}</textarea>
                </label>
            </div>
            <p class="dica">
                Esta ação altera somente a batida escolhida. As demais batidas e justificativas do
                dia são mantidas.
            </p>
        `,
        async (form) => {
            const d = Object.fromEntries(new FormData(form));
            let erro = '';
            const ok = await executar(
                form,
                async () => {
                    try {
                        await editarBatidaManual(uid, dia, id, d.data, d.hora, d.motivo);
                    } catch (e) {
                        erro = e.message;
                        throw e;
                    }
                },
                'Inclusão manual atualizada.'
            );
            if (!ok) {
                if (erro) erroForm(form, erro);
                return;
            }
            mov.uid = uid;
            if (d.data < mov.inicio || d.data > mov.fim) {
                mov.inicio = d.data;
                mov.fim = d.data;
                filtroPeriodo = { inicio: d.data, fim: d.data };
            }
            fecharModal();
            render?.();
        }
    );
}

async function excluirManual(uid, dia, id, render) {
    const chave = uid + '/' + dia + '/' + id;
    if (excluindoManuais.has(chave)) return;
    let registro;
    try {
        registro = obterManual(uid, dia, id);
    } catch (e) {
        return toast(e.message, 'erro');
    }
    if (
        !confirm(
            `Excluir somente a inclusão manual de ${fmtData(parseKey(dia))} às ${fmtHora(registro.timestamp)}? Os totais serão recalculados.`
        )
    )
        return;
    excluindoManuais.add(chave);
    try {
        await excluirBatidaManual(uid, dia, id);
        fecharModal();
        toast('Inclusão manual excluída.');
        render?.();
    } catch (e) {
        toast(e.message || 'Não foi possível excluir a inclusão manual.', 'erro');
    } finally {
        excluindoManuais.delete(chave);
    }
}

function gerenciarManuais(uid, dia, render) {
    if (!carregado('funcionarios', 'registros')) return toast('Aguarde o carregamento.');
    const erro = erroDataPonto(state.funcionarios[uid], dia);
    if (erro) return toast(erro, 'erro');
    const manuais = batidas(uid, dia).filter((b) => b.manual === true);
    if (!manuais.length) return toast('Não há inclusões manuais neste dia.');
    abrirModal({
        titulo: `Inclusões manuais — ${fmtData(parseKey(dia))}`,
        largo: true,
        corpo: `
            <p class="dica">${esc(state.funcionarios[uid]?.nome)}</p>
            <div class="cad-tabela-wrap">
                <table class="cad-tabela">
                    <thead>
                        <tr>
                            <th>Horário</th>
                            <th>Motivo</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${manuais
                            .map(
                                (b) => `
                                    <tr>
                                        <td>${fmtHora(b.timestamp)}</td>
                                        <td>${esc(b.motivo || '—')}</td>
                                        <td>
                                            <div class="acoes-linha">
                                                <button
                                                    type="button"
                                                    class="btn-ajustar"
                                                    data-editar-manual="${esc(b.id)}"
                                                    data-dia="${dia}"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn btn-perigo cad-btn-peq"
                                                    data-excluir-manual="${esc(b.id)}"
                                                    data-dia="${dia}"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `
                            )
                            .join('')}
                    </tbody>
                </table>
            </div>
        `,
        aoAbrir: (c) => ligarAcoesManuais(c, uid, render)
    });
}

export function bind({ render }) {
    bindIr();
    $('#sel-func')?.addEventListener('change', (e) => {
        mov.uid = e.target.value;
        mov.inicio = null;
        mov.fim = null;
        filtroPeriodo = { inicio: '', fim: '' };
        paginaPeriodo = 0;
        render();
    });
    for (const [id, k] of [
        ['sel-inicio', 'inicio'],
        ['sel-fim', 'fim']
    ])
        $('#' + id)?.addEventListener('input', (e) => {
            filtroPeriodo[k] = e.target.value;
        });
    $('#mov-periodo')?.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
            datasPeriodo(filtroPeriodo.inicio, filtroPeriodo.fim, Infinity);
            mov.inicio = filtroPeriodo.inicio;
            mov.fim = filtroPeriodo.fim;
            paginaPeriodo = 0;
            erroPeriodo = '';
        } catch (err) {
            erroPeriodo = err.message;
        }
        render();
    });
    $('#mov-anterior')?.addEventListener('click', () => {
        if (paginaPeriodo > 0) {
            paginaPeriodo--;
            render();
        }
    });
    $('#mov-proximo')?.addEventListener('click', () => {
        paginaPeriodo++;
        render();
    });
    $('#btn-incluir')?.addEventListener('click', inclusao);
    $('#btn-pdf')?.addEventListener('click', () => {
        const f = { id: mov.uid, ...state.funcionarios[mov.uid] };
        const linhas = datasPeriodo(mov.inicio, mov.fim, Infinity).map((key) => {
            const a = analisarDia(f, key);
            return [
                fmtData(a.date),
                DIAS[a.date.getDay()],
                a.bs.map((b) => fmtHora(b.timestamp) + (b.manual ? ' (manual)' : '')).join(' / ') ||
                    {
                        falta: 'FALTA',
                        justificado: 'JUSTIFICADO',
                        feriado: 'FERIADO',
                        folga: 'FOLGA',
                        apos: 'DESLIGADO',
                        antes: 'ANTERIOR AO CADASTRO'
                    }[a.tipo] ||
                    '—',
                formatoTempo(a.total),
                a.ajuste?.tipo || a.feriado?.descricao || '',
                a.ajuste?.obs || a.bs.find((b) => b.manual)?.motivo || ''
            ];
        });
        imprimirTabela(
            `Cartão Ponto — ${f.nome}`,
            ['Data', 'Dia', 'Batidas', 'Total', 'Justificativa', 'Observação'],
            linhas,
            `Matrícula ${f.matricula || '—'} · Período ${fmtData(parseKey(mov.inicio))} até ${fmtData(parseKey(mov.fim))}.`
        );
    });
    ligarAcoesManuais(document.getElementById('view'), mov.uid, render);
    $$('[data-gerenciar-manuais]').forEach((b) =>
        b.addEventListener('click', () =>
            gerenciarManuais(mov.uid, b.dataset.gerenciarManuais, render)
        )
    );
    $$('[data-ajustar]').forEach((b) =>
        b.addEventListener('click', () => ajuste(b.closest('tr').dataset.key))
    );
}
