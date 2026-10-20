import { empresasDisponiveis } from './empresas.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { codigoLoginEmpresa, publicarIdEmpresa } from './empresa-id.js';

const publicados = new Set();
let preparando = false, falhou = false;
export function preencherEmpresaHeader() {
    const fb = window.fb, conta = fb.contaAtiva?.id;
    const seletor = document.getElementById('sessao-empresa');
    const campo = document.getElementById('sessao-id-empresa');
    if (!seletor || !campo || !conta) return;
    const empresas = empresasDisponiveis();
    const key = `mixponto-empresa-login-${conta}`;
    const escolhida = empresas.find((empresa) => empresa.id === sessionStorage.getItem(key)) || empresas[0];
    seletor.replaceChildren();
    empresas.forEach((empresa) => seletor.add(new Option(empresa.nome, empresa.id)));
    seletor.hidden = empresas.length < 2;
    if (escolhida) {
        seletor.value = escolhida.id;
        fb.empresaAtiva = { id: escolhida.id, codigo: codigoLoginEmpresa(escolhida) };
        campo.textContent = fb.empresaAtiva.codigo || 'Preparando ID da empresa…';
    } else { fb.empresaAtiva = null; campo.textContent = 'Cadastre uma empresa'; }
    seletor.onchange = () => { sessionStorage.setItem(key, seletor.value); preencherEmpresaHeader(); };
    if (fb.contaAtiva.permissao !== 'administrador' || preparando || falhou ||
        !state.carregados.empresa || !state.carregados.empresas) return;
    const pendentes = empresas.filter((empresa) => !publicados.has(`${conta}/${empresa.id}`));
    if (!pendentes.length) return;
    preparando = true;
    (async () => {
        try {
            for (const empresa of pendentes) {
                await publicarIdEmpresa(fb, conta, empresa);
                publicados.add(`${conta}/${empresa.id}`);
            }
        } catch {
            falhou = true;
            toast('Não foi possível preparar o ID de login da empresa. Publique as regras atualizadas e recarregue o site.', 'erro');
        } finally { preparando = false; if (!falhou) queueMicrotask(preencherEmpresaHeader); }
    })();
}
