const seletores = new WeakMap();
export function atualizarSeletorContas(select, contas, ativa) {
    let controller = seletores.get(select);
    if (!controller) {
        const root = document.createElement('div');
        root.className = 'conta-switch';
        root.innerHTML = `<button type="button" class="conta-switch-trigger" aria-expanded="false" aria-haspopup="listbox" aria-controls="conta-switch-lista"><span class="conta-switch-icone" aria-hidden="true">▦</span><span class="conta-switch-texto"><small>EMPRESA ATIVA</small><strong></strong></span><span class="conta-switch-seta" aria-hidden="true">⌄</span></button><div class="conta-switch-popover" hidden><label class="conta-switch-busca"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar por nome ou ID" aria-label="Buscar empresa"></label><div id="conta-switch-lista" role="listbox" aria-label="Empresas disponíveis"></div><p class="conta-switch-vazio" hidden>Nenhuma empresa encontrada.</p><p class="conta-switch-rodape">Cada empresa abre seu próprio ambiente.</p></div>`;
        select.before(root);
        root.appendChild(select);
        const trigger=root.querySelector('.conta-switch-trigger'), popover=root.querySelector('.conta-switch-popover');
        const search=root.querySelector('input'), list=root.querySelector('[role="listbox"]');
        const model={contas:[],ativa:null};
        function fechar(focus=false) {popover.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
        function desenhar() {
            list.replaceChildren();
            const term=search.value.trim().toLocaleLowerCase('pt-BR');
            const matches=model.contas.filter(c=>`${c.nome} ${c.codigoApp}`.toLocaleLowerCase('pt-BR').includes(term));
            for(const c of matches) {
                const button=document.createElement('button');
                button.type='button';button.className='conta-switch-opcao';button.setAttribute('role','option');
                const current=c.id===model.ativa.id;
                button.setAttribute('aria-selected',String(current));
                const text=document.createElement('span'), name=document.createElement('strong'), id=document.createElement('small'), check=document.createElement('span');
                name.textContent=c.nome;id.textContent=`ID ${c.codigoApp || 'pendente'}`;check.textContent=current?'✓':'→';check.setAttribute('aria-hidden','true');
                text.append(name,id);button.append(text,check);
                button.onclick=()=>{fechar();if(current)return;select.value=c.id;select.dispatchEvent(new Event('change'));};
                list.appendChild(button);
            }
            root.querySelector('.conta-switch-vazio').hidden=matches.length>0;
        }
        function abrir() {desenhar();popover.hidden=false;trigger.setAttribute('aria-expanded','true');search.focus();}
        trigger.onclick=()=>popover.hidden?abrir():fechar();
        search.oninput=desenhar;
        root.addEventListener('keydown',e=>{
            if(e.key==='Escape'){fechar(true);return;}
            if(e.key==='ArrowDown' || e.key==='ArrowUp') {
                e.preventDefault();if(popover.hidden)abrir();
                const options=[...list.querySelectorAll('button')], index=options.indexOf(document.activeElement);
                options[(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();
            }
        });
        const outside=e=>{if(!root.contains(e.target))fechar();};
        document.addEventListener('pointerdown',outside);
        window.addEventListener('mixponto:encerrar',()=>{fechar();document.removeEventListener('pointerdown',outside);},{once:true});
        controller=(contas,ativa)=>{
            model.contas=contas;model.ativa=ativa;
            root.querySelector('.conta-switch-texto strong').textContent=ativa.nome;
            trigger.setAttribute('aria-label',`Trocar empresa. Atual: ${ativa.nome}, ID ${ativa.codigoApp || 'pendente'}`);
            desenhar();
        };
        seletores.set(select,controller);
    }
    controller(contas,ativa);
}
