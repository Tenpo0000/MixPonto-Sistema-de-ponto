const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../src');
function modulo(c,arquivo,nomes){const src=fs.readFileSync(path.join(root,arquivo),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');return vm.runInContext(`(()=>{${src}\nreturn {${nomes.join(',')}};})()`,c);}
function base(){
 const writes=[],c=vm.createContext({console,Date,Set,Map,Object,Math,String,Number,
  pad:n=>String(n).padStart(2,'0'),dateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
  parseKey:s=>new Date(s+'T12:00:00'),lista:o=>Object.entries(o||{}).map(([id,v])=>({id,...v})),porNome:(a,b)=>a.nome.localeCompare(b.nome),novoId:()=>'-evento',
  db:{update:async m=>{writes.push(m);for(const [p,v]of Object.entries(m)){const ks=p.split('/');let o=c.state;for(const k of ks.slice(0,-1))o=o[k]||=( {} );if(v===null)delete o[ks.at(-1)];else o[ks.at(-1)]=v;}}}
 });
 Object.assign(c,modulo(c,'core/jornada.js',['totalJornada','inicioJornada','fimJornada']));
 Object.assign(c,modulo(c,'core/controle-ponto.js',['inicioControle']));
 Object.assign(c,modulo(c,'core/state.js',['state','cargaPrevista','analisarDia','horarioDoDia','cfg','funcionariosAtivos']));
 Object.assign(c,modulo(c,'core/calculos.js',['resumoPeriodo']));
 Object.assign(c,modulo(c,'core/desligamentos.js',['listaDesligamentos','validarDesligamento','desligar','reativar']));
 return {c,writes};
}
test('jornada aceita manhã, tarde e dois períodos completos',()=>{
 const {c}=base();assert.equal(c.totalJornada(['08:00','12:00','','']),240);
 assert.equal(c.totalJornada(['','','13:00','17:00']),240);
 assert.equal(c.inicioJornada(['','','13:00','17:00']),'13:00');
 assert.equal(c.fimJornada(['08:00','12:00','','']),'12:00');
 assert.equal(c.totalJornada(['08:00','12:00','13:00','17:00']),480);
 const semana=[480,480,480,480,c.totalJornada(['08:00','12:00','','']),0,0];assert.equal(semana.reduce((a,b)=>a+b),2160);
});
test('jornada rejeita pares incompletos, horário invertido, inválido e sobreposição',()=>{
 const {c}=base();for(const h of [['08:00','','',''],['08:00','12:00','13:00',''],['12:00','08:00','',''],['08:00','12:00','11:00','17:00'],['25:00','26:00','',''],['','','','']])assert.equal(c.totalJornada(h),null);
});
test('cartão ponto e relatório usam a mesma carga de um dia parcial',()=>{
 const {c}=base();const f={id:'f',nome:'Maria',horarioId:'h',status:'ativo',admissao:'2020-01-01',dataInicioPonto:'2020-01-01'};
 c.state.funcionarios.f=f;c.state.horarios.h={modo:'semanal',dias:Array.from({length:7},(_,i)=>({ativo:i===4,horarios:['08:00','12:00','','']}))};
 assert.equal(c.cargaPrevista(f,new Date('2025-01-03T12:00:00')),240);
 assert.equal(c.analisarDia(f,'2025-01-03').previsto,240);
 assert.equal(c.resumoPeriodo(f,'2025-01-03','2025-01-03').carga,240);
});
test('demissão grava histórico e situação juntos, preserva batidas e permite reativação',async()=>{
 const {c,writes}=base();c.state.funcionarios.f={nome:'Maria',cpf:'123',status:'ativo',admissao:'2020-01-01',cartaoUid:'626BD163'};
 c.state.registros={'2025-01-03':{f:{r:{timestamp:'2025-01-03T11:00:00Z'}}}};
 const registros=JSON.stringify(c.state.registros);await c.desligar('f','2025-01-03','Fim do contrato');
 assert.equal(writes.length,1);assert.equal(c.state.funcionarios.f.status,'desligado');assert.equal(c.state.funcionarios.f.cartaoUid,'626BD163');
 assert.equal(JSON.stringify(c.state.registros),registros);assert.equal(c.listaDesligamentos().length,1);assert.equal(c.listaDesligamentos()[0].uid,'f');
 await assert.rejects(c.desligar('f','2025-01-03','Repetido'),/já está desligado/);assert.equal(writes.length,1);
 await c.reativar(c.listaDesligamentos()[0]);assert.equal(c.state.funcionarios.f.status,'ativo');assert.equal(c.state.desligamentos['-evento'].status,'reativado');
});
test('botão Demitir abre modal pré-selecionado e leva à lista após confirmação',async()=>{
 const {c}=base();c.state.funcionarios.f={nome:'Maria',status:'ativo',admissao:'2020-01-01',dataInicioPonto:'2020-01-01'};
 let modal,click,submit,closed=false;const form={dataset:{},values:{uid:'f',demissao:'2025-01-03',motivo:'Fim do contrato'},addEventListener:(e,fn)=>{if(e==='submit')submit=fn;}};
 Object.assign(c,{location:{hash:'#cadastro'},esc:s=>String(s||''),fmtData:c.dateKey,carregado:()=>true,toast(){},campo:()=>'',
  opcoes:(lista,id)=>lista.map(f=>`<option value="${f.id}" ${f.id===id?'selected':''}>${f.nome}</option>`).join(''),
  abrirModal:o=>{modal=o;o.aoAbrir({});},fecharModal:()=>{closed=true;},erroForm(){},
  executar:async(f,acao)=>{await acao();return true;},
  FormData:class{constructor(f){return Object.entries(f.values)[Symbol.iterator]();}},
  $:s=>s==='form'?form:s==='.modal-rodape'?{insertAdjacentHTML(){}}:{addEventListener:(e,fn)=>{if(e==='click')click=fn;}},
  $$:s=>s==='[data-func-demitir]'?[{dataset:{funcDemitir:'f'},addEventListener:(e,fn)=>{click=fn;}}]:[],
  cabecalho:()=>'',semDados:()=>'',aguarde:()=>'',novoFuncionario(){},editarFuncionario(){}
 });
 Object.assign(c,modulo(c,'pages/demitidos.js',['registrarDemissao']));
 const cadastro=modulo(c,'pages/cadastro.js',['view','bind']);assert.match(cadastro.view(),/>Demitir</);assert(!cadastro.view().includes('data-func-excluir'));
 cadastro.bind();click();assert.match(modal.corpo,/value="f" selected/);submit({preventDefault(){}});await new Promise(setImmediate);
 assert(closed);assert.equal(c.location.hash,'demitidos');assert.equal(c.state.funcionarios.f.status,'desligado');assert.equal(c.listaDesligamentos().length,1);
});
