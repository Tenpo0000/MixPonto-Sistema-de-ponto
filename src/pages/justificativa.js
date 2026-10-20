import { $, $$, esc } from '../core/utils.js';
import { state } from '../core/state.js';
import { toast } from '../core/ui.js';
import {
    cabecalho,
    itens,
    carregado,
    campo,
    chave,
    novoId,
    gravar,
    executar,
    erroForm,
    semDados
} from '../core/cadastros.js';

let id = null,
    rascunho = { abreviacao: '', nome: '', descricao: '', contarComoFalta: false };
const limpar = () => {
    id = null;
    rascunho = { abreviacao: '', nome: '', descricao: '', contarComoFalta: false };
};

export function view() {
    const lista = itens('justificativas');
    return `
        <div class="cad-page">
            ${cabecalho('Justificativa', id ? 'Editar Justificativa' : 'Nova Justificativa', 'Defina os critérios e descrições para abonos ou faltas justificadas no sistema.')}
            <div class="cad-grid cad-grid-just">
                <section class="cad-card cad-form-alto">
                    <form id="just-form" novalidate>
                        <fieldset
                            class="cad-fieldset"
                            ${carregado('justificativas', 'ajustes') ? '' : 'disabled'}
                        >
                            <div class="cad-duas-colunas">
                                ${campo('abreviacao', 'Nome Abreviado', rascunho.abreviacao, 'maxlength="10" required placeholder="Ex: MED"')}${campo('nome', 'Nome Completo', rascunho.nome, 'maxlength="120" required placeholder="Ex: Atestado Médico"')}
                            </div>
                            <p class="cad-ajuda">Máximo de 10 caracteres para listagens rápidas.</p>
                            <label class="cad-campo cad-espaco">
                                <span>Descrição Detalhada</span>
                                <textarea
                                    name="descricao"
                                    rows="5"
                                    maxlength="1500"
                                    placeholder="Descreva as regras para aplicação desta justificativa…"
                                >
${esc(rascunho.descricao)}</textarea>
                            </label>
                            <label class="cad-checkbox-box">
                                <input
                                    type="checkbox"
                                    name="contarComoFalta"
                                    ${rascunho.contarComoFalta ? 'checked' : ''}
                                />
                                <span>
                                    <strong>Contabilizar como falta (em vez de abonar)</strong>
                                    <small>
                                        Ao marcar, a ausência continua no total de faltas, com o
                                        motivo registrado.
                                    </small>
                                </span>
                            </label>
                            <p class="erro" data-erro hidden></p>
                            <footer class="cad-form-acoes">
                                <button type="button" class="btn btn-secundario" id="just-cancelar">
                                    Cancelar
                                </button>
                                <button type="submit" class="btn btn-primario">
                                    Salvar Justificativa
                                </button>
                            </footer>
                        </fieldset>
                    </form>
                </section>
                <aside class="cad-aside">
                    <section class="cad-card cad-dicas">
                        <h2>Dicas</h2>
                        <p>
                            <b>01</b>
                            Use nomes abreviados claros, como “MED”, para facilitar a leitura do
                            cartão ponto.
                        </p>
                        <p>
                            <b>02</b>
                            Marque a opção de falta quando o motivo não deve abonar a ausência.
                        </p>
                    </section>
                    <section class="cad-escuro">
                        <h3>Resumo da Configuração</h3>
                        <p id="just-resumo">
                            ${rascunho.contarComoFalta ? 'A ausência será contada como falta.' : 'A ausência será registrada como justificada.'}
                        </p>
                        <small>
                            A justificativa será disponibilizada no ajuste do cartão ponto.
                        </small>
                    </section>
                    <section class="cad-dicas">
                        <h3>Gestão de registros</h3>
                        <p>
                            Revise os critérios antes de aplicar uma justificativa ao colaborador.
                        </p>
                    </section>
                </aside>
            </div>
            <section class="cad-card cad-lista cad-margem">
                <header class="cad-card-topo">
                    <h2>Justificativas cadastradas</h2>
                    <span class="cad-pill">${lista.length}</span>
                </header>
                ${
                    lista.length
                        ? `
                              <div class="cad-tabela-wrap">
                                  <table class="cad-tabela">
                                      <thead>
                                          <tr>
                                              <th>Abreviação</th>
                                              <th>Nome</th>
                                              <th>Tratamento da ausência</th>
                                              <th>Ações</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          ${lista
                                              .map(
                                                  (j) => `
                                                      <tr data-busca>
                                                          <td>
                                                              <strong>${esc(j.abreviacao)}</strong>
                                                          </td>
                                                          <td>${esc(j.nome)}</td>
                                                          <td>
                                                              ${j.contarComoFalta ? 'Conta como falta' : 'Justificada'}
                                                          </td>
                                                          <td>
                                                              <div class="acoes-linha">
                                                                  <button
                                                                      class="btn-ajustar"
                                                                      data-just-editar="${esc(j.id)}"
                                                                  >
                                                                      Editar
                                                                  </button>
                                                                  <button
                                                                      class="btn btn-perigo cad-btn-peq"
                                                                      data-just-excluir="${esc(j.id)}"
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
                          `
                        : semDados(
                              carregado('justificativas')
                                  ? 'Nenhuma justificativa cadastrada.'
                                  : 'Carregando dados…'
                          )
                }
            </section>
        </div>
    `;
}

export function bind({ render }) {
    const form = $('#just-form');
    form.addEventListener('input', (e) => {
        if (e.target.name in rascunho)
            rascunho[e.target.name] =
                e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        if (e.target.name === 'contarComoFalta')
            $('#just-resumo').textContent = e.target.checked
                ? 'A ausência será contada como falta.'
                : 'A ausência será registrada como justificada.';
    });
    $('#just-cancelar').addEventListener('click', () => {
        limpar();
        render();
    });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!carregado('justificativas', 'ajustes')) return;
        const d = {
            abreviacao: rascunho.abreviacao.trim().toUpperCase(),
            nome: rascunho.nome.trim(),
            descricao: rascunho.descricao.trim(),
            contarComoFalta: rascunho.contarComoFalta
        };
        if (!d.abreviacao || !d.nome)
            return erroForm(form, 'Preencha o nome abreviado e o nome completo.');
        if (d.abreviacao.length > 10) return erroForm(form, 'Use até 10 caracteres na abreviação.');
        if (
            itens('justificativas').some(
                (j) =>
                    j.id !== id &&
                    (chave(j.nome) === chave(d.nome) || chave(j.abreviacao) === chave(d.abreviacao))
            )
        )
            return erroForm(form, 'Já existe uma justificativa com este nome ou abreviação.');
        if (
            await executar(
                form,
                () => gravar(`justificativas/${id || novoId('justificativas')}`, d),
                'Justificativa salva.'
            )
        ) {
            limpar();
            render();
        }
    });
    $$('[data-just-editar]').forEach((b) =>
        b.addEventListener('click', () => {
            id = b.dataset.justEditar;
            rascunho = { ...state.justificativas[id] };
            render();
            $('#just-form input')?.focus();
        })
    );
    $$('[data-just-excluir]').forEach((b) =>
        b.addEventListener('click', async () => {
            if (!carregado('ajustes')) return toast('Aguarde o carregamento dos ajustes.');
            const jid = b.dataset.justExcluir;
            if (
                Object.values(state.ajustes || {}).some((dia) =>
                    Object.values(dia || {}).some((a) => a.justificativaId === jid)
                )
            )
                return toast('Esta justificativa está vinculada a ajustes de ponto.', 'erro');
            if (!confirm('Excluir esta justificativa?')) return;
            try {
                await gravar(`justificativas/${jid}`, null);
                if (id === jid) limpar();
                toast('Justificativa excluída.');
                render();
            } catch {
                toast('Não foi possível excluir.', 'erro');
            }
        })
    );
}
