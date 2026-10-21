import { fotoLocal } from '../core/imagens.js';
import { inicioJornada, fimJornada } from '../core/jornada.js';
import { $, $$, esc, dateKey, lista } from '../core/utils.js';
import { state } from '../core/state.js';
import { empresasDisponiveis, empresaPorId } from '../core/empresas.js';
import { normalizarCartao, validarCartao, salvarFuncionarioComCartao } from '../core/rfid.js';
import { toast } from '../core/ui.js';
import { createEmployeeAccess } from '../core/employee-credentials.js';
import { revokeMobile } from '../core/mobile-access.js';
import {
    cabecalho,
    itens,
    carregado,
    campo,
    opcoes,
    novoId,
    erroForm
} from '../core/cadastros.js';

let editId = null,
    draft = null,
    fotoPendente = false,
    mobileOcupado = false,
    mobileEmail = null,
    mobileSenha = null,
    mobileConfirmar = null,
    mobileMensagem = '';
const novo = () => ({
    nome: '',
    cpf: '',
    matricula: '',
    admissao: '',
    empresaId: '',
    departamentoId: '',
    cargoId: '',
    horarioId: '',
    status: 'ativo',
    foto: '',
    cartaoUid: ''
});

export function editarFuncionario(id) {
    editId = id;
    draft = { ...novo(), ...state.funcionarios[id] };
    mobileEmail = null;
    mobileSenha = mobileConfirmar = null;
    mobileMensagem = '';
    location.hash = 'funcionario';
}

export function novoFuncionario() {
    editId = null;
    draft = novo();
    mobileEmail = null;
    mobileSenha = mobileConfirmar = null;
    mobileMensagem = '';
    location.hash = 'funcionario';
}

function select(nome, label, opcs, extra = '') {
    return `
        <label class="cad-campo">
            <span>${label}</span>
            <select name="${nome}">
                ${opcoes(opcs, draft[nome])}${extra}
            </select>
        </label>
    `;
}

function legado(tipo) {
    return !draft[`${tipo}Id`] && draft[tipo]
        ? `
              <option value="__legado" selected>${esc(draft[tipo])} (cadastro antigo)</option>
          `
        : '';
}

function acessoSalvo() {
    const acessos = Object.entries(state.mobileAcessos || {})
        .filter(([, acesso]) => acesso.funcionarioId === editId)
        .map(([uid, acesso]) => ({ uid, ...acesso }));
    const acesso = acessos.find((item) => item.ativo) || acessos[0];
    const funcionario = state.funcionarios[editId] || draft || {};
    return {
        uid: funcionario.appAuthUid || acesso?.uid || '',
        email: funcionario.emailApp || acesso?.email || ''
    };
}

