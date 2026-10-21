const chave = 'mixponto-aviso-privacidade';
const versao = '2026-10-20.1';

// Não é consentimento genérico: a versão atual utiliza somente armazenamento
// necessário. Rastreadores opcionais não são instalados por este módulo.
export function consultarArmazenamento(event) {
    const anterior = event?.currentTarget || null;
    document.getElementById('aviso-armazenamento')?.remove();
    const box = document.createElement('aside');
    box.id = 'aviso-armazenamento';
    box.className = 'aviso-armazenamento';
    box.setAttribute('aria-label', 'Armazenamento e privacidade');
    const title = document.createElement('h2');
    title.id = 'aviso-armazenamento-titulo';
    title.tabIndex = -1;
    box.setAttribute('aria-labelledby', title.id);
    title.textContent = 'Privacidade neste dispositivo';
    const text = document.createElement('p');
    text.textContent = 'Usamos armazenamento necessário para login, troca de conta e confirmação de envios. Não instalamos rastreadores de publicidade ou análise. Consultar o aviso não é autorizar novos usos dos seus dados.';
    const link = document.createElement('a');
    link.href = 'politicas.html#cookies'; link.textContent = 'Detalhes sobre cookies e armazenamento';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = 'Entendi';
    close.onclick = () => {
        try { localStorage.setItem(chave, versao); } catch { /* O aviso funciona sem armazenamento disponível. */ }
        const restaurar = box.contains(document.activeElement);
        box.remove();
        if (restaurar && anterior?.isConnected) anterior.focus();
    };
    box.append(title, text, link, close);
    document.body.append(box);
    if (anterior) title.focus();
}

if (document.querySelector('[data-aviso-privacidade]')) {
    document.querySelectorAll('[data-aviso-privacidade]').forEach(b => b.addEventListener('click', consultarArmazenamento));
    try { if (localStorage.getItem(chave) !== versao) consultarArmazenamento(); } catch { consultarArmazenamento(); }
}
