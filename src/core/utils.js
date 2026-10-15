/* Constantes, utilitários e ícones compartilhados por todas as páginas */

export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const DIAS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
export const DIAS_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const ROTULO_BATIDA = ['Entrou','Pausa','Voltou','Saída'];

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const pad = n => String(n).padStart(2, '0');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const fmtMin = m => `${pad(Math.floor(m / 60))}:${pad(Math.floor(m % 60))}`;
export const fmtHora = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const fmtData = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const lista = obj => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));
export const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
export const iniciais = nome => (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const CORES_AVATAR = ['#2f5fd0', '#7c3aed', '#0e8a6a', '#c2410c', '#a21caf', '#0369a1', '#b45309', '#be123c'];
export const corAvatar = nome => CORES_AVATAR[[...(nome || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES_AVATAR.length];

const svg = d => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICONES = {
    home: svg('<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'),
    cadastro: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M19 8v6M16 11h6"/>'),
    mov: svg('<path d="M4 8h14l-4-4M20 16H6l4 4"/>'),
    config: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'),
    sino: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    busca: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    timer: svg('<circle cx="12" cy="14" r="8"/><path d="M12 14v-4M9 2h6"/>'),
    semUser: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M3 3l18 18"/>'),
    guardaChuva: svg('<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v7a2 2 0 0 1-4 0"/>'),
    calX: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M10 14l4 4M14 14l-4 4"/>'),
    recibo: svg('<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>')
};
