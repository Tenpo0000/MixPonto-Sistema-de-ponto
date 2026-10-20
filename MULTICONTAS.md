# MixPonto 1.3 — acesso a várias contas

O site foi atualizado em `C:\Users\Laerte\Documents\GitHub\Sistema-de-ponto`. O aplicativo fica em `C:\Users\Laerte\Desktop\mixponto-android\mixponto-android`; o APK novo é `dist/MixPonto-contas-1.3-debug.apk`.

## Atualização inicial

1. Guarde as regras atualmente publicadas no Firebase. Publique o conteúdo completo de `firebase/database.rules.json` do site no Realtime Database do projeto `mixponto-ffe50`. O mesmo arquivo está em `spark/database.rules.json` no projeto Android.
2. Mantenha em `titularesAutorizados` apenas os titulares originais das contas existentes. Essa lista identifica os proprietários; usuários convidados não precisam ser adicionados a ela.
3. Atualize o site com Ctrl + F5 e entre como administrador da empresa.
4. Em **Configurações → Usuários**, salve os perfis que devem receber acesso. Para perfis já cadastrados, o botão **Ativar acessos dos perfis existentes** grava as permissões mantendo a situação e o papel de cada um. Se algum perfil estiver inválido, corrija-o antes de repetir a ativação.
5. Instale o APK 1.3. Não é necessário apagar os dados ou desinstalar a versão anterior.

Essa publicação de regras é uma atualização única do sistema. A partir dela, concessões e bloqueios por usuário são feitos pelo painel web, sem editar UIDs no Console.

## Acesso do usuário ao site

O administrador cadastra o e-mail do usuário em cada conta que deseja autorizar, com a permissão e a situação correspondentes. O mesmo e-mail pode receber acesso a várias contas existentes. O usuário mantém sua senha; o cadastro de permissões não altera sua senha.

Se ainda não tem login, a pessoa pode criar seu login na tela de acesso. Para aceitar permissões por e-mail, ela precisa confirmar esse endereço: o site oferece **Enviar confirmação de e-mail** e **Verificar meus acessos**. Isso impede que um cadastro com endereço de outra pessoa receba os convites dela.

Após entrar, o usuário escolhe a empresa. O seletor no cabeçalho permite trocar de empresa; cada troca encerra as assinaturas anteriores e recarrega os dados da conta escolhida. O cabeçalho mostra o **ID numérico da empresa para o app**, gerado automaticamente como 1, 2, 3… O usuário não escolhe nem digita esse ID no cadastro web. Se a conta contém várias empresas, escolha no segundo seletor qual ID copiar. A lista e o formulário em Cadastro → Empresa também mostram o número.

- **Administrador:** gerencia a conta, usuários e acessos móveis.
- **RH:** consulta os dados e edita os cadastros e registros operacionais, sem conceder permissões de usuários ou liberar logins móveis.
- **Visualizador:** consulta os dados operacionais e relatórios; não altera registros nem consulta senhas e usuários administrativos.

Bloquear um perfil retira o acesso somente àquela conta. As permissões em outras contas são preservadas. A exclusão ou alteração do perfil também é conferida pelas regras, não apenas pela interface.

## Numeração automática das empresas

O primeiro número é 1 e cada empresa nova recebe o seguinte, considerando todas as contas do projeto Firebase. `sequenciaEmpresas` guarda o último número. O contador, o diretório e o código da empresa são gravados juntos; as regras rejeitam disputas pelo mesmo número e o site tenta novamente. Editar uma empresa não consome número; excluir não recicla o número antigo.

Empresas existentes recebem seu número quando o administrador abre o site atualizado. Essa atribuição acontece na ordem de atualização dessas empresas, sem mover dados antigos. Não apague nem reinicie o contador no Console. Códigos alfanuméricos já publicados continuam como compatibilidade no app 1.3, mas o cabeçalho passa a mostrar somente o número.

Depois de publicar as regras desta entrega, recarregue o site com Ctrl + F5 como administrador. O mesmo APK 1.3 já aceita os IDs numéricos; não foi necessário gerar outro APK.

