import { state } from './state.js';
import { db } from './db.js';
import { dateKey } from './utils.js';
import { dataValida, inicioLegado } from './controle-ponto.js';
import { toast } from './ui.js';
let executando=false;
const tentados=new Set();
export async function prepararControlePonto() {
    if(executando || !state.carregados?.funcionarios || !state.carregados?.registros)return;
    const ids=Object.keys(state.funcionarios).filter(id=>!dataValida(state.funcionarios[id]?.dataInicioPonto)&&!tentados.has(id));
    if(!ids.length)return;
    executando=true;
    try {
        for(const id of ids){
            tentados.add(id);
            try {
                await db.transacao(`funcionarios/${id}`,atual=>{
                    if(!atual||dataValida(atual.dataInicioPonto))return;
                    const inicio=inicioLegado(atual,id,state.registros,dateKey(new Date()));
                    return {...atual,dataInicioPonto:inicio.data,inicioPontoOrigem:inicio.origem};
                });
            } catch { toast('Não foi possível preparar o início do controle de ponto. Confira a conexão e recarregue a página.','erro'); }
        }
    } finally { executando=false; }
    prepararControlePonto();
}