function acessoPeloAplicativo() {
    const acessos = Object.entries(state.mobileAcessos || {}).filter(
        ([, acesso]) => acesso.funcionarioId === editId
    );
    const bloqueado = draft.status !== 'ativo' || mobileOcupado ||
        (window.fb.contaAtiva?.permissao && window.fb.contaAtiva.permissao !== 'administrador');
    const salvo = acessoSalvo();
    const email = mobileEmail ?? salvo.email;
    return `
        <section class="cad-card" id="func-acesso-app">
            <h2>Acesso pelo aplicativo</h2>
            <p class="cad-ajuda">
                Defina o e-mail e a senha que o funcionário usará para entrar no aplicativo e bater ponto.
                O vínculo é salvo ao clicar em Salvar Funcionário. A senha não é armazenada neste cadastro.
            </p>

            <div class="cad-duas-colunas cad-espaco">
                <label class="cad-campo">
                    <span>E-mail de acesso ao aplicativo</span>
                    <input id="func-mobile-email" type="email" value="${esc(email)}" autocomplete="off" maxlength="254" ${bloqueado ? 'disabled' : ''} />
                </label>
                <label class="cad-campo">
                    <span>Senha de acesso ao aplicativo</span>
                    <input id="func-mobile-senha" type="password" autocomplete="new-password" spellcheck="false" autocapitalize="off" minlength="8" placeholder="${salvo.uid ? 'Deixe em branco para manter o acesso' : 'Defina a senha do aplicativo'}" ${bloqueado ? 'disabled' : ''} />
                </label>
                <label class="cad-campo">
                    <span>Confirmar senha</span>
                    <input id="func-mobile-confirmar" type="password" autocomplete="new-password" minlength="8" ${bloqueado ? 'disabled' : ''} />
                </label>
            </div>
            <p class="cad-ajuda cad-espaco">O e-mail permanece no cadastro. Senhas não podem ser recuperadas aqui. Deixe senha e confirmação vazias para manter o vínculo atual. Use a recuperação do Firebase para alterar uma senha existente.</p>
            <p id="func-mobile-mensagem" class="cad-ajuda cad-espaco" role="status" aria-live="polite">${esc(mobileMensagem)}</p>
            ${salvo.uid && state.mobileAcessos?.[salvo.uid]?.ativo === false ? `<button id="func-mobile-liberar" type="submit" class="btn btn-primario" ${bloqueado ? 'disabled' : ''}>Salvar e liberar acesso novamente</button>` : ''}
            ${acessos.length ? `<h3 class="cad-espaco">Acessos deste funcionário</h3>${acessos.map(([uid, acesso]) => `
                <p class="cad-ajuda cad-espaco">${esc(acesso.email)} · ${acesso.ativo ? 'Autorizado' : 'Revogado'}
                    ${acesso.ativo ? `<button type="button" class="btn btn-perigo cad-btn-peq" data-mobile-revogar="${esc(uid)}" ${bloqueado ? 'disabled' : ''}>Revogar acesso</button>` : ''}
                </p>`).join('')}` : ''}
        </section>
    `;
}