## Acesso no Android

O funcionário informa **ID da empresa**, **e-mail** e **senha**. Use o ID mostrado no cabeçalho do site da empresa correspondente. O aplicativo consulta o vínculo naquela conta e envia todas as operações de ponto para ela.

Os envios pendentes são separados por empresa e usuário. Um envio antigo é recuperado somente na empresa à qual pertence. Para trocar de empresa, saia da sessão e entre informando outro ID autorizado.

## Organização dos dados

```text
contas/ID_DA_CONTA/
  meta/ownerUid
  usuarios/ID_DO_PERFIL
  solicitacoesMobile/UID_DO_FUNCIONARIO
  acessosMobile/UID_DO_FUNCIONARIO
  mobileAcessos/UID_DO_FUNCIONARIO
  mobileConfig/ID_DO_FUNCIONARIO
  credenciaisApp/ID_DO_FUNCIONARIO
  batidasMobile/ID_DO_FUNCIONARIO/ID_DA_BATIDA
  controleBatidas/ID_DO_FUNCIONARIO
```

As novas solicitações, autorizações e batidas móveis ficam dentro da empresa. `credenciaisApp` mantém a cópia recuperável das credenciais pedida para consulta administrativa; visualizadores e funcionários do aplicativo não podem lê-la.

`acessosContas/EMAIL_CODIFICADO/ID_DA_CONTA` é um índice de permissões do sistema web, usado para descobrir as empresas autorizadas antes de selecionar uma conta. Não armazena batidas nem senhas. Somente administradores autorizados da empresa podem conceder ou bloquear sua entrada nesse índice.

Vínculos móveis antigos que já estavam na raiz não são apagados. O APK 1.3 consegue consultá-los como compatibilidade, somente se corresponderem à conta resolvida pelo ID da empresa informado e não houver um vínculo novo naquela empresa. Novos cadastros não criam solicitações nem vínculos na raiz. Uma revogação nova dentro da empresa prevalece sobre o vínculo antigo. Para converter um acesso existente, salve novamente o funcionário com suas credenciais atuais.

O índice `empresasPorId/ID_DA_EMPRESA` contém apenas `contaId` e `empresaId` para localizar o cadastro. Não contém solicitações, batidas ou senhas. Somente administradores da conta podem publicá-lo; o app autenticado consulta um ID conhecido, sem listar o índice. O app confere se o funcionário pertence à empresa informada. O número público fica em `codigoApp` no cadastro da empresa. As chaves internas antigas, como `-P43wVnlbXoHqjGXy1sq`, permanecem para preservar os vínculos de funcionários, feriados e históricos. O ID para informar no app é o número mostrado no cabeçalho.

## Header e isolamento

As requisições HTTP de dados usam **`X-Conta-ID`** para o espaço interno da conta e **`X-Empresa-ID`** para a empresa selecionada no site e informada no Android. O site usa REST com ETag nas transações e SSE nas assinaturas. Administradores e RH compartilham uma assinatura por empresa; visualizadores fazem consultas periódicas a cada 15 segundos nas coleções permitidas, sem ler a raiz privada.

O login global do Firebase Authentication e a descoberta das empresas precedem a seleção da conta. O ID de uma empresa não é uma senha nem concede acesso: as regras verificam a identidade autenticada, as permissões atuais e o ID no caminho do banco. Informar um header de outra empresa não permite atravessar contas.

## Verificação e limites

Foram aprovados 69 testes locais do site e 57 testes nos emuladores Auth/Database, incluindo duas empresas para o mesmo e-mail, bloqueio independente, perfis, administrador convidado, solicitações móveis por empresa, headers HTTP, transações ETag, SSE e encerramento das assinaturas. O APK 1.3 compilou com Gradle 8.11.1 e JBR 21.

Não houve publicação no Firebase, criação de usuários de produção, envio de e-mails reais, batidas reais ou instalação em aparelho. Não há celular conectado para teste físico. As validações de UID/índice/versão do RFID das regras anteriores foram preservadas e exercitadas nos emuladores.
