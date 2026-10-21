import '../fireBase_config.js';
import { serverTimestamp } from '../core/firebase-tenant.js';
import { contasDisponiveis } from '../core/contas.js';
import { criarEstadoPedidos } from './pedido-estado.js';

const fb = window.fb;
const form = document.getElementById('pedido');
const status = document.getElementById('resultado');
const result = document.getElementById('pedidos');
const estado = criarEstadoPedidos();
let enviando = false;
const text = (tag, value) => Object.assign(document.createElement(tag), { textContent: value });

function validarSessao(user, revisao) {
    if (fb.auth.currentUser?.uid !== user.uid || estado.sessao() !== revisao) throw Error('A sessão mudou.');
}

async function conta(codigo = form.elements.conta.value) {
    if (!/^[1-9][0-9]{0,8}$/.test(codigo)) throw Error('Informe um ID de conta válido.');
    const map = (await fb.get(fb.ref(fb.db, `contasPorId/${codigo}`))).val();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(map?.contaId || '')) throw Error('Conta não encontrada.');
    return map.contaId;
}

async function consultar() {
    const user = fb.auth.currentUser;
    if (!user) throw Error('Entre com seu próprio login para consultar pedidos.');
    const revisao = estado.sessao();
    const consulta = estado.iniciarConsulta();
    const codigoConta = form.elements.conta.value;
    const id = await conta(codigoConta);
    validarSessao(user, revisao);
    // A API só amplia a consulta para administradores. Se estiver indisponível,
    // manter o canal pessoal disponível sem tentar ler pedidos de terceiros.
    let contas = [];
    let consultaPessoal = false;
    try { contas = await contasDisponiveis(fb, user, id); }
    catch { consultaPessoal = true; }
    validarSessao(user, revisao);
    const admin = contas.some(c => c.id === id && c.permissao === 'administrador');
    const data = (await fb.get(fb.ref(fb.db, `contas/${id}/privacidade${admin ? '' : '/' + user.uid}`))).val() || {};
    validarSessao(user, revisao);
    if (!estado.consultaAtual(consulta)) return;
    if (consultaPessoal) status.textContent = 'A consulta administrativa está indisponível. Mostramos apenas os pedidos da sua própria identidade nesta conta.';
    result.replaceChildren();
    const groups = admin ? Object.entries(data) : [[user.uid, data]];
    for (const [uid, requests] of groups) for (const [key, item] of Object.entries(requests || {})) {
        const card = text('article', ''); card.className = 'pedido';
        card.append(text('h2', `Protocolo ${key}`), text('p', `${item.tipo} · ${item.status} · ${new Date(item.criadoEm).toLocaleString('pt-BR')}`));
        if (item.detalhes) card.append(text('p', item.detalhes));
        if (item.resposta) card.append(text('p', `Resposta: ${item.resposta}`));
        if (admin && item.status === 'recebida') {
            const label = text('label', 'Resposta fundamentada (até 2.000 caracteres)');
            const input = document.createElement('textarea'); input.maxLength = 2000; label.append(input);
            const button = text('button', 'Registrar resposta'); button.type = 'button';
            button.onclick = async () => {
                if (!input.value.trim()) return input.focus();
                button.disabled = true;
                try {
                    validarSessao(user, revisao);
                    if (form.elements.conta.value !== codigoConta) throw Error('A conta mudou. Consulte os pedidos novamente.');
                    await fb.update(fb.ref(fb.db, `contas/${id}/privacidade/${uid}/${key}`), {
                        status: 'respondida', resposta: input.value.trim(), respondidoEm: serverTimestamp()
                    });
                    validarSessao(user, revisao);
                    status.textContent = 'Resposta registrada. O titular pode consultá-la neste canal.';
                    await consultar();
                } catch { if (estado.sessao() === revisao) status.textContent = 'Não foi possível registrar a resposta. Confira a conta, sua permissão e tente novamente.'; }
                finally { button.disabled = false; }
            };
            card.append(text('p', 'A resposta registrada será definitiva neste protocolo. Revise o conteúdo antes de enviar.'), label, button);
        }
        result.append(card);
    }
    if (!result.children.length) result.append(text('p', 'Nenhum pedido encontrado nesta conta.'));
}

