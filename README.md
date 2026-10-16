# MixPonto — Sistema de Controle de Ponto

Aplicação web para gerenciar funcionários, jornadas de trabalho e registros de ponto, com autenticação pelo Firebase e integração com um terminal ESP32 equipado com leitor RFID.

O frontend utiliza HTML, CSS e JavaScript com módulos ES, sem framework. Os dados são armazenados no Firebase Realtime Database, em espaços separados por conta autenticada.

## Funcionalidades

### Painel inicial

- Indicadores de funcionários trabalhando, faltantes, feriados e folgas.
- Acompanhamento da presença semanal.
- Visualização das atividades recentes.

### Cadastros

- Empresas e unidades vinculadas à conta.
- Funcionários, com data de admissão, cargo, departamento e horário de trabalho.
- Vínculo de cartões RFID pelo UID informado no cadastro do funcionário.
- Horários identificados por nome, com modalidades semanal e carga horária.
- Jornadas com um ou dois períodos completos por dia.
- Cargos, departamentos e justificativas.
- Feriados, com opção de importar feriados nacionais por ano.

### Movimentações

- Cartão ponto com filtros de data inicial e final.
- Total de horas, saldo de horas, faltas, atrasos e status do período.
- Inclusão manual de batidas com motivo obrigatório.
- Edição e exclusão individual de batidas manuais.
- Ajustes utilizando justificativas cadastradas no sistema.
- Relatório de cálculos e exportação de planilhas XLSX.
- Impressão de relatórios e cartão ponto para salvar como PDF.
- Demissão e consulta de funcionários desligados, preservando o histórico.

### Conta e configurações

- Cadastro de conta, login, recuperação e alteração de senha pelo Firebase Authentication.
- Edição de perfil e preferências da conta.
- Lista administrativa de usuários.
- Separação dos dados entre contas autenticadas.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5 e CSS3 |
| Lógica do frontend | JavaScript com módulos ES |
| Autenticação | Firebase Authentication — e-mail e senha |
| Banco de dados | Firebase Realtime Database |
| Terminal de ponto | ESP32 e leitor RFID MFRC522 |
| Testes locais | Node.js, `node:test` e `node:vm` |

## Estrutura do projeto

```text
.
├── src/
│   ├── index.html
│   ├── style.css
│   ├── fireBase_config.js
│   ├── bootstrap.js
│   ├── app.js
│   ├── core/
│   └── pages/
├── firebase/
│   └── database.rules.json
├── testes/
│   ├── package.json
│   ├── regras-emulador.mjs
│   └── ...
├── firebase.json
├── .editorconfig
├── .prettierrc.json
└── README.md
```

- **`index.html`**: estrutura principal da aplicação.
- **`bootstrap.js`**: autenticação e preparação do contexto da conta.
- **`app.js`**: navegação por hash, renderização e listeners dos dados.
- **`pages/`**: conteúdo e eventos das páginas, seguindo o contrato `view()` e `bind()`.
- **`core/`**: acesso aos dados, estado, cálculos e funções compartilhadas.
- **`style.css`**: todos os estilos da aplicação.
- **`firebase/database.rules.json`**: regras de acesso e validação do banco.
- **`testes/`**: verificações locais e teste das regras com emulador.

## Executar localmente

### Pré-requisitos

- Navegador com suporte a módulos JavaScript.
- Servidor HTTP local, como o Live Server do VS Code ou o servidor do Python.
- Projeto Firebase com Authentication e Realtime Database habilitados.
- Node.js para executar os testes; não é necessário para servir o frontend com Python ou Live Server.

O projeto completo precisa conter também os módulos compartilhados `src/core/utils.js`, `ui.js`, `demo.js` e `componentes.js`. Ao montar o repositório a partir dos pacotes de atualização, preserve esses arquivos do projeto original.

### 1. Configurar o Firebase

No console do seu projeto Firebase:

1. Adicione uma aplicação web e copie sua configuração.
2. Atualize o objeto `firebaseConfig` em `src/fireBase_config.js` com os dados do seu projeto.
3. Habilite **Authentication → Método de login → E-mail/Senha**.
4. Crie ou habilite o **Realtime Database**.
5. Confira os domínios autorizados para o endereço usado pela aplicação.
6. Publique as regras de `firebase/database.rules.json` no Realtime Database.

O arquivo de configuração utiliza o SDK web do Firebase **10.7.0**, carregado por URL. Não há etapa de build do frontend.

As regras também podem ser publicadas com a CLI Firebase, após autenticar e escolher explicitamente o projeto:

```bash
firebase deploy --only database --project SEU_PROJECT_ID
```

A configuração web do Firebase identifica o projeto; a autorização dos dados depende da autenticação e das regras publicadas. Não inclua senhas, chaves de contas de serviço ou credenciais do terminal no repositório.

### 2. Iniciar o servidor

Na raiz do projeto, usando Python:

```bash
python -m http.server 5500 --directory src
```

Acesse **http://localhost:5500**.

Como alternativa, abra `src/index.html` com o Live Server. Utilize um servidor HTTP em vez de abrir o arquivo diretamente com `file://`.

### 3. Criar a conta

1. Na tela de login, selecione **Criar uma conta para minha empresa**.
2. Informe os dados solicitados e entre no sistema.
3. Complete o cadastro da empresa.
4. Cadastre horários, cargos, departamentos, justificativas e funcionários.
5. Confira os registros em **Movimentações → Cartão ponto**.

## Organização dos dados

