import './fireBase_config.js';
import { contasDisponiveis } from './core/contas.js';

const fb = window.fb;
const $ = (s) => document.querySelector(s);
let modo = 'entrar',
    ocupado = false,
    appUid = null,
    nomeResponsavel = '',
    importTentado = false;
let abrindo = false;

function mensagem(texto, erro = false) {
    const el = $('#auth-mensagem');
    el.textContent = texto;
    el.classList.toggle('auth-erro', erro);
}

function traduzir(e) {
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

async function prepararConta(user) {
    const base = `contas/${user.uid}`,
        meta = await fb.get(fb.ref(fb.db, `${base}/meta`));
    const owner = meta.val()?.ownerUid;
    if (owner === user.uid) return;
    if (owner) throw Error('O titular registrado nesta conta não corresponde ao login atual. Confira meta/ownerUid no Console.');
    if (meta.exists()) {
        await completarTitular(user, base);
        return;
    }
    const perfil = {
        nome: user.displayName || nomeResponsavel || 'Minha Conta',
        email: user.email || '',
        cargo: 'Administrador',
        departamento: '',
        foto: ''
    };
    const agora = new Date().toISOString();
    const inicial = {
        meta: { ownerUid: user.uid, criadoEm: agora },
        config: { jornada: 8, tolerancia: 10, diasTrabalho: '12345' },
        preferencias: {
            [user.uid]: {
                perfil,
                alertas: { atrasos: true, ausencias: true, extras: false },
                atualizadoEm: agora
            }
        },
        usuarios: {
            [user.uid]: {
                nome: perfil.nome,
                email: perfil.email,
                permissao: 'administrador',
                status: 'ativo',
                titular: true,
                criadoEm: agora
            }
        }
    };
    // A transação só inicializa uma conta inexistente; não substitui dados já salvos.
    await fb.runTransaction(
        fb.ref(fb.db, base),
        (atual) => (atual === null ? inicial : undefined),
        { applyLocally: false }
    );
    // Contas antigas podem já ter funcionários, mas ainda não ter metadados.
    await completarTitular(user, base);
}

async function completarTitular(user, base) {
    await fb.runTransaction(fb.ref(fb.db, `${base}/meta/ownerUid`), (atual) => {
        if (atual && atual !== user.uid) throw Error('Titular divergente. Confira meta/ownerUid no Console.');
        return atual === null ? user.uid : undefined;
    }, { applyLocally: false });
}

async function abrir(user) {
    if (appUid || abrindo) return;
    abrindo = true;
    bloquear(true);
    mensagem('Carregando sua empresa…');
    try {
        try { await prepararConta(user); }
        catch (error) {
            // Um convidado não precisa ter uma empresa própria.
            if (!/permission/i.test(error.code || error.message)) throw error;
        }
        const contas = await contasDisponiveis(fb, user);
        const chave = `mixponto-conta-${user.uid}`;
        const escolhida = contas.find((c) => c.id === sessionStorage.getItem(chave)) || (contas.length === 1 ? contas[0] : null);
        if (!escolhida) {
            $('#auth-form').hidden = true;
            $('#auth-alternar').hidden = true;
            $('#auth-recuperar').hidden = true;
            $('#auth-compartilhado').hidden = false;
            $('#auth-verificar-email').hidden = user.emailVerified;
            const lista = $('#auth-contas-lista');
            lista.replaceChildren();
            contas.forEach((conta) => {
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'btn btn-primario';
                botao.textContent = `${conta.nome} · ${conta.id}`;
                botao.onclick = () => { sessionStorage.setItem(chave, conta.id); abrir(user); };
                lista.appendChild(botao);
            });
            mensagem(contas.length ? 'Escolha a empresa que deseja acessar.' : !user.emailVerified
                ? 'Confirme seu e-mail para consultar as empresas que liberaram acesso para você. Depois clique em Verificar meus acessos.'
                : 'Nenhuma empresa liberou acesso para este e-mail. Peça ao administrador para cadastrá-lo em Configurações → Usuários.');
            return;
        }
        fb.contaAtiva = escolhida;
        await fb.get(fb.ref(fb.db, `contas/${escolhida.id}/meta`));
        sessionStorage.setItem(chave, escolhida.id);
        const seletor = $('#sessao-conta');
        seletor.replaceChildren();
        contas.forEach((conta) => seletor.add(new Option(conta.nome, conta.id)));
        seletor.value = escolhida.id;
        seletor.hidden = contas.length < 2;
        seletor.onchange = () => {
            sessionStorage.setItem(chave, seletor.value);
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
        if (importTentado) {
            $('#auth-form').hidden = true;
            $('#auth-alternar').hidden = true;
            $('#auth-recuperar').hidden = true;
            $('#auth-recarregar').hidden = false;
        }
        try {
            await fb.signOut(fb.auth);
        } catch {}
    } finally {
        abrindo = false;
        bloquear(false);
    }
}

export async function iniciar() {
    window.addEventListener('mixponto:acesso-revogado', () => {
        $('#app-shell').hidden = true;
        $('#view').replaceChildren();
        sessionStorage.removeItem(`mixponto-conta-${fb.auth.currentUser?.uid}`);
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
            $('#auth-tela').hidden = false;
            $('#app-shell').hidden = true;
            $('#auth-senha').value = '';
            mensagem('');
        }
    });
}
