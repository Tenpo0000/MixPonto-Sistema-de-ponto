import { conterFoco } from './foco.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let gestaoAberta = null;
export async function gestaoApi(path='',body) {
    const user=window.fb.auth.currentUser;
    if(!user) throw Error('Entre no sistema.');
    const url=new URL(window.fb.contasApiUrl,location.href);
    url.pathname=url.pathname.replace(/\/contas$/, '/gestao')+path;
    const response=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${await user.getIdToken()}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(30000)});
    const result=await response.json();
    if(window.fb.auth.currentUser?.uid!==user.uid) throw Error('A sessão mudou.');
    if(!response.ok) throw Error(result.error || 'Não foi possível concluir.');
    return result;
}
export async function abrirGestao() {
    if (gestaoAberta) return gestaoAberta;
    let painel=document.getElementById('gestao-painel');
    if(!painel){ painel=document.createElement('section'); painel.id='gestao-painel'; painel.className='gestao-painel'; document.body.appendChild(painel); }
    painel.hidden=false;
    // requestId permite repetir uma ação sem duplicá-la no servidor. revisao
    // descarta respostas de uma tela anterior quando a seleção muda ou fecha.
    let selected='', requestId=crypto.randomUUID(), revisao=0, alterado=false, aberto=true, resumo=null, liberarFoco=null;
    function fechar() {
        aberto=false;
        revisao++;
        painel.hidden=true;
        liberarFoco?.();
        gestaoAberta=null;
        if(alterado) window.dispatchEvent(new Event('mixponto:gestao-atualizada'));
    }
    painel.innerHTML='<div class="gestao-conteudo"><div class="cabecalho-pagina"><div><h1>Gestão de contas</h1><p>Gerencie suas contas sem precisar selecionar uma empresa.</p></div><button type="button" class="btn" data-fechar>Voltar</button></div><p role="status" data-status></p></div>';
    painel.querySelector('[data-fechar]').onclick=fechar;
    painel.setAttribute('role','dialog');
    painel.setAttribute('aria-modal','true');
    painel.setAttribute('aria-label','Gestão de contas');
    liberarFoco=conterFoco(painel,fechar);
    async function render(atualizar = true) {
        if(!aberto) return;
        const atual=++revisao;
        painel.setAttribute('aria-busy','true');
        painel.querySelector('[data-status]').textContent='Atualizando informações…';
        painel.querySelectorAll('button:not([data-fechar])').forEach(b=>b.disabled=true);
        try {
            const [list,c]=await Promise.all([
                atualizar || !resumo ? gestaoApi() : resumo,
                selected ? gestaoApi('/'+selected) : null,
            ]);
            if(atual!==revisao || painel.hidden) return;
            // Cache apenas de apresentação; permissões e alterações são sempre
            // conferidas pelo servidor, inclusive ao abrir os detalhes da conta.
            resumo=list;
            painel.innerHTML=`<div class="gestao-conteudo"><div class="cabecalho-pagina"><div><h1>Gestão de contas</h1><p>Gerencie clientes e acessos. Cada conta tem seu próprio ID para o aplicativo.</p></div><button class="btn" data-fechar>Voltar ao sistema</button></div>
                <div class="gestao-metricas"><article><span>Contas gerenciadas</span><strong>${list.contas.length}</strong><small>Ambientes independentes</small></article><article><span>Acessos ativos</span><strong>${list.contas.reduce((n,c)=>n+c.usuarios,0)}</strong><small>Usuários autorizados</small></article><article><span>Convites pendentes</span><strong>${list.contas.reduce((n,c)=>n+c.convites,0)}</strong><small>Aguardando confirmação</small></article></div>
                <p role="status" data-status></p>
                ${list.geral || list.revendedor?'<form data-criar class="cad-card"><h2>Nova conta de cliente</h2><label class="cad-campo">Nome da conta<input name="nome" maxlength="160" required></label><button class="btn btn-primario">Criar conta</button></form>':''}
                ${list.geral?'<form data-revendedor class="cad-card"><h2>Autorizar revendedor</h2><label class="cad-campo">E-mail verificado<input name="email" type="email" required></label><label><input name="remover" type="checkbox"> Revogar autorização de revendedor</label><button class="btn btn-primario">Salvar autorização</button></form>':''}
                ${list.geral?`<section class="cad-card"><h2>Revendedores autorizados</h2>${(list.revendedores || []).map(r=>`<p>${esc(r.email)} · ${r.ativo?'Ativo':'Desativado'}</p>`).join('') || '<p>Nenhum revendedor autorizado.</p>'}</section>`:''}<section class="cad-card"><label class="cad-campo">Buscar conta por nome ou ID<input data-buscar type="search"></label><div data-lista>${list.contas.map(c=>`<button class="btn" data-conta="${esc(c.id)}"><span><strong>${esc(c.nome)}</strong><small>ID ${esc(c.codigoApp)}</small></span><span aria-hidden="true">→</span></button>`).join('') || '<p>Nenhuma conta disponível para gerenciamento.</p>'}</div></section>
                ${c?`<section class="cad-card"><h2>${esc(c.nome)} · ID ${esc(c.codigoApp)}</h2><form data-editar><label class="cad-campo">Nome<input name="nome" maxlength="160" value="${esc(c.nome)}" required></label><button class="btn">Atualizar nome</button></form>
                ${list.geral?'<form data-responsavel><label class="cad-campo">E-mail do revendedor responsável<input name="email" type="email" required></label><button class="btn">Alterar responsável comercial</button></form>':''}<h3>Adicionar ou alterar acesso</h3><form data-acesso><label class="cad-campo">E-mail<input name="email" type="email" required maxlength="254"></label><label class="cad-campo">Permissão<select name="permissao"><option value="visualizador">Visualizador</option><option value="rh">Gestor / RH</option><option value="administrador">Administrador</option></select></label><button class="btn btn-primario">Conceder acesso</button><p>Quem ainda não confirmou o e-mail receberá um convite válido por 7 dias. O destinatário aceita após entrar e verificar seus acessos. Nenhuma senha é alterada.</p></form>
                <h3>Usuários</h3>${c.usuarios.map(u=>`<p>${esc(u.email)} · ${esc(u.permissao)} · ${esc(u.status)} <button class="btn" data-revogar="${esc(u.email)}" data-role="${esc(u.permissao)}">Revogar</button></p>`).join('') || '<p>Nenhum acesso ativo.</p>'}
                <h3>Convites</h3>${c.convites.map(i=>`<p>${esc(i.email)} · ${esc(i.status==='pendente' && i.expiraEm<Date.now()?'expirado':i.status)} · ${esc(new Date(i.expiraEm).toLocaleDateString('pt-BR'))} ${i.status==='pendente'?`<button class="btn" data-revogar="${esc(i.email)}" data-role="${esc(i.permissao)}">Cancelar convite</button>`:''}</p>`).join('') || '<p>Nenhum convite.</p>'}
                <h3>Histórico administrativo</h3>${c.auditoria.map(a=>`<p>${esc(new Date(a.criadoEm).toLocaleString('pt-BR'))} · ${esc(a.tipo)} · ${esc(a.email || '')} · responsável ${esc(a.atorUid)}</p>`).join('') || '<p>Nenhuma atividade registrada.</p>'}</section>`:''}</div>`;
            painel.querySelector('[data-fechar]').onclick=fechar;
            painel.querySelector('[data-fechar]').focus?.();
            painel.querySelector('[data-buscar]').oninput=e=>painel.querySelectorAll('[data-conta]').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(e.target.value.toLowerCase()));
            painel.querySelectorAll('[data-conta]').forEach(b=>b.onclick=()=>{selected=b.dataset.conta;requestId=crypto.randomUUID();render(false);});
            async function submit(form,path,body) {
                if(form.dataset.busy) return;
                form.dataset.busy='1';form.querySelectorAll('button').forEach(b=>b.disabled=true);
                try {await gestaoApi(path,{...body,requestId});alterado=true;requestId=crypto.randomUUID();if(aberto)await render();else window.dispatchEvent(new Event('mixponto:gestao-atualizada'));}
                catch(e){if(aberto)painel.querySelector('[data-status]').textContent=e.message+' Você pode tentar novamente.';}
                finally{delete form.dataset.busy;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
            }
            const criar=painel.querySelector('[data-criar]');
            if(criar) criar.onsubmit=e=>{e.preventDefault();submit(criar,'',{nome:new FormData(criar).get('nome')});};
            const rev=painel.querySelector('[data-revendedor]');
            if(rev) rev.onsubmit=e=>{e.preventDefault();const d=new FormData(rev);if(confirm('Confirmar alteração da autorização de revendedor?')) submit(rev,'/revendedores',{email:d.get('email'),remover:d.has('remover')});};
            const editar=painel.querySelector('[data-editar]');
            if(editar) editar.onsubmit=e=>{e.preventDefault();submit(editar,'/'+selected,{tipo:'editar',nome:new FormData(editar).get('nome')});};
            const responsavel=painel.querySelector('[data-responsavel]');
            if(responsavel) responsavel.onsubmit=e=>{e.preventDefault();if(confirm('Transferir a responsabilidade comercial desta conta?')) submit(responsavel,'/'+selected,{tipo:'revendedor',email:new FormData(responsavel).get('email')});};
            const acesso=painel.querySelector('[data-acesso]');
            if(acesso) acesso.onsubmit=e=>{e.preventDefault();submit(acesso,'/'+selected,{tipo:'acesso',...Object.fromEntries(new FormData(acesso))});};
            painel.querySelectorAll('[data-revogar]').forEach(b=>b.onclick=()=>{if(confirm('Revogar o acesso ou convite de '+b.dataset.revogar+' somente nesta conta?')) submit(b.closest('section'),'/'+selected,{tipo:'acesso',email:b.dataset.revogar,permissao:b.dataset.role,revogar:true});});
        } catch(e){
            if(atual!==revisao || painel.hidden) return;
            const p=painel.querySelector('[data-status]');p.textContent=e.message;
            if(window.fb.auth.currentUser && !window.fb.auth.currentUser.emailVerified){const verify=document.createElement('button');verify.textContent='Enviar confirmação de e-mail';verify.onclick=async()=>{try{await window.fb.sendEmailVerification(window.fb.auth.currentUser);p.textContent='Abra a confirmação recebida por e-mail e entre novamente.';}catch{p.textContent='Não foi possível enviar agora. Tente novamente mais tarde.';}};painel.append(verify);}
        } finally {if(atual===revisao)painel.setAttribute('aria-busy','false');}
    }
    gestaoAberta=render();
    await gestaoAberta;
}
