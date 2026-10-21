const sobreposicoes = [];

/** Contém o foco, inclusive em navegadores sem suporte a inert. */
export function conterFoco(container, fechar) {
    const anterior = document.activeElement;
    const tabindex = container.getAttribute('tabindex');
    let ativa = true;
    sobreposicoes.push(container);
    const siblings = [...document.body.children].filter(el => el !== container && !el.contains(container));
    const estados = siblings.map(el => [el, el.inert]);
    for (const [el] of estados) el.inert = true;
    const seletores = 'button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
    const campos = () => [...container.querySelectorAll(seletores)].filter(el => !el.closest('[hidden],[inert],[aria-hidden="true"]') && el.getClientRects().length);
    const principal = () => ativa && sobreposicoes.at(-1) === container;
    const focar = () => (campos()[0] || container).focus();
    const tecla = event => {
        if (!principal()) return;
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); fechar();
        } else if (event.key === 'Tab') {
            const items = campos();
            const destino = event.shiftKey ? items.at(-1) : items[0];
            if (!items.length) { event.preventDefault(); container.focus(); }
            else if (!container.contains(document.activeElement) || (!event.shiftKey && document.activeElement === items.at(-1)) || (event.shiftKey && document.activeElement === items[0])) {
                event.preventDefault(); destino.focus();
            }
        }
    };
    const foco = event => {
        if (principal() && !container.contains(event.target)) focar();
    };
    container.setAttribute('tabindex', '-1');
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('focusin', foco, true);
    queueMicrotask(() => { if (principal() && container.isConnected) focar(); });
    return () => {
        if (!ativa) return;
        ativa = false;
        sobreposicoes.splice(sobreposicoes.indexOf(container), 1);
        document.removeEventListener('keydown', tecla, true);
        document.removeEventListener('focusin', foco, true);
        if (tabindex === null) container.removeAttribute('tabindex');
        else container.setAttribute('tabindex', tabindex);
        for (const [el, inert] of estados) el.inert = inert;
        if (anterior?.isConnected && !anterior.closest('[inert]')) anterior.focus();
    };
}
