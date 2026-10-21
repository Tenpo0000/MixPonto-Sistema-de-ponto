/* Toda leitura/gravação é relativa à conta autenticada. Sem fallback global/local. */
import { toast } from './ui.js';

const fb = window.fb,
    uid = fb?.auth?.currentUser?.uid;
if (!uid) throw Error('Entre na sua conta antes de carregar o sistema.');
// UID identifica a pessoa; contaAtiva identifica o ambiente. O fallback atende
// contas antigas cuja chave era o UID e não deve substituir a seleção atual.
const conta = fb.contaAtiva?.id || uid;
const base = `contas/${conta}`,
    assinaturas = new Set();
let encerrado = false;

// Este módulo fica vinculado à conta em que foi carregado. Callbacks antigos
// não podem continuar operando depois de sair ou trocar de empresa.
function sessao() {
    if (encerrado || fb.auth.currentUser?.uid !== uid || (fb.contaAtiva?.id || uid) !== conta)
        throw Error('A sessão mudou. Entre novamente.');
}

function validarPath(path) {
    if (
        typeof path !== 'string' ||
        !path ||
        path.startsWith('/') ||
        path.endsWith('/') ||
        path.split('/').some((p) => !p || /[.#$\[\]]/.test(p))
    )
        throw Error('Caminho de dados inválido.');
    return path;
}

function referencia(path) {
    sessao();
    return fb.ref(fb.db, `${base}/${validarPath(path)}`);
}
export const db = {
    listen(path, cb) {
        const r = referencia(path);
        const off = fb.onValue(
            r,
            (snap) => {
                if (!encerrado && fb.auth.currentUser?.uid === uid && (fb.contaAtiva?.id || uid) === conta) cb(snap.val());
            },
            (e) => {
                console.error(e);
                if (e.code === 'permission_denied') window.dispatchEvent(new Event('mixponto:acesso-revogado'));
                if (!encerrado)
                    toast(
                        'Sem acesso aos dados da empresa. Confira as regras do Firebase e sua sessão.',
                        'erro'
                    );
            }
        );
        assinaturas.add(off);
        return () => {
            off();
            assinaturas.delete(off);
        };
    },
    set(path, val) {
        return fb.set(referencia(path), val);
    },
    push(path, val) {
        const r = fb.push(referencia(path));
        fb.set(r, val).catch((e) => {
            console.error(e);
            toast('Não foi possível salvar os dados.', 'erro');
        });
        return r.key;
    },
    novoId(path) {
        return fb.push(referencia(path)).key;
    },
    remove(path) {
        return fb.remove(referencia(path));
    },
    // Caminhos são relativos à conta: um único lote mantém vínculos consistentes.
    async update(mudancas) {
        sessao();
        if (!mudancas || typeof mudancas !== 'object' || Array.isArray(mudancas))
            throw Error('Atualização inválida.');
        for (const p of Object.keys(mudancas)) validarPath(p);
        await fb.update(fb.ref(fb.db, base), mudancas);
    },
    transacao(path, atualizar) {
        return fb.runTransaction(
            referencia(path),
            (atual) => {
                sessao();
                return atualizar(atual);
            },
            { applyLocally: false }
        );
    },
    destroy() {
        encerrado = true;
        for (const off of assinaturas) off();
        assinaturas.clear();
    }
};
window.addEventListener('mixponto:encerrar', () => db.destroy());
