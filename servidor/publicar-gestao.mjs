// Publica somente regras; nunca reimporta, renumera ou substitui dados operacionais.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder=process.argv[2], apply=process.argv.includes('--aplicar');
if(!folder || process.env.FIREBASE_DATABASE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error('Informe uma pasta nova e desative emuladores.');
const credential=applicationDefault();
const info=JSON.parse(await fs.readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
if(info.project_id!=='mixponto-ffe50') throw Error('Credencial de outro projeto.');
const app=initializeApp({projectId:info.project_id,credential});
const central=await getAuth(app).getUserByEmail('laertelai12@gmail.com');
if(central.disabled) throw Error('Administrador padrão desativado.');
await fs.mkdir(folder,{recursive:false});
const token=(await credential.getAccessToken()).access_token;
const request=(endpoint,options={})=>fetch('https://mixponto-ffe50-default-rtdb.firebaseio.com'+endpoint,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
const [dataResponse,rulesResponse]=await Promise.all([request('/.json'),request('/.settings/rules.json')]);
if(!dataResponse.ok || !rulesResponse.ok) throw Error('Não foi possível salvar o backup.');
const data=await dataResponse.json(),before=await rulesResponse.json();
const after=JSON.parse(await fs.readFile(new URL('../firebase/database.rules.json',import.meta.url),'utf8'));
assert.equal(after.rules.contas.$empresa['.write'],false);
for(const [name,value] of Object.entries({'banco-antes.json':data,'regras-antes.json':before,'regras-novas.json':after}))
    await fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2),{flag:'wx'});
if(apply){
    const saved=await request('/.settings/rules.json',{method:'PUT',body:JSON.stringify(after)});
    if(!saved.ok) throw Error('Firebase recusou as regras.');
    const actual=await request('/.settings/rules.json');assert.deepEqual(await actual.json(),after);
    // Configuração local privada, preservando valores já definidos pelo operador.
    const envPath=new URL('.env',import.meta.url);
    let env='';try{env=await fs.readFile(envPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!/^PLATFORM_ADMIN_UIDS=.+/m.test(env)) env+='\nPLATFORM_ADMIN_UIDS='+central.uid+'\n';
    if(!/^PLATFORM_ADMIN_EMAIL=/m.test(env)) env+='PLATFORM_ADMIN_EMAIL=laertelai12@gmail.com\n';
    if(!/^GOOGLE_APPLICATION_CREDENTIALS=/m.test(env)) env+='GOOGLE_APPLICATION_CREDENTIALS='+process.env.GOOGLE_APPLICATION_CREDENTIALS.replaceAll('\\','/')+'\n';
    await fs.writeFile(envPath,env);
}
const result={aplicado:apply,contas:Object.keys(data.contas || {}).length,sequenciaContas:data.sequenciaContas,administradorPrecisaVerificarEmail:!central.emailVerified,dadosOperacionaisAlterados:false};
await fs.writeFile(path.join(folder,'resultado.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
