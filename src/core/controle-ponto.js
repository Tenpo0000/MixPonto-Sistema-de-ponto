/* A data de admissão do cadastro é o único início operacional do ponto. */
import { dateKey } from './utils.js';
export function dataValida(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '')) return false;
    const d=new Date(valor+'T12:00:00');
    return Number.isFinite(+d) && dateKey(d)===valor;
}
export function inicioControle(f) {
    return dataValida(f?.admissao)?f.admissao:'';
}
export function erroDataPonto(f,data) {
    if(!f)return 'Selecione um funcionário disponível.';
    if(!dataValida(data))return 'Informe uma data válida.';
    const inicio=inicioControle(f);
    if(!inicio)return 'Informe uma data de admissão válida no cadastro do funcionário.';
    if(data<inicio)return `Não é permitido lançar ponto ou justificativa antes da admissão em ${inicio.split('-').reverse().join('/')}.`;
    return '';
}
