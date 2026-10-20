import { state } from './state.js';
import { toast } from './ui.js';
import { codigoLoginConta, publicarIdConta } from './conta-id.js';

let preparando = false, falhou = false;
export function preencherContaHeader() {
    const fb = window.fb, conta = fb.contaAtiva?.id;
    const campo = document.getElementById('sessao-id-conta');
    if (!campo || !conta) return;
    const codigo = codigoLoginConta(state.meta) || codigoLoginConta(fb.contaAtiva);
    if (codigo) fb.contaAtiva.codigoApp = codigo;
    campo.textContent = codigo || 'Preparando ID da conta…';
    if (codigo || preparando || falhou || !state.carregados.meta || fb.contaAtiva.permissao !== 'administrador') return;
    preparando = true;
    publicarIdConta(fb, conta).then(codigo => {
        if (fb.contaAtiva?.id !== conta) return;
        fb.contaAtiva.codigoApp = codigo;
        campo.textContent = codigo;
    }).catch(() => {
        falhou = true;
        toast('Não foi possível preparar o ID da conta. Confira as regras publicadas e recarregue o site.', 'erro');
    }).finally(() => { preparando = false; });
}
