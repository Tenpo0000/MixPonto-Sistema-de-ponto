/* Toda leitura/gravação é relativa à conta autenticada. Sem fallback global/local. */
import { toast } from './ui.js';

const fb = window.fb,
    uid = fb?.auth?.currentUser?.uid;
if (!uid) throw Error('Entre na sua conta antes de carregar o sistema.');
export const usandoFirebase = true;
const base = `contas/${uid}`,
    assinaturas = new Set();
let encerrado = false;

function sessao() {
    if (encerrado || fb.auth.currentUser?.uid !== uid)
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
                if (!encerrado && fb.auth.currentUser?.uid === uid) cb(snap.val());
            },
            (e) => {
                console.error(e);
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
