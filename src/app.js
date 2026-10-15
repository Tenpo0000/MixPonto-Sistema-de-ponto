/* Roteador: páginas existentes + cadastros integrados. */
import { $, $$, ICONES } from './core/utils.js';
import { state, funcionariosAtivos, pendencias } from './core/state.js';
import { db, usandoFirebase } from './core/db.js';
import { toast, abrirModal } from './core/ui.js';
import * as inicio from './pages/inicio.js';
import * as cadastro from './pages/cadastro.js';
import * as movimentacoes from './pages/movimentacoes.js';
import * as usuarios from './pages/usuarios.js';
import * as gerenciamento from './pages/gerenciamento.js';
import { perfilId, preencherHeader } from './core/preferencias.js';
import * as empresa from './pages/empresa.js';
import * as horario from './pages/horario.js';
import * as funcionario from './pages/funcionario.js';
import * as cargo from './pages/cargo.js';
import * as departamento from './pages/departamento.js';
import * as feriado from './pages/feriado.js';
import * as justificativa from './pages/justificativa.js';
import * as relatorio from './pages/relatorio.js';
import * as demitidos from './pages/demitidos.js';
function paginaProvisoria(grupo,titulo,descricao){return {view:()=>`<div class="breadcrumb"><span>${grupo}</span><span>›</span><span class="destacado">${titulo}</span></div><div class="cabecalho-pagina"><div><h1>${titulo}</h1><p>${descricao}</p></div></div><div class="vazio"><h2>${titulo}</h2><p>Esta tela ainda está em construção.</p></div>`,bind(){}};}
const configuracoes = gerenciamento;
const PAGES={inicio,cadastro,movimentacoes,configuracoes,empresa,horario,funcionario,cargo,departamento,feriado,justificativa,relatorio,demitidos,usuarios,gerenciamento};
const GRUPOS={cadastro:['cadastro','empresa','horario','funcionario','cargo','departamento','feriado','justificativa'],movimentacoes:['movimentacoes','relatorio','demitidos'],configuracoes:['configuracoes','usuarios','gerenciamento']};
const grupoDe=view=>Object.keys(GRUPOS).find(g=>GRUPOS[g].includes(view));
let viewAtual='inicio',termoBusca='',agendado=false;
function abrirSubmenu(grupo,abrir){$(`#submenu-${grupo}`).hidden=!abrir;$(`.menu-item[data-view="${grupo}"]`).setAttribute('aria-expanded',String(abrir));}
function aplicarBusca(){const t=termoBusca.trim().toLowerCase();$$('#view [data-busca]').forEach(el=>el.hidden=!!t&&!el.textContent.toLowerCase().includes(t));}
function render(){const pagina=PAGES[viewAtual];preencherHeader();$('#view').innerHTML=pagina.view();pagina.bind?.({render});const grupo=grupoDe(viewAtual)||viewAtual;$$('.menu-item').forEach(b=>b.classList.toggle('ativo',b.dataset.view===grupo));$$('.submenu-item').forEach(b=>b.classList.toggle('ativo',b.dataset.view===viewAtual));aplicarBusca();$('#sino .ponto')?.remove();if(pendencias()>0)$('#sino').insertAdjacentHTML('beforeend','<span class="ponto"></span>');}
function rota(){const h=location.hash.replace('#','');viewAtual=PAGES[h]?h:'inicio';const g=grupoDe(viewAtual);if(g)abrirSubmenu(g,true);render();$('#view').scrollTop=0;}
function agendar(){if(agendado)return;agendado=true;requestAnimationFrame(()=>{agendado=false;render();});}
function iniciar(){
 const rotulos={inicio:['home','Início'],cadastro:['cadastro','Cadastro'],movimentacoes:['mov','Movimentações'],configuracoes:['config','Configurações']};
 $$('.menu-item').forEach(b=>{const view=b.dataset.view,[ic,nome]=rotulos[view];b.innerHTML=`${ICONES[ic]}<span>${nome}</span>`;b.addEventListener('click',()=>{if(GRUPOS[view])abrirSubmenu(view,$(`#submenu-${view}`).hidden);else location.hash=view;});});
 $$('.submenu-item').forEach(b=>b.addEventListener('click',()=>location.hash=b.dataset.view));
 $('#btn-sobre').innerHTML=`${ICONES.info}<span>Sobre</span>`;$('#btn-sobre').addEventListener('click',()=>abrirModal({titulo:'Sobre o sistema',corpo:`<p style="font-size:14px;line-height:1.6">Sistema de ponto da Mix Telecomunicações, <strong>protótipo de demonstração</strong>. Construído com HTML, CSS e JavaScript puro, com dados no Firebase Realtime Database.</p><p class="dica" style="margin-top:12px">${usandoFirebase?'Conectado ao Firebase.':'Firebase indisponível: rodando em modo local.'}</p>`}));
 $('#icone-busca').innerHTML=ICONES.busca;$('#sino').innerHTML=ICONES.sino;$('#sino').addEventListener('click',()=>{const n=pendencias();toast(n?`${n} faltas aguardando justificativa nos últimos 31 dias.`:'Nenhuma pendência.');});
 const con=$('#conexao');con.textContent=usandoFirebase?'Firebase':'Modo local';con.classList.toggle('local',!usandoFirebase);
 $('#busca').addEventListener('input',e=>{termoBusca=e.target.value;if(viewAtual==='movimentacoes'&&termoBusca.trim()){const t=termoBusca.trim().toLowerCase(),achou=funcionariosAtivos().find(f=>f.nome.toLowerCase().includes(t));if(achou&&achou.id!==movimentacoes.mov.uid){movimentacoes.mov.uid=achou.id;render();}}else aplicarBusca();});
 ['funcionarios','registros','ajustes','feriados','config','empresa','horarios','cargos','departamentos','justificativas','desligamentos','usuarios'].forEach(p=>db.listen(p,v=>{state[p]=v||{};state.carregados[p]=true;agendar();}));
 db.listen(`preferencias/${perfilId()}`,v=>{state.preferencias=v||{};state.carregados.preferencias=true;agendar();});
 window.addEventListener('hashchange',rota);rota();
}
iniciar();
