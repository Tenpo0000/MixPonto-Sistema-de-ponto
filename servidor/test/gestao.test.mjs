import test from 'node:test';
import assert from 'node:assert/strict';
import { criarConta, aplicar, aceitarConvites, podeAdministrar, emailKey } from '../gestao.mjs';
const config={adminEmail:'central@example.com',adminUids:['central'],resellerUids:['reseller']};
const reseller={uid:'reseller',email:'reseller@example.com',email_verified:true};
const central={uid:'central',emailVerified:true,email:'central@example.com'};
const identity={uid:'central',email:'central@example.com',email_verified:true};
const action=(extra={})=>({requestId:crypto.randomUUID(),...extra});
const fixture=()=>{const result=criarConta({},reseller,action({nome:'Cliente'}),config,central);return result.root.contas[result.contaId];};
test('mesmo revendedor cria contas isoladas com IDs 1 e 2; retry não duplica',()=>{
    const a=action({nome:'A'}),one=criarConta({},reseller,a,config,central);
    one.root.contas[one.contaId].funcionarios={privado:{nome:'Privado'}};
    const two=criarConta(one.root,reseller,action({nome:'B'}),config,central);
    assert.equal(two.root.sequenciaContas,2);assert.equal(two.root.contas[two.contaId].meta.codigoApp,'2');
    assert.notEqual(one.contaId,'central');assert.notEqual(one.contaId,'reseller');
    assert.equal(two.root.contas[two.contaId].funcionarios,undefined);
    assert.equal(criarConta(two.root,reseller,a,config,central).contaId,one.contaId);
    assert.equal(two.root.sequenciaContas,2);
});
test('cliente comum, e-mail não confirmado e contador inconsistente não criam contas',()=>{
    assert.throws(()=>criarConta({},identity,action({nome:'A'}),{...config,adminUids:[]},central));
    assert.throws(()=>criarConta({},{...reseller,email_verified:false},action({nome:'A'}),config,central));
    assert.throws(()=>criarConta({sequenciaContas:0,contasPorId:{1:{contaId:'ocupado'}}},reseller,action({nome:'A'}),config,central));
});
test('administrador padrão único recebe vínculo e identidade existente sem senha',()=>{
    const c=fixture();assert.equal(c.meta.ownerUid,'central');
    assert.equal(c.acessosContas[emailKey(config.adminEmail)].permissao,'administrador');
    assert.equal(c.usuarios[Object.keys(c.usuarios)[0]].authUid,'central');
    assert.equal(JSON.stringify(c).includes('senha'),false);
});
test('revendedor não gerencia clientes de outro revendedor; papel não vem do corpo da ação',()=>{
    const c=fixture();const intruder={uid:'intruder',email_verified:true};
    assert.equal(podeAdministrar(c,intruder,config),false);
    assert.throws(()=>aplicar(c,intruder,action({tipo:'editar',nome:'Roubo',permissao:'administrador'}),config));
});
test('concessão existente exige identidade verificada e mantém uma pessoa por e-mail',()=>{
    const c=fixture(), a=action({tipo:'acesso',email:' User@Example.com ',permissao:'rh'});
    aplicar(c,reseller,a,config,{uid:'user',emailVerified:true});
    aplicar(c,reseller,action({...a,requestId:'outra',permissao:'visualizador'}),config,{uid:'user',emailVerified:true});
    assert.equal(Object.values(c.usuarios).filter(u=>u.email==='user@example.com').length,1);
    assert.equal(c.acessosContas[emailKey('user@example.com')].permissao,'visualizador');
});
test('convite só é aceito pelo e-mail verificado correto, uma vez e antes do vencimento',()=>{
    const c=fixture();aplicar(c,reseller,action({tipo:'acesso',email:'new@example.com',permissao:'rh'}),config,null,1000);
    assert.equal(aceitarConvites(c,{uid:'new',email:'new@example.com',email_verified:false},2000),false);
    assert.equal(aceitarConvites(c,{uid:'other',email:'other@example.com',email_verified:true},2000),false);
    assert.equal(aceitarConvites(c,{uid:'new',email:'new@example.com',email_verified:true},1000+8*86400000),false);
    assert.equal(aceitarConvites(c,{uid:'new',email:'new@example.com',email_verified:true},2000),true);
    assert.equal(aceitarConvites(c,{uid:'new',email:'new@example.com',email_verified:true},3000),false);
});
test('revogação bloqueia somente o vínculo da conta e cancela convites',()=>{
    const a=fixture(),b=fixture(),grant=()=>action({tipo:'acesso',email:'user@example.com',permissao:'administrador'});
    for(const c of [a,b]) aplicar(c,identity,grant(),config,{uid:'user',emailVerified:true});
    const user={uid:'user',email:'user@example.com',email_verified:true};
    assert.equal(podeAdministrar(a,user,config),true);
    aplicar(a,identity,action({tipo:'acesso',email:user.email,permissao:'administrador',revogar:true}),config);
    assert.equal(podeAdministrar(a,user,config),false);assert.equal(podeAdministrar(b,user,config),true);
    aplicar(a,identity,action({tipo:'acesso',email:'new@example.com',permissao:'rh'}),config);
    aplicar(a,identity,action({tipo:'acesso',email:'new@example.com',permissao:'rh',revogar:true}),config);
    assert.equal(aceitarConvites(a,{uid:'new',email:'new@example.com',email_verified:true}),false);
});
test('protege administrador central, rejeita papel global e gera auditoria sem credenciais',()=>{
    const c=fixture();
    assert.throws(()=>aplicar(c,reseller,action({tipo:'acesso',email:config.adminEmail,permissao:'administrador',revogar:true}),config));
    assert.throws(()=>aplicar(c,reseller,action({tipo:'acesso',email:'x@example.com',permissao:'geral'}),config));
    aplicar(c,reseller,action({tipo:'editar',nome:'Novo nome',senha:'NUNCA-REGISTRAR'}),config);
    assert.equal(JSON.stringify(c.auditoria).includes('NUNCA-REGISTRAR'),false);
});
test('somente administrador geral transfere responsabilidade comercial',()=>{
    const c=fixture(),target={uid:'reseller2',email:'r2@example.com',emailVerified:true,customClaims:{mixpontoRevendedor:true}};
    assert.throws(()=>aplicar(c,reseller,action({tipo:'revendedor'}),config,target));
    aplicar(c,identity,action({tipo:'revendedor',email:target.email}),config,target);
    assert.equal(c.meta.revendedorUid,'reseller2');
    assert.equal(podeAdministrar(c,reseller,config),false);
    assert.equal(podeAdministrar(c,{uid:'reseller2',mixpontoRevendedor:true,email_verified:true},config),true);
});
