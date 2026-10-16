/* Preserva o cadastro antigo (id padrao) junto das novas empresas da conta. */
import { state } from './state.js';

export function empresasDisponiveis() {
    const empresas = Object.entries(state.empresas || {})
        .filter(([id]) => id !== 'padrao')
        .map(([id, e]) => ({ ...e, id }));
    if (state.empresa?.nome) empresas.push({ ...state.empresa, id: 'padrao' });
    return empresas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}
export const empresaPorId = (id) => empresasDisponiveis().find((e) => e.id === id);
