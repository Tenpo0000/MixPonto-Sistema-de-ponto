import { applicationDefault } from 'firebase-admin/app';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { migrarIdsContas } from '../firebase/migrar-ids-contas.mjs';

const apply = process.argv.includes('--aplicar');
const args = process.argv.slice(2).filter(v => v !== '--aplicar');
if (!args[0]) throw Error('Informe uma nova pasta para o backup e o resultado. Acrescente --aplicar somente para executar a atualização.');
const keyInfo = JSON.parse(await fs.readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS || '', 'utf8'));
if (keyInfo.project_id !== 'mixponto-ffe50' || process.env.FIREBASE_DATABASE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error('Configuração incompatível com o projeto de destino.');
const output = path.resolve(args[0]);
await fs.mkdir(output, { recursive: false });
const token = (await applicationDefault().getAccessToken()).access_token;
const base = 'https://mixponto-ffe50-default-rtdb.firebaseio.com';
const send = (endpoint, options = {}) => fetch(base + endpoint, { ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, signal: AbortSignal.timeout(20000) });
const [sourceResponse, rulesResponse] = await Promise.all([
    send('/.json', { headers: { 'X-Firebase-ETag': 'true' } }), send('/.settings/rules.json'),
]);
if (!sourceResponse.ok || !rulesResponse.ok) throw Error('Não foi possível obter os dados e as regras atuais.');
const etag = sourceResponse.headers.get('etag');
if (!etag) throw Error('O servidor não forneceu controle de concorrência.');
const before = await sourceResponse.json(), oldRules = await rulesResponse.json();
const { dados: after, relatorio } = migrarIdsContas(before);
function operational(data) {
    const copy = structuredClone(data);
    for (const key of ['empresasPorId','sequenciaEmpresas','contasPorId','sequenciaContas']) delete copy[key];
    for (const account of Object.values(copy.contas || {})) {
        if (account.meta) delete account.meta.codigoApp;
        if (account.empresa) delete account.empresa.codigoApp;
        for (const company of Object.values(account.empresas || {})) if (company) delete company.codigoApp;
    }
    return copy;
}
assert.deepEqual(operational(after), operational(before), 'Dados operacionais não podem mudar.');
const newRules = JSON.parse(await fs.readFile(new URL('../firebase/database.rules.json', import.meta.url), 'utf8'));
assert.equal(newRules.rules['.read'], false); assert.equal(newRules.rules['.write'], false);
assert.ok(newRules.rules.contasPorId && newRules.rules.sequenciaContas);
const save = (name, value) => fs.writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
await Promise.all([save('banco-antes.json', before), save('regras-antes.json', oldRules), save('banco-contas-numeradas.json', after), save('regras-novas.json', newRules)]);
const report = { ...relatorio, aplicado: false, dadosOperacionaisPreservados: true };
if (apply) {
    let rulesChanged = false, committed = false;
    try {
        const published = await send('/.settings/rules.json', { method: 'PUT', body: JSON.stringify(newRules) });
        if (!published.ok) throw Error('Falha ao publicar as novas regras.');
        rulesChanged = true;
        const updated = await send('/.json', { method: 'PUT', headers: { 'If-Match': etag }, body: JSON.stringify(after) });
        if (updated.status === 412) throw Error('O banco mudou após o backup; a substituição foi cancelada. Prepare uma nova tentativa.');
        if (!updated.ok) throw Error('O Firebase não confirmou a atualização da numeração.');
        committed = true;
        const check = await send('/.json');
        if (!check.ok) throw Error('Não foi possível conferir a gravação.');
        const actual = await check.json();
        const directory = value => Object.fromEntries(Object.entries(value || {}).filter(([, v]) => v));
        assert.deepEqual(directory(actual.contasPorId), directory(after.contasPorId), 'Índice publicado difere do preparado.');
        assert.equal(actual.sequenciaContas, after.sequenciaContas);
        assert.equal(actual.empresasPorId, undefined); assert.equal(actual.sequenciaEmpresas, undefined);
        assert.deepEqual(operational(actual), operational(before), 'Dados operacionais mudaram durante a conferência.');
        report.aplicado = true;
        report.verificadoNoFirebase = true;
    } catch (error) {
        report.aplicado = committed;
        if (committed) report.confirmacaoPendente = true;
        if (rulesChanged && !committed) {
            const currentResponse = await send('/.json');
            const current = currentResponse.ok ? await currentResponse.json() : null;
            const looksCommitted = current && !current.empresasPorId && current.sequenciaContas === after.sequenciaContas &&
                relatorio.ids.every(item => current.contas?.[item.contaId]?.meta?.codigoApp === item.codigoApp);
            if (!looksCommitted) {
                const restored = await send('/.settings/rules.json', { method: 'PUT', body: JSON.stringify(oldRules) });
                report.regrasRestauradas = restored.ok;
            } else { report.aplicado = true; report.confirmacaoPendente = true; }
        }
        report.erro = error.message;
        await save('resultado.json', report);
        throw error;
    }
}
report.backupSHA256 = createHash('sha256').update(JSON.stringify(before)).digest('hex');
await save('resultado.json', report);
console.log(JSON.stringify({ contas: report.contas, cadastrosEmpresa: report.cadastrosEmpresa, sequenciaContas: report.sequenciaContas, aplicado: report.aplicado, backup: output }, null, 2));
