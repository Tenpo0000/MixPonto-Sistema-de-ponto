import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    getDatabase,
    ref,
    onValue,
    push,
    set,
    remove,
    update,
    get,
    runTransaction
} from './core/firebase-tenant.js';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: 'AIzaSyATekRkxlRuGqxPShBpF5_MR8xrOCXk0qQ',
    authDomain: 'mixponto-ffe50.firebaseapp.com',
    databaseURL: 'https://mixponto-ffe50-default-rtdb.firebaseio.com',
    projectId: 'mixponto-ffe50',
    storageBucket: 'mixponto-ffe50.firebasestorage.app',
    messagingSenderId: '910575501364',
    appId: '1:910575501364:web:31ff4ee81d33100cbfca61'
};
const app = initializeApp(firebaseConfig),
    db = getDatabase(app),
    auth = getAuth(app);
export { app, db, auth };
window.fb = {
    contasApiUrl: document.querySelector('meta[name="mixponto-contas-api"]')?.content || '/api/contas',
    app,
    db,
    auth,
    ref,
    onValue,
    push,
    set,
    remove,
    update,
    get,
    runTransaction,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    sendEmailVerification
};
