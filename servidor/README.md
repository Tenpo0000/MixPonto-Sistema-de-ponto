> Para a visão atual do sistema, instalação e gestão de contas, consulte o [README principal](../README.md). A API retorna `codigoApp` dos metadados da conta; unidades internas não recebem códigos de login.

# Descoberta automática de contas — MixPonto 1.4

Este serviço permite selecionar as empresas autorizadas em qualquer dispositivo sem guardar `acessosContas` na raiz do Realtime Database. Ele valida o ID token do Firebase Authentication, inclusive revogação/desativação, e consulta somente permissões e metadados dentro de cada conta. Retorna apenas ID interno, nome, papel e indicação de titular. O navegador continua sujeito às regras do banco em toda operação.

## Configurar e executar

Requer Node.js 22 ou superior e credenciais administrativas do projeto `mixponto-ffe50`, disponíveis somente ao servidor. Não coloque a chave no código do site, no APK ou no Git. Mantenha o arquivo fora da pasta publicada.

```powershell
cd C:\Users\Laerte\Documents\GitHub\Sistema-de-ponto\servidor
npm ci
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\caminho-fora-do-site\credencial-administrativa.json'
npm start
```

Abra `http://127.0.0.1:8787/src/index.html`. Esse servidor entrega os arquivos públicos de `src` e as APIs de contas e gestão. O Live Server da porta 5501, sozinho, não executa essas rotas. O arquivo `.env.example` documenta as variáveis; copie-o para `.env` para carregá-las automaticamente com `npm start`.

Para produção, hospede esse processo Node com HTTPS, configure `HOST`, `PORT`, `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL` e `ALLOWED_ORIGINS` (origens exatas, separadas por vírgula). A hospedagem do serviço é separada do plano Spark do banco; o código não usa Cloud Functions.

Se o site e a API tiverem endereços diferentes, preencha a meta `mixponto-contas-api` em `src/index.html` com a URL completa, por exemplo `https://api.seudominio.com/api/contas`, e autorize a origem do site em `ALLOWED_ORIGINS`. Na mesma origem, deixe a meta vazia.

## Comportamento e limites

- A API não recebe e-mail ou UID escolhidos pelo cliente. A identidade vem exclusivamente do token validado.
- Titulares precisam estar autorizados em `contas/{contaId}/titularesAutorizados/{ownerUid}`.
- Convidados precisam confirmar o e-mail e ter índice e perfil ativos e coerentes naquela conta.
- Não existe fallback para os quatro nós legados da raiz. Sem serviço disponível, o site informa a configuração pendente.
- A listagem de IDs é superficial; as leituras seguintes buscam apenas metadados, autorização e o perfil correspondente. Nenhuma leitura de funcionários, senhas ou batidas participa da descoberta.
- O trabalho de descoberta cresce com o número de contas, já que não existe um índice global de permissões. São consultadas até oito contas por vez e os resultados não são armazenados como autorizações em cache.
- Credenciais padrão de aplicações também podem ser fornecidas pelo ambiente da hospedagem. Não disponibilize ao navegador endpoints administrativos genéricos.

Referências: [validação de ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [checagem de revogação](https://firebase.google.com/docs/auth/admin/manage-sessions), [leitura superficial por REST](https://firebase.google.com/docs/database/rest/retrieve-data).

Execute `npm test` nesta pasta. Os testes com Auth/Database reais em emuladores estão no projeto Android em `spark/test/discovery.test.mjs`.
