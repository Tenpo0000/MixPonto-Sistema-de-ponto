/* Um dia admite um ou dois pares completos, sem sobreposição. */
const minutos = valor => /^([01]\d|2[0-3]):[0-5]\d$/.test(valor) ? Number(valor.slice(0,2))*60+Number(valor.slice(3)) : NaN;
export function totalJornada(horarios) {
    const hs=Array.from({length:4},(_,i)=>String(horarios?.[i]||'').trim());
    let total=0,pares=0,fimAnterior=-1;
    for(let i=0;i<4;i+=2){
        if(!hs[i]&&!hs[i+1])continue;
        if(!hs[i]||!hs[i+1])return null;
        const inicio=minutos(hs[i]),fim=minutos(hs[i+1]);
        if(!Number.isFinite(inicio)||!Number.isFinite(fim)||fim<=inicio||inicio<fimAnterior)return null;
        total+=fim-inicio;fimAnterior=fim;pares++;
    }
    return pares?total:null;
}
export const inicioJornada=horarios=>totalJornada(horarios)===null?'':horarios.find(Boolean)||'';
export const fimJornada=horarios=>totalJornada(horarios)===null?'':horarios.filter(Boolean).slice(-1)[0]||'';