export function view() {
    if (!draft) draft = novo();
    const empresas = empresasDisponiveis(),
        horarios = itens('horarios').map((h) => ({
            ...h,
            nome: h.nome || (h.id === 'padrao' ? 'Perfil Padrão' : 'Horário sem nome')
        }));
    const pronto = carregado(
        'funcionarios',
        'empresa',
        'empresas',
        'cargos',
        'departamentos',
        'horarios'
    );
    return `
        <div class="cad-page">
            ${cabecalho(
                'Funcionários',
                editId ? 'Editar Funcionário' : 'Cadastro de Funcionários',
                'Preencha as informações abaixo para registrar um colaborador no sistema.',
                `
                    <button type="button" class="btn btn-secundario" id="func-cancelar" ${mobileOcupado ? 'disabled' : ''}>
                        Cancelar
                    </button>
                    <button
                        class="btn btn-primario"
                        type="submit"
                        form="func-form"
                        ${!pronto || mobileOcupado ? 'disabled' : ''}
                    >
                        Salvar Funcionário
                    </button>
                `
            )}
            <form id="func-form" novalidate>
                <fieldset class="cad-fieldset" ${!pronto || mobileOcupado ? 'disabled' : ''}>
                    <div class="cad-grid cad-grid-func">
                        <div class="cad-pilha">
                            <section class="cad-card">
                                <h2>Informações Pessoais</h2>
                                ${campo('nome', 'Nome Completo', draft.nome, 'autocomplete="name" maxlength="160" placeholder="Ex: Maria Oliveira Silva" required')}
                                <div class="cad-duas-colunas cad-espaco">
                                    ${campo('cpf', 'CPF (opcional)', draft.cpf, 'inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')}${campo('matricula', 'Matrícula / número interno', draft.matricula, 'maxlength="40" placeholder="123456" required')}
                                </div>
                                <div class="cad-duas-colunas cad-espaco">
                                    ${campo('admissao', 'Data de Admissão', draft.admissao, 'type="date" required')}
                                    <label class="cad-campo">
                                        <span>Situação</span>
                                        <select name="status">
                                            <option
                                                value="ativo"
                                                ${draft.status !== 'desligado' ? 'selected' : ''}
                                            >
                                                Ativo
                                            </option>
                                            <option
                                                value="desligado"
                                                ${draft.status === 'desligado' ? 'selected' : ''}
                                            >
                                                Desligado
                                            </option>
                                        </select>
                                    </label>
                                </div>
                            </section>
                            <section class="cad-card">
                                <h2>Cartão de ponto RFID</h2>
                                ${campo('cartaoUid', 'UID do cartão', draft.cartaoUid, 'autocomplete="off" spellcheck="false" maxlength="40" placeholder="Ex.: 626BD163"')}
                                <p class="cad-ajuda cad-espaco">
                                    Informe o UID exibido pelo leitor. Espaços são removidos ao
                                    salvar. Deixe em branco para remover o vínculo; cada cartão
                                    pertence a um funcionário nesta empresa.
                                </p>
                            </section>
                            ${acessoPeloAplicativo()}
                            <section class="cad-card">
                                <h2>Vínculos Institucionais</h2>
                                <p class="cad-ajuda">
                                    Desligamentos e reativações devem ser registrados em
                                    <a href="#demitidos">Movimentações → Funcionários demitidos</a>
                                    .
                                </p>
                                <div class="cad-duas-colunas">
                                    ${select('empresaId', 'Empresa / Unidade', empresas)}${select('departamentoId', 'Departamento', itens('departamentos'), legado('departamento'))}${select('cargoId', 'Função / Cargo', itens('cargos'), legado('cargo'))}${select('horarioId', 'Horário de Trabalho', horarios, draft.entrada && !draft.horarioId && editId ? '<option value="__legado" selected>Horário individual anterior</option>' : '')}
                                </div>
                                ${!empresas.length || !horarios.length || !itens('cargos').length || !itens('departamentos').length ? '<p class="cad-ajuda cad-espaco">Cadastre <a href="#empresa">empresa</a>, <a href="#departamento">departamento</a>, <a href="#cargo">cargo</a> e <a href="#horario">horário</a> para disponibilizar os vínculos.</p>' : ''}
                            </section>
                            <p class="erro" data-erro hidden></p>
                            ${!pronto ? '<p class="cad-ajuda">Carregando cadastros…</p>' : ''}
                        </div>
                        <aside class="cad-aside">
                            <section class="cad-azul">
                                <h2>Resumo do Registro</h2>
                                <div class="cad-destaque">
                                    <p>
                                        O número da folha deve ser único no sistema para evitar
                                        duplicidade.
                                    </p>
                                </div>
                            </section>
                            <label class="cad-foto" for="func-foto">
                                <span class="cad-foto-preview" id="func-preview">
                                    ${
                                        fotoLocal(draft.foto)
                                            ? `
                                                  <img
                                                      src="${esc(draft.foto)}"
                                                      alt="Foto do colaborador"
                                                  />
                                              `
                                            : '<span aria-hidden="true">♧</span>'
                                    }
                                </span>
                                <strong>Foto do colaborador (opcional)</strong>
                                <small>Use somente foto autorizada para esta finalidade (PNG ou JPG, até 5 MB)</small>
                                <input
                                    type="file"
                                    id="func-foto"
                                    accept="image/png,image/jpeg"
                                    class="cad-input-foto"
                                />
                            </label>
                            <button
                                class="btn btn-secundario cad-btn-peq"
                                type="button"
                                id="func-remover-foto"
                            >
                                Remover foto
                            </button>
                            <p id="func-foto-status" class="cad-ajuda" role="status"></p>
                            <section class="cad-card cad-dicas">
                                <h2>Dicas de Cadastro</h2>
                                <p>Confira os dados do colaborador antes de salvar.</p>
                                <p>A data de admissão define o início da análise de presença.</p>
                                <p>Vincule o horário correto para calcular a jornada prevista.</p>
                            </section>
                        </aside>
                    </div>
                </fieldset>
            </form>
        </div>
    `;
}

