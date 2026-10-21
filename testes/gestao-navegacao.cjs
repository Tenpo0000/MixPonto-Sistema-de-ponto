const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function ambiente() {
    const elements=new Map(),pending=[],calls={requests:0,reload:0};
    function element() {
        const nodes=new Map();
        return {innerHTML:'',hidden:false,attributes:{},
            setAttribute(k,v){this.attributes[k]=v;},
            querySelector(selector){
                if(['[data-criar]','[data-revendedor]','[data-editar]','[data-responsavel]','[data-acesso]'].includes(selector))return null;
                if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);
            },querySelectorAll(){return [];},append(){},replaceChildren(){}
        };
    }
    const context=vm.createContext({
        window:{fb:{auth:{currentUser:{uid:'u',emailVerified:true,getIdToken:async()=> 'token'}},contasApiUrl:'/api/contas'},dispatchEvent(){}},
        document:{getElementById:id=>elements.get(id),createElement:element,body:{appendChild(el){elements.set(el.id,el);}}},
        location:{href:'http://127.0.0.1:8787/src/index.html',reload(){calls.reload++;}},
        URL,AbortSignal,crypto,conterFoco:()=>()=>{},Event:class{},
        fetch:async()=>{calls.requests++;return new Promise(resolve=>pending.push(value=>resolve({ok:true,json:async()=>value})));}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/core/gestao.js'),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nthis.abrir=abrirGestao;',context);
    return {context,calls,pending,panel:()=>elements.get('gestao-painel'),finish:()=>pending.shift()({contas:[],geral:false,revendedor:false})};
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
test('gestão abre sem conta selecionada e mantém cabeçalho e Voltar durante a consulta',async()=>{
    const a=ambiente(),opening=a.context.abrir();await tick();
    assert.match(a.panel().innerHTML,/<h1>Gestão de contas<\/h1>/);
    assert.match(a.panel().innerHTML,/data-fechar/);
    assert.doesNotMatch(a.panel().innerHTML,/Carregando gestão/);
    assert.equal(a.panel().hidden,false);
    a.finish();await opening;
    assert.equal(a.panel().attributes['aria-busy'],'false');
});
test('cliques repetidos não reiniciam a consulta nem substituem o painel',async()=>{
    const a=ambiente(),first=a.context.abrir(),second=a.context.abrir();await tick();
    assert.equal(a.calls.requests,1);
    a.finish();await Promise.all([first,second]);
    await a.context.abrir();assert.equal(a.calls.requests,1);
});
test('Voltar funciona durante consulta e não recarrega nem reabre a tela após resposta atrasada',async()=>{
    const a=ambiente(),opening=a.context.abrir();await tick();
    a.panel().querySelector('[data-fechar]').onclick();
    assert.equal(a.panel().hidden,true);assert.equal(a.calls.reload,0);
    a.finish();await opening;
    assert.equal(a.panel().hidden,true);assert.equal(a.calls.reload,0);
});
test('reabrir revalida as permissões e resposta antiga não sobrescreve a tela nova',async()=>{
    const a=ambiente(),old=a.context.abrir();await tick();
    a.panel().querySelector('[data-fechar]').onclick();
    const current=a.context.abrir();await tick();
    assert.equal(a.calls.requests,2);
    a.finish();await old;
    assert.equal(a.panel().attributes['aria-busy'],'true');
    a.finish();await current;
    assert.equal(a.panel().hidden,false);assert.equal(a.panel().attributes['aria-busy'],'false');
});
