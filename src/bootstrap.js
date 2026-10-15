import './fireBase_config.js';
const fb=window.fb;
const $=s=>document.querySelector(s);
let modo='entrar',ocupado=false,appUid=null,nomeEmpresa='',nomeResponsavel='',importTentado=false;
function mensagem(texto,erro=false){const el=$('#auth-mensagem');el.textContent=texto;el.classList.toggle('auth-erro',erro);}
function traduzir(e){return ({'auth/invalid-credential':'E-mail ou senha incorretos.','auth/wrong-password':'E-mail ou senha incorretos.','auth/user-not-found':'E-mail ou senha incorretos.','auth/email-already-in-use':'Este e-mail já tem uma conta. Use Entrar ou Recuperar senha.','auth/invalid-email':'Informe um e-mail válido.','auth/weak-password':'A senha não atende à política de segurança configurada.','auth/operation-not-allowed':'Habilite E-mail/Senha no Firebase Authentication do projeto.','auth/unauthorized-domain':'Autorize o domínio deste site nas configurações de Authentication.','auth/too-many-requests':'Muitas tentativas. Aguarde e tente novamente.','auth/network-request-failed':'Não foi possível conectar. Verifique sua conexão.','auth/user-disabled':'Esta conta foi desativada.'})[e.code]||((String(e.code||e.message).toLowerCase().includes('permission'))?'Sem permissão no banco. Publique as regras de isolamento fornecidas.':'Não foi possível concluir. Verifique a configuração Firebase e tente novamente.');}
function alternar(){modo=modo==='entrar'?'criar':'entrar';$('#auth-titulo').textContent=modo==='entrar'?'Entre na sua conta':'Cadastre sua empresa';$('#auth-cadastro').hidden=modo==='entrar';$('#auth-senha').autocomplete=modo==='entrar'?'current-password':'new-password';$('#auth-submit').textContent=modo==='entrar'?'Entrar':'Criar Conta';$('#auth-alternar').textContent=modo==='entrar'?'Criar uma conta para minha empresa':'Já tenho uma conta';$('#auth-senha').value='';mensagem('');}
function bloquear(v){ocupado=v;$('#auth-form fieldset').disabled=v;$('#auth-alternar').disabled=v;$('#auth-recuperar').disabled=v;}
async function prepararConta(user){
 const base=`contas/${user.uid}`,meta=await fb.get(fb.ref(fb.db,`${base}/meta`));if(meta.exists())return;
 const perfil={nome:user.displayName||nomeResponsavel||'Minha Conta',email:user.email||'',cargo:'Administrador',departamento:'',foto:''};
 const agora=new Date().toISOString();
 const inicial={meta:{ownerUid:user.uid,criadoEm:agora},config:{jornada:8,tolerancia:10,diasTrabalho:'12345'},preferencias:{[user.uid]:{perfil,alertas:{atrasos:true,ausencias:true,extras:false},atualizadoEm:agora}},usuarios:{[user.uid]:{nome:perfil.nome,email:perfil.email,permissao:'administrador',status:'ativo',titular:true,criadoEm:agora}}};
 if(nomeEmpresa)inicial.empresa={nome:nomeEmpresa};
 // A transação só inicializa uma conta inexistente; não substitui dados já salvos.
 await fb.runTransaction(fb.ref(fb.db,base),atual=>atual===null?inicial:undefined,{applyLocally:false});
}
async function abrir(user){if(appUid)return;bloquear(true);mensagem('Carregando sua empresa…');try{
 await prepararConta(user);
 if(fb.auth.currentUser?.uid!==user.uid)throw Error('Sessão alterada.');
 // Somente depois da autenticação os módulos de dados e páginas são carregados.
 importTentado=true;
 await import('./app.js');
 if(fb.auth.currentUser?.uid!==user.uid){window.dispatchEvent(new Event('mixponto:encerrar'));location.reload();return;}
 appUid=user.uid;$('#auth-tela').hidden=true;$('#app-shell').hidden=false;
 $('#sessao-email').textContent=user.email||'';
 $('#btn-sair').addEventListener('click',async()=>{try{await fb.signOut(fb.auth);}catch(e){alert(traduzir(e));}});
 }catch(e){console.error(e);mensagem(traduzir(e)+' Se a conta acabou de ser criada, ela já existe: corrija a configuração e entre novamente.',true);$('#auth-senha').value='';if(importTentado){$('#auth-form').hidden=true;$('#auth-alternar').hidden=true;$('#auth-recuperar').hidden=true;$('#auth-recarregar').hidden=false;}try{await fb.signOut(fb.auth);}catch{} }
 finally{bloquear(false);}}
export async function iniciar(){
 $('#auth-recarregar').addEventListener('click',()=>location.reload());
 $('#auth-alternar').addEventListener('click',alternar);
 $('#auth-form').addEventListener('submit',async e=>{e.preventDefault();if(ocupado)return;const email=$('#auth-email').value.trim(),senha=$('#auth-senha').value;if(!email||!senha)return mensagem('Preencha e-mail e senha.',true);
 nomeEmpresa=modo==='criar'?$('#auth-empresa').value.trim():'';nomeResponsavel=modo==='criar'?$('#auth-nome').value.trim():'';if(modo==='criar'&&(!nomeEmpresa||!nomeResponsavel||senha.length<8))return mensagem('Preencha seu nome e a empresa e use uma senha com ao menos 8 caracteres.',true);
 bloquear(true);mensagem('Conectando…');try{
 const lembrar=$('#auth-lembrar').checked;await fb.setPersistence(fb.auth,lembrar?fb.browserLocalPersistence:fb.browserSessionPersistence);localStorage.setItem('mixponto-manter-sessao',lembrar?'1':'0');
 const cred=modo==='criar'?await fb.createUserWithEmailAndPassword(fb.auth,email,senha):await fb.signInWithEmailAndPassword(fb.auth,email,senha);
 if(modo==='criar')await fb.updateProfile(cred.user,{displayName:nomeResponsavel});
 $('#auth-senha').value='';await abrir(cred.user);
 }catch(e){mensagem(traduzir(e),true);$('#auth-senha').value='';}finally{bloquear(false);}});
 $('#auth-recuperar').addEventListener('click',async()=>{if(ocupado)return;const email=$('#auth-email').value.trim();if(!email)return mensagem('Digite seu e-mail para recuperar a senha.',true);bloquear(true);try{await fb.sendPasswordResetEmail(fb.auth,email);mensagem('Se houver uma conta elegível para este e-mail, você receberá as instruções de recuperação.');}catch(e){mensagem(traduzir(e),true);}finally{bloquear(false);}});
 bloquear(true);const lembrar=localStorage.getItem('mixponto-manter-sessao')==='1';$('#auth-lembrar').checked=lembrar;
 await fb.setPersistence(fb.auth,lembrar?fb.browserLocalPersistence:fb.browserSessionPersistence);bloquear(false);
 fb.onAuthStateChanged(fb.auth,user=>{
  if(appUid&&user?.uid!==appUid){$('#app-shell').hidden=true;$('#view').replaceChildren();document.querySelector('#modal-container')?.remove();window.dispatchEvent(new Event('mixponto:encerrar'));location.reload();return;}
  if(ocupado)return;
  if(user)abrir(user);else{$('#auth-tela').hidden=false;$('#app-shell').hidden=true;$('#auth-senha').value='';mensagem('');}
 });
}