function cpfMask(v) {
    return v
        .replace(/\D/g, '')
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function validarFuncionario(d, id) {
    if (!d.nome || !d.matricula || !d.admissao)
        return 'Preencha nome, número de folha e admissão.';
    if (d.cpf && d.cpf.replace(/\D/g, '').length !== 11) return 'Informe um CPF com 11 dígitos.';
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(d.admissao) ||
        dateKey(new Date(d.admissao + 'T12:00:00')) !== d.admissao
    )
        return 'Informe uma data de admissão válida.';
    const erroCartao = validarCartao(d.cartaoUid, id);
    if (erroCartao) return erroCartao;
    const outros = lista(state.funcionarios).filter((f) => f.id !== id);
    if (d.cpf && outros.some((f) => String(f.cpf || '').replace(/\D/g, '') === d.cpf.replace(/\D/g, '')))
        return 'Já existe um funcionário com esse CPF.';
    if (
        outros.some(
            (f) =>
                String(f.matricula || '')
                    .trim()
                    .toLowerCase() === d.matricula.toLowerCase()
        )
    )
        return 'Já existe um funcionário com esse número de folha.';
    if (!d.empresaId || !d.departamentoId || !d.cargoId || !d.horarioId)
        return 'Selecione empresa, departamento, cargo e horário.';
    if (!empresaPorId(d.empresaId)) return 'A empresa selecionada não está disponível.';
    for (const [tipo, colecao] of [
        ['cargo', 'cargos'],
        ['departamento', 'departamentos']
    ])
        if (d[`${tipo}Id`] !== '__legado' && !state[colecao]?.[d[`${tipo}Id`]])
            return `O ${tipo} selecionado não está disponível.`;
    if (d.horarioId !== '__legado' && !state.horarios?.[d.horarioId])
        return 'O horário selecionado não está disponível.';
    return '';
}

