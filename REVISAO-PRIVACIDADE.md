# Revisão técnica das alterações — 20/10/2026

Revisão do código alterado e dos arquivos novos do site, servidor, regras e Android, com nova execução das verificações abaixo. Este relatório registra evidências e limitações; não certifica ausência de defeitos nem conformidade jurídica integral.

## Problemas encontrados e corrigidos nesta revisão

1. **Android: tentativa editada após falha de rede.** O mesmo protocolo podia continuar associado ao conteúdo anterior e impedir o envio corrigido. Agora a tentativa considera identidade, conta, tipo e conteúdo: repetir os mesmos dados conserva o protocolo; editar cria outro. Em caso de confirmação desconhecida, consultar os pedidos antes de iniciar outro requerimento.
2. **Android: identidade durante operações assíncronas.** Cada operação captura a sessão antes de entrar na fila e verifica a mesma identidade antes de buscar token, enviar e aceitar o resultado. A tela encerra ao retornar com outra sessão; cliques e retornos de rede também verificam a identidade antes de agir ou exibir resultados.
3. **Site: confirmação de protocolo existente.** Além de verificar a existência, o canal confere tipo e conteúdo. Um protocolo divergente não recebe confirmação falsa de sucesso nem limpa o formulário. Acrescentado teste negativo.
4. **Seletor de empresas: teclado e foco.** Seta para cima a partir da busca vai à última opção; selecionar uma empresa devolve o foco ao botão antes de iniciar a troca. Acrescentado teste de regressão e verificação do retorno de foco.

## Conferências realizadas

| Área | Evidência | Resultado |
| --- | --- | --- |
| Site | Suíte local, incluindo cadastro, troca de conta, convites, direitos, foco, fotos e acesso mobile | 102 testes aprovados |
| Servidor | Autenticação, origem, autorização, gestão, resposta mínima, arquivos privados e limpeza de credenciais | 20 testes aprovados |
| Firebase | Emuladores Auth/Database: isolamento, revogação, Android/RFID, relógio, regras de direitos e senhas | 72 testes aprovados |
| Android | `assembleDebug` e `lintDebug` com JDK 21 | Sucesso; zero erros e um aviso de versão mais recente do Firebase BOM |
| Sintaxe e formatação | Verificação JavaScript e `git diff --check` | Sem erros |
| Conteúdo compartilhado | JSON do site versus assets Android; regras geradas versus cópia do site | Iguais |
| Servidor local | Início, políticas, direitos e JSON público | HTTP 200 e CSP presente |

O total é **194 testes automatizados aprovados**. Compilação e lint são verificações adicionais, não testes de uso do aplicativo em aparelho. Os testes do fluxo integrado usam emuladores e módulos reais de transporte; não equivalem a executar a interface Android ou firmware em equipamento físico.

A revisão das regras confirmou pedidos originais e respostas definitivas imutáveis, consulta pessoal isolada por UID e conta, proteção contra recriação das cópias conhecidas de senha, e separação entre RH, administrador e revendedor. Nenhuma regra foi modificada ou republicada nesta revisão. A remoção das cópias no banco real pertence à ativação anterior, registrada em `PRIVACIDADE-E-RISCOS.md`.

Fotos de cadastro passam por canvas e os campos salvos só exibem imagens raster locais aceitas pelo filtro. Não foram encontrados carregadores de Analytics, pixels ou fontes remotas nas páginas revisadas. Firebase continua sendo uma dependência externa necessária. Ausência desses carregadores não representa análise de tráfego em dispositivo.

Os textos foram reconferidos com as fontes oficiais da [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [CDC](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm) e [W3C sobre contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum). Continuam preliminares, sem inventar responsável, contato, cobrança, avaliação ou certificação. A verificação de cores não certifica todas as combinações possíveis de telas, estados e conteúdo enviado por usuários.

## Entrega revisada

Android **1.7.1**, código **8**. APK: `C:\Users\Laerte\Desktop\mixponto-android\mixponto-android\dist\MixPonto-privacidade-1.7.1-debug.apk`.

SHA256: `A6BDC78FBDAFD078E9A79D8FB594FCED502F604215CA9F9931186C89D9CFFA20`.

O APK 1.7 anterior foi preservado; instalar o 1.7.1 para receber as correções desta revisão. Os textos jurídicos compartilhados continuam na versão 2026-10-20.1.

## Limites e pendências reais

- Faltam testes de uso em aparelho, rotação durante falha de rede, TalkBack, teclado real, zoom e navegação visual completa no navegador. Não foram simulados nesta revisão como se tivessem ocorrido.
- Nome e canal real do responsável continuam ausentes. A análise jurídica de operação comercial, retenção, contratos, transferência internacional, suporte central e registro oficial de jornada permanece necessária. Detalhes em `PRIVACIDADE-E-RISCOS.md`.
- A criação de contas usa transação global e a descoberta percorre metadados das contas. A autorização é conferida a cada operação, mas não houve teste de carga para um banco grande; essa arquitetura exige evolução antes de prometer escala ilimitada.
- Backups históricos podem conter dados e cópias antigas de senha. Esta revisão não os leu nem apagou. Não foi feita rotação de chaves ou de senhas de usuários.
- O APK é de validação, assinado para debug. Publicação comercial exige processo e assinatura próprios.
