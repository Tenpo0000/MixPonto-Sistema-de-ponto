/* Pedaços de interface reutilizados pelas páginas */
import { $$ } from './utils.js';
import { gerarDemo } from './demo.js';

export const vazio = (titulo, texto, botoes = '') => `
    <div class="vazio"><h2>${titulo}</h2><p>${texto}</p><div class="botoes-acao">${botoes}</div></div>`;

export const vazioInicialBotoes = `
    <button class="btn btn-primario" data-ir="cadastro">Cadastrar funcionário</button>
    <button class="btn btn-secundario" data-demo>Gerar dados de demonstração</button>`;

export function bindIr() {
    $$('[data-ir]').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.ir; }));
    $$('[data-demo]').forEach(b => b.addEventListener('click', gerarDemo));
}
