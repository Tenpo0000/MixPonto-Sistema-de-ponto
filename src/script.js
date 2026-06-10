class SistemaPonto {
    constructor() {
        this.inicializar();
    }

    inicializar() {
        this.configurarMenu();
        this.configurarBotoes();
        this.configurarBusca();
        this.carregarDados();
    }

    configurarMenu() {
        const itensMenu = document.querySelectorAll('.menu-item');
        
        itensMenu.forEach(item => {
            item.addEventListener('click', (e) => {
                itensMenu.forEach(i => i.classList.remove('ativo'));
                item.classList.add('ativo');
                this.exibirNotificacao(`Navegando para: ${item.textContent.trim()}`);
            });
        });
    }

    configurarBotoes() {
        const btnInclusao = document.querySelector('.btn-primario');
        if (btnInclusao) {
            btnInclusao.addEventListener('click', () => {
                this.abrirModalInclusao();
            });
        }

        const btnExportar = document.querySelector('.btn-secundario');
        if (btnExportar) {
            btnExportar.addEventListener('click', () => {
                this.exportarPDF();
            });
        }

        const botoesAjustar = document.querySelectorAll('.btn-ajustar');
        botoesAjustar.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.abrirModalAjuste(e.target);
            });
        });
    }

    configurarBusca() {
        const inputBusca = document.querySelector('.busca');
        if (inputBusca) {
            inputBusca.addEventListener('input', (e) => {
                const termo = e.target.value.toLowerCase();
                this.filtrarRegistros(termo);
            });
        }
    } 

    formatarHora(timestamp) {
    if (!timestamp) return '-----';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    calcularTotal(batidas) {
    if (batidas.length < 2) return '00:00';
    let totalMin = 0;
    for (let i = 0; i + 1 < batidas.length; i += 2) {
        const entrada = new Date(batidas[i]);
        const saida   = new Date(batidas[i + 1]);
        totalMin += (saida - entrada) / 60000;
    }
    const h = Math.floor(totalMin / 60);
    const m = Math.floor(totalMin % 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    

    carregarDados() {
    // Pega a data de hoje no formato YYYY-MM-DD
        const hoje = new Date().toISOString().split('T')[0];
        const caminhoHoje = `registros/${hoje}`;

        const refRegistros = window.ref(window.db, caminhoHoje);

        window.onValue(refRegistros, (snapshot) => {
            const dados = snapshot.val();
            const tbody = document.getElementById('corpo-tabela');

            if (!dados) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align:center; padding:30px; color:#999;">
                            Nenhum registro encontrado hoje.
                        </td>
                    </tr>`;
                return;
            }
            console.log("Snapshot recebido:", dados);

            // Agrupa as batidas por UID (funcionário)
            const funcionarios = {};

            Object.entries(dados).forEach(([uid, batidasObj]) => {
                Object.values(batidasObj).forEach(registro => {
                    if (!funcionarios[uid]) {
                        funcionarios[uid] = { nome: registro.nome, batidas: [] };
                    }
                    funcionarios[uid].batidas.push(registro.timestamp);
                });
            });


            // Ordena batidas por horário
            Object.values(funcionarios).forEach(f => {
                f.batidas.sort();
            });

            // Renderiza as linhas
            tbody.innerHTML = '';

            Object.values(funcionarios).forEach(func => {
                const batidas = func.batidas;
                const entrada1 = batidas[0] ? this.formatarHora(batidas[0]) : '-----';
                const saida1   = batidas[1] ? this.formatarHora(batidas[1]) : '-----';
                const entrada2 = batidas[2] ? this.formatarHora(batidas[2]) : '-----';
                const saida2   = batidas[3] ? this.formatarHora(batidas[3]) : '-----';
                const total    = this.calcularTotal(batidas);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="dia">
                        <span class="numero">${func.nome}</span>
                        <small>${hoje}</small>
                    </td>
                    <td>${entrada1}</td>
                    <td>${saida1}</td>
                    <td>${entrada2}</td>
                    <td>${saida2}</td>
                    <td class="total">${total}</td>
                    <td>—</td>
                    <td><button class="btn-ajustar">Ajustar</button></td>
                `;
                tbody.appendChild(tr);
            });

            // Reconfigura botões de ajuste
            this.configurarBotoes();
            document.querySelector('.rodape-tabela').textContent =
                `Exibindo ${Object.keys(funcionarios).length} funcionário(s) hoje`;
        });
    }

    filtrarRegistros(termo) {
        const linhas = document.querySelectorAll('table tbody tr');
        
        linhas.forEach(linha => {
            const texto = linha.textContent.toLowerCase();
            if (texto.includes(termo)) {
                linha.style.display = '';
            } else {
                linha.style.display = 'none';
            }
        });
    }

    abrirModalInclusao() {
        const conteudo = `
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Inclusão Manual de Ponto</h2>
                        <button class="fechar-modal">&times;</button>
                    </div>
                    <div class="modal-corpo">
                        <div class="grupo-formulario">
                            <label>Data</label>
                            <input type="date" id="data-inclusao">
                        </div>
                        <div class="linha-formulario">
                            <div class="grupo-formulario">
                                <label>Entrada 1</label>
                                <input type="time" id="entrada1-inclusao">
                            </div>
                            <div class="grupo-formulario">
                                <label>Saída 1</label>
                                <input type="time" id="saida1-inclusao">
                            </div>
                        </div>
                        <div class="linha-formulario">
                            <div class="grupo-formulario">
                                <label>Entrada 2</label>
                                <input type="time" id="entrada2-inclusao">
                            </div>
                            <div class="grupo-formulario">
                                <label>Saída 2</label>
                                <input type="time" id="saida2-inclusao">
                            </div>
                        </div>
                        <div class="grupo-formulario">
                            <label>Justificativa</label>
                            <textarea id="justificativa-inclusao" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-rodape">
                        <button class="btn btn-secundario fechar-modal-btn">Cancelar</button>
                        <button class="btn btn-primario salvar-inclusao">Salvar</button>
                    </div>
                </div>
            </div>
        `;

        this.renderizarModal(conteudo);
        this.configurarModalInclusao();
    }

    configurarModalInclusao() {
        const fecharBotoes = document.querySelectorAll('.fechar-modal, .fechar-modal-btn');
        fecharBotoes.forEach(btn => {
            btn.addEventListener('click', () => this.fecharModal());
        });

        const botaoSalvar = document.querySelector('.salvar-inclusao');
        if (botaoSalvar) {
            botaoSalvar.addEventListener('click', () => {
                this.exibirNotificacao('Ponto incluído com sucesso!');
                this.fecharModal();
            });
        }
    }

    abrirModalAjuste(botao) {
        const linha = botao.closest('tr');
        const dia = linha.querySelector('.numero').textContent;
        
        const conteudo = `
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Ajustar Ponto - ${dia}</h2>
                        <button class="fechar-modal">&times;</button>
                    </div>
                    <div class="modal-corpo">
                        <div class="grupo-formulario">
                            <label>Tipo de Ajuste</label>
                            <select id="tipo-ajuste">
                                <option>Anexar Atestado</option>
                                <option>Justificar Falta</option>
                                <option>Corrigir Horário</option>
                            </select>
                        </div>
                        <div class="grupo-formulario">
                            <label>Observação</label>
                            <textarea id="obs-ajuste" rows="4"></textarea>
                        </div>
                        <div class="grupo-formulario">
                            <label>Arquivo (opcional)</label>
                            <input type="file" id="arquivo-ajuste">
                        </div>
                    </div>
                    <div class="modal-rodape">
                        <button class="btn btn-secundario fechar-modal-btn">Cancelar</button>
                        <button class="btn btn-primario salvar-ajuste">Salvar Ajuste</button>
                    </div>
                </div>
            </div>
        `;

        this.renderizarModal(conteudo);
        this.configurarModalAjuste();
    }

    configurarModalAjuste() {
        const fecharBotoes = document.querySelectorAll('.fechar-modal, .fechar-modal-btn');
        fecharBotoes.forEach(btn => {
            btn.addEventListener('click', () => this.fecharModal());
        });

        const botaoSalvar = document.querySelector('.salvar-ajuste');
        if (botaoSalvar) {
            botaoSalvar.addEventListener('click', () => {
                this.exibirNotificacao('Ajuste realizado com sucesso!');
                this.fecharModal();
            });
        }
    }

    exportarPDF() {
        this.exibirNotificacao('Gerando PDF do cartão de ponto...');
        setTimeout(() => {
            this.exibirNotificacao('PDF exportado com sucesso!');
        }, 1500);
    }

    renderizarModal(conteudo) {
        const container = document.createElement('div');
        container.id = 'modal-container';
        container.innerHTML = conteudo;
        document.body.appendChild(container);

        const overlay = container.querySelector('.modal-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.fecharModal();
            }
        });
    }

    fecharModal() {
        const container = document.getElementById('modal-container');
        if (container) {
            container.remove();
        }
    }

    exibirNotificacao(mensagem) {
        const notificacao = document.createElement('div');
        notificacao.className = 'notificacao';
        notificacao.textContent = mensagem;
        document.body.appendChild(notificacao);

        setTimeout(() => {
            notificacao.classList.add('visivel');
        }, 10);

        setTimeout(() => {
            notificacao.classList.remove('visivel');
            setTimeout(() => notificacao.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SistemaPonto();

    const estilosModal = `
        <style>
            #modal-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
            }

            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }

            .modal {
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                max-width: 500px;
                width: 90%;
                display: flex;
                flex-direction: column;
                max-height: 90vh;
                overflow-y: auto;
            }

            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .modal-header h2 {
                font-size: 18px;
                margin: 0;
            }

            .fechar-modal {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .fechar-modal:hover {
                color: #333;
            }

            .modal-corpo {
                padding: 20px;
                flex: 1;
            }

            .grupo-formulario {
                margin-bottom: 16px;
            }

            .grupo-formulario label {
                display: block;
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 6px;
                color: #333;
            }

            .grupo-formulario input,
            .grupo-formulario select,
            .grupo-formulario textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                font-size: 13px;
                font-family: inherit;
            }

            .grupo-formulario input:focus,
            .grupo-formulario select:focus,
            .grupo-formulario textarea:focus {
                outline: none;
                border-color: #0052cc;
                box-shadow: 0 0 0 3px rgba(0, 82, 204, 0.1);
            }

            .linha-formulario {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .modal-rodape {
                padding: 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .notificacao {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: #333;
                color: white;
                padding: 14px 20px;
                border-radius: 6px;
                font-size: 13px;
                opacity: 0;
                transition: opacity 0.3s ease;
                z-index: 2000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }

            .notificacao.visivel {
                opacity: 1;
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', estilosModal);
});
