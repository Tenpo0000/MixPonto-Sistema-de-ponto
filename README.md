# MixPonto — Sistema de Ponto

Sistema web para gerenciar funcionários, jornadas e registros de ponto em ambientes separados por conta. Integra-se ao aplicativo Android MixPonto e ao terminal RFID.

O mesmo usuário pode acessar várias contas autorizadas com seu próprio login. Cada conta possui um ID numérico público, exibido no cabeçalho do site e utilizado no login do aplicativo.

> **Em desenvolvimento.** O projeto não declara certificação como registrador eletrônico de ponto nem conformidade jurídica ou de acessibilidade integral. Os documentos de privacidade são preliminares e precisam receber a identificação e o contato real do responsável antes de uma oferta comercial.

## Recursos

- Login com Firebase Authentication e seleção das contas autorizadas.
- Gestão de contas, revendedores, acessos por e-mail e convites.
- Perfis de administrador, RH e visualizador.
- Cadastro de empresas/unidades, funcionários, cargos, departamentos e horários.
- Feriados, justificativas, desligamentos e reativações.
- Cartão de ponto, relatórios de cálculos e exportações.
- Integração de batidas do aplicativo Android e terminal RFID.
- Configuração e revogação do acesso mobile no cadastro do funcionário.
- Histórico de ações de gestão por conta.
- Políticas públicas e canal autenticado de solicitações de privacidade.
- Recursos de teclado, foco visível e tratamento de movimento reduzido no site.

## Tecnologias

| Camada | Implementação |
| --- | --- |
| Interface | HTML, CSS e JavaScript com módulos ES |
| Serviço web/API | Node.js e Firebase Admin SDK |
| Autenticação | Firebase Authentication com e-mail e senha |
| Banco | Firebase Realtime Database com regras por conta |
| Validação | Testes nativos do Node.js e integração com emuladores Firebase |
| Aplicativo integrado | Android nativo em Kotlin, mantido em projeto separado |

O frontend não exige uma etapa de compilação. O servidor Node entrega os arquivos públicos e executa as APIs de descoberta e gestão. As bibliotecas Firebase do navegador são carregadas de `gstatic.com`.

## Executar localmente

### 1. Preparar o ambiente

- Node.js **22 ou superior**, com npm.
- Projeto Firebase com Authentication por e-mail/senha habilitado e Realtime Database configurado.
- Credencial administrativa do Firebase disponível **somente ao servidor**, fora do repositório e da pasta pública.

Clone o projeto e instale as dependências do serviço:

```powershell
git clone https://github.com/Tenpo0000/Sistema-de-ponto.git
cd Sistema-de-ponto
npm ci --prefix servidor
Copy-Item servidor/.env.example servidor/.env
```

### 2. Configurar o Firebase

Edite `servidor/.env` com os valores do seu ambiente. Exemplo de preenchimento, com dados fictícios:

```dotenv
FIREBASE_PROJECT_ID=seu-projeto-firebase
FIREBASE_DATABASE_URL=https://seu-projeto-default-rtdb.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS=C:/credenciais/firebase-admin.json
PORT=8787
HOST=127.0.0.1
ALLOWED_ORIGINS=http://127.0.0.1:8787,http://localhost:8787
PLATFORM_ADMIN_EMAIL=admin@seudominio.com
PLATFORM_ADMIN_UIDS=
RESELLER_UIDS=
```

Também ajuste a configuração pública do mesmo projeto em [`src/fireBase_config.js`](src/fireBase_config.js). Se integrar o Android ou RFID, configure esses projetos para usar o mesmo ambiente.

Publique no Realtime Database as regras de [`firebase/database.rules.json`](firebase/database.rules.json), após revisá-las para o ambiente. Não substitua as regras por acesso público para resolver erros de permissão.

**O JSON de exportação do banco não é uma credencial administrativa.** A chave de serviço é um arquivo diferente, emitido para uma conta de serviço do Firebase/Google Cloud.

### 3. Iniciar o site

```powershell
cd servidor
npm start
```