Cada login titular possui seu próprio espaço no Realtime Database:

```text
contas/{uidDoTitular}/
├── meta
├── empresa
├── empresas
├── funcionarios
├── cartoes
├── horarios
├── cargos
├── departamentos
├── feriados
├── justificativas
├── registros/{AAAA-MM-DD}/{idDoFuncionario}/{idDaBatida}
├── ajustes/{AAAA-MM-DD}/{idDoFuncionario}
├── desligamentos
├── usuarios
├── preferencias/{uidDoTitular}
└── config
```

O modelo atual usa **um login titular por conta empresarial**. Os cadastros de empresas e unidades pertencem a esse espaço. A lista de usuários do sistema é administrativa: ela não cria credenciais de acesso nem implementa convites para outros membros.

As operações da aplicação são relativas ao UID autenticado. A versão atual não utiliza o fallback antigo de dados globais no `localStorage`.

Dados de versões anteriores armazenados na raiz do banco precisam ser associados à conta correta. O procedimento está em [CONFIGURAR-FIREBASE.md](CONFIGURAR-FIREBASE.md).

## Regras do cartão ponto

- A **Data de Admissão** define o início do histórico do funcionário.
- Ao selecionar um funcionário, o cartão abre da admissão até a data atual. Se a admissão estiver no futuro, o período inicial fica nessa data.
- Datas anteriores à admissão aparecem como **Anterior ao cadastro**, não geram faltas nem carga prevista e ficam bloqueadas para lançamentos e justificativas.
- Dias úteis sem batidas após a admissão podem contar como faltas, inclusive em anos anteriores.
- O filtro inclui as duas datas informadas e pode atravessar meses e anos.
- A tabela do cartão apresenta até **100 dias por página**. Os totais e a exportação consideram todo o período selecionado.
- O cartão permite históricos maiores que um ano. O Relatório de cálculos mantém seu limite de **366 dias por consulta**.
- Apenas pares completos de entrada e saída entram no total de horas trabalhadas.
- As batidas manuais podem ser editadas ou excluídas individualmente. Essas ações não alteram as demais batidas do dia.

Os cálculos representam tempo de trabalho. Não implementam cálculo de remuneração ou folha de pagamento.

## Integração com ESP32 e RFID

O terminal lê o UID do cartão e utiliza o vínculo cadastrado no sistema para identificar o funcionário.

1. Leia o UID do cartão com o leitor RFID.
2. No sistema, abra **Cadastro → Funcionário** e edite o funcionário desejado.
3. Preencha o campo **UID do cartão** e salve.
4. Utilize o firmware compatível com o modelo autenticado e os caminhos desta aplicação.
5. Aproxime o cartão do terminal e confira a batida no cartão ponto.

O vínculo é armazenado em `contas/{uidDoTitular}/cartoes/{uidDoCartao}`. O índice do cartão e o cadastro do funcionário são atualizados juntos. O terminal compatível consulta esse índice e verifica se o funcionário está ativo.

O hardware utiliza o ESP32, MFRC522, display LCD I2C e os componentes de sinalização do terminal. Sensores de presença e proximidade foram retirados do fluxo de leitura.

O firmware é mantido separadamente do pacote web. Configure Wi-Fi e autenticação localmente, sem publicar credenciais. Consulte [VINCULAR-CARTAO.md](VINCULAR-CARTAO.md) para detalhes do vínculo e da compatibilidade.

## Testes

Na raiz do projeto, execute:

```bash
npm --prefix testes run test:local
```

A suíte local contém **44 testes**, cobrindo isolamento entre contas, vínculos RFID, cadastros, jornadas parciais, demissão, períodos do cartão e manutenção das batidas manuais.

Para as regras no emulador, siga a seção correspondente de [CONFIGURAR-FIREBASE.md](CONFIGURAR-FIREBASE.md). Os testes locais não substituem a validação no Firebase real, no navegador ou no hardware.

## Padrão do código

- Indentação de quatro espaços.
- Módulos JavaScript organizados por responsabilidade.
- Páginas com `view()` para renderização e `bind()` para eventos.
- Estilos centralizados em `src/style.css`.
- Comentários reservados a regras ou decisões que precisam de contexto.
- Configurações de formatação em `.editorconfig` e `.prettierrc.json`.

## Estado atual e limitações

O projeto está em desenvolvimento. A versão atual não inclui:

- Importação automática de batidas de outros sistemas.
- Múltiplos logins com acesso compartilhado à mesma empresa.
- Convites e autorização por papéis aplicada no servidor.
- Envio automático dos alertas de e-mail configuráveis na interface.
- Cobrança, processamento de pagamentos ou folha de pagamento.
- Operação web offline com sincronização posterior.

O terminal compatível utiliza as credenciais do titular e suas permissões, sem uma identidade restrita exclusiva do dispositivo. A versão de firmware descrita na documentação mantém uma batida pendente de envio, sem fila para vários registros offline.

## Documentação complementar

- [Configuração do Firebase e isolamento das contas](CONFIGURAR-FIREBASE.md)
- [Vínculo dos cartões RFID](VINCULAR-CARTAO.md)
- [Cartão ponto pela data de admissão](PONTO-POR-ADMISSAO.md)
- [Edição e exclusão de inclusões manuais](EDITAR-INCLUSAO-MANUAL.md)
- [Demissão e jornada parcial](DEMISSAO-E-HORARIO-PARCIAL.md)
- [Organização do código](CODIGO-ORGANIZADO.md)
