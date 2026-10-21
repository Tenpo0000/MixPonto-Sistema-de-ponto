import { inicioControle } from './controle-ponto.js';
import { totalJornada, inicioJornada } from './jornada.js';

import { pad, dateKey, parseKey, lista, porNome } from './utils.js';

// Projeção em memória da conta aberta, preenchida pelas assinaturas em app.js.
// carregados distingue uma coleção vazia de uma leitura ainda não concluída.
export const state = {
    funcionarios: {},
    registros: {},
    batidasMobile: {},
    mobileAcessos: {},
    ajustes: {},
    feriados: {},
    config: {},
    meta: {},
    empresa: {},
    empresas: {},
    cargos: {},
    departamentos: {},
    horarios: {},
    justificativas: {},
    desligamentos: {},
    usuarios: {},
    preferencias: {},
    carregados: {}
};
export const cfg = () => ({ jornada: 8, tolerancia: 10, diasTrabalho: '12345', ...state.config });
export const funcionariosAtivos = () =>
    lista(state.funcionarios)
        .filter((f) => f.status !== 'desligado')
        .sort(porNome);

export function batidas(uid, key) {
    const o = state.registros?.[key]?.[uid];
    return !o
        ? []
        : Object.entries(o)
              .map(([id, r]) => ({ id, ...r }))
              .filter((r) => r.timestamp)
              .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
}

// Soma pares completos de entrada/saída; uma batida sem par não cria horas.
export function totalMin(bs) {
    let t = 0;
    for (let i = 0; i + 1 < bs.length; i += 2)
        t += (new Date(bs[i + 1].timestamp) - new Date(bs[i].timestamp)) / 60000;
    return Math.max(0, Math.round(t));
}
export const feriadoDe = (key, f) =>
    lista(state.feriados)
        .filter((x) => x.data === key && (!x.empresaId || x.empresaId === f?.empresaId))
        .sort((a, b) => Number(!!b.empresaId) - Number(!!a.empresaId))[0];

function perfil(f) {
    return f?.horarioId ? state.horarios?.[f.horarioId] : null;
}

export function horarioDoDia(f, date) {
    const h = perfil(f);
    if (!h || h.modo !== 'semanal') return null;
    const indice = (date.getDay() + 6) % 7;
    return h.dias?.[indice] || null;
}

export function desligadoNaData(f, key) {
    if (!f?.id) return false;
    if (f.status === 'desligado' && f.demissao && key > f.demissao) return true;
    return Object.values(state.desligamentos || {}).some(
        (e) =>
            e.uid === f.id &&
            e.demissao &&
            key > e.demissao &&
            (e.status !== 'reativado' || !e.reativadoEm || key < e.reativadoEm)
    );
}

export function diaUtil(date, f) {
    if (f && (!inicioControle(f) || dateKey(date) < inicioControle(f))) return false;
    if (desligadoNaData(f, dateKey(date))) return false;
    const h = perfil(f),
        dia = horarioDoDia(f, date);
    const trabalha = dia
        ? dia.ativo
        : h?.modo === 'carga' && h.classificacao === 'folga'
          ? false
          : String(cfg().diasTrabalho).includes(String(date.getDay()));
    return !!trabalha && !feriadoDe(dateKey(date), f);
}

export function cargaPrevista(f, date) {
    const h = perfil(f),
        dia = horarioDoDia(f, date);
    if (!diaUtil(date, f)) return 0;
    if (dia) return totalJornada(dia.horarios) ?? 0;
    if (h?.modo === 'carga') {
        const [a, b] = String(h.carga || '00:00')
            .split(':')
            .map(Number);
        return Number.isFinite(a * 60 + b) ? a * 60 + b : 0;
    }
    return Number(cfg().jornada) * 60;
}

export function analisarDia(f, key) {
    const date = parseKey(key),
        hoje = dateKey(new Date()),
        inicio = inicioControle(f),
        anterior = !inicio || key < inicio,
        bs = anterior ? [] : batidas(f.id, key),
        ajuste = anterior ? undefined : state.ajustes?.[key]?.[f.id],
        feriado = feriadoDe(key, f);
    let tipo;
    if (anterior) tipo = 'antes';
    else if (bs.length) tipo = 'trabalho';
    else if (desligadoNaData(f, key)) tipo = 'apos';
    else if (feriado) tipo = 'feriado';
    else if (!diaUtil(date, f)) tipo = 'folga';
    else if (key > hoje) tipo = 'futuro';
    else if (key === hoje) tipo = ajuste ? 'justificado' : 'pendente';
    else tipo = ajuste ? 'justificado' : 'falta';
    const h = perfil(f),
        dia = horarioDoDia(f, date),
        entrada = inicioJornada(dia?.horarios) || f.entrada;
    let atraso = false;
    // Carga horária flexível não possui uma entrada fixa para medir atraso.
    if (bs.length && entrada && h?.modo !== 'carga') {
        const [hh, mm] = entrada.split(':').map(Number),
            t = new Date(bs[0].timestamp);
        const tolerancia = Number(h?.tolerancia ?? cfg().tolerancia);
        atraso = t.getHours() * 60 + t.getMinutes() > hh * 60 + mm + tolerancia;
    }
    const contarComoFalta = tipo === 'justificado' && !!ajuste?.contarComoFalta;
    return {
        key,
        date,
        bs,
        ajuste,
        feriado,
        tipo,
        atraso,
        total: totalMin(bs),
        contarComoFalta,
        previsto: cargaPrevista(f, date)
    };
}

export function resumoMes(f, ano, mes) {
    const r = { total: 0, trabalhados: 0, faltas: 0, justificadas: 0, atrasos: 0, previsto: 0 };
    for (let d = 1; d <= new Date(ano, mes + 1, 0).getDate(); d++) {
        const a = analisarDia(f, `${ano}-${pad(mes + 1)}-${pad(d)}`);
        r.total += a.total;
        if (a.tipo !== 'antes') r.previsto += a.previsto;
        if (a.tipo === 'trabalho') r.trabalhados++;
        if (a.tipo === 'falta' || a.contarComoFalta) r.faltas++;
        if (a.tipo === 'justificado') r.justificadas++;
        if (a.atraso) r.atrasos++;
    }
    return r;
}

export function sequencia(f) {
    let n = 0;
    const d = new Date();
    for (let i = 0; i < 90; i++) {
        const t = analisarDia(f, dateKey(d)).tipo;
        if (t === 'trabalho') n++;
        else if (['falta', 'justificado', 'antes', 'apos'].includes(t)) break;
        d.setDate(d.getDate() - 1);
    }
    return n;
}

export function pendencias() {
    let n = 0;
    const d = new Date(),
        ativos = funcionariosAtivos();
    for (let i = 0; i < 31; i++) {
        const k = dateKey(d);
        ativos.forEach((f) => {
            if (analisarDia(f, k).tipo === 'falta') n++;
        });
        d.setDate(d.getDate() - 1);
    }
    return n;
}
