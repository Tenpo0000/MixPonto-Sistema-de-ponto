import { inicioControle } from './controle-ponto.js';
import { inicioJornada } from './jornada.js';
/* Cálculos de tempo para relatórios. Não calcula remuneração nem adicionais em dinheiro. */
import { dateKey, parseKey, pad } from './utils.js';
import { state, analisarDia, cargaPrevista, horarioDoDia, cfg } from './state.js';
export function datasPeriodo(inicio,fim,limite=366){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(inicio||'')||!/^\d{4}-\d{2}-\d{2}$/.test(fim||''))throw Error('Informe as datas inicial e final.');
 const a=parseKey(inicio),b=parseKey(fim);if(dateKey(a)!==inicio||dateKey(b)!==fim||inicio>fim)throw Error('Informe um período válido, com início anterior ou igual ao fim.');
 const lista=[];for(const d=new Date(a);dateKey(d)<=fim;d.setDate(d.getDate()+1)){lista.push(dateKey(d));if(lista.length>limite)throw Error(`Selecione um período de até ${limite} dias.`);}return lista;
}
export const formatoTempo=n=>`${n<0?'-':''}${pad(Math.floor(Math.abs(Math.round(n))/60))}:${pad(Math.abs(Math.round(n))%60)}`;
export function minutosNoturnos(bs){
 let total=0;for(let i=0;i+1<bs.length;i+=2){const a=new Date(bs[i].timestamp),b=new Date(bs[i+1].timestamp);if(!Number.isFinite(+a)||!Number.isFinite(+b)||b<=a)continue;
 // Recorta cada par nas janelas 00h–05h e 22h–24h de cada dia local.
 const dia=new Date(a);dia.setHours(0,0,0,0);let limite=0;
 for(;dia<b&&limite<370;dia.setDate(dia.getDate()+1),limite++){for(const [inicio,fim]of[[0,5],[22,24]]){const x=new Date(dia),y=new Date(dia);x.setHours(inicio);y.setHours(fim);total+=Math.max(0,Math.min(+b,+y)-Math.max(+a,+x))/60000;}}
 }return Math.round(total);
}
export function resumoPeriodo(f,inicio,fim,limiteDias=366){
 const keys=datasPeriodo(inicio,fim,limiteDias),hoje=dateKey(new Date()),r={total:0,normais:0,extras:0,carga:0,faltas:0,justificadas:0,atrasos:0,atrasoMin:0,noturno:0,saldo:0,abonadas:0,trabalhados:0,interjornada:0,incompletos:0,diasConcluidos:0};
 let ultimaSaida=null;const limite=660;
 // Lê também a última saída anterior ao período para comparar a primeira jornada.
 const anteriores=Object.keys(state.registros||{}).filter(k=>k<inicio&&k>=inicioControle(f)&&state.registros[k]?.[f.id]).sort().reverse();
 if(anteriores[0]){const registros=Object.values(state.registros[anteriores[0]][f.id]).filter(x=>x.timestamp).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));if(registros.length&&registros.length%2===0)ultimaSaida=new Date(registros.at(-1).timestamp);}
 for(const key of keys){const a=analisarDia(f,key),posteriorDemissao=f.status==='desligado'&&f.demissao&&key>f.demissao;const antes=!inicioControle(f)||key<inicioControle(f);const previsto=antes||posteriorDemissao?0:cargaPrevista(f,a.date);
  r.total+=a.total;r.normais+=Math.min(a.total,previsto);r.extras+=Math.max(0,a.total-previsto);r.carga+=previsto;r.noturno+=minutosNoturnos(a.bs);
  if(a.bs.length){r.trabalhados++;if(a.bs.length%2)r.incompletos++;if(ultimaSaida&&a.bs.length){const intervalo=(new Date(a.bs[0].timestamp)-ultimaSaida)/60000;if(intervalo>=0&&intervalo<limite)r.interjornada++;}ultimaSaida=a.bs.length%2===0?new Date(a.bs.at(-1).timestamp):null;}
  if(!antes&&!posteriorDemissao){if(a.tipo==='falta'||a.contarComoFalta)r.faltas++;if(a.tipo==='justificado')r.justificadas++;}
  if(a.atraso){r.atrasos++;const entrada=inicioJornada(horarioDoDia(f,a.date)?.horarios)||f.entrada;const [h,m]=entrada.split(':').map(Number),t=new Date(a.bs[0].timestamp);r.atrasoMin+=Math.max(0,t.getHours()*60+t.getMinutes()-h*60-m);}
  if(key<hoje&&!antes&&!posteriorDemissao){const abono=a.tipo==='justificado'&&!a.contarComoFalta?previsto:0;r.abonadas+=abono;r.saldo+=a.total+abono-previsto;r.diasConcluidos++;}
 }
 return r;
}
export function mesPeriodo(mes){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes||''))throw Error('Selecione um mês válido.');const [ano,m]=mes.split('-').map(Number);return {inicio:mes+'-01',fim:`${mes}-${pad(new Date(ano,m,0).getDate())}`};}
