import { $, esc, lista } from './utils.js';
import { state } from './state.js';
import { db, usandoFirebase } from './db.js';
import { toast } from './ui.js';

export const chave = (s) =>
    String(s || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
export const carregado = (...nomes) => nomes.every((n) => state.carregados?.[n]);
export const itens = (nome) =>
    lista(state[nome]).sort((a, b) =>
        (a.nome || a.descricao || '').localeCompare(b.nome || b.descricao || '', 'pt-BR')
    );
export const colaboradores = (tipo, item) =>
    lista(state.funcionarios).filter(
        (f) =>
            f.status !== 'desligado' &&
            (f[`${tipo}Id`] ? f[`${tipo}Id`] === item.id : chave(f[tipo]) === chave(item.nome))
    );
export const numero = (n) => String(n).padStart(2, '0');

export function cabecalho(grupo, titulo, texto, acoes = '') {
    return `
        <div class="breadcrumb">
            <span>Cadastro</span>
            <span>›</span>
            <span class="destacado">${esc(grupo)}</span>
        </div>
        <div class="cabecalho-pagina">
            <div>
                <h1>${esc(titulo)}</h1>
                <p>${esc(texto)}</p>
            </div>
            <div class="botoes-acao">${acoes}</div>
        </div>
    `;
}
export const semDados = (msg = 'Nenhum cadastro encontrado.') => `
    <p class="cad-vazio">${esc(msg)}</p>
`;
export const aguarde = () => semDados('Carregando dados…');

export function erroForm(form, mensagem, campo) {
    const el = $('[data-erro]', form);
    if (el) {
        el.hidden = false;
        el.textContent = mensagem;
    }
    if (campo) $(`[name="${campo}"]`, form)?.focus();
}

export function campo(nome, rotulo, valor = '', opts = '') {
    return `
        <label class="cad-campo">
            <span>${esc(rotulo)}</span>
            <input name="${nome}" value="${esc(valor)}" ${opts} />
        </label>
    `;
}

export function opcoes(lista, atual, placeholder = 'Selecione') {
    return (
        `<option value="">${esc(placeholder)}</option>` +
        lista
            .map(
                (x) => `
                    <option value="${esc(x.id)}" ${x.id === atual ? ' selected' : ''}>
                        ${esc(x.nome || x.descricao)}
                    </option>
                `
            )
            .join('')
    );
}

export function novoId(path) {
    return db.novoId(path);
}

export async function gravar(path, val) {
    return db.set(path, val);
}

export async function executar(form, acao, sucesso) {
    if (form.dataset.salvando) return false;
    form.dataset.salvando = 'true';
    const controles = [...form.querySelectorAll('input,select,textarea,button')].map((el) => [
        el,
        el.disabled
    ]);
    controles.forEach(([el]) => (el.disabled = true));
    try {
        await acao();
        toast(sucesso);
        return true;
    } catch {
        erroForm(form, 'Não foi possível salvar. Confira a conexão e as permissões do banco.');
        toast('Não foi possível salvar os dados.', 'erro');
        return false;
    } finally {
        delete form.dataset.salvando;
        controles.forEach(([el, disabled]) => (el.disabled = disabled));
    }
}

export function exportarCSV(nome, linhas) {
    const limpar = (v) => {
        let s = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
    };
    const blob = new Blob(['\uFEFF' + linhas.map((l) => l.map(limpar).join(';')).join('\r\n')], {
        type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob),
        a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
