/* Geração de dados de demonstração */
import { dateKey, fmtMin, lista } from './utils.js';
import { db } from './db.js';
import { state } from './state.js';
import { toast } from './ui.js';

export function gerarDemo() {
    if (lista(state.funcionarios).length && !confirm('Isso substitui os dados atuais pelos dados de demonstração. Continuar?')) return;
    const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const base = [
        ['Ricardo Gomes', 'Analista de Suporte', 'Suporte', '08:00'], ['Mariana Costa', 'Atendente', 'Atendimento', '08:00'],
        ['Arthur Lima', 'Técnico de Campo', 'Operações', '07:30'], ['Carla Dias', 'Analista Financeiro', 'Financeiro', '08:00'],
        ['Fernanda Alves', 'Assistente de RH', 'Recursos Humanos', '09:00'], ['Paulo Henrique', 'Técnico de Redes', 'Operações', '08:00'],
        ['Juliana Ramos', 'Vendedora', 'Comercial', '08:30'], ['Bruno Teixeira', 'Atendente', 'Atendimento', '08:00']
    ];
    const ano = new Date().getFullYear();
    const feriadosDemo = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'],
        ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']];
    const feriados = {};
    feriadosDemo.forEach(([md, descricao], i) => { feriados['h' + i] = { data: `${ano}-${md}`, descricao }; });
    const diasUteis = '12345';
    const ehUtil = (d, k) => diasUteis.includes(String(d.getDay())) && !Object.values(feriados).some(f => f.data === k);

    const funcionarios = {}, registros = {}, ajustes = {};
    const agora = new Date(), minAgora = agora.getHours() * 60 + agora.getMinutes();
    const admissao = `${ano - 1}-03-01`;

    base.forEach(([nome, cargo, departamento, entrada], i) => {
        const id = 'f' + (i + 1);
        const [h, m] = entrada.split(':').map(Number), e0 = h * 60 + m;
        funcionarios[id] = { nome, cpf: `${100 + i * 37}.${200 + i * 11}.${300 + i * 7}-${10 + i}`, matricula: String(1001 + i),
            cargo, departamento, entrada, saida: fmtMin(e0 + 9 * 60), admissao, status: 'ativo' };

        for (let off = -30; off <= 0; off++) {
            const d = new Date(); d.setDate(d.getDate() + off);
            const k = dateKey(d);
            if (!ehUtil(d, k)) continue;
            const ehHoje = off === 0;
            if (!ehHoje && Math.random() < 0.06) {
                if (Math.random() < 0.5) { (ajustes[k] ||= {})[id] = { tipo: 'Atestado', obs: 'Atestado médico apresentado ao RH' }; }
                continue;
            }
            if (ehHoje && Math.random() < 0.12) continue;
            const e1 = e0 + (Math.random() < 0.15 ? rnd(15, 40) : rnd(-8, 8));
            const s1 = e0 + 240 + rnd(-5, 10), e2 = s1 + 60 + rnd(0, 12);
            const s2 = e2 + (480 - (s1 - e1)) + rnd(-6, 12);
            const mins = [e1, s1, e2, s2].filter(x => !ehHoje || x <= minAgora);
            mins.forEach((mn, j) => {
                const dt = new Date(d); dt.setHours(0, mn, 0, 0);
                const reg = { nome, timestamp: dt.toISOString() };
                if (j === 1 && Math.random() < 0.08) { reg.manual = true; reg.motivo = 'Esqueceu de bater o ponto'; }
                ((registros[k] ||= {})[id] ||= {})['b' + j] = reg;
            });
        }
    });

    db.set('funcionarios', funcionarios);
    db.set('registros', registros);
    db.set('ajustes', ajustes);
    db.set('feriados', feriados);
    db.set('config', { jornada: 8, tolerancia: 10, diasTrabalho: diasUteis });
    toast('Dados de demonstração gerados.');
}
