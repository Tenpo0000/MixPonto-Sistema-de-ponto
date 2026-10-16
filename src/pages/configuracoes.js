import { DIAS_CURTO, $, $$, esc } from '../core/utils.js';
import { state, cfg } from '../core/state.js';
import { usandoFirebase } from '../core/db.js';
import { toast } from '../core/ui.js';
import { bindIr } from '../core/componentes.js';
import { gravar, executar, erroForm, carregado } from '../core/cadastros.js';

export function view() {
    const c = cfg();
    return `
        <div class="cabecalho-pagina">
            <div>
                <h1>Configurações</h1>
                <p>
                    ${usandoFirebase ? 'Conectado ao Firebase Realtime Database.' : 'Modo local: os dados ficam só neste navegador.'}
                </p>
            </div>
        </div>
        <form class="secao" id="form-jornada" novalidate>
            <h2>Jornada de trabalho</h2>
            <p>Configuração global para funcionários sem perfil de horário vinculado.</p>
            <fieldset class="cad-fieldset" ${carregado('config') ? '' : 'disabled'}>
                <div class="form-linha">
                    <label class="campo">
                        Carga diária (horas)
                        <input
                            type="number"
                            name="jornada"
                            min="1"
                            max="12"
                            step="0.5"
                            value="${esc(c.jornada)}"
                        />
                    </label>
                    <label class="campo">
                        Tolerância de atraso (min)
                        <input
                            type="number"
                            name="tolerancia"
                            min="0"
                            max="60"
                            step="1"
                            value="${esc(c.tolerancia)}"
                        />
                    </label>
                </div>
                <div class="campo" style="margin-bottom:18px">
                    Dias de trabalho
                    <div class="dias-semana">
                        ${DIAS_CURTO.map(
                            (nome, i) => `
                                <label>
                                    <input
                                        type="checkbox"
                                        name="dia"
                                        value="${i}"
                                        ${String(c.diasTrabalho).includes(String(i)) ? 'checked' : ''}
                                    />
                                    ${esc(nome)}
                                </label>
                            `
                        ).join('')}
                    </div>
                </div>
                <p class="erro" data-erro hidden></p>
                <button class="btn btn-primario" type="submit">Salvar jornada</button>
            </fieldset>
        </form>
        <section class="secao">
            <h2>Feriados e horários</h2>
            <p>Gerencie os calendários e os perfis de jornada nos cadastros correspondentes.</p>
            <div class="botoes-acao">
                <a class="btn btn-secundario" href="#feriado">Cadastro de Feriados</a>
                <a class="btn btn-secundario" href="#horario">Cadastro de Horários</a>
            </div>
        </section>
        <section class="secao">
            <h2>Dados de demonstração</h2>
            <p>
                Cria 8 funcionários com registros de ponto, faltas e atrasos. Isso substitui os
                funcionários, registros, ajustes, feriados e configurações atuais.
            </p>
            <div class="botoes-acao">
                <button class="btn btn-primario" data-demo>Gerar dados de demonstração</button>
                <button class="btn btn-perigo" id="btn-limpar">Apagar dados de ponto</button>
            </div>
        </section>
    `;
}

export function bind() {
    bindIr();
    const form = $('#form-jornada');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (form.dataset.salvando || !carregado('config')) return;
        const d = new FormData(form),
            jornada = Number(d.get('jornada')),
            tolerancia = Number(d.get('tolerancia'));
        if (
            !Number.isFinite(jornada) ||
            jornada < 1 ||
            jornada > 12 ||
            jornada * 2 !== Math.round(jornada * 2)
        )
            return erroForm(
                form,
                'Informe uma jornada entre 1 e 12 horas, em intervalos de meia hora.'
            );
        if (
            d.get('tolerancia') === '' ||
            !Number.isInteger(tolerancia) ||
            tolerancia < 0 ||
            tolerancia > 60
        )
            return erroForm(form, 'Informe uma tolerância inteira entre 0 e 60 minutos.');
        const diasTrabalho = d.getAll('dia').join('');
        if (!diasTrabalho) return erroForm(form, 'Selecione pelo menos um dia de trabalho.');
        await executar(
            form,
            () => gravar('config', { ...state.config, jornada, tolerancia, diasTrabalho }),
            'Jornada salva.'
        );
    });
    $('#btn-limpar').addEventListener('click', async (e) => {
        if (
            !confirm(
                'Apagar funcionários, registros, ajustes e feriados? Isso não pode ser desfeito.'
            )
        )
            return;
        const b = e.currentTarget;
        b.disabled = true;
        try {
            for (const p of ['funcionarios', 'registros', 'ajustes', 'feriados'])
                await gravar(p, null);
            toast('Dados de ponto apagados.');
        } catch {
            toast('Não foi possível concluir a exclusão dos dados.', 'erro');
        } finally {
            b.disabled = false;
        }
    });
}
