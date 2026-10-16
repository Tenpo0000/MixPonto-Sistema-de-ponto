import { $, $$, esc } from '../core/utils.js';
import { state } from '../core/state.js';
import { abrirModal, fecharModal, toast } from '../core/ui.js';
import {
    itens,
    carregado,
    colaboradores,
    cabecalho,
    semDados,
    aguarde,
    campo,
    chave,
    novoId,
    gravar,
    executar,
    erroForm
} from '../core/cadastros.js';

export function view() {
    const cargos = itens('cargos'),
        ordenados = cargos
            .map((c) => ({ c, n: colaboradores('cargo', c).length }))
            .sort((a, b) => b.n - a.n),
        maior = ordenados[0];
    return `
        <div class="cad-page">
            ${cabecalho('Cargo', 'Gestão de Cargos e Funções', 'Configure as descrições dos cargos ativos no sistema.', '<button class="btn btn-primario" id="cargo-novo">+ Nova Função</button>')}
            <div class="cad-grid">
                <section class="cad-card cad-lista">
                    <header class="cad-card-topo">
                        <h2>Lista de Funções</h2>
                        <span class="cad-pill">${cargos.length} Registradas</span>
                    </header>
                    ${
                        !carregado('cargos', 'funcionarios')
                            ? aguarde()
                            : !cargos.length
                              ? semDados('Cadastre a primeira função para organizar sua equipe.')
                              : `
                                    <div class="cad-tabela-wrap">
                                        <table class="cad-tabela">
                                            <thead>
                                                <tr>
                                                    <th>Descrição da função</th>
                                                    <th>Colaboradores</th>
                                                    <th>Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${cargos
                                                    .map((c) => {
                                                        const funcs = colaboradores('cargo', c);
                                                        return `
                                                            <tr data-busca>
                                                                <td>
                                                                    <strong>${esc(c.nome)}</strong>
                                                                    ${
                                                                        c.descricao
                                                                            ? `
                                                                                  <small
                                                                                      class="cad-subtexto"
                                                                                  >
                                                                                      ${esc(c.descricao)}
                                                                                  </small>
                                                                              `
                                                                            : ''
                                                                    }
                                                                </td>
                                                                <td>${funcs.length}</td>
                                                                <td>
                                                                    <div class="acoes-linha">
                                                                        <button
                                                                            class="btn-ajustar"
                                                                            data-cargo-editar="${esc(c.id)}"
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                        <button
                                                                            class="btn btn-perigo cad-btn-peq"
                                                                            data-cargo-excluir="${esc(c.id)}"
                                                                        >
                                                                            Excluir
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        `;
                                                    })
                                                    .join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `
                    }
                </section>
                <aside class="cad-aside">
                    <section class="cad-azul">
                        <h2>Visão Geral</h2>
                        <p>
                            Gerencie as responsabilidades de cada setor através das funções
                            registradas.
                        </p>
                        <div class="cad-destaque">
                            <small>Função mais ocupada</small>
                            <strong>
                                ${maior?.n ? esc(maior.c.nome) : 'Nenhum vínculo ainda'}
                            </strong>
                        </div>
                    </section>
                    <section class="cad-dicas">
                        <h3>Dicas de gestão</h3>
                        <p>Mantenha as descrições curtas e objetivas.</p>
                        <p>Revise as funções da sua equipe periodicamente.</p>
                    </section>
                </aside>
            </div>
        </div>
    `;
}

function formulario(id) {
    if (!carregado('cargos', 'funcionarios')) return toast('Aguarde o carregamento dos dados.');
    const c = state.cargos?.[id] || {};
    const modal = abrirModal({
        titulo: id ? 'Editar função' : 'Nova função',
        corpo: `${campo('nome', 'Nome da função', c.nome, 'maxlength="120" required')}${campo('descricao', 'Descrição', c.descricao, 'maxlength="240"')}<p class="erro" data-erro hidden></p>`,
        aoAbrir: (container) => {
            const form = $('form', container);
            $('.modal-rodape', container).insertAdjacentHTML(
                'beforeend',
                '<button type="button" class="btn btn-primario" id="cargo-gravar">Salvar Função</button>'
            );
            const salvar = async () => {
                const d = Object.fromEntries(new FormData(form));
                d.nome = d.nome?.trim();
                d.descricao = d.descricao?.trim() || '';
                if (!d.nome) return erroForm(form, 'Informe o nome da função.', 'nome');
                if (itens('cargos').some((x) => x.id !== id && chave(x.nome) === chave(d.nome)))
                    return erroForm(form, 'Já existe uma função com esse nome.', 'nome');
                const legado = Object.values(state.funcionarios || {}).some(
                    (f) => !f.cargoId && chave(f.cargo) === chave(c.nome)
                );
                if (id && chave(c.nome) !== chave(d.nome) && legado)
                    return erroForm(
                        form,
                        'Vincule os funcionários antigos a esta função antes de renomeá-la.'
                    );
                if (
                    await executar(
                        form,
                        () => gravar(`cargos/${id || novoId('cargos')}`, { ...c, ...d }),
                        'Função salva.'
                    )
                )
                    fecharModal();
            };
            $('#cargo-gravar', container).addEventListener('click', salvar);
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                salvar();
            });
        }
    });
    return modal;
}

export function bind() {
    $('#cargo-novo').addEventListener('click', () => formulario());
    $$('[data-cargo-editar]').forEach((b) =>
        b.addEventListener('click', () => formulario(b.dataset.cargoEditar))
    );
    $$('[data-cargo-excluir]').forEach((b) =>
        b.addEventListener('click', async () => {
            const id = b.dataset.cargoExcluir,
                c = { id, ...state.cargos[id] };
            const vinculado = Object.values(state.funcionarios || {}).some(
                (f) => f.cargoId === id || (!f.cargoId && chave(f.cargo) === chave(c.nome))
            );
            if (vinculado) return toast('Há funcionários vinculados a esta função.', 'erro');
            if (!confirm(`Excluir a função ${c.nome}?`)) return;
            try {
                await gravar(`cargos/${id}`, null);
                toast('Função excluída.');
            } catch {
                toast('Não foi possível excluir.', 'erro');
            }
        })
    );
}
