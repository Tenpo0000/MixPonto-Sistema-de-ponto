import { createHash } from 'node:crypto';
export const emailKey = email => email.trim().toLowerCase().replace(/[% .#$\[\]\/]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const hash = value => createHash('sha256').update(value).digest('hex').slice(0,32);
const fail = (message,status=403) => { throw Object.assign(Error(message),{status}); };
const roles = ['administrador','rh','visualizador'];
export function plataforma(user,config) { return { geral:(config.adminUids.includes(user.uid) || user.mixpontoGeral === true),revendedor:(config.resellerUids.includes(user.uid) || user.mixpontoRevendedor === true) }; }
export function podeAdministrar(conta,user,config) {
    const p=plataforma(user,config);
    if (p.geral || (p.revendedor && conta.meta?.revendedorUid===user.uid)) return true;
    if (conta.meta?.ownerUid===user.uid && (conta.meta?.gestaoVersao!==2 || user.email_verified)) return true;
    const g=conta.acessosContas?.[emailKey(user.email || '')], u=conta.usuarios?.[g?.usuarioId];
    return !!(user.email_verified && g?.status==='ativo' && g.permissao==='administrador' && g.email===user.email?.toLowerCase() && u?.email===g.email && u?.status==='ativo' && u?.permissao==='administrador');
}
export function resumir(c,id) { return {id,nome:c.meta?.nome || c.empresa?.nome || 'Conta',codigoApp:c.meta?.codigoApp || '',usuarios:Object.values(c.acessosContas || {}).filter(g=>g.status==='ativo').length,convites:Object.values(c.convites || {}).filter(g=>g.status==='pendente' && g.expiraEm>Date.now()).length}; }
function audit(c,user,a,now,details={}) { c.auditoria ||= {}; c.auditoria[hash(user.uid+a.requestId)]={atorUid:user.uid,tipo:a.tipo,criadoEm:now,resultado:'sucesso',...details}; }
function grant(c,email,role,uid,now,nome) {
    const key=emailKey(email), usuarioId=c.acessosContas?.[key]?.usuarioId || 'u_'+hash(email);
    c.usuarios ||= {}; c.acessosContas ||= {};
    c.usuarios[usuarioId]={...c.usuarios[usuarioId],nome:nome || email,email,permissao:role,status:'ativo',criadoEm:c.usuarios[usuarioId]?.criadoEm || now,...(uid?{authUid:uid}:{})};
    c.acessosContas[key]={usuarioId,email,nomeConta:c.meta.nome || c.empresa?.nome || 'Conta',permissao:role,status:'ativo'};
}
export function aplicar(c,user,a,config,target,now=Date.now()) {
    if (!user.email_verified || !podeAdministrar(c,user,config)) fail('Sem permissão para gerenciar esta conta. Confirme seu e-mail.');
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(a.requestId || '')) fail('Identificador da operação inválido.',400);
    const request=hash(user.uid+a.requestId);
    if(c.operacoes?.[request]) return c;
    if(a.tipo==='editar') {
        const nome=String(a.nome || '').trim();
        if(!nome || nome.length>160) fail('Informe o nome da conta.',400);
        c.meta.nome=nome;
        for(const g of Object.values(c.acessosContas || {})) g.nomeConta=nome;
        audit(c,user,a,now);
    } else if(a.tipo==='revendedor') {
        if(!plataforma(user,config).geral || !target?.emailVerified || target.disabled || !(config.resellerUids.includes(target.uid) || target.customClaims?.mixpontoRevendedor)) fail('Selecione um revendedor autorizado.');
        c.meta.revendedorUid=target.uid;
        audit(c,user,a,now,{email:target.email || a.email,revendedorUid:target.uid});
    } else if(a.tipo==='acesso') {
        const email=String(a.email || '').trim().toLowerCase(), role=a.permissao;
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !roles.includes(role)) fail('E-mail ou permissão inválidos.',400);
        const key=emailKey(email), previous=c.acessosContas?.[key];
        const protectedUser=email===config.adminEmail || c.usuarios?.[previous?.usuarioId]?.authUid===c.meta.ownerUid || c.usuarios?.[previous?.usuarioId]?.titular;
        if(protectedUser && (a.revogar || role!=='administrador')) fail('O administrador protegido deve permanecer ativo.');
        if(previous?.status==='ativo' && previous.permissao==='administrador' && (a.revogar || role!=='administrador')) {
            const others=Object.values(c.acessosContas || {}).filter(g=>g.email!==email && g.status==='ativo' && g.permissao==='administrador');
            if(!others.length && (!c.meta.ownerUid || c.meta.ownerUid==='pendente')) fail('Mantenha ao menos um administrador ativo.');
        }
        c.convites ||= {};
        if(a.revogar) {
            if(previous) { previous.status='bloqueado'; c.usuarios[previous.usuarioId].status='bloqueado'; }
            if(c.convites[key]) c.convites[key].status='cancelado';
        } else if(target?.emailVerified && !target.disabled) {
            grant(c,email,role,target.uid,now,a.nome);
            if(c.convites[key]) c.convites[key].status='aceito';
        } else {
            if(previous) { previous.status='bloqueado'; c.usuarios[previous.usuarioId].status='bloqueado'; }
            c.convites[key]={email,permissao:role,status:'pendente',criadoEm:now,expiraEm:now+7*86400000,concedidoPor:user.uid};
        }
        audit(c,user,a,now,{email,permissao:role,revogado:!!a.revogar});
    } else fail('Operação inválida.',400);
    c.operacoes ||= {}; c.operacoes[request]={criadoEm:now};
    return c;
}
export function aceitarConvites(c,user,now=Date.now()) {
    if(!user.email_verified || !user.email) return false;
    const invite=c.convites?.[emailKey(user.email)];
    if(invite?.status!=='pendente' || invite.expiraEm<=now) return false;
    grant(c,user.email.toLowerCase(),invite.permissao,user.uid,now);
    invite.status='aceito'; invite.aceitoEm=now;
    audit(c,user,{tipo:'aceitar-convite',requestId:'convite-'+invite.criadoEm},now);
    return true;
}
export function criarConta(root,user,a,config,central,now=Date.now()) {
    const p=plataforma(user,config);
    if(!user.email_verified || (!p.geral && !p.revendedor)) fail('Somente revendedores autorizados podem criar contas.');
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(a.requestId || '')) fail('Identificador da operação inválido.',400);
    const nome=String(a.nome || '').trim();
    if(!nome || nome.length>160) fail('Informe o nome da conta.',400);
    const contaId='c_'+hash(user.uid+a.requestId);
    root.contas ||= {}; root.contasPorId ||= {};
    if(root.contas[contaId]) return {root,contaId};
    const next=(root.sequenciaContas || 0)+1;
    if(!Number.isSafeInteger(next) || next>999999999 || root.contasPorId[next]) fail('Sequência de contas inconsistente.',409);
    const owner=central?.uid || 'pendente';
    const c={meta:{nome,ownerUid:owner,codigoApp:String(next),gestaoVersao:2,revendedorUid:user.uid,criadoEm:now},empresa:{nome},config:{jornada:8,tolerancia:10,diasTrabalho:'12345'},titularesAutorizados:{[owner]:true}};
    c.convites={[emailKey(config.adminEmail)]:{email:config.adminEmail,permissao:'administrador',status:'pendente',criadoEm:now,expiraEm:now+7*86400000,concedidoPor:user.uid}};
    if(central?.emailVerified && !central.disabled) { grant(c,config.adminEmail,'administrador',central.uid,now); c.convites[emailKey(config.adminEmail)].status='aceito'; }
    audit(c,user,{...a,tipo:'criar-conta'},now);
    root.contas[contaId]=c; root.contasPorId[next]={contaId}; root.sequenciaContas=next;
    return {root,contaId};
}
