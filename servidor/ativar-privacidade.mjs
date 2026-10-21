import fs from 'node:fs/promises';
import path from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { inventariarCopias, bloquearELimpar } from './privacidade-cleanup.mjs';

const apply = process.argv.includes('--aplicar');
const folder = process.argv.slice(2).find(a => a !== '--aplicar');
if (!folder || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST)
    throw Error('Informe uma pasta nova para o relatório, fora da pasta pública. Não use emuladores.');
const publicRoot = (await fs.realpath(fileURLToPath(new URL('../src', import.meta.url)))).toLowerCase();
const resolvedFolder = path.resolve(await fs.realpath(path.dirname(path.resolve(folder))), path.basename(folder));
if (resolvedFolder.toLowerCase() === publicRoot || resolvedFolder.toLowerCase().startsWith(publicRoot + path.sep))
    throw Error('Relatórios não podem ficar na pasta pública src.');
const key = JSON.parse(await fs.readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
if (key.project_id !== 'mixponto-ffe50') throw Error('Projeto incompatível.');
const credential = applicationDefault();
const url = 'https://mixponto-ffe50-default-rtdb.firebaseio.com';
const app = initializeApp({ credential, projectId: key.project_id, databaseURL: url });
const database = getDatabase(app);
const token = (await credential.getAccessToken()).access_token;
const rulesUrl = `${url}/.settings/rules.json`;
const request = options => fetch(rulesUrl, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000) });
const before = await request();
if (!before.ok) throw Error('Não foi possível preservar as regras anteriores.');
const rules = JSON.parse(await fs.readFile(new URL('../firebase/database.rules.json', import.meta.url), 'utf8'));
assert.equal(rules.rules.contas.$empresa.credenciaisApp['.write'], false);
assert.ok(rules.rules.contas.$empresa.privacidade);
await fs.mkdir(resolvedFolder, { recursive: false });
await fs.writeFile(path.join(resolvedFolder, 'regras-antes.json'), JSON.stringify(await before.json(), null, 2), { flag: 'wx' });
await fs.writeFile(path.join(resolvedFolder, 'regras-novas.json'), JSON.stringify(rules, null, 2), { flag: 'wx' });
const readAccounts = async () => (await database.ref('contas').get()).val() || {};
let inventory;
if (apply) {
    inventory = await bloquearELimpar({
        publish: async () => {
            const saved = await request({ method: 'PUT', body: JSON.stringify(rules) });
            if (!saved.ok) throw Error('Publicação das regras recusada. Nenhuma cópia foi removida.');
        },
        readAccounts,
        removePaths: changes => database.ref().update(changes),
    });
    const actual = await request();
    assert.ok(actual.ok);
    assert.deepEqual(await actual.json(), rules);
} else inventory = inventariarCopias(await readAccounts());
const report = { aplicado: apply, contas: inventory.contas, copiasDeSenhaEncontradas: inventory.copies,
    camposLegadosEncontrados: inventory.legacy, ausenciaConferidaAposBloqueio: apply, senhasAuthenticationAlteradas: false };
await fs.writeFile(path.join(resolvedFolder, 'resultado.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify(report));
process.exit(0);
