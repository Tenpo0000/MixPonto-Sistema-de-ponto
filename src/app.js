import { $, $$, ICONES } from './core/utils.js';
import { state, funcionariosAtivos, pendencias } from './core/state.js';
import { db } from './core/db.js';
import { registrosIntegrados } from './core/registros-integrados.js';
import { toast, abrirModal } from './core/ui.js';
import * as inicio from './pages/inicio.js';
import * as cadastro from './pages/cadastro.js';
import * as movimentacoes from './pages/movimentacoes.js';
import * as usuarios from './pages/usuarios.js';
import * as gerenciamento from './pages/gerenciamento.js';
import { perfilId, preencherHeader } from './core/preferencias.js';
import { preencherEmpresaHeader } from './core/empresa-login.js';
import * as empresa from './pages/empresa.js';
import * as horario from './pages/horario.js';
import * as funcionario from './pages/funcionario.js';
import * as cargo from './pages/cargo.js';
import * as departamento from './pages/departamento.js';
import * as feriado from './pages/feriado.js';
import * as justificativa from './pages/justificativa.js';
import * as relatorio from './pages/relatorio.js';
import * as demitidos from './pages/demitidos.js';

const configuracoes = gerenciamento;
const PAGES = {
    inicio,
    cadastro,
    movimentacoes,
    configuracoes,
    empresa,
    horario,
    funcionario,
    cargo,
    departamento,
    feriado,
    justificativa,
    relatorio,
    demitidos,
    usuarios,
    gerenciamento
};
const GRUPOS = {
    cadastro: [
        'cadastro',
        'empresa',
        'horario',
        'funcionario',
        'cargo',
        'departamento',
        'feriado',
        'justificativa'
    ],
    movimentacoes: ['movimentacoes', 'relatorio', 'demitidos'],
    configuracoes: ['configuracoes', 'usuarios', 'gerenciamento']
};
const grupoDe = (view) => Object.keys(GRUPOS).find((g) => GRUPOS[g].includes(view));
let viewAtual = 'inicio',
    termoBusca = '',
    agendado = false;
const fontesBatidas = { registros: {}, batidasMobile: {} };
const fontesCarregadas = { registros: false, batidasMobile: false };
const permissao = window.fb?.contaAtiva?.permissao || 'administrador';

function abrirSubmenu(grupo, abrir) {
    $(`#submenu-${grupo}`).hidden = !abrir;
    $(`.menu-item[data-view="${grupo}"]`).setAttribute('aria-expanded', String(abrir));
}

function aplicarBusca() {
    const t = termoBusca.trim().toLowerCase();
    $$('#view [data-busca]').forEach(
        (el) => (el.hidden = !!t && !el.textContent.toLowerCase().includes(t))
    );
}

function render() {
    const pagina = PAGES[viewAtual];
    preencherHeader();
    preencherEmpresaHeader();
    $('#view').innerHTML = pagina.view();
    pagina.bind?.({ render });
    const grupo = grupoDe(viewAtual) || viewAtual;
    $$('.menu-item').forEach((b) => b.classList.toggle('ativo', b.dataset.view === grupo));
    $$('.submenu-item').forEach((b) => b.classList.toggle('ativo', b.dataset.view === viewAtual));
    aplicarBusca();
    $('#sino .ponto')?.remove();
    if (pendencias() > 0) $('#sino').insertAdjacentHTML('beforeend', '<span class="ponto"></span>');
}

function rota() {
    const h = location.hash.replace('#', '');
    viewAtual = PAGES[h] ? h : 'inicio';
    if (viewAtual === 'usuarios' && permissao !== 'administrador') viewAtual = 'inicio';
    const g = grupoDe(viewAtual);
    if (g) abrirSubmenu(g, true);
    render();
    $('#view').scrollTop = 0;
}

function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
        agendado = false;
        render();
    });
}

function iniciar() {
    const rotulos = {
        inicio: ['home', 'Início'],
        cadastro: ['cadastro', 'Cadastro'],
        movimentacoes: ['mov', 'Movimentações'],
        configuracoes: ['config', 'Configurações']
    };
    $$('.menu-item').forEach((b) => {
        const view = b.dataset.view,
            [ic, nome] = rotulos[view];
        b.innerHTML = `${ICONES[ic]}<span>${nome}</span>`;
        b.addEventListener('click', () => {
            if (GRUPOS[view]) abrirSubmenu(view, $(`#submenu-${view}`).hidden);
            else location.hash = view;
        });
    });
    $$('.submenu-item').forEach((b) =>
        b.addEventListener('click', () => (location.hash = b.dataset.view))
    );
    const menuUsuarios = $('[data-view="usuarios"]');
    if (menuUsuarios) menuUsuarios.hidden = permissao !== 'administrador';
    $('#btn-sobre').innerHTML = `${ICONES.info}<span>Sobre</span>`;
    $('#btn-sobre').addEventListener('click', () =>
        abrirModal({
            titulo: 'Sobre o sistema',
            corpo: `
                <p style="font-size:14px;line-height:1.6">
                    Sistema de ponto da Mix Telecomunicações,
                    <strong>protótipo de demonstração</strong>
                    . Construído com HTML, CSS e JavaScript puro, com dados no Firebase Realtime
                    Database.
                </p>
                <p class="dica" style="margin-top:12px">
                    Conectado ao Firebase.
                </p>
            `
        })
    );
    $('#icone-busca').innerHTML = ICONES.busca;
    $('#sino').innerHTML = ICONES.sino;
    $('#sino').addEventListener('click', () => {
        const n = pendencias();
        toast(
            n ? `${n} faltas aguardando justificativa nos últimos 31 dias.` : 'Nenhuma pendência.'
        );
    });
    $('#busca').addEventListener('input', (e) => {
        termoBusca = e.target.value;
        if (viewAtual === 'movimentacoes' && termoBusca.trim()) {
            const t = termoBusca.trim().toLowerCase(),
                achou = funcionariosAtivos().find((f) => f.nome.toLowerCase().includes(t));
            if (achou && achou.id !== movimentacoes.mov.uid) {
                movimentacoes.mov.uid = achou.id;
                render();
            }
        } else aplicarBusca();
    });
    [
        'funcionarios',
        'registros',
        'batidasMobile',
        'mobileAcessos',
        'credenciaisApp',
        'ajustes',
        'feriados',
        'config',
        'empresa',
        'empresas',
        'horarios',
        'cargos',
        'departamentos',
        'justificativas',
        'desligamentos',
        'usuarios'
    ].forEach((p) =>
        {
        if (permissao === 'visualizador' && (p === 'credenciaisApp' || p === 'usuarios')) {
            state[p] = {}; state.carregados[p] = true; return;
        }
        db.listen(p, (v) => {
            if (p === 'registros' || p === 'batidasMobile') {
                fontesBatidas[p] = v || {};
                fontesCarregadas[p] = true;
                state.registros = registrosIntegrados(fontesBatidas.registros, fontesBatidas.batidasMobile);
                state.batidasMobile = fontesBatidas.batidasMobile;
                state.carregados.registros = fontesCarregadas.registros && fontesCarregadas.batidasMobile;
                state.carregados.batidasMobile = fontesCarregadas.batidasMobile;
            } else {
                state[p] = v || {};
                state.carregados[p] = true;
            }
            agendar();
        });
        }
    );
    db.listen(`preferencias/${perfilId()}`, (v) => {
        state.preferencias = v || {};
        state.carregados.preferencias = true;
        agendar();
    });
    window.addEventListener('hashchange', rota);
    rota();
}
iniciar();
