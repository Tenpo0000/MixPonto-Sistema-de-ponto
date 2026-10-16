import { totalJornada } from '../core/jornada.js';
/* Cadastro de horários. Contrato compatível com app.js: view() e bind({render}). */
import { $, $$, esc } from '../core/utils.js';
import { state } from '../core/state.js';
import { itens, carregado, chave, novoId, gravar } from '../core/cadastros.js';
import { toast } from '../core/ui.js';

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const inicial = () => ({ nome: '', modo: 'semanal', dias: DIAS.map((nome, i) => ({ nome, ativo: i < 5, horarios: ['08:00', '12:00', '13:00', '17:00'] })), carga: '08:00', intervalo: 60, tolerancia: 10, compensacao: true, classificacao: 'util' });
let dados = inicial(), editId = null, erro = '', salvando = false, formulario = false;
const nomePerfil = (h, id) => h.nome || (id === 'padrao' ? 'Perfil Padrão' : 'Horário sem nome');
function normalizar(v) { const base = inicial(); return { ...base, ...copia(v), dias: base.dias.map((d, i) => ({...d, ...(v.dias?.[i] || {}), horarios: v.dias?.[i]?.horarios || d.horarios})) }; }
function limpar() { dados = inicial(); editId = null; erro = ''; formulario = false; }
window.addEventListener('hashchange', () => { if (location.hash === '#horario' && !salvando) limpar(); });
const copia = obj => JSON.parse(JSON.stringify(obj));
const min = h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h || '') ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : NaN;
const fmt = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
function totalDia(d) {
    if (!d.ativo) return 0;
    return totalJornada(d.horarios);
}
function resumo() {
    const ativos = dados.dias.filter(d => d.ativo), totais = ativos.map(totalDia);
    return { quantidade: ativos.length, invalido: totais.includes(null), total: totais.reduce((a, b) => a + (b || 0), 0) };
}
function abas() {
    return `<div class="hor-abas" role="tablist" aria-label="Tipo de jornada"><button type="button" role="tab" id="hor-tab-semanal" aria-controls="hor-painel" aria-selected="${dados.modo === 'semanal'}" data-modo="semanal">Horário Semanal</button><button type="button" role="tab" id="hor-tab-carga" aria-controls="hor-painel" aria-selected="${dados.modo === 'carga'}" data-modo="carga">Carga Horária</button></div>`;
}
function semanal() {
    const r = resumo();
    return `<div class="hor-grid"><section class="hor-card hor-principal"><div class="hor-cab"><h2>Configuração por Dia</h2>${abas()}</div><div id="hor-painel" role="tabpanel" aria-labelledby="hor-tab-semanal" class="hor-dias">${dados.dias.map((d, i) => `<div class="hor-dia ${d.ativo ? '' : 'hor-inativo'}"><label class="hor-dia-nome"><input type="checkbox" data-dia="${i}" ${d.ativo ? 'checked' : ''}>${d.nome}</label><div class="hor-horas">${['Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'].map((label, j) => `<label>${label}<input type="time" aria-label="${label} de ${d.nome}" data-hora="${i},${j}" value="${esc(d.horarios[j])}" ${d.ativo ? '' : 'disabled'}></label>`).join('')}</div><div class="hor-total"><small>Total</small><strong data-total="${i}">${totalDia(d) === null ? '—' : fmt(totalDia(d))}</strong></div></div>`).join('')}</div></section><aside class="hor-lateral"><section class="hor-resumo hor-escuro"><h3>Carga semanal</h3><div class="hor-numero"><strong id="hor-semana">${r.invalido ? '—' : fmt(r.total)}</strong><span>horas</span></div><dl><div><dt>Dias úteis</dt><dd id="hor-quantidade">${r.quantidade} dias</dd></div><div><dt>Média diária</dt><dd id="hor-media">${r.invalido ? '—' : fmt(r.quantidade ? Math.round(r.total / r.quantidade) : 0)} h</dd></div></dl></section><section class="hor-dica"><strong>Dica de RH</strong><p>Confira os intervalos de descanso e as regras de jornada aplicáveis à sua equipe.</p></section><section class="hor-perfil"><div><strong id="hor-perfil-nome">${esc(dados.nome || 'Novo horário')}</strong><small>Jornada da equipe</small></div><p>Configure e salve os horários deste perfil.</p></section></aside></div>`;
}
function carga() {
    return `<div class="hor-grid hor-grid-carga"><section class="hor-card hor-principal"><div class="hor-cab"><h2>Definição de Jornada</h2>${abas()}</div><div id="hor-painel" role="tabpanel" aria-labelledby="hor-tab-carga"><div class="hor-campos"><label>Horas Totais Diárias<input type="text" inputmode="numeric" placeholder="08:00" maxlength="5" id="hor-carga" value="${esc(dados.carga)}" aria-describedby="hor-erro"></label><label>Intervalo Mínimo (minutos)<input type="number" min="0" max="1440" step="1" id="hor-intervalo" value="${dados.intervalo}"></label></div><div class="hor-gerais"><h3>Configurações gerais</h3><div class="hor-campos"><label>Tolerância (Minutos)<div class="hor-input-unidade"><input type="number" min="0" max="1440" step="1" id="hor-tolerancia" value="${dados.tolerancia}"><span>min</span></div></label><label class="hor-compensacao"><span><strong>Compensação Automática</strong><small>Ativa banco de horas automático</small></span><input type="checkbox" role="switch" id="hor-compensacao" ${dados.compensacao ? 'checked' : ''}></label></div></div></div></section><aside class="hor-lateral"><section class="hor-card"><h2>Classificação do Dia</h2><div class="hor-classificacoes" role="radiogroup" aria-label="Classificação do dia">${[['util', 'Dia Útil', '✓'], ['extra', 'Dia Extra', '+'], ['folga', 'Folga', '⊘']].map(([v, t, s]) => `<label><input type="radio" name="hor-classificacao" value="${v}" ${dados.classificacao === v ? 'checked' : ''}><span class="hor-opcao">${t}<span class="hor-check" aria-hidden="true">✓</span></span></label>`).join('')}</div></section><section class="hor-resumo hor-azul"><h3>Resumo da configuração</h3><div class="hor-numero hor-numero-menor"><strong id="hor-resumo-carga">${esc(dados.carga)}</strong></div><small>Carga Horária Planejada</small><dl><div><dt>Tolerância:</dt><dd id="hor-resumo-tolerancia">± ${dados.tolerancia} min</dd></div><div><dt>Tipo de Dia:</dt><dd id="hor-resumo-tipo">${{util:'Regular',extra:'Extra',folga:'Folga'}[dados.classificacao]}</dd></div></dl></section></aside></div>`;
}
export function view() {
    const pronto = carregado('horarios', 'funcionarios');
    const lista = itens('horarios');
    if(!formulario)return `<div class="cad-page"><div class="breadcrumb"><span>Cadastro</span><span>›</span><span class="destacado">Horários</span></div><div class="cabecalho-pagina"><div><h1>Horários</h1><p>${lista.length} cadastrados</p></div><button class="btn btn-primario" id="hor-novo" ${!pronto || salvando?'disabled':''}>+ Novo horário</button></div><section class="cad-card cad-lista hor-cadastrados"><header class="cad-card-topo"><h2>Horários cadastrados</h2><span class="cad-pill">${lista.length}</span></header>${!pronto ? '<p class="cad-vazio">Carregando horários…</p>' : !lista.length ? '<p class="cad-vazio">Nenhum horário cadastrado. Clique em Novo horário para começar.</p>' : `<div class="cad-tabela-wrap"><table class="cad-tabela"><thead><tr><th>Nome</th><th>Tipo de jornada</th><th>Funcionários ativos</th><th>Ações</th></tr></thead><tbody>${lista.map(h => `<tr data-busca><td><strong>${esc(nomePerfil(h, h.id))}</strong></td><td>${h.modo === 'carga' ? 'Carga horária' : 'Horário semanal'}</td><td>${Object.values(state.funcionarios || {}).filter(f => f.horarioId === h.id && f.status !== 'desligado').length}</td><td><div class="acoes-linha"><button class="btn-ajustar" data-hor-editar="${esc(h.id)}" ${salvando ? 'disabled' : ''}>Editar</button><button class="btn btn-perigo cad-btn-peq" data-hor-excluir="${esc(h.id)}" ${salvando ? 'disabled' : ''}>Excluir</button></div></td></tr>`).join('')}</tbody></table></div>`}</section></div>`;
    return `<div class="horario-page"><div class="breadcrumb"><span>Cadastro</span><span>›</span><span class="destacado">Horário</span></div><div class="cabecalho-pagina"><div><h1>Cadastro de Horários</h1><p>Cadastre e identifique os perfis de jornada da sua equipe.</p></div><button class="btn btn-secundario" id="hor-novo" ${salvando ? 'disabled' : ''}>+ Novo Horário</button></div><fieldset class="hor-fieldset" ${!pronto || salvando ? 'disabled' : ''}><section class="hor-card hor-identificacao"><label for="hor-nome">Nome do Horário <span aria-hidden="true">*</span></label><input id="hor-nome" maxlength="80" value="${esc(dados.nome)}" placeholder="Ex.: Administrativo — 08h às 17h" required aria-describedby="hor-nome-ajuda hor-erro"><small id="hor-nome-ajuda">Este nome aparecerá na seleção de horário do funcionário.</small>${editId ? '<span class="cad-pill">Editando horário salvo</span>' : ''}</section>${dados.modo === 'semanal' ? semanal() : carga()}<p id="hor-erro" class="erro" role="alert" tabindex="-1" ${erro ? '' : 'hidden'}>${esc(erro)}</p><footer class="hor-rodape"><button type="button" class="hor-cancelar" id="hor-cancelar">Cancelar</button><button type="button" class="btn btn-primario hor-salvar" id="hor-salvar">${salvando ? 'Salvando…' : !pronto ? 'Carregando…' : editId ? 'Salvar Alterações' : 'Salvar Horário'}</button></footer></fieldset></div>`;
}
function atualizarTotais() {
    dados.dias.forEach((d, i) => { const el = $(`[data-total="${i}"]`); if (el) el.textContent = totalDia(d) === null ? '—' : fmt(totalDia(d)); });
    const r = resumo();
    if ($('#hor-semana')) $('#hor-semana').textContent = r.invalido ? '—' : fmt(r.total);
    if ($('#hor-quantidade')) $('#hor-quantidade').textContent = `${r.quantidade} dias`;
    if ($('#hor-media')) $('#hor-media').textContent = `${r.invalido ? '—' : fmt(r.quantidade ? Math.round(r.total / r.quantidade) : 0)} h`;
}
function validar() {
    const nome = dados.nome.trim();
    if (!nome) return 'Informe o nome do horário.';
    if (nome.length > 80) return 'Use até 80 caracteres no nome do horário.';
    if (itens('horarios').some(h => h.id !== editId && chave(nomePerfil(h, h.id)) === chave(nome))) return 'Já existe um horário com esse nome.';
    if (dados.modo === 'semanal') {
        if (!dados.dias.some(d => d.ativo)) return 'Selecione pelo menos um dia de trabalho.';
        const d = dados.dias.find(d => d.ativo && totalDia(d) === null);
        if (d) return `${d.nome}: preencha ao menos um par de entrada e saída, sem horários incompletos ou sobrepostos.`;
    } else {
        if (!Number.isFinite(min(dados.carga)) || min(dados.carga) <= 0) return 'Informe a carga diária no formato HH:MM, entre 00:01 e 23:59.';
        if (![dados.intervalo, dados.tolerancia].every(v => Number.isInteger(v) && v >= 0 && v <= 1440)) return 'Intervalo e tolerância devem ser minutos inteiros entre 0 e 1440.';
    }
    return '';
}
export function bind({ render }) {
    $('#hor-nome')?.addEventListener('input', e => { dados.nome = e.target.value; if ($('#hor-perfil-nome')) $('#hor-perfil-nome').textContent = dados.nome || 'Novo horário'; });
    $('#hor-novo').addEventListener('click', () => { if (salvando) return; limpar(); formulario=true; render(); $('#hor-nome').focus(); });
    $$('[data-hor-editar]').forEach(b => b.addEventListener('click', () => {
        if (salvando) return;
        const id = b.dataset.horEditar, perfil = state.horarios?.[id];
        if (!perfil) return toast('Este horário não está mais disponível.', 'erro');
        formulario=true; editId = id; dados = normalizar(perfil); dados.nome = nomePerfil(perfil, id); erro = ''; render(); $('#hor-nome').focus(); $('#view').scrollTop = 0;
    }));
    $$('[data-hor-excluir]').forEach(b => b.addEventListener('click', async () => {
        if (salvando || !carregado('horarios', 'funcionarios')) return;
        const id = b.dataset.horExcluir;
        if (Object.values(state.funcionarios || {}).some(f => f.horarioId === id)) return toast('Este horário possui funcionários vinculados. Altere os vínculos antes de excluí-lo.', 'erro');
        if (!confirm('Excluir este horário?')) return;
        salvando = true; render();
        try { await gravar(`horarios/${id}`, null); if (editId === id) limpar(); toast('Horário excluído.'); }
        catch { toast('Não foi possível excluir o horário.', 'erro'); }
        finally { salvando = false; if (location.hash === '#horario') render(); }
    }));
    if(!formulario)return;
    $$('[data-modo]').forEach(b => b.addEventListener('click', () => { dados.modo = b.dataset.modo; erro = ''; render(); $(`#hor-tab-${dados.modo}`)?.focus(); }));
    $$('.hor-abas [role=tab]').forEach(b => b.addEventListener('keydown', e => { if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); const modo = e.key === 'Home' ? 'semanal' : e.key === 'End' ? 'carga' : dados.modo === 'semanal' ? 'carga' : 'semanal'; dados.modo = modo; render(); $(`#hor-tab-${modo}`)?.focus(); } }));
    $$('[data-dia]').forEach(el => el.addEventListener('change', () => { dados.dias[Number(el.dataset.dia)].ativo = el.checked; render(); }));
    $$('[data-hora]').forEach(el => el.addEventListener('input', () => { const [i,j] = el.dataset.hora.split(',').map(Number); dados.dias[i].horarios[j] = el.value; atualizarTotais(); }));
    [['hor-carga','carga'],['hor-intervalo','intervalo'],['hor-tolerancia','tolerancia']].forEach(([id,k]) => $(`#${id}`)?.addEventListener('input', e => { dados[k] = k === 'carga' ? e.target.value : e.target.value === '' ? NaN : Number(e.target.value); if ($('#hor-resumo-carga')) $('#hor-resumo-carga').textContent = dados.carga || '—'; if ($('#hor-resumo-tolerancia')) $('#hor-resumo-tolerancia').textContent = `± ${Number.isFinite(dados.tolerancia) ? dados.tolerancia : '—'} min`; }));
    $('#hor-compensacao')?.addEventListener('change', e => { dados.compensacao = e.target.checked; });
    $$('input[name=hor-classificacao]').forEach(el => el.addEventListener('change', () => { dados.classificacao = el.value; $('#hor-resumo-tipo').textContent = {util:'Regular',extra:'Extra',folga:'Folga'}[el.value]; }));
    $('#hor-cancelar').addEventListener('click', () => { if (salvando) return; limpar(); render(); });
    $('#hor-salvar').addEventListener('click', async () => {
        if (salvando || !carregado('horarios', 'funcionarios')) return;
        erro = validar(); if (erro) { render(); $('#hor-erro')?.focus(); return; }
        const id = editId || novoId('horarios');
        const payload = { ...copia(dados), nome: dados.nome.trim() };
        salvando = true; render();
        try {
            await gravar(`horarios/${id}`, payload);
            limpar();
            toast('Horário salvo.');
        } catch { erro = 'Não foi possível salvar o horário. Tente novamente.'; toast(erro, 'erro'); }
        finally { salvando = false; if (location.hash === '#horario') render(); }
    });
}
