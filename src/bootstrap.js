import './fireBase_config.js';
import { contasDisponiveis } from './core/contas.js';
import { gestaoApi, abrirGestao } from './core/gestao.js';
import { atualizarSeletorContas } from './core/conta-seletor.js';

const fb = window.fb;
const $ = (s) => document.querySelector(s);
let modo = 'entrar',
    ocupado = false,
    appUid = null,
    nomeResponsavel = '',
    importTentado = false;
let abrindo = false;

function destinoTroca(user, preferida) {
    let troca;
    try {troca=JSON.parse(sessionStorage.getItem('mixponto-troca') || 'null');sessionStorage.removeItem('mixponto-troca');} catch {return null;}
    return troca?.uid===user.uid && troca.conta===preferida && Date.now()-troca.em>=0 && Date.now()-troca.em<60000 ? troca.conta : null;
}

function carregando(texto) {
    $('#sessao-carregando-texto').textContent = texto;
    $('#sessao-carregando').hidden = false;
    $('#auth-tela').hidden = true;
    $('#app-shell').hidden = true;
}

function escolherConta() {
    $('#auth-titulo').textContent = 'Suas contas';
    $('.auth-descricao').textContent = 'Você continua conectado. Escolha a conta que deseja acessar.';
    $('#auth-form').hidden = true;
    $('#auth-alternar').hidden = true;
    $('#auth-recuperar').hidden = true;
    $('#auth-compartilhado').hidden = false;
    $('#auth-tela').hidden = false;
}

function mensagem(texto, erro = false) {
    const el = $('#auth-mensagem');
    el.textContent = texto;
    el.classList.toggle('auth-erro', erro);
}

function traduzir(e) {
    if (e.code === 'contas/indisponivel') return e.message;
    return (
        {
            'auth/invalid-credential': 'E-mail ou senha incorretos.',
            'auth/wrong-password': 'E-mail ou senha incorretos.',
            'auth/user-not-found': 'E-mail ou senha incorretos.',
            'auth/email-already-in-use':
                'Este e-mail já tem uma conta. Use Entrar ou Recuperar senha.',
            'auth/invalid-email': 'Informe um e-mail válido.',
            'auth/weak-password': 'A senha não atende à política de segurança configurada.',
            'auth/operation-not-allowed':
                'Habilite E-mail/Senha no Firebase Authentication do projeto.',
            'auth/unauthorized-domain':
                'Autorize o domínio deste site nas configurações de Authentication.',
            'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
            'auth/network-request-failed': 'Não foi possível conectar. Verifique sua conexão.',
            'auth/user-disabled': 'Esta conta foi desativada.'
        }[e.code] ||
        (String(e.code || e.message)
            .toLowerCase()
            .includes('permission')
            ? 'Sem permissão no banco. Publique as regras de isolamento fornecidas.'
            : 'Não foi possível concluir. Verifique a configuração Firebase e tente novamente.')
    );
}

function alternar() {
    modo = modo === 'entrar' ? 'criar' : 'entrar';
    $('#auth-titulo').textContent =
        modo === 'entrar' ? 'Entre na sua conta' : 'Crie seu login';
    $('#auth-cadastro').hidden = modo === 'entrar';
    $('#auth-senha').autocomplete = modo === 'entrar' ? 'current-password' : 'new-password';
    $('#auth-submit').textContent = modo === 'entrar' ? 'Entrar' : 'Criar Conta';
    $('#auth-alternar').textContent =
        modo === 'entrar' ? 'Criar meu login' : 'Já tenho uma conta';
    $('#auth-senha').value = '';
    mensagem('');
}

function bloquear(v) {
    ocupado = v;
    $('#auth-form fieldset').disabled = v;
    $('#auth-alternar').disabled = v;
    $('#auth-recuperar').disabled = v;
}

