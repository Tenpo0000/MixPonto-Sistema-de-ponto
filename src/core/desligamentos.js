import { state } from './state.js';
import { dateKey, parseKey, lista } from './utils.js';
import { novoId } from './cadastros.js';
import { db } from './db.js';

export function listaDesligamentos() {
    const historico = lista(state.desligamentos).map((e) => ({ ...e, legado: false }));
    const conhecidos = new Set(historico.filter((e) => e.status !== 'reativado').map((e) => e.uid));
    for (const f of lista(state.funcionarios)) {
        if (f.status === 'desligado' && !conhecidos.has(f.id))
            historico.push({
                id: 'legado-' + f.id,
                uid: f.id,
                nome: f.nome,
                cpf: f.cpf,
                cargo: f.cargo,
                admissao: f.admissao,
                demissao: f.demissao || '',
                motivo: f.motivoDemissao || '',
                status: 'desligado',
                legado: true
            });
    }
    return historico.sort(
        (a, b) =>
            (b.demissao || '').localeCompare(a.demissao || '') ||
            (a.nome || '').localeCompare(b.nome || '')
    );
}

export function validarDesligamento(uid, data) {
    const f = state.funcionarios?.[uid];
    if (!f) return 'Selecione um funcionário disponível.';
    if (f.status === 'desligado') return 'Este funcionário já está desligado.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || dateKey(parseKey(data)) !== data)
        return 'Informe uma data de demissão válida.';
    if (f.admissao && data < f.admissao) return 'A demissão não pode ser anterior à admissão.';
    if (data > dateKey(new Date())) return 'A data de demissão não pode estar no futuro.';
    return '';
}

export async function desligar(uid, data, motivo) {
    const erro = validarDesligamento(uid, data);
    if (erro) throw Error(erro);
    const f = state.funcionarios[uid],
        id = novoId('desligamentos');
    const evento = {
        uid,
        nome: f.nome || '',
        cpf: f.cpf || '',
        cargo: state.cargos?.[f.cargoId]?.nome || f.cargo || '',
        admissao: f.admissao || '',
        demissao: data,
        motivo: motivo.trim(),
        status: 'desligado'
    };
    await db.update({
        [`desligamentos/${id}`]: evento,
        [`funcionarios/${uid}/status`]: 'desligado',
        [`funcionarios/${uid}/demissao`]: data,
        [`funcionarios/${uid}/motivoDemissao`]: motivo.trim(),
        [`funcionarios/${uid}/desligamentoId`]: id
    });
}

export async function reativar(evento) {
    const f = state.funcionarios?.[evento.uid];
    if (!f) throw Error('O cadastro deste funcionário foi excluído.');
    if (f.status !== 'desligado') throw Error('Este funcionário já está ativo.');
    const id = evento.legado ? novoId('desligamentos') : evento.id;
    const valor = { ...evento, status: 'reativado', reativadoEm: dateKey(new Date()) };
    delete valor.id;
    delete valor.legado;
    await db.update({
        [`desligamentos/${id}`]: valor,
        [`funcionarios/${evento.uid}/status`]: 'ativo',
        [`funcionarios/${evento.uid}/demissao`]: null,
        [`funcionarios/${evento.uid}/motivoDemissao`]: null,
        [`funcionarios/${evento.uid}/desligamentoId`]: null
    });
}
