import { $, $$, esc, lista, iniciais, corAvatar, dateKey } from '../core/utils.js';
import { state } from '../core/state.js';
import {
    carregado,
    campo,
    itens,
    chave,
    novoId,
    gravar,
    executar,
    erroForm
} from '../core/cadastros.js';
import { abrirModal, fecharModal, toast } from '../core/ui.js';

let pagina = 0;
const papeis = { administrador: 'Administrador', rh: 'RH', visualizador: 'Visualizador' };

export function validarUsuario(d, id) {
    if (!String(d.nome || '').trim() || !String(d.email || '').trim())
        return 'Preencha nome e e-mail.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'Informe um e-mail válido.';
    if (!papeis[d.permissao]) return 'Selecione uma permissão válida.';
    if (!['ativo', 'bloqueado'].includes(d.status)) return 'Selecione uma situação válida.';
    if (itens('usuarios').some((u) => u.id !== id && chave(u.email) === chave(d.email)))
        return 'Já existe um usuário com este e-mail.';
    return '';
}

function acesso(v) {
    if (!v) return 'Ainda sem registro';
    const d = new Date(v);
    if (!Number.isFinite(+d)) return 'Ainda sem registro';
    const hoje = dateKey(new Date());
    return `${dateKey(d) === hoje ? 'Hoje' : d.toLocaleDateString('pt-BR')}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function view() {
    const usuarios = itens('usuarios'),
        pronto = carregado('usuarios');
    pagina = Math.min(pagina, Math.max(0, Math.ceil(usuarios.length / 6) - 1));
    const rows = usuarios.slice(pagina * 6, pagina * 6 + 6),
        ativos = usuarios.filter((u) => u.status !== 'bloqueado').length,
        admins = usuarios.filter((u) => u.permissao === 'administrador').length,
        bloqueados = usuarios.filter((u) => u.status === 'bloqueado').length;
    return `
        <div class="conf-page">
            <div class="breadcrumb">
                <span>Configurações</span>
                <span>›</span>
                <span class="destacado">Usuários</span>
            </div>
            <div class="cabecalho-pagina">
                <div>
                    <h1>Gerenciamento de Usuários</h1>
                    <p>Visualize, adicione e gerencie os perfis cadastrados no sistema.</p>
                </div>
                <button class="btn btn-primario" id="usr-novo">Novo Usuário</button>
            </div>
            <div class="conf-indicadores">
                ${[
                    ['Total de Usuários', usuarios.length, 'azul', '♙'],
                    ['Ativos', ativos, 'verde', '✓'],
                    ['Administradores', admins, 'neutro', '♧'],
                    ['Perfis Bloqueados', bloqueados, 'vermelho', '⊘']
                ]
                    .map(
                        ([n, v, c, i]) => `
                            <section class="conf-indicador conf-${c}">
                                <div>
                                    <h3>${n}</h3>
                                    <strong>${v}</strong>
                                </div>
                            </section>
                        `
                    )
                    .join('')}
            </div>
            <section class="cad-card cad-lista">
                <div class="cad-tabela-wrap">
                    <table class="cad-tabela conf-tabela">
                        <thead>
                            <tr>
                                <th>Usuário</th>
                                <th>Permissão</th>
                                <th>Último Acesso</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${
                                !pronto
                                    ? '<tr><td colspan="4">Carregando usuários…</td></tr>'
                                    : !rows.length
                                      ? '<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>'
                                      : rows
                                            .map(
                                                (u) => `
                                                    <tr data-busca>
                                                        <td>
                                                            <div class="conf-pessoa">
                                                                <span
                                                                    class="conf-avatar"
                                                                    style="background:${corAvatar(u.nome)}"
                                                                >
                                                                    ${esc(iniciais(u.nome))}
                                                                </span>
                                                                <div>
                                                                    <strong>${esc(u.nome)}</strong>
                                                                    <small>${esc(u.email)}</small>
                                                                    ${u.status === 'bloqueado' ? '<span class="mov-badge mov-badge-vermelho">Bloqueado</span>' : ''}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span
                                                                class="conf-papel conf-papel-${papeis[u.permissao] ? u.permissao : 'visualizador'}"
                                                            >
                                                                ${esc(papeis[u.permissao] || 'Visualizador')}
                                                            </span>
                                                        </td>
                                                        <td>${esc(acesso(u.ultimoAcesso))}</td>
                                                        <td>
                                                            <button
                                                                class="conf-editar"
                                                                data-usr-editar="${esc(u.id)}"
                                                                aria-label="Editar ${esc(u.nome)}"
                                                            >
                                                                <span>Editar</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `
                                            )
                                            .join('')
                            }
                        </tbody>
                    </table>
                </div>
                <footer class="cad-paginacao">
                    <span>Exibindo ${rows.length} de ${usuarios.length} usuários</span>
                    <div>
                        <button
                            class="btn btn-secundario cad-btn-peq"
                            id="usr-anterior"
                            ${pagina === 0 ? 'disabled' : ''}
                        >
                            ‹ Anterior
                        </button>
                        <span>${pagina + 1}</span>
                        <button
                            class="btn btn-secundario cad-btn-peq"
                            id="usr-proximo"
                            ${(pagina + 1) * 6 >= usuarios.length ? 'disabled' : ''}
                        >
                            Próximo ›
                        </button>
                    </div>
                </footer>
            </section>
            <p class="conf-nota">
                O login titular é o proprietário desta empresa. Os demais perfis desta lista são
                registros administrativos: não criam logins nem compartilham o acesso da empresa.
            </p>
        </div>
    `;
}

function formulario(id) {
    if (!carregado('usuarios')) return toast('Aguarde o carregamento.');
    const u = state.usuarios?.[id] || { permissao: 'visualizador', status: 'ativo' };
    abrirModal({
        titulo: id ? 'Editar usuário' : 'Novo usuário',
        corpo: `${campo('nome', 'Nome completo', u.nome, 'maxlength="160" autocomplete="name" required')}${campo('email', 'E-mail', u.email, 'type="email" maxlength="254" autocomplete="email" required')}<div class="cad-duas-colunas"><label class="cad-campo"><span>Permissão</span><select name="permissao">${Object.entries(
            papeis
        )
            .map(
                ([v, t]) => `
                    <option value="${v}" ${u.permissao === v ? 'selected' : ''}>${t}</option>
                `
            )
            .join(
                ''
            )}</select></label><label class="cad-campo"><span>Situação do perfil</span><select name="status"><option value="ativo" ${u.status !== 'bloqueado' ? 'selected' : ''}>Ativo</option><option value="bloqueado" ${u.status === 'bloqueado' ? 'selected' : ''}>Bloqueado</option></select></label></div><p class="dica">Para outra empresa, crie uma conta na tela de acesso. Perfis adicionais aqui não recebem credenciais de login.</p><p class="erro" data-erro hidden></p>`,
        aoAbrir: (c) => {
            const form = $('form', c);
            $('.modal-rodape', c).insertAdjacentHTML(
                'beforeend',
                '<button type="button" class="btn btn-primario" data-usr-gravar>Salvar Usuário</button>'
            );
            const salvar = async () => {
                if (form.dataset.salvando) return;
                const f = Object.fromEntries(new FormData(form)),
                    d = { ...f, nome: f.nome.trim(), email: f.email.trim().toLowerCase() };
                if (
                    u.titular &&
                    (d.status !== 'ativo' || d.permissao !== 'administrador' || d.email !== u.email)
                )
                    return erroForm(
                        form,
                        'A conta titular deve permanecer ativa e administradora. O e-mail de login não é alterado por este cadastro.'
                    );
                const erro = validarUsuario(d, id);
                if (erro) return erroForm(form, erro);
                const payload = { ...u, ...d, criadoEm: u.criadoEm || new Date().toISOString() };
                if (
                    await executar(
                        form,
                        () => gravar(`usuarios/${id || novoId('usuarios')}`, payload),
                        'Usuário salvo.'
                    )
                )
                    fecharModal();
            };
            $('[data-usr-gravar]', c).addEventListener('click', salvar);
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                salvar();
            });
        }
    });
}

export function bind({ render }) {
    $('#usr-novo').addEventListener('click', () => formulario());
    $$('[data-usr-editar]').forEach((b) =>
        b.addEventListener('click', () => formulario(b.dataset.usrEditar))
    );
    $('#usr-anterior').addEventListener('click', () => {
        pagina--;
        render();
    });
    $('#usr-proximo').addEventListener('click', () => {
        pagina++;
        render();
    });
}