export function bind({ render }) {
    const form = $('#func-form');
    $('#func-mobile-email').value = mobileEmail ?? acessoSalvo().email;
    $('#func-mobile-email').addEventListener('input', (e) => { mobileEmail = e.target.value; });
    $('#func-mobile-senha').value = mobileSenha ?? '';
    $('#func-mobile-confirmar').value = mobileConfirmar ?? '';
    $('#func-mobile-senha').addEventListener('input', (e) => { mobileSenha = e.target.value; });
    $('#func-mobile-confirmar').addEventListener('input', (e) => { mobileConfirmar = e.target.value; });
    $$('[data-mobile-revogar]').forEach((button) => {
        button.addEventListener('click', async () => {
            if (mobileOcupado || !confirm('Revogar este acesso ao aplicativo? As batidas serão mantidas.')) return;
            const id = editId;
            mobileOcupado = true;
            const uid = button.dataset.mobileRevogar;
            render();
            try {
                await revokeMobile(window.fb.db, window.fb.contaAtiva?.id || window.fb.auth.currentUser.uid, uid);
                if (editId === id) mobileMensagem = 'Acesso revogado. O histórico foi mantido.';
            } catch (error) {
                if (editId === id) mobileMensagem = error.message || 'Não foi possível revogar o acesso.';
            } finally {
                mobileOcupado = false;
                if (location.hash === '#funcionario') render();
            }
        });
    });
    form.addEventListener('input', (e) => {
        if (!(e.target.name in draft)) return;
        if (e.target.name === 'cpf') e.target.value = cpfMask(e.target.value);
        draft[e.target.name] = e.target.value;
    });
    form.addEventListener('change', (e) => {
        if (e.target.name in draft) draft[e.target.name] = e.target.value;
    });
    $('#func-cancelar').addEventListener('click', () => {
        mobileSenha = mobileConfirmar = null;
        mobileEmail = null;
        editId = null;
        draft = null;
        location.hash = 'cadastro';
    });
    $('#func-remover-foto').addEventListener('click', () => {
        draft.foto = '';
        $('#func-preview').textContent = '♧';
        $('#func-foto').value = '';
    });
    $('#func-foto').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            e.target.value = '';
            return toast('Escolha um PNG ou JPG de até 5 MB.', 'erro');
        }
        fotoPendente = true;
        $('#func-foto-status').textContent = 'Processando foto…';
        const destino = draft;
        try {
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const escala = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.round(bitmap.width * escala);
            canvas.height = Math.round(bitmap.height * escala);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            const foto = canvas.toDataURL('image/jpeg', 0.82);
            if (draft === destino) {
                draft.foto = foto;
                if (location.hash === '#funcionario')
                    $('#func-preview').innerHTML = `
                        <img src="${foto}" alt="Foto do colaborador" />
                    `;
            }
        } catch {
            toast('Não foi possível ler a imagem.', 'erro');
        } finally {
            fotoPendente = false;
            if ($('#func-foto-status')) $('#func-foto-status').textContent = '';
        }
    });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (form.dataset.salvando || mobileOcupado) return;
        if (fotoPendente) return erroForm(form, 'Aguarde o processamento da foto.');
        if (
            !carregado('funcionarios', 'empresa', 'empresas', 'cargos', 'departamentos', 'horarios')
        )
            return;
        const camposFuncionario = ['nome', 'cpf', 'matricula', 'admissao', 'status', 'empresaId', 'departamentoId', 'cargoId', 'horarioId', 'cartaoUid'];
        const f = Object.fromEntries([...new FormData(form)].filter(([campo]) => camposFuncionario.includes(campo)));
        for (const k of ['nome', 'matricula', 'cpf', 'admissao']) f[k] = (f[k] || '').trim();
        f.cpf = cpfMask(f.cpf);
        f.cartaoUid = normalizarCartao(f.cartaoUid);
        const erro = validarFuncionario(f, editId);
        if (erro) return erroForm(form, erro);
        if (
            (editId &&
                state.funcionarios[editId].status !== f.status &&
                (state.funcionarios[editId].status === 'desligado' || f.status === 'desligado')) ||
            (!editId && f.status === 'desligado')
        )
            return erroForm(
                form,
                'Cadastre como ativo. Para registrar demissão ou reativação, use Movimentações → Funcionários demitidos.'
            );
        const acessoAnterior = acessoSalvo();
        const email = $('#func-mobile-email').value.trim().toLowerCase();
        const password = $('#func-mobile-senha').value;
        const confirmation = $('#func-mobile-confirmar').value;
        // Salvar o cadastro não deve reativar um vínculo revogado: essa ação
        // exige senha informada e o botão específico de liberação.
        const revogado = acessoAnterior.uid && state.mobileAcessos?.[acessoAnterior.uid]?.ativo === false;
        const papel = globalThis.window?.fb?.contaAtiva?.permissao;
        const podeLiberar = !papel || papel === 'administrador';
        const configurarAcesso = podeLiberar && !!password && (!revogado || e.submitter?.id === 'func-mobile-liberar');
        if (revogado && !configurarAcesso && password)
            return erroForm(form, 'Para configurar estas credenciais e reativar o aplicativo, use Salvar e liberar acesso novamente.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return erroForm(form, 'Informe um e-mail válido para o aplicativo.');
        if (password !== confirmation)
            return erroForm(form, 'Preencha a mesma senha nos dois campos.');
        if (password && (!email || password.length < 8))
            return erroForm(form, 'Informe o e-mail e uma senha com pelo menos 8 caracteres.');
        if (email && !password && (!acessoAnterior.uid || email !== acessoAnterior.email.toLowerCase()))
            return erroForm(form, 'Para criar um acesso ou definir outro e-mail, preencha também a senha e sua confirmação.');
        if (!email && acessoAnterior.uid)
            return erroForm(form, 'O e-mail identifica o acesso existente. Para bloquear o aplicativo, use Revogar acesso.');
        if (password && f.status !== 'ativo')
            return erroForm(form, 'Somente funcionários ativos podem receber acesso ao aplicativo.');
        mobileEmail = email;
        mobileSenha = password;
        mobileConfirmar = confirmation;
        const agora = new Date();
        const salvo = {
            ...(editId ? state.funcionarios[editId] : {}),
            ...f,
            foto: draft.foto || '',
            ...(!editId ? { dataCadastro: dateKey(agora), cadastradoEm: agora.toISOString() } : {})
        };
        // Remove campos legados de senha caso um cadastro antigo ainda esteja em memória.
        for (const field of ['senha', 'password', 'senhaApp', 'appPassword', 'mobilePassword', 'senhaMobile']) delete salvo[field];
        if (acessoAnterior.uid) {
            salvo.emailApp = acessoAnterior.email;
            salvo.appAuthUid = acessoAnterior.uid;
        }
        for (const [tipo, colecao] of [
            ['cargo', 'cargos'],
            ['departamento', 'departamentos']
        ]) {
            if (f[`${tipo}Id`] === '__legado') {
                salvo[`${tipo}Id`] = '';
                salvo[tipo] = draft[tipo] || '';
            } else {
                salvo[tipo] = state[colecao][f[`${tipo}Id`]].nome;
            }
        }
        if (f.horarioId === '__legado') {
            salvo.horarioId = '';
            salvo.entrada = draft.entrada || '08:00';
            salvo.saida = draft.saida || '17:00';
        } else {
            const h = state.horarios[f.horarioId];
            const dia = (h.dias || []).find((d) => d.ativo);
            salvo.entrada = inicioJornada(dia?.horarios) || '08:00';
            salvo.saida = fimJornada(dia?.horarios) || '17:00';
        }
        const id = editId || novoId('funcionarios');
        // RTDB e Authentication não compartilham uma transação. Guardar a etapa
        // concluída permite informar uma falha parcial sem perder o cadastro.
        let cadastroSalvo = false;
        form.dataset.salvando = 'true';
        mobileOcupado = true;
        mobileMensagem = configurarAcesso ? 'Salvando cadastro e acesso ao aplicativo…' : 'Salvando funcionário…';
        render();
        try {
            await salvarFuncionarioComCartao(id, salvo);
            cadastroSalvo = true;
            editId = id;
            draft = { ...salvo, ...(state.funcionarios[id] || {}) };
            if (configurarAcesso) {
                const acesso = await createEmployeeAccess({ auth: window.fb.auth, db: window.fb.db, owner: window.fb.contaAtiva?.id || window.fb.auth.currentUser.uid, fid: id, email, password });
                const metadata = { emailApp: acesso.email, appAuthUid: acesso.uid };
                state.funcionarios[id] = { ...(state.funcionarios[id] || salvo), ...metadata };
                Object.assign(draft, metadata);
                mobileEmail = acesso.email;
                mobileMensagem = 'Funcionário e acesso salvos. O e-mail permanece no cadastro; a senha não é guardada aqui.';
            } else {
                mobileMensagem = acessoAnterior.uid
                    ? 'Funcionário salvo. O vínculo de acesso foi mantido sem guardar a senha.'
                    : 'Funcionário salvo.';
            }
            mobileSenha = mobileConfirmar = null;
            toast(mobileMensagem);
        } catch (error) {
            mobileMensagem = cadastroSalvo
                ? `O cadastro foi salvo, mas o acesso ao aplicativo não foi confirmado. ${error.message || 'Confira a conexão e tente novamente com os mesmos dados.'}`
                : 'Não foi possível salvar o cadastro. Confira a conexão e as permissões do banco.';
            toast(mobileMensagem, 'erro');
        } finally {
            delete form.dataset.salvando;
            mobileOcupado = false;
            if (location.hash === '#funcionario' || location.hash === 'funcionario') render();
        }
    });
}