async function abrir(user, discreto = false) {
    if (appUid || abrindo) return;
    abrindo = true;
    bloquear(true);
    if (!discreto) carregando('Carregando sua conta…');
    mensagem('Carregando sua empresa…');
    try {
        const chave = `mixponto-conta-${user.uid}`;
        const destino=destinoTroca(user,localStorage.getItem(chave));
        if(!destino && user.emailVerified) await gestaoApi('/aceitar',{});
        const contas = await contasDisponiveis(fb, user, destino);
        if(destino && !contas.some(c=>c.id===destino)) throw Object.assign(Error('Acesso revogado.'),{code:'permission_denied'});
        const escolhida = contas.find((c) => c.id === localStorage.getItem(chave)) || (contas.length === 1 ? contas[0] : null);
        if (!escolhida) {
            escolherConta();
            $('#auth-verificar-email').hidden = user.emailVerified;
            const lista = $('#auth-contas-lista');
            lista.replaceChildren();
            contas.forEach((conta) => {
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'btn btn-primario';
                botao.textContent = conta.nome;
                botao.onclick = () => { localStorage.setItem(chave, conta.id); abrir(user); };
                lista.appendChild(botao);
            });
            mensagem(contas.length ? 'Escolha a empresa que deseja acessar.' : !user.emailVerified
                ? 'Confirme seu e-mail para consultar as empresas que liberaram acesso para você. Depois clique em Verificar meus acessos.'
                : 'Nenhuma empresa liberou acesso para este e-mail. Peça ao administrador para cadastrá-lo em Configurações → Usuários.');
            return;
        }
        fb.contaAtiva = escolhida;
        fb.contasDisponiveis = contas;
        // O endpoint já verificou metadados e permissões; os dados operacionais
        // são novamente autorizados pelas regras do Firebase ao serem carregados.
        localStorage.setItem(chave, escolhida.id);
        const seletor = $('#sessao-conta');
        seletor.replaceChildren();
        contas.forEach((conta) => seletor.add(new Option(`${conta.nome} · ID ${conta.codigoApp || 'pendente'}`, conta.id)));
        seletor.value = escolhida.id;
        atualizarSeletorContas(seletor,contas,escolhida);
        seletor.hidden = contas.length < 2;
        seletor.onchange = () => {
            if (seletor.value === escolhida.id) return;
            carregando('Trocando de conta…');
            localStorage.setItem(chave, seletor.value);
            sessionStorage.setItem('mixponto-troca',JSON.stringify({uid:user.uid,conta:seletor.value,em:Date.now()}));
            window.dispatchEvent(new Event('mixponto:encerrar'));
            location.reload();
        };
        if (fb.auth.currentUser?.uid !== user.uid) throw Error('Sessão alterada.');
        // Somente depois da autenticação os módulos de dados e páginas são carregados.
        importTentado = true;
        await import('./app.js');
        if (fb.auth.currentUser?.uid !== user.uid) {
            window.dispatchEvent(new Event('mixponto:encerrar'));
            location.reload();
            return;
        }
        appUid = user.uid;
        $('#auth-tela').hidden = true;
        $('#app-shell').hidden = false;
        $('#sessao-email').textContent = user.email || '';
        if(destino) contasDisponiveis(fb,user).then(novas=>{
            if(fb.auth.currentUser?.uid!==user.uid || fb.contaAtiva?.id!==escolhida.id) return;
            const atual=novas.find(c=>c.id===escolhida.id);
            if(!atual || atual.permissao!==escolhida.permissao) return window.dispatchEvent(new Event('mixponto:acesso-revogado'));
            contas.splice(0,contas.length,...novas);
            seletor.replaceChildren(...contas.map(c=>new Option(`${c.nome} · ID ${c.codigoApp || 'pendente'}`,c.id)));
            seletor.value=escolhida.id;
            atualizarSeletorContas(seletor,contas,atual);
        }).catch(()=>{});
        $('#btn-sair').addEventListener('click', async () => {
            try {
                await fb.signOut(fb.auth);
            } catch (e) {
                alert(traduzir(e));
            }
        });
    } catch (e) {
        console.error(e);
        const semPermissao = /permission/i.test(String(e.code || e.message));
        mensagem(semPermissao
            ? 'O acesso a esta empresa não está disponível. Peça ao administrador para conferir seu perfil em Configurações → Usuários. Se o sistema acabou de ser atualizado, confira a publicação das regras de acesso compartilhado.'
            : traduzir(e), true);
        $('#auth-senha').value = '';
        // Uma falha no acesso à conta não invalida a identidade autenticada.
        if (fb.auth.currentUser?.uid === user.uid) {
            escolherConta();
            $('#auth-verificar-email').hidden = user.emailVerified;
            if (semPermissao) localStorage.removeItem(`mixponto-conta-${user.uid}`);
        } else {
            $('#auth-tela').hidden = false;
        }
        if (importTentado) {
            $('#auth-form').hidden = true;
            $('#auth-alternar').hidden = true;
            $('#auth-recuperar').hidden = true;
            $('#auth-recarregar').hidden = false;
        }
    } finally {
        $('#sessao-carregando').hidden = true;
        abrindo = false;
        bloquear(false);
    }
}

