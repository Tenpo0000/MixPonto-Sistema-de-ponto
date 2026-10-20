# MixPonto — sistema de ponto com Firebase Spark

Sirva a raiz deste projeto por HTTP/HTTPS e abra `/src/index.html`. O sistema reúne cadastros, jornadas, cartão ponto, relatórios, justificativas, batidas manuais e registros RFID e móveis.

O mesmo login pode selecionar entre empresas autorizadas. Em **Configurações → Usuários**, o administrador concede ou bloqueia acesso pelo e-mail, sem cadastrar manualmente o UID de cada convidado no Firebase. O ID de Cadastro → Empresa é numérico e automático (1, 2, 3…), aparece no cabeçalho para copiar no aplicativo; ele acompanha os dados em `X-Empresa-ID`. O espaço interno da conta usa `X-Conta-ID`.

O Android 1.3 pede ID da empresa, e-mail e senha. As novas solicitações e autorizações móveis ficam dentro da respectiva empresa no banco. `/src/mobile.html` redireciona para o cadastro integrado.

Consulte [MULTICONTAS.md](MULTICONTAS.md) para a atualização única das regras, uso das permissões e instalação do APK.

A configuração compartilhada está em `src/fireBase_config.js`, a inicialização em `src/bootstrap.js`, as rotas em `src/app.js` e o transporte HTTP com header e assinaturas em `src/core/firebase-tenant.js`. As regras estão em `firebase/database.rules.json`.

Execute `npm run test:local --prefix testes` para verificar o site. Os testes de integração Auth/Database estão no projeto Android, em `spark`.
