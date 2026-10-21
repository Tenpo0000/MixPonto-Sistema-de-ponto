import { consultarArmazenamento } from './privacidade.js';

const criar = (tag, texto) => Object.assign(document.createElement(tag), { textContent: texto });
try {
    const response = await fetch('./legal/politicas.json', { cache: 'no-store' });
    if (!response.ok) throw Error('Documentos indisponíveis.');
    const data = await response.json();
    document.getElementById('aviso').textContent = data.aviso;
    document.getElementById('versao').textContent = `Versão ${data.versao} · Atualização: ${data.atualizadoEm} · Texto ${data.estado}`;
    const owner = document.getElementById('responsavel');
    owner.append(criar('h2', 'Responsável pelo serviço'));
    for (const [label, key] of [['Nome', 'nome'], ['Documento, se aplicável', 'documento'], ['Endereço de atendimento', 'endereco'], ['Contato de privacidade', 'emailPrivacidade']])
        owner.append(criar('p', `${label}: ${data.responsavel[key] || 'ainda não definido'}`));
    const nav = document.getElementById('documentos');
    for (const item of data.documentos) {
        const link = criar('a', item.titulo);
        link.href = `#${item.id}`;
        nav.append(link);
    }
    function render() {
        const item = data.documentos.find(d => `#${d.id}` === location.hash) || data.documentos[0];
        const article = document.getElementById('documento');
        article.replaceChildren(criar('h2', item.titulo));
        for (const section of item.secoes) article.append(criar('h3', section.titulo), criar('p', section.texto));
        for (const link of nav.children) link.setAttribute('aria-current', link.hash === `#${item.id}` ? 'page' : 'false');
        document.title = `${item.titulo} · MixPonto`;
    }
    for (const source of data.fontes) {
        const link = criar('a', source.titulo);
        link.href = source.url;
        document.getElementById('fontes').append(link);
    }
    window.addEventListener('hashchange', () => {
        render();
        const article = document.getElementById('documento');
        article.tabIndex = -1;
        article.focus();
    });
    document.getElementById('armazenamento').onclick = consultarArmazenamento;
    render();
} catch {
    document.getElementById('aviso').textContent = 'Não foi possível consultar os documentos. Tente novamente ou procure a empresa responsável.';
}
