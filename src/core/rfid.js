/* Vínculo RFID salvo com o funcionário em uma atualização atômica. */
import { state } from './state.js';
import { db } from './db.js';

export const normalizarCartao = valor => String(valor || '').replace(/\s+/g, '').toUpperCase();
export function validarCartao(valor, id) {
    const uid = normalizarCartao(valor);
    if (!uid) return '';
    if (!/^(?:[0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/.test(uid))
        return 'Informe o UID hexadecimal completo do cartão (8, 14 ou 20 caracteres).';
    if (Object.entries(state.funcionarios || {}).some(([outroId, f]) => outroId !== id && normalizarCartao(f.cartaoUid) === uid))
        return 'Este cartão já está vinculado a outro funcionário. Remova o vínculo anterior para transferi-lo.';
    return '';
}
export async function salvarFuncionarioComCartao(id, funcionario) {
    const erro = validarCartao(funcionario.cartaoUid, id);
    if (erro) throw Error(erro);
    const anterior = state.funcionarios?.[id] || {};
    const antigo = normalizarCartao(anterior.cartaoUid);
    const uid = normalizarCartao(funcionario.cartaoUid);
    const salvo = { ...funcionario, cartaoUid: uid, cartaoVersao: Number(anterior.cartaoVersao || 0) + 1 };
    const mudancas = { [`funcionarios/${id}`]: salvo };
    if (antigo && antigo !== uid) mudancas[`cartoes/${antigo}`] = null;
    if (uid) mudancas[`cartoes/${uid}`] = id;
    await db.update(mudancas);
}
