import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { criarGestao } from './gestao-service.mjs';
import { getAuth } from 'firebase-admin/auth';
import { criarHandler } from './http.mjs';
import { criarStore } from './firebase-store.mjs';

const projectId = process.env.FIREBASE_PROJECT_ID || 'mixponto-ffe50';
const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://mixponto-ffe50-default-rtdb.firebaseio.com';
const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if ((emulatorHost || authEmulator) && (projectId !== 'demo-mixponto' || !emulatorHost || !authEmulator))
    throw Error('Use os dois emuladores juntos e somente com o projeto demo-mixponto.');
const credential = applicationDefault();
const app = initializeApp({ projectId, databaseURL, credential });
const store = criarStore({ databaseURL, credential, projectId, emulatorHost });
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:8787,http://localhost:8787').split(',').map(s => s.trim()).filter(Boolean);
const config = {
    adminEmail: (process.env.PLATFORM_ADMIN_EMAIL || 'laertelai12@gmail.com').trim().toLowerCase(),
    adminUids: (process.env.PLATFORM_ADMIN_UIDS || '').split(',').map(s=>s.trim()).filter(Boolean),
    resellerUids: (process.env.RESELLER_UIDS || '').split(',').map(s=>s.trim()).filter(Boolean),
};
const gestao = criarGestao(getDatabase(app),getAuth(app),config,store);
const handler = criarHandler({
    gestao,
    verifyToken: async token => {
        const identity=await getAuth(app).verifyIdToken(token,true);
        const record=await getAuth(app).getUser(identity.uid);
        return {...identity,mixpontoGeral:record.customClaims?.mixpontoGeral===true,mixpontoRevendedor:record.customClaims?.mixpontoRevendedor===true};
    }, store,
    siteRoot: fileURLToPath(new URL('../', import.meta.url)), allowedOrigins,
});
const server = createServer((req, res) => {
    handler(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'Não foi possível concluir a requisição.' }));
    });
});
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => console.log('MixPonto disponível na porta ' + server.address().port));
