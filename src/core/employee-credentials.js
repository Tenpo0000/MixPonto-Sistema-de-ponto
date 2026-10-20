import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDatabase, ref, get, set, serverTimestamp, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
import { authorizeMobile, employeeForAccess } from './mobile-access.js';

export async function createEmployeeAccess({ auth, db, fid, email, password, emulators = null }) {
    const administrator = auth.currentUser;
    if (!administrator) throw new Error('Entre como titular da empresa.');
    const mail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error('Informe um e-mail válido para o funcionário.');
    if (mail === administrator.email?.toLowerCase()) throw new Error('Use um e-mail diferente do administrador.');
    if (typeof password !== 'string' || password.length < 8) throw new Error('Defina uma senha com pelo menos 8 caracteres.');
    await employeeForAccess(db, administrator.uid, fid);

    // A sessão temporária não substitui o titular nem persiste o login do funcionário.
    const app = initializeApp(auth.app.options, `employee-${globalThis.crypto.randomUUID()}`);
    const temporaryAuth = initializeAuth(app, { persistence: inMemoryPersistence });
    const temporaryDb = getDatabase(app);
    if (emulators) {
        connectAuthEmulator(temporaryAuth, emulators.auth, { disableWarnings: true });
        connectDatabaseEmulator(temporaryDb, emulators.databaseHost, emulators.databasePort);
    }
    let identified = false;
    try {
        let credential;
        try {
            credential = await createUserWithEmailAndPassword(temporaryAuth, mail, password);
        } catch (error) {
            if (error.code !== 'auth/email-already-in-use') throw error;
            // Permite concluir uma criação cujo vínculo não foi confirmado na primeira tentativa.
            // A senha de uma conta existente nunca é sobrescrita.
            try {
                credential = await signInWithEmailAndPassword(temporaryAuth, mail, password);
            } catch (signInError) {
                if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(signInError.code)) {
                    throw new Error('Este e-mail já tem conta e a senha informada não confere. Use a senha atual ou outro e-mail.');
                }
                throw signInError;
            }
        }
        identified = true;
        const user = credential.user;
        if (user.uid === administrator.uid) throw new Error('Use uma conta individual de funcionário.');
        await user.getIdToken(true);
        const identityRef = ref(temporaryDb, `solicitacoesMobile/${user.uid}`);
        if (!(await get(identityRef)).exists()) {
            try {
                await set(identityRef, { email: user.email, criadoEm: serverTimestamp() });
            } catch (error) {
                if (!(await get(identityRef)).exists()) throw error;
            }
        }
        if (auth.currentUser?.uid !== administrator.uid) throw new Error('A sessão do administrador mudou. Entre novamente antes de liberar o acesso.');
        await authorizeMobile(db, administrator.uid, fid, user.uid);
        return { uid: user.uid, email: user.email };
    } catch (error) {
        const messages = {
            'auth/weak-password': 'A senha não atende à política do Firebase. Use uma senha mais forte.',
            'auth/password-does-not-meet-requirements': 'A senha não atende à política do Firebase. Use uma senha mais forte.',
            'auth/invalid-email': 'Confira o e-mail do funcionário.',
            'auth/operation-not-allowed': 'Habilite o provedor E-mail/senha no Firebase Authentication.',
            'auth/user-disabled': 'Esta conta está desativada no Firebase Authentication. Confira a situação antes de liberar o acesso.',
            'auth/too-many-requests': 'Muitas tentativas. Aguarde antes de tentar novamente.',
            'auth/network-request-failed': 'Falha de conexão. Tente novamente com o mesmo e-mail e senha.',
        };
        if (messages[error.code]) throw new Error(messages[error.code]);
        if (identified && error.code) throw new Error('A conta foi identificada, mas o vínculo não foi confirmado. Confira as regras e a conexão e tente novamente com o mesmo e-mail e senha.');
        throw error;
    } finally {
        await signOut(temporaryAuth).catch(() => {});
        await deleteApp(app);
    }
}