export async function iniciar() {
    window.addEventListener('mixponto:gestao-atualizada', async () => {
        const user=fb.auth.currentUser;
        if(!user) return;
        if(!appUid) return abrir(user,true);
        try {
            const contas=await contasDisponiveis(fb,user);
            if(fb.auth.currentUser?.uid!==user.uid) return;
            const ativa=contas.find(c=>c.id===fb.contaAtiva?.id);
            if(!ativa || ativa.permissao!==fb.contaAtiva.permissao) {
                window.dispatchEvent(new Event('mixponto:acesso-revogado'));
                return;
            }
            fb.contasDisponiveis.splice(0,fb.contasDisponiveis.length,...contas);
            const seletor=$('#sessao-conta');
            seletor.replaceChildren(...contas.map(c=>new Option(`${c.nome} · ID ${c.codigoApp || 'pendente'}`,c.id)));
            seletor.value=ativa.id;
            seletor.hidden=contas.length<2;
            atualizarSeletorContas(seletor,fb.contasDisponiveis,ativa);
        } catch { mensagem('Não foi possível atualizar a lista de contas. Tente verificar seus acessos novamente.',true); }
    });
    for(const parent of [document.querySelector('#auth-compartilhado'), document.querySelector('#sessao-conta')?.parentElement]) {
        if(!parent) continue;
        const button=document.createElement('button');button.type='button';button.className='btn btn-gestao';button.textContent='Gestão de contas';button.onclick=abrirGestao;parent.appendChild(button);
    }
    let verificando=false;
    setInterval(async()=>{
        if(!appUid || verificando) return;
        verificando=true;
        try {
            const contas=await contasDisponiveis(fb,fb.auth.currentUser);
            const ativa=contas.find(c=>c.id===fb.contaAtiva?.id);
            if(!ativa || ativa.permissao!==fb.contaAtiva.permissao) window.dispatchEvent(new Event('mixponto:acesso-revogado'));
        } catch {} finally {verificando=false;}
    },15000);

    window.addEventListener('mixponto:acesso-revogado', () => {
        $('#app-shell').hidden = true;
        $('#view').replaceChildren();
        localStorage.removeItem(`mixponto-conta-${fb.auth.currentUser?.uid}`);
        window.dispatchEvent(new Event('mixponto:encerrar'));
        location.reload();
    }, { once: true });
    $('#auth-sair').addEventListener('click', () => fb.signOut(fb.auth).then(() => location.reload()));
    $('#auth-verificar-email').addEventListener('click', async () => {
        try {
            await fb.sendEmailVerification(fb.auth.currentUser);
            mensagem('Enviamos a confirmação. Abra o link recebido no seu e-mail e depois clique em Verificar meus acessos.');
        } catch (error) { mensagem(traduzir(error), true); }
    });
    $('#auth-conferir-contas').addEventListener('click', async () => {
        if (ocupado || !fb.auth.currentUser) return;
        try {
            await fb.auth.currentUser.reload();
            await fb.auth.currentUser.getIdToken(true);
            await abrir(fb.auth.currentUser);
        } catch (error) { mensagem(traduzir(error), true); }
    });
    $('#auth-recarregar').addEventListener('click', () => location.reload());
    $('#auth-alternar').addEventListener('click', alternar);
    $('#auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (ocupado) return;
        const email = $('#auth-email').value.trim(),
            senha = $('#auth-senha').value;
        if (!email || !senha) return mensagem('Preencha e-mail e senha.', true);
        nomeResponsavel = modo === 'criar' ? $('#auth-nome').value.trim() : '';
        if (modo === 'criar' && (!nomeResponsavel || senha.length < 8))
            return mensagem(
                'Preencha seu nome e use uma senha com ao menos 8 caracteres.',
                true
            );
        bloquear(true);
        mensagem('Conectando…');
        try {
            const lembrar = $('#auth-lembrar').checked;
            await fb.setPersistence(
                fb.auth,
                lembrar ? fb.browserLocalPersistence : fb.browserSessionPersistence
            );
            localStorage.setItem('mixponto-manter-sessao', lembrar ? '1' : '0');
            const cred =
                modo === 'criar'
                    ? await fb.createUserWithEmailAndPassword(fb.auth, email, senha)
                    : await fb.signInWithEmailAndPassword(fb.auth, email, senha);
            if (modo === 'criar')
                await fb.updateProfile(cred.user, { displayName: nomeResponsavel });
            $('#auth-senha').value = '';
            await abrir(cred.user);
        } catch (e) {
            mensagem(traduzir(e), true);
            $('#auth-senha').value = '';
        } finally {
            bloquear(false);
        }
    });
    $('#auth-recuperar').addEventListener('click', async () => {
        if (ocupado) return;
        const email = $('#auth-email').value.trim();
        if (!email) return mensagem('Digite seu e-mail para recuperar a senha.', true);
        bloquear(true);
        try {
            await fb.sendPasswordResetEmail(fb.auth, email);
            mensagem(
                'Se houver uma conta elegível para este e-mail, você receberá as instruções de recuperação.'
            );
        } catch (e) {
            mensagem(traduzir(e), true);
        } finally {
            bloquear(false);
        }
    });
    bloquear(true);
    const lembrar = localStorage.getItem('mixponto-manter-sessao') === '1';
    $('#auth-lembrar').checked = lembrar;
    await fb.setPersistence(
        fb.auth,
        lembrar ? fb.browserLocalPersistence : fb.browserSessionPersistence
    );
    bloquear(false);
    fb.onAuthStateChanged(fb.auth, (user) => {
        if (appUid && user?.uid !== appUid) {
            $('#app-shell').hidden = true;
            $('#view').replaceChildren();
            document.querySelector('#modal-container')?.remove();
            window.dispatchEvent(new Event('mixponto:encerrar'));
            location.reload();
            return;
        }
        if (ocupado) return;
        if (user) abrir(user);
        else {
            $('#sessao-carregando').hidden = true;
            $('#auth-tela').hidden = false;
            $('#app-shell').hidden = true;
            $('#auth-compartilhado').hidden = true;
            $('#auth-form').hidden = false;
            $('#auth-alternar').hidden = false;
            $('#auth-recuperar').hidden = false;
            $('#auth-senha').value = '';
            mensagem('');
        }
    });
}
