# Sistema de Ponto

Interface web completa para gerenciamento de registros de ponto em português brasileiro. O sistema é estruturado em arquivos HTML, CSS e JavaScript, com integração ao Firebase para armazenamento e consulta de dados em tempo real.

## Estrutura dos Arquivos

- **index.html** – Estrutura principal da página e marcação semântica.
- **style.css** – Estilos visuais, layout responsivo e variáveis de tema.
- **script.js** – Lógica interativa da aplicação e manipulação do DOM.
- **firebase_config.js** – Configuração e inicialização do Firebase, expondo funções para acesso ao banco de dados.

## Como Usar

1. Coloque todos os arquivos na mesma pasta do projeto.
2. utilize o comando **npm install firebase** no terminal
3. Abra o arquivo `index.html` em um navegador.
4. O sistema carregará automaticamente os registros de ponto do Firebase.

## Funcionalidades

### Menu Lateral
- Indicação visual da seção ativa.
- Compatibilidade com dispositivos móveis.

### Busca
- Campo de busca para localizar funcionários.
- Filtragem dinâmica dos registros exibidos na tabela.

### Cartão Ponto
- Exibição de horas trabalhadas diariamente.
- Cálculo de saldo de banco de horas.
- Registro de faltas e atrasos com justificativas.
- Status mensal do período em andamento.

### Tabela de Registros
- Visualização detalhada por dia.
- Suporte para múltiplas entradas e saídas.
- Indicação de registros manuais.
- Opções de ajuste em caso de falta ou inconsistência.

### Modais Interativos
- Inclusão manual de ponto com justificativa.
- Ajuste de ponto com opções de correção, justificativa ou anexação de documentos.
- Fechamento e salvamento com notificações visuais.

### Estatísticas
- Média de horas semanais.
- Quantidade de chegadas atrasadas.
- Sequência de presença contínua.
- Comparação com períodos anteriores.


## Responsividade

A interface é adaptável a diferentes dispositivos:

- **Desktop**: telas acima de 1200px.
- **Tablets**: entre 768px e 1199px.
- **Dispositivos móveis**: abaixo de 768px.

## Funcionalidades JavaScript

### Classe Principal: SistemaPonto

- `inicializar()` – Configura todos os componentes da interface.
- `configurarMenu()` – Gerencia navegação lateral e estados ativos.
- `configurarBotoes()` – Define eventos dos botões principais e de ajuste.
- `configurarBusca()` – Implementa busca e filtragem de registros.
- `carregarDados()` – Consulta registros no Firebase e renderiza a tabela.
- `abrirModalInclusao()` – Exibe modal para inclusão manual de ponto.
- `abrirModalAjuste()` – Exibe modal para ajustes de registros.
- `exportarPDF()` – Simula exportação do cartão de ponto em PDF.
- `filtrarRegistros()` – Filtra registros da tabela por termo de busca.
- `exibirNotificacao()` – Mostra mensagens temporárias ao usuário.

## Expansão

- **Integração com Backend**: Substituir eventos simulados por chamadas reais a APIs.
- **Validação de Formulários**: Adicionar regras de validação nos inputs dos modais.
- **Gráficos**: Integrar bibliotecas como Chart.js para visualização de estatísticas.
- **Paginação**: Implementar paginação na tabela de registros para grandes volumes de dados.
- **Temas**: Criar suporte a temas claros e escuros.

## Notas

- Não há dependências externas além do Firebase.
- CSS utiliza variáveis para facilitar customização.
- Código organizado e comentado para melhor compreensão.
- Pronto para integração com APIs e sistemas externos.
