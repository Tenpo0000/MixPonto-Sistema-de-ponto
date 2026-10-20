import { createHash } from 'node:crypto';
import { criarConta, aplicar, aceitarConvites, podeAdministrar, plataforma, resumir, emailKey } from './gestao.mjs';
export function criarGestao(database,auth,config,store) {
    const lookup=async email=>{ try{return await auth.getUserByEmail(email);}catch(e){if(e.code==='auth/user-not-found')return null;throw e;} };
    const keys=()=>store.listAccountIds();
    return {
        async reseller(user,a) {
            if(!plataforma(user,config).geral || !user.email_verified) throw Object.assign(Error('Somente o administrador geral pode gerenciar revendedores.'),{status:403});
            const target=await lookup(String(a.email || '').trim().toLowerCase());
            if(!target?.emailVerified || target.disabled) throw Object.assign(Error('O destinatário precisa ter um login com e-mail verificado.'),{status:400});
            if(config.resellerUids.includes(target.uid)) throw Object.assign(Error('Esta autorização está fixada na configuração RESELLER_UIDS do servidor.'),{status:409});
            if(config.adminUids.includes(target.uid) || target.customClaims?.mixpontoGeral) throw Object.assign(Error('Não altere o administrador geral por esta operação.'),{status:403});
            if(!/^[a-zA-Z0-9_-]{1,128}$/.test(a.requestId || '')) throw Object.assign(Error('Operação inválida.'),{status:400});
            const ids=await keys();let auditId;
            for(const id of ids) { const meta=await store.get(`contas/${id}/meta`);if(meta?.ownerUid===user.uid){auditId=id;break;} }
            if(!auditId) throw Object.assign(Error('Configure uma conta administrativa para registrar o histórico.'),{status:409});
            const key=createHash('sha256').update(user.uid+a.requestId).digest('hex').slice(0,32);
            const log=database.ref(`contas/${auditId}/auditoria/${key}`);
            const event={atorUid:user.uid,tipo:a.remover?'revogar-revendedor':'autorizar-revendedor',email:target.email,criadoEm:Date.now(),resultado:'iniciado'};
            await log.set(event);
            try {
                await auth.setCustomUserClaims(target.uid,{...target.customClaims,mixpontoRevendedor:!a.remover});
                await log.update({resultado:'sucesso'});
            } catch(e) { await log.update({resultado:'falha-ou-pendente'}).catch(()=>{});throw e; }
            return {ok:true};
        },
        async list(user) {
            const contas=[];
            for(const id of await keys()) {
                const meta=await store.get(`contas/${id}/meta`);
                const grants=await store.get(`contas/${id}/acessosContas`);
                const users=await store.get(`contas/${id}/usuarios`);
                const c={meta,acessosContas:grants,usuarios:users};
                if(podeAdministrar(c,user,config)) { c.convites=await store.get(`contas/${id}/convites`); contas.push(resumir(c,id)); }
            }
            const platform=plataforma(user,config), revendedores=[];
            if(platform.geral) {
                let page;
                do {
                    const batch=await auth.listUsers(1000,page);
                    for(const record of batch.users) if(config.resellerUids.includes(record.uid) || record.customClaims?.mixpontoRevendedor)
                        revendedores.push({email:record.email || '',ativo:!record.disabled,verificado:record.emailVerified});
                    page=batch.pageToken;
                } while(page);
            }
            return {contas,revendedores,...platform};
        },
        async accept(user) {
            if(!user.email_verified) return;
            for(const id of await keys()) {
                const invite=await store.get(`contas/${id}/convites/${emailKey(user.email || '')}`);
                if(invite?.status!=='pendente' || invite.expiraEm<=Date.now()) continue;
                const reference=database.ref(`contas/${id}`);
                await reference.once('value');
                await reference.transaction(c=>{
                if(!c)return c;
                if(!aceitarConvites(c,user))return;
                return c;
            }); }
        },
        async create(user,a) {
            const central=await lookup(config.adminEmail);
            let id;
            await database.ref().transaction(root=>{const value=criarConta(root || {},user,a,config,central);id=value.contaId;return value.root;});
            return {conta:resumir((await database.ref(`contas/${id}`).get()).val(),id)};
        },
        async detail(user,id) {
            const c=(await database.ref(`contas/${id}`).get()).val();
            if(!c || !podeAdministrar(c,user,config))throw Object.assign(Error('Sem permissão para gerenciar esta conta.'),{status:403});
            return {...resumir(c,id),usuarios:Object.values(c.acessosContas || {}),convites:Object.values(c.convites || {}),auditoria:Object.values(c.auditoria || {}).sort((a,b)=>b.criadoEm-a.criadoEm).slice(0,100)};
        },
        async mutate(user,id,a) {
            // Autorização antes da consulta ao diretório Auth e novamente dentro da transação.
            const before=(await database.ref(`contas/${id}`).get()).val();
            if(!before || !podeAdministrar(before,user,config))throw Object.assign(Error('Sem permissão.'),{status:403});
            const target=['acesso','revendedor'].includes(a.tipo) && !a.revogar?await lookup(String(a.email || '').trim().toLowerCase()):null;
            const reference=database.ref(`contas/${id}`);
                await reference.once('value');
                await reference.transaction(c=>{if(!c)return c;return aplicar(c,user,a,config,target);});
            return {ok:true};
        }
    };
}
