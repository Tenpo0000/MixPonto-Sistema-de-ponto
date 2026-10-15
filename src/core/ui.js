/* Toast e modal */
import { $, $$, esc } from './utils.js';

export function toast(msg, tipo) {
    const el = document.createElement('div');
    el.className = 'notificacao' + (tipo === 'erro' ? ' erro-toast' : '');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('visivel'), 10);
    setTimeout(() => { el.classList.remove('visivel'); setTimeout(() => el.remove(), 300); }, 3200);
}

export function fecharModal() { $('#modal-container')?.remove(); }

export function abrirModal({ titulo, corpo, salvarTxt = 'Salvar', onSalvar, largo = false, aoAbrir }) {
    fecharModal();
    const c = document.createElement('div');
    c.id = 'modal-container';
    c.innerHTML = `
        <div class="modal-overlay">
            <div class="modal${largo ? ' largo' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
                <div class="modal-header">
                    <h2 id="modal-titulo">${esc(titulo)}</h2>
                    <button type="button" class="fechar-modal" aria-label="Fechar">&times;</button>
                </div>
                <form novalidate>
                    <div class="modal-corpo">${corpo}<p class="erro" id="modal-erro" hidden></p></div>
                    <div class="modal-rodape">
                        <button type="button" class="btn btn-secundario fechar-modal-btn">${onSalvar ? 'Cancelar' : 'Fechar'}</button>
                        ${onSalvar ? `<button type="submit" class="btn btn-primario">${esc(salvarTxt)}</button>` : ''}
                    </div>
                </form>
            </div>
        </div>`;
    document.body.appendChild(c);
    const overlay = $('.modal-overlay', c);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) fecharModal(); });
    $$('.fechar-modal, .fechar-modal-btn', c).forEach(b => b.addEventListener('click', fecharModal));
    $('form', c).addEventListener('submit', e => {
        e.preventDefault();
        if (!onSalvar) return;
        const erro = onSalvar(e.target);
        if (typeof erro === 'string') {
            const p = $('#modal-erro', c);
            p.textContent = erro; p.hidden = false;
        } else fecharModal();
    });
    aoAbrir?.(c);
    $('input:not([type=hidden]), select, textarea', c)?.focus();
    return c;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });
