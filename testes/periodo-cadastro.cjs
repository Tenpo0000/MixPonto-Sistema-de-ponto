const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../src');
function modulo(c,file,names){const s=fs.readFileSync(path.join(root,file),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');return vm.runInContext(`(()=>{${s}\nreturn {${names.join(',')}};})()`,c);}
function contexto(){
 const writes=[],errors=[],nodes=new Map(),c=vm.createContext({Date,console,Object,Array,Set,Math,Number,String,document:{getElementById:()=>({})},
  dateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
  parseKey:k=>new Date(k+'T12:00:00'),pad:n=>String(n).padStart(2,'0'),lista:o=>Object.entries(o||{}).map(([id,v])=>({id,...v})),porNome:(a,b)=>a.nome.localeCompare(b.nome),
  esc:s=>String(s??''),fmtData:d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`,
  fmtHora:ts=>new Date(ts).toTimeString().slice(0,5),fmtMin:n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`,
  MESES:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],DIAS:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
  location:{hash:'#movimentacoes'},carregado:()=>true,toast:m=>errors.push(m),erroForm:(f,m)=>errors.push(m),bindIr(){},vazio:()=>'',vazioInicialBotoes:'',novoId:()=>'-novo',
  itens:n=>Object.entries(c.state[n]||{}).map(([id,v])=>({id,...v})),fecharModal(){},
  FormData:class{constructor(form){return Object.entries(form.values||{})[Symbol.iterator]();}},
  $:s=>{if(!nodes.has(s))nodes.set(s,{dataset:{},events:{},value:'',min:'',disabled:false,focus(){},addEventListener(e,fn){this.events[e]=fn;},insertAdjacentHTML(){}});return nodes.get(s);},
  $$:()=>[],
  executar:async(form,acao)=>{await acao();return true;},
  gravar:async(p,v)=>writes.push([p,v]),db:{update:async m=>writes.push(m)}
 });
 Object.assign(c,modulo(c,'core/jornada.js',['totalJornada','inicioJornada','fimJornada']));
 Object.assign(c,modulo(c,'core/controle-ponto.js',['inicioControle','dataValida','erroDataPonto']));
 Object.assign(c,modulo(c,'core/state.js',['state','cfg','funcionariosAtivos','batidas','diaUtil','analisarDia','resumoMes','sequencia','cargaPrevista','horarioDoDia','pendencias']));
 Object.assign(c,modulo(c,'core/calculos.js',['resumoPeriodo','datasPeriodo','formatoTempo']));
 c.state.carregados={funcionarios:true,registros:true};
 c.state.funcionarios.f={nome:'Maria',status:'ativo',admissao:'2026-10-16',dataCadastro:'2026-10-16',dataInicioPonto:'2026-10-16'};
 return {c,writes,errors,nodes};
}
test('dias anteriores ao cadastro não geram faltas, horas previstas ou saldo negativo',()=>{
 const {c}=contexto(),f={id:'f',...c.state.funcionarios.f};
 c.state.registros['2026-10-15']={f:{r:{timestamp:'2026-10-15T11:00:00Z'}}};
 c.state.ajustes['2026-10-15']={f:{tipo:'Antigo'}};
 const a=c.analisarDia(f,'2026-10-15');assert.equal(a.tipo,'antes');assert.equal(a.total,0);assert.equal(a.bs.length,0);assert.equal(a.ajuste,undefined);
 const r=c.resumoPeriodo(f,'2026-10-01','2026-10-15');assert.equal(r.faltas,0);assert.equal(r.carga,0);assert.equal(r.saldo,0);
 assert.match(c.erroDataPonto(f,'2026-10-15'),/admissão em 16\/10\/2026/);assert.equal(c.erroDataPonto(f,'2026-10-16'),'');
});
test('somente admissão define o início, mesmo com metadados mais recentes',()=>{
 const {c}=contexto();
 assert.equal(c.inicioControle({admissao:'2001-01-20',dataCadastro:'2026-10-16',dataInicioPonto:'2026-10-16',cadastradoEm:'2026-10-16T12:00:00Z'}),'2001-01-20');
 assert.equal(c.inicioControle({dataCadastro:'2026-10-16'}),'');
 assert.equal(c.inicioControle({admissao:'2026-02-30'}),'');
});
test('aplicação não prepara nem regrava datas operacionais automaticamente',()=>{
 const src=fs.readFileSync(path.join(root,'app.js'),'utf8');assert(!src.includes('prepararControlePonto'));
 const {c}=contexto();const antes=JSON.stringify(c.state.funcionarios);c.inicioControle(c.state.funcionarios.f);assert.equal(JSON.stringify(c.state.funcionarios),antes);
});
test('intervalo inclui as duas datas, cruza meses e PDF usa as mesmas linhas',()=>{
 const {c,nodes}=contexto();let pdf;
 c.imprimirTabela=(...args)=>{pdf=args;};const api=modulo(c,'pages/movimentacoes.js',['mov','view','bind']);
 api.mov.uid='f';api.mov.inicio='2026-10-15';api.mov.fim='2026-10-20';let html=api.view();
 assert.equal((html.match(/data-key=/g)||[]).length,6);assert.match(html,/data-key="2026-10-15"/);assert.match(html,/data-key="2026-10-20"/);
 const bloqueada=html.match(/<tr[^>]*data-key="2026-10-15"[\s\S]*?<\/tr>/)[0];assert.match(bloqueada,/ANTERIOR AO CADASTRO/);assert(!bloqueada.includes('data-ajustar'));
 api.mov.inicio='2026-10-30';api.mov.fim='2026-11-02';html=api.view();assert.equal((html.match(/data-key=/g)||[]).length,4);
 api.bind({render(){}});nodes.get('#btn-pdf').events.click();assert.equal(pdf[2].length,4);assert.match(pdf[3],/30\/10\/2026 até 02\/11\/2026/);
 assert.throws(()=>c.datasPeriodo('2026-10-20','2026-10-15'),/período válido/);
 assert.throws(()=>c.datasPeriodo('2025-01-01','2026-12-31'),/366/);
});
test('ajuste só oferece justificativas cadastradas e rejeita valor legado injetado',async()=>{
 const {c,nodes,writes,errors}=contexto();let modal;
 c.state.justificativas.med={abreviacao:'MED',nome:'ATESTADO MEDICO',contarComoFalta:false};
 c.abrirModal=o=>{modal=o;o.aoAbrir({});};const api=modulo(c,'pages/movimentacoes.js',['mov','ajuste']);api.mov.uid='f';
 api.ajuste('2026-10-16');assert.match(modal.corpo,/MED — ATESTADO MEDICO/);assert(!modal.corpo.includes('padrão anterior'));assert(!modal.corpo.includes('legado:'));
 nodes.get('form').values={justificativa:'legado:0',obs:'teste'};await nodes.get('[data-gravar]').events.click();assert.equal(writes.length,0);assert.match(errors.at(-1),/cadastrada/);
 nodes.get('form').values={justificativa:'med',obs:'Recebido'};await nodes.get('[data-gravar]').events.click();assert.equal(writes[0][0],'ajustes/2026-10-16/f');assert.equal(writes[0][1].justificativaId,'med');
 modal=null;api.ajuste('2026-10-15');assert.equal(modal,null);
});
test('inclusão manual bloqueia data anterior mesmo alterando o formulário',async()=>{
 const {c,nodes,writes,errors}=contexto();let modal;c.abrirModal=o=>{modal=o;o.aoAbrir({});};
 const api=modulo(c,'pages/movimentacoes.js',['mov','inclusao']);api.mov.uid='f';api.mov.inicio='2026-10-15';api.mov.fim='2026-10-20';api.inclusao();
 assert.match(modal.corpo,/min="2026-10-16"/);
 nodes.get('form').values={uid:'f',data:'2026-10-15',t0:'08:00',motivo:'Teste'};
 await nodes.get('[data-gravar]').events.click();assert.equal(writes.length,0);assert.match(errors.at(-1),/antes da admissão/);
 nodes.get('form').values.data='2026-10-16';await nodes.get('[data-gravar]').events.click();assert.equal(writes.length,1);assert.match(Object.keys(writes[0])[0],/^registros\/2026-10-16\/f\//);
});
test('novo funcionário recebe data de cadastro e edição não altera essa data',async()=>{
 const {c,nodes}=contexto();let salvo;
 c.state.empresa={nome:'Empresa'};c.state.cargos={c:{nome:'Cargo'}};c.state.departamentos={d:{nome:'Setor'}};c.state.horarios={h:{dias:[{ativo:true,horarios:['08:00','12:00','','']}]}};
 Object.assign(c,modulo(c,'core/empresas.js',['empresasDisponiveis','empresaPorId']));
 Object.assign(c,modulo(c,'core/rfid.js',['normalizarCartao','validarCartao']));
 c.salvarFuncionarioComCartao=async(id,valor)=>{salvo=valor;c.state.funcionarios[id]=valor;};
 const api=modulo(c,'pages/funcionario.js',['novoFuncionario','editarFuncionario','bind']);api.novoFuncionario();api.bind({render(){}});
 nodes.get('#func-form').values={nome:'Ana',cpf:'11122233344',matricula:'10',admissao:'2020-01-01',empresaId:'padrao',cargoId:'c',departamentoId:'d',horarioId:'h',status:'ativo',cartaoUid:''};
 await nodes.get('#func-form').events.submit({preventDefault(){}});
 assert.equal(salvo.dataCadastro,c.dateKey(new Date()));assert.equal(salvo.dataInicioPonto,undefined);assert.equal(c.inicioControle(salvo),'2020-01-01');assert(Number.isFinite(+new Date(salvo.cadastradoEm)));
 const inicio=c.inicioControle(salvo),criacao=salvo.cadastradoEm;api.editarFuncionario('-novo');api.bind({render(){}});
 nodes.get('#func-form').values.nome='Ana editada';await nodes.get('#func-form').events.submit({preventDefault(){}});
 assert.equal(c.inicioControle(salvo),inicio);assert.equal(salvo.cadastradoEm,criacao);
});
test('sem justificativas cadastradas o ajuste não oferece opções artificiais',()=>{
 const {c,nodes}=contexto();let modal;c.abrirModal=o=>{modal=o;o.aoAbrir({});};
 const api=modulo(c,'pages/movimentacoes.js',['mov','ajuste']);api.mov.uid='f';api.ajuste('2026-10-16');
 assert.match(modal.corpo,/Nenhuma justificativa cadastrada/);assert.equal((modal.corpo.match(/<option/g)||[]).length,1);assert.equal(nodes.get('[data-gravar]').disabled,true);
});
test('formulário do filtro aplica início e fim juntos e mantém o período se forem inválidos',()=>{
 const {c,nodes}=contexto();const api=modulo(c,'pages/movimentacoes.js',['mov','view','bind']);api.mov.uid='f';api.mov.inicio='2026-10-16';api.mov.fim='2026-10-31';api.view();api.bind({render(){}});
 nodes.get('#sel-inicio').events.input({target:{value:'2026-10-15'}});nodes.get('#sel-fim').events.input({target:{value:'2026-10-20'}});
 nodes.get('#mov-periodo').events.submit({preventDefault(){}});assert.equal(api.mov.inicio,'2026-10-15');assert.equal(api.mov.fim,'2026-10-20');
 nodes.get('#sel-fim').events.input({target:{value:'2026-10-10'}});nodes.get('#mov-periodo').events.submit({preventDefault(){}});
 assert.equal(api.mov.fim,'2026-10-20');
});
test('admissão em 2001 abre o histórico até hoje, com totais/PDF completos e tabela paginada',()=>{
 const {c,nodes}=contexto();c.state.funcionarios.f.admissao='2001-01-20';let pdf;c.imprimirTabela=(...args)=>{pdf=args;};
 const api=modulo(c,'pages/movimentacoes.js',['mov','view','bind']);api.mov.uid='f';let html=api.view();
 assert.equal(api.mov.inicio,'2001-01-20');assert.equal(api.mov.fim,c.dateKey(new Date()));
 const datas=c.datasPeriodo(api.mov.inicio,api.mov.fim,Infinity);assert(datas.length>366);assert.equal((html.match(/data-key=/g)||[]).length,100);
 api.bind({render(){}});nodes.get('#mov-proximo').events.click();html=api.view();assert.match(html,new RegExp('data-key="'+datas[100]+'"'));
 nodes.get('#btn-pdf').events.click();assert.equal(pdf[2].length,datas.length);assert.equal(pdf[2][0][0],'20/01/2001');
});
test('limite anterior à admissão é bloqueado, mas data anterior ao cadastro do site é permitida',()=>{
 const {c}=contexto(),f={nome:'Maria',admissao:'2001-01-20',dataCadastro:'2026-10-16',dataInicioPonto:'2026-10-16'};
 assert.match(c.erroDataPonto(f,'2001-01-19'),/admissão/);assert.equal(c.erroDataPonto(f,'2001-01-20'),'');assert.equal(c.erroDataPonto(f,'2010-05-01'),'');
});
