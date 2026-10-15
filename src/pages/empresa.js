/* Cadastro de empresa: integração com o roteador view()/bind({render}). */
import { $, esc, ICONES } from '../core/utils.js';
import { db, usandoFirebase } from '../core/db.js';
import { toast } from '../core/ui.js';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const vazio = () => ({ nome:'', documento:'', inscricaoEstadual:'', cep:'', logradouro:'', numero:'', bairro:'', cidade:'', uf:'', responsavel:'', cargo:'', email:'' });
let dados = vazio(), salvo = null, alterado = false, pronto = false, escutando = false, salvando = false, erro = '';
const copiar = d => JSON.parse(JSON.stringify(d));
const svg = content => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${content}</svg>`;
const predio = svg('<path d="M3 21V3h12v18M15 9h6v12M1 21h22M7 7h1M11 7h1M7 11h1M11 11h1M7 15h1M11 15h1M7 19h1M18 13h1M18 17h1"/>');
const localizacao = svg('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>');
const assinatura = svg('<path d="M5 14V3h12v8M8 7h6M8 10h5M3 18v3h7M13 20l7-7 2 2-7 7h-3z"/>');
const salvarIcone = svg('<path d="M3 3h15l3 3v15H3zM7 3v6h10V3M7 21v-7h10v7"/>');
function campo(nome, label, placeholder, opts = '') {
    return `<label class="emp-campo" for="emp-${nome}"><span>${label}</span><input id="emp-${nome}" name="${nome}" value="${esc(dados[nome])}" placeholder="${esc(placeholder)}" ${opts}></label>`;
}
export function view() {
    return `<div class="empresa-page"><div class="breadcrumb"><span>Cadastro</span><span>›</span><span class="destacado">Empresa</span></div><div class="cabecalho-pagina"><div><h1>Dados Cadastrais</h1><p>Preencha as informações abaixo para registrar uma unidade corporativa.</p></div></div><form id="emp-form" novalidate aria-busy="${salvando}"><fieldset class="emp-fieldset" ${!pronto || salvando ? 'disabled' : ''}><legend class="emp-sr">Dados da empresa e do responsável</legend><section class="emp-card emp-gerais" aria-labelledby="emp-titulo-gerais"><h2 id="emp-titulo-gerais">${predio} Informações Gerais</h2><div class="emp-grade-gerais"><div class="emp-nome">${campo('nome','Nome da Empresa','Ex: Inova Soluções Tecnológicas','autocomplete="organization" required maxlength="160"')}</div>${campo('documento','CNPJ/CPF','00.000.000/0000-00','required maxlength="18" autocapitalize="characters" spellcheck="false"')}${campo('inscricaoEstadual','Inscrição Estadual','Isento ou Nº','maxlength="40"')}</div></section><div class="emp-grade-inferior"><section class="emp-card emp-localizacao" aria-labelledby="emp-titulo-local"><h2 id="emp-titulo-local">${localizacao} Localização</h2><div class="emp-endereco"><div class="emp-endereco-linha">${campo('cep','CEP','00000-000','inputmode="numeric" autocomplete="postal-code" maxlength="9" required')}${campo('logradouro','Logradouro','Rua, Avenida, Praça...','autocomplete="address-line1" maxlength="180" required')}</div><div class="emp-endereco-linha">${campo('numero','Número','S/N','maxlength="20" required')}${campo('bairro','Bairro','Centro','maxlength="100" required')}</div><div class="emp-endereco-linha emp-cidade-uf">${campo('cidade','Cidade','São Paulo','autocomplete="address-level2" maxlength="100" required')}<label class="emp-campo" for="emp-uf"><span>UF</span><select id="emp-uf" name="uf" autocomplete="address-level1" required><option value="">Selecione</option>${UFS.map(uf=>`<option value="${uf}" ${dados.uf === uf ? 'selected' : ''}>${uf}</option>`).join('')}</select></label></div></div></section><section class="emp-card emp-assinatura" aria-labelledby="emp-titulo-assinatura"><h2 id="emp-titulo-assinatura">${assinatura} Assinatura</h2><div class="emp-contato">${campo('responsavel','Nome do Responsável','Nome Completo','autocomplete="name" maxlength="160" required')}${campo('cargo','Cargo','Diretor, Gerente...','autocomplete="organization-title" maxlength="100" required')}${campo('email','E-mail','responsavel@empresa.com.br','type="email" autocomplete="email" maxlength="254" required')}</div><div class="emp-aviso">${ICONES.info || ''}<p>Este responsável será o contato principal para assinaturas digitais de documentos de RH.</p></div></section></div></fieldset><p class="erro emp-erro" id="emp-erro" role="alert" tabindex="-1" ${erro ? '' : 'hidden'}>${esc(erro)}</p><div class="emp-status" role="status">${!pronto ? 'Carregando dados da empresa…' : ''}</div><footer class="emp-acoes"><button type="button" class="emp-cancelar" id="emp-cancelar" ${salvando ? 'disabled' : ''}>Cancelar</button><button type="submit" class="btn btn-primario emp-salvar" ${!pronto || salvando ? 'disabled' : ''}>${salvarIcone}${salvando ? 'Salvando…' : 'Salvar Empresa'}</button></footer></form><p class="emp-rodape">Sistema de Ponto · Gestão inteligente de recursos humanos</p></div>`;
}
function mascaraDocumento(value) {
    const d = value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,14);
    if (/^\d{0,11}$/.test(d)) return d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
    return d.replace(/^(.{2})(.)/,'$1.$2').replace(/^(.{2})\.(.{3})(.)/,'$1.$2.$3').replace(/^(.{2})\.(.{3})\.(.{3})(.)/,'$1.$2.$3/$4').replace(/(.{4})(.{1,2})$/,'$1-$2');
}
function validar(d) {
    const campos = [['nome','nome da empresa'],['documento','CNPJ/CPF'],['cep','CEP'],['logradouro','logradouro'],['numero','número ou S/N'],['bairro','bairro'],['cidade','cidade'],['uf','UF'],['responsavel','nome do responsável'],['cargo','cargo do responsável'],['email','e-mail do responsável']];
    for (const [nome, label] of campos) if (!d[nome]) return {campo:nome, mensagem:`Preencha ${label}.`};
    const documento=d.documento.replace(/[^A-Z0-9]/gi,'');
    if (!(/^\d{11}$/.test(documento) || /^[A-Z0-9]{12}\d{2}$/.test(documento))) return {campo:'documento',mensagem:'Informe um CPF com 11 dígitos ou um CNPJ com 14 posições e os dois últimos dígitos numéricos.'};
    if (d.cep.replace(/\D/g,'').length !== 8) return {campo:'cep',mensagem:'Informe um CEP com 8 dígitos.'};
    if (!UFS.includes(d.uf)) return {campo:'uf',mensagem:'Selecione uma UF válida.'};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return {campo:'email',mensagem:'Informe um e-mail válido.'};
    return null;
}
export function bind({render}) {
    if (!escutando) {
        escutando = true;
        db.listen('empresa', v => {
            pronto = true; salvo = v;
            if (!alterado) dados = { ...vazio(), ...(v || {}) };
            if (location.hash === '#empresa') requestAnimationFrame(render);
        });
    }
    const form = $('#emp-form');
    form.addEventListener('input', e => {
        if (!(e.target.name in dados)) return;
        if (e.target.name === 'documento') e.target.value = mascaraDocumento(e.target.value);
        if (e.target.name === 'cep') e.target.value = e.target.value.replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');
        dados[e.target.name] = e.target.value; alterado = true;
        e.target.removeAttribute('aria-invalid');
    });
    form.addEventListener('change', e => { if (e.target.name in dados) { dados[e.target.name] = e.target.value; alterado = true; } });
    $('#emp-cancelar').addEventListener('click', () => { dados = { ...vazio(), ...(salvo ? copiar(salvo) : {}) }; alterado = false; erro = ''; location.hash = 'inicio'; });
    form.addEventListener('submit', async e => {
        e.preventDefault(); if (!pronto || salvando) return;
        const payload = Object.fromEntries(Object.keys(vazio()).map(k=>[k,String(dados[k] || '').trim()]));
        payload.documento=mascaraDocumento(payload.documento);
        const falha = validar(payload);
        if (falha) { erro = falha.mensagem; render(); const input = $(`#emp-${falha.campo}`); input?.setAttribute('aria-invalid','true'); input?.setAttribute('aria-describedby','emp-erro'); input?.focus(); return; }
        erro=''; salvando=true; render();
        try {
            await db.set('empresa',payload);
            dados=payload; salvo=copiar(payload); alterado=false; toast('Dados da empresa salvos.');
        } catch { erro='Não foi possível salvar os dados da empresa. Tente novamente.'; toast(erro,'erro'); }
        finally { salvando=false; if (location.hash === '#empresa') render(); }
    });
}
