import { state, batidas } from './state.js';
import { erroDataPonto } from './controle-ponto.js';
import { db } from './db.js';

export function obterManual(uid,dia,id) {
    const erro=erroDataPonto(state.funcionarios[uid],dia);
    if(erro)throw Error(erro);
    const registro=state.registros?.[dia]?.[uid]?.[id];
    if(!registro)throw Error('Esta batida não está mais disponível.');
    if(registro.manual!==true)throw Error('Somente inclusões manuais podem ser editadas ou excluídas por esta ação.');
    return registro;
}
export function prepararEdicaoManual(uid,dia,id,data,hora,motivo) {
    const registro=obterManual(uid,dia,id),erro=erroDataPonto(state.funcionarios[uid],data);
    if(erro)throw Error(erro);
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora||''))throw Error('Informe um horário válido.');
    const texto=String(motivo||'').trim();
    if(!texto)throw Error('Informe o motivo da inclusão manual.');
    if(texto.length>1000)throw Error('Use até 1000 caracteres no motivo.');
    const instante=new Date(`${data}T${hora}:00`);
    if(!Number.isFinite(+instante))throw Error('Informe data e horário válidos.');
    const existentes=batidas(uid,data).filter(b=>!(data===dia&&b.id===id));
    if(existentes.some(b=>Math.abs(new Date(b.timestamp)-instante)<5*60000))
        throw Error('Precisa haver pelo menos 5 minutos entre uma batida e outra.');
    if(data!==dia&&state.registros?.[data]?.[uid]?.[id])throw Error('Já existe uma batida com esta chave na data escolhida.');
    return {...registro,timestamp:instante.toISOString(),motivo:texto,manual:true,editadoEm:new Date().toISOString()};
}
export async function editarBatidaManual(uid,dia,id,data,hora,motivo) {
    const valor=prepararEdicaoManual(uid,dia,id,data,hora,motivo);
    const lote={};
    if(data!==dia)lote[`registros/${dia}/${uid}/${id}`]=null;
    lote[`registros/${data}/${uid}/${id}`]=valor;
    await db.update(lote);
}
export async function excluirBatidaManual(uid,dia,id) {
    obterManual(uid,dia,id);
    await db.update({[`registros/${dia}/${uid}/${id}`]:null});
}
