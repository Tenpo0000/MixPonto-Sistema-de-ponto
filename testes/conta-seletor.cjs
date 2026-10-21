const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
function ambiente(){
    const doc={activeElement:null,events:{},createElement:tag=>new El(tag),addEventListener(k,fn){this.events[k]=fn;},removeEventListener(k){delete this.events[k];}};
    class El{
        constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.events={};this.hidden=false;this.value='';this.textContent='';this.nodes={};}
        set innerHTML(value){this.html=value;if(value.includes('conta-switch-trigger')) for(const s of ['.conta-switch-trigger','.conta-switch-popover','input','[role="listbox"]','.conta-switch-texto strong','.conta-switch-vazio'])this.nodes[s]=new El(s);}
        setAttribute(k,v){this.attributes[k]=v;} getAttribute(k){return this.attributes[k];}
        querySelector(s){return this.nodes[s];} querySelectorAll(){return this.children;}
        appendChild(el){this.children.push(el);return el;} append(...els){this.children.push(...els);}
        replaceChildren(){this.children=[];} before(el){this.wrapper=el;}
        addEventListener(k,fn){this.events[k]=fn;} dispatchEvent(e){this.events[e.type]?.(e);}
        focus(){doc.activeElement=this;} contains(el){return el===this || Object.values(this.nodes).includes(el) || this.children.some(c=>c.contains(el));}
    }
    const select=new El('select'), window={addEventListener(){}}, context=vm.createContext({document:doc,window,Event:class{constructor(type){this.type=type;}}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/core/conta-seletor.js'),'utf8').replace(/export /g,'')+'\nthis.update=atualizarSeletorContas;',context);
    const contas=[{id:'A',nome:'Empresa Alfa',codigoApp:'1'},{id:'B',nome:'Empresa Beta',codigoApp:'2'}];
    context.update(select,contas,contas[0]);
    return {doc,select,root:select.wrapper,contas,update:context.update};
}
test('seletor identifica empresa ativa e lista nomes e IDs sem alterar a seleção',()=>{
    const a=ambiente(),root=a.root;
    assert.equal(root.querySelector('.conta-switch-texto strong').textContent,'Empresa Alfa');
    assert.match(root.querySelector('.conta-switch-trigger').attributes['aria-label'],/ID 1/);
    assert.equal(root.querySelector('[role="listbox"]').children.length,2);
    assert.equal(root.querySelector('[role="listbox"]').children[0].attributes['aria-selected'],'true');
});
test('pesquisa por ID e teclado selecionam somente a empresa escolhida',()=>{
    const a=ambiente(),r=a.root,search=r.querySelector('input'),list=r.querySelector('[role="listbox"]');
    let changes=0;a.select.events.change=()=>changes++;
    r.querySelector('.conta-switch-trigger').onclick();search.value='2';search.oninput();
    assert.equal(list.children.length,1);
    r.events.keydown({key:'ArrowDown',preventDefault(){}});
    assert.equal(a.doc.activeElement,list.children[0]);list.children[0].onclick();
    assert.equal(a.select.value,'B');assert.equal(changes,1);
    assert.equal(a.doc.activeElement,r.querySelector('.conta-switch-trigger'));
    assert.equal(r.querySelector('.conta-switch-popover').hidden,true);
});

test('seta para cima a partir da busca foca a última empresa',()=>{
    const a=ambiente(),r=a.root;
    r.querySelector('.conta-switch-trigger').onclick();
    r.events.keydown({key:'ArrowUp',preventDefault(){}});
    assert.equal(a.doc.activeElement,r.querySelector('[role="listbox"]').children.at(-1));
});
test('empresa ativa não dispara troca e Escape fecha devolvendo o foco',()=>{
    const a=ambiente(),r=a.root,trigger=r.querySelector('.conta-switch-trigger');let changes=0;
    a.select.events.change=()=>changes++;trigger.onclick();r.querySelector('[role="listbox"]').children[0].onclick();assert.equal(changes,0);
    trigger.onclick();r.events.keydown({key:'Escape'});assert.equal(a.doc.activeElement,trigger);
    assert.equal(trigger.attributes['aria-expanded'],'false');
});
test('atualização reutiliza o controle e nomes recebidos ficam como texto',()=>{
    const a=ambiente(),name='<img src=x onerror=alert(1)>',c={id:'C',nome:name,codigoApp:'3'};
    a.update(a.select,[c],c);assert.equal(a.select.wrapper,a.root);
    assert.equal(a.root.querySelector('.conta-switch-texto strong').textContent,name);
    assert.equal(a.root.querySelector('[role="listbox"]').children[0].children[0].children[0].textContent,name);
    a.doc.events.pointerdown({target:{}});assert.equal(a.root.querySelector('.conta-switch-popover').hidden,true);
});
