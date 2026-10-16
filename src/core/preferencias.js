import { state } from './state.js';

export function perfilId() {
    const uid = window.fb?.auth?.currentUser?.uid;
    if (!uid) throw Error('Sessão não autenticada.');
    return uid;
}
export const perfilPadrao = () => ({
    nome: window.fb?.auth?.currentUser?.displayName || 'Minha Conta',
    email: window.fb?.auth?.currentUser?.email || '',
    cargo: 'Administrador do Sistema',
    departamento: 'RH',
    foto: ''
});
export const perfilAtual = () => ({ ...perfilPadrao(), ...(state.preferencias?.perfil || {}) });
export const alertasAtuais = () => ({
    atrasos: true,
    ausencias: true,
    extras: false,
    ...(state.preferencias?.alertas || {})
});

export function preencherHeader() {
    const p = perfilAtual(),
        nome = document.querySelector('.usuario span'),
        avatar = document.querySelector('.info-usuario > .avatar');
    if (nome) nome.textContent = p.nome;
    if (avatar) {
        avatar.textContent =
            p.nome
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((s) => s[0])
                .join('')
                .toUpperCase() || '?';
        if (p.foto) {
            const img = document.createElement('img');
            img.src = p.foto;
            img.alt = '';
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
            avatar.replaceChildren(img);
        }
    }
}