Abra **[http://127.0.0.1:8787/src/index.html](http://127.0.0.1:8787/src/index.html)**.

O comando carrega automaticamente `servidor/.env`, quando existente. Reinicie o processo após alterar essa configuração.

> Live Server, GitHub Pages ou abrir o HTML diretamente não executam as APIs Node. O login e a descoberta de contas dependem do serviço `/api/contas` disponível.

### 4. Configurar o administrador inicial

1. Crie seu login na tela de acesso e confirme o e-mail.
2. Confira o UID desse usuário em **Firebase Authentication → Usuários**.
3. Defina esse UID em `PLATFORM_ADMIN_UIDS` e o e-mail correspondente em `PLATFORM_ADMIN_EMAIL`, no `.env` do servidor.
4. Reinicie o servidor e abra **Gestão de contas** para criar a primeira conta.
5. Gerencie os acessos dos demais usuários pelo painel. Eles precisam confirmar seus próprios e-mails para acessar contas compartilhadas.

`PLATFORM_ADMIN_UIDS` e `RESELLER_UIDS` aceitam UIDs separados por vírgula e são configurações confiáveis do servidor. Não receba esses papéis de campos enviados pelo navegador.

## Contas, empresas e acesso mobile

Há três identificadores com funções diferentes:

| Identificador | Finalidade |
| --- | --- |
| UID do usuário | Identificar a pessoa no Firebase Authentication |
| ID interno da conta | Isolar os dados em `contas/{contaId}` |
| ID numérico público (`codigoApp`) | Identificar a conta no cabeçalho e no login mobile |

Uma conta pode conter cadastros de empresas/unidades. Criar uma unidade dentro da conta **não gera outro ID de login mobile**. O número público é sequencial por criação de conta.

Para liberar o aplicativo, selecione a conta no site, abra **Cadastro → Funcionário**, defina e-mail e senha e salve. O funcionário informa o **ID numérico da conta**, e-mail e senha no Android.

O e-mail permanece no cadastro. A senha é processada pelo Firebase Authentication e não é mantida em cópia recuperável no Realtime Database. Deixar os campos de senha vazios conserva um vínculo existente; a revogação usa a ação específica do cadastro.

## Organização dos dados

Estrutura simplificada; os nomes abaixo são exemplos:

```text
contas/
  {contaId}/
    meta/                    # Titular, nome e código público
    empresas/                # Empresas/unidades desta conta
    funcionarios/
    registros/
    batidasMobile/
    acessosContas/
    acessosMobile/
    solicitacoesMobile/
    titularesAutorizados/
    usuarios/
    convites/
    auditoria/
    privacidade/
contasPorId/
  {numero}/
    contaId                  # Referência ao ambiente interno
sequenciaContas               # Contador global de contas
```

Permissões, vínculos e dados operacionais ficam dentro de cada conta. O diretório numérico serve para localizar o ambiente; conhecer um ID não concede acesso aos dados.

## Estrutura do repositório

```text
src/
  index.html                 # Entrada do sistema
  bootstrap.js               # Login e seleção da conta
  app.js                     # Navegação e assinaturas de dados
  core/                      # Regras compartilhadas, transporte e estado
  pages/                     # Telas de cadastro e movimentações
  legal/                     # Políticas e canal de direitos
  politicas.html             # Documentos públicos
  direitos.html              # Solicitações de privacidade
servidor/
  server.mjs                 # Inicialização do serviço
  http.mjs                   # Rotas, arquivos públicos e cabeçalhos
  descoberta.mjs             # Contas autorizadas para o usuário
  gestao.mjs                 # Regras de gestão de contas
  gestao-service.mjs         # Integração administrativa com Firebase
  test/                      # Testes do serviço
firebase/
  database.rules.json        # Regras de acesso ao banco
testes/                      # Testes locais do site
```

Para manutenção, preserve a separação entre interface, regras de negócio e acesso ao banco. Operações assíncronas precisam respeitar a sessão e a conta em que foram iniciadas. Transações podem repetir seus callbacks; evite efeitos externos dentro deles.

## Testes

Na raiz do repositório:

```powershell
npm run test:local --prefix testes
npm test --prefix servidor
```

Os testes de integração Auth/Database e Android/RFID estão no projeto Android separado, na pasta `spark`; não fazem parte deste checkout. As suítes acima verificam o site e o serviço; não substituem testes em aparelho, teclado real ou leitor de tela.

## Privacidade e segurança

- Nunca envie chaves administrativas, `.env`, exportações reais do banco ou dados pessoais para o GitHub.
- O servidor administrativo deve permanecer separado dos arquivos públicos de `src`.
- Use HTTPS e configure origens exatas em `ALLOWED_ORIGINS` na implantação.
- O serviço Node precisa de hospedagem própria; o plano Spark do Firebase não hospeda esse processo. O projeto não depende de Cloud Functions.
- Solicitações de privacidade não apagam automaticamente registros trabalhistas. A empresa responsável deve analisar e responder.
- A versão atual não instala Analytics ou pixels publicitários. O aviso explica o armazenamento necessário ao funcionamento.

Os textos compartilhados ficam em [`src/legal/politicas.json`](src/legal/politicas.json). Preencha a identificação real do responsável e revise os documentos antes de comercializar. Para atualizar a cópia Android, use o script de sincronização existente naquele projeto.

## Documentação e limites

- [Textos de privacidade, termos e acessibilidade](src/legal/politicas.json)
- [Página pública de políticas](src/politicas.html)
- [Canal de solicitações de privacidade](src/direitos.html)
- [Configuração do serviço](servidor/README.md)

A descoberta percorre metadados das contas, e a criação usa uma transação global para manter contador e diretório consistentes. Essas escolhas precisam ser reavaliadas conforme o volume crescer. Não há promessa de escala ilimitada, disponibilidade garantida ou certificação REP-P/WCAG/LGPD. Testes automatizados não substituem validação em dispositivos e análise jurídica aplicável ao uso real.

Antes da operação comercial, também precisam ser definidos atendimento, retenção e descarte de dados, proteção de backups, contratos e condições de transferência internacional. O acesso central de suporte e os requisitos para uso como registro oficial de jornada exigem avaliação específica.

## Licença

Código disponibilizado sob a [licença MIT](LICENSE). Dependências e conteúdos enviados por usuários mantêm suas próprias condições e direitos.
