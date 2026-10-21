/** Mantém tentativas somente em memória, sem salvar o texto do titular no navegador. */
export function criarEstadoPedidos(novoId = () => crypto.randomUUID()) {
    let revisao = 0;
    let consulta = 0;
    let pendente = null;
    return {
        sessao() { return revisao; },
        mudarSessao() { revisao++; consulta++; pendente = null; },
        iniciarConsulta() { return ++consulta; },
        consultaAtual(id) { return consulta === id; },
        tentar(dados) {
            // Uma repetição com os mesmos dados reutiliza o protocolo após falha
            // de rede. Uma edição explícita representa um requerimento diferente.
            const assinatura = JSON.stringify(dados);
            if (!pendente || pendente.assinatura !== assinatura)
                pendente = { ...dados, id: novoId(), assinatura };
            return pendente;
        },
        confirmar(tentativa) { if (pendente === tentativa) pendente = null; },
    };
}
