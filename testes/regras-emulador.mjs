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
 // Vínculo RFID: lote consistente, concorrência, troca e remoção.
 const conta=a.ref('contas/empresaA');
 const vinculo=(f,cartao,versao=1)=>({[`funcionarios/${f}`]:{nome:f,status:'ativo',cartaoUid:cartao,cartaoVersao:versao},[`cartoes/${cartao}`]:f});
 await assertFails(conta.child('cartoes/626BD163').set('f1'));
 await assertSucceeds(conta.update(vinculo('f1','626BD163')));
 await assertFails(conta.update(vinculo('f2','626BD163')));
 await assertFails(conta.child('funcionarios/f1/cartaoUid').set('AABBCCDD'));
 await assertFails(b.ref('contas/empresaA/cartoes/626BD163').once('value'));
 await assertSucceeds(b.ref('contas/empresaB').update(vinculo('f1','626BD163')));
 await assertSucceeds(conta.update({...vinculo('f1','AABBCCDD',2),'cartoes/626BD163':null}));
 await assertFails(conta.update({...vinculo('f1','11223344',2),'cartoes/AABBCCDD':null}));
 await assertSucceeds(conta.update({'funcionarios/f1/cartaoUid':'','funcionarios/f1/cartaoVersao':3,'cartoes/AABBCCDD':null}));
 await assertSucceeds(conta.update(vinculo('f2','AABBCCDD')));
 console.log('PASS: vínculos RFID, unicidade, versão e isolamento de empresa.');
 console.log('PASS: acesso próprio autorizado; cruzado, anônimo, raiz, lote cruzado e ownerUid indevido negados.');
}finally{await env.cleanup();}
