> Versão atual: **1.5**. O ID pertence à conta inteira; empresas internas não recebem IDs de login. Consulte [CONTAS-1.5.md](../CONTAS-1.5.md). As instruções 1.4 abaixo registram a migração anterior e não devem ser reaplicadas nesta instalação.

# Ativar isolamento e acesso móvel — 1.4

Siga [ISOLAMENTO-1.4.md](../ISOLAMENTO-1.4.md) antes de publicar as novas regras. Exporte e migre os dados, revise o relatório e prepare o serviço autenticado de descoberta.

Os titulares agora ficam em contas/{contaId}/titularesAutorizados/{ownerUid}. As permissões de convidados ficam na mesma conta, em acessosContas. Não recrie esses nós na raiz. Solicitações e vínculos móveis também são consultados apenas dentro da conta.

A configuração do servidor está em [servidor/README.md](../servidor/README.md). Após preparar a estrutura e o serviço, publique o conteúdo completo de database.rules.json e atualize o aplicativo para o APK 1.4.

Nenhuma migração ou publicação no Firebase real foi executada pelas ferramentas nesta entrega.
