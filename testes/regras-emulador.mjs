/* Execute somente no emulador local. Não aponta para o projeto de produção. */
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
const env=await initializeTestEnvironment({projectId:'demo-mixponto-security',database:{host:'127.0.0.1',port:9000,rules:await readFile(new URL('../firebase/database.rules.json',import.meta.url),'utf8')}});
try{
 await env.clearDatabase();
 const a=env.authenticatedContext('empresaA').database(),b=env.authenticatedContext('empresaB').database(),anon=env.unauthenticatedContext().database();
 await assertSucceeds(a.ref('contas/empresaA/empresa').set({nome:'Empresa A'}));
 await assertSucceeds(b.ref('contas/empresaB/empresa').set({nome:'Empresa B'}));
 await assertSucceeds(a.ref('contas/empresaA').once('value'));
 await assertFails(a.ref('contas/empresaB').once('value'));
 await assertFails(a.ref('contas/empresaB/empresa').set({nome:'Invasão'}));
 await assertFails(anon.ref('contas/empresaA').once('value'));
 await assertFails(anon.ref('contas/empresaA/empresa').set({nome:'Anônimo'}));
 await assertFails(a.ref().once('value'));
 await assertFails(a.ref('empresa').set({nome:'Legado'}));
 await assertFails(a.ref().update({'contas/empresaA/teste':true,'contas/empresaB/teste':true}));
 await assertSucceeds(a.ref('contas/empresaA/meta/ownerUid').set('empresaA'));
 await assertFails(a.ref('contas/empresaA/meta/ownerUid').set('empresaB'));
 console.log('PASS: acesso próprio autorizado; cruzado, anônimo, raiz, lote cruzado e ownerUid indevido negados.');
}finally{await env.cleanup();}