form.onsubmit = async event => {
    event.preventDefault();
    const user = fb.auth.currentUser;
    if (!user || enviando) return;
    const revisao = estado.sessao();
    const dados = { codigo: form.elements.conta.value, tipo: form.elements.tipo.value, detalhes: form.elements.detalhes.value.trim() };
    enviando = true;
    document.getElementById('enviar').disabled = true;
    try {
        const id = await conta(dados.codigo);
        validarSessao(user, revisao);
        const tentativa = estado.tentar({ conta: id, uid: user.uid, tipo: dados.tipo, detalhes: dados.detalhes });
        const ref = fb.ref(fb.db, `contas/${tentativa.conta}/privacidade/${user.uid}/${tentativa.id}`);
        const existing = await fb.get(ref);
        validarSessao(user, revisao);
        if (existing.exists()) {
            const saved = existing.val();
            if (saved?.tipo !== tentativa.tipo || saved?.detalhes !== tentativa.detalhes) throw Error('O protocolo contém outro pedido.');
        } else await fb.set(ref, { tipo: tentativa.tipo, detalhes: tentativa.detalhes, criadoEm: serverTimestamp(), status: 'recebida' });
        validarSessao(user, revisao);
        status.textContent = `Solicitação registrada na conta ${dados.codigo}. Guarde o protocolo: ${tentativa.id}. A empresa responsável precisa analisar o pedido; não houve exclusão automática de dados.`;
        estado.confirmar(tentativa);
        if (form.elements.detalhes.value.trim() === tentativa.detalhes) form.elements.detalhes.value = '';
    } catch {
        if (estado.sessao() === revisao) status.textContent = 'Não foi possível confirmar o pedido. Verifique o ID da conta e seu vínculo. Tentar novamente sem editar reutiliza o protocolo; editar os dados inicia outro pedido. Você também pode baixar o requerimento e encaminhá-lo à empresa empregadora.';
    } finally {
        if (estado.sessao() === revisao) {
            enviando = false;
            document.getElementById('enviar').disabled = !fb.auth.currentUser;
        }
    }
};

document.getElementById('consultar').onclick = () => {
    const revisao = estado.sessao();
    return consultar().catch(() => {
        if (estado.sessao() === revisao) status.textContent = 'Não foi possível consultar. Confira a conta, a sessão e seu vínculo.';
    });
};
form.elements.conta.addEventListener('input', () => {
    estado.iniciarConsulta();
    result.replaceChildren();
});
document.getElementById('modelo').onclick = () => {
    const content = `Requerimento de privacidade — rascunho não enviado\nConta: ${form.elements.conta.value}\nPedido: ${form.elements.tipo.selectedOptions[0].textContent}\n${form.elements.detalhes.value.trim()}\n\nEncaminhar pelo canal real da empresa responsável. Não anexar documentos sem necessidade e canal seguro.`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'requerimento-privacidade.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Requerimento preparado no dispositivo. Nenhum pedido foi enviado por esse botão.';
};

try {
    let manter = false;
    try { manter = localStorage.getItem('mixponto-manter-sessao') === '1'; } catch { /* Preferência indisponível: usa a sessão atual. */ }
    await fb.setPersistence(fb.auth, manter ? fb.browserLocalPersistence : fb.browserSessionPersistence);
} catch {
    status.textContent = 'O navegador não permitiu ajustar a persistência. A sessão atual será usada.';
}
fb.onAuthStateChanged(fb.auth, user => {
    estado.mudarSessao(); result.replaceChildren(); status.textContent = '';
    enviando = false;
    form.elements.detalhes.value = '';
    document.getElementById('sessao').textContent = user ? 'Sessão autenticada. O pedido fica vinculado apenas à conta informada e à sua identidade.' : 'Entre no sistema com seu próprio login para registrar ou acompanhar pedidos. O modelo para download funciona sem login.';
    for (const id of ['enviar', 'consultar']) document.getElementById(id).disabled = !user;
});
