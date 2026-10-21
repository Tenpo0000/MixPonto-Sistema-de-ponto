# Privacidade, acessibilidade e riscos — 20/10/2026

Revisão posterior: consultar `REVISAO-PRIVACIDADE.md`, com correções adicionais, 194 testes aprovados e APK Android 1.7.1/código 8. Os registros de ativação abaixo preservam os resultados da entrega inicial.

## Situação da entrega

Esta é uma implementação técnica e uma análise preliminar, não um parecer jurídico ou certificado LGPD/WCAG/REP-P. O usuário informou que ainda não tem empresa e que os dados do responsável estão em branco. Por isso os textos públicos exibem claramente **preliminar** e não inventam identificação, contato, faturamento ou promessa comercial. Uma pessoa física também pode ter obrigações de proteção de dados; não se presume isenção por ausência de CNPJ.

As políticas ficam em `src/legal/politicas.json`, fonte única para site e Android. Há documentos de privacidade, termos, armazenamento/cookies, cancelamento/reembolso, exercício de direitos, acessibilidade e licenças. Antes de qualquer oferta real, identificar o responsável, disponibilizar contato verdadeiro, revisar o texto e definir as condições do serviço.

## Correções técnicas

- Senha de funcionário não é mais persistida no RTDB nem reexibida no cadastro. É usada somente para criar/autenticar a identidade no Firebase Authentication. O formulário mantém o e-mail e permite conservar o vínculo deixando a senha vazia. Senhas de contas existentes não são redefinidas silenciosamente.
- O script `servidor/ativar-privacidade.mjs` publica regras que impedem a recriação de cópias e remove as cópias antigas mediante `--aplicar`, com relatório sem valores secretos. Não cria um novo backup de senhas. As regras anteriores são preservadas. Backups antigos na Área de Trabalho podem continuar contendo dados e senhas legadas: revisar, restringir acesso, definir retenção e descarte seguro. Esta tarefa não apaga backups históricos sem delimitar seu conteúdo e necessidade.
- Solicitações de privacidade ficam em `contas/{contaId}/privacidade/{uid}/{protocolo}`. São autenticadas, sem CPF/documento/data de nascimento. O pedido original não pode ser reescrito nem apagado por clientes; um administrador operacional autorizado pode registrar uma resposta definitiva, que também não pode ser sobrescrita ou removida por clientes. O titular acompanha apenas seus pedidos. Revendedor comercial sem acesso operacional não pode consultar esses textos.
- Funcionários com vínculo inativo ainda podem exercer direitos. Solicitação não executa eliminação automática de registros trabalhistas nem promete atendimento automático. Administradores devem consultar a fila, tratar o pedido e informar uma resposta fundamentada. Sem vínculo ou login, há modelo para download local e orientação para buscar a empresa empregadora; o canal público da plataforma ainda depende de configuração real.
- RH deixa de ler toda a raiz privada. Consulta as coleções operacionais permitidas e não os requerimentos de terceiros. Regras do Firebase continuam autorizando cada operação.
- CPF do funcionário e dados fiscais/de contato da empresa são opcionais no cadastro inicial; o nome identifica a empresa no ambiente. Matrícula, admissão e vínculos necessários ao cálculo de jornada foram preservados. Foto é opcional, redimensionada em canvas e não usada para reconhecimento facial nesta versão.
- Fontes externas foram retiradas. Não foram instalados analytics, pixels, anúncios ou gravação de sessões. O aviso descreve armazenamento necessário, sem fingir consentimento de publicidade. Inserções futuras precisam de avaliação e controle específico antes da coleta.
- Fotos exibidas são restritas a formatos raster locais; URLs externas e SVG em cadastros não são usados como pixels. Não houve inclusão de imagens de banco comercial ou avaliações de clientes.
- O servidor acrescenta políticas de recursos, bloqueio de enquadramento e de referência, além de CSP. Bibliotecas Firebase continuam necessárias ao login. A CSP permite estilos inline existentes, portanto não representa isolamento absoluto contra todo tipo de injeção.

## Operação da fila de direitos

No rodapé do site, abrir **Solicitações LGPD**. Informar o ID numérico e usar o próprio login. É possível registrar e consultar protocolo/resposta. Na mesma página, administradores da conta consultam os pedidos daquela conta e registram resposta. A submissão repetida após falha de rede consulta o mesmo protocolo, evitando duplicação. O texto da tentativa não é persistido no armazenamento local do navegador.

Se a API de gestão estiver indisponível, a consulta web usa somente o caminho pessoal do usuário autenticado. Ela nunca tenta abrir pedidos de terceiros como alternativa. Trocas de sessão descartam resultados e formulários anteriores; respostas administrativas verificam novamente a sessão e a conta antes de gravar.

No Android, **Privacidade, termos e meus direitos** aparece na tela de login, no painel e nas telas de status. Políticas funcionam sem internet. O formulário usa a identidade autenticada e o ID informado, separadamente do vínculo ativo para bater ponto. O aplicativo não solicita câmera, microfone, localização ou contatos para esse canal.

O protocolo não substitui o processo de atendimento: é necessário monitorar a fila, verificar identidade proporcionalmente, localizar dados em outros sistemas, fornecer cópia por canal seguro quando cabível e fundamentar retenção/recusa. A aplicação não integra um serviço de e-mail de notificação de pedidos.

## Riscos que continuam exigindo decisão real

| Prioridade | Ponto | Ação necessária |
| --- | --- | --- |
| Alta | Identificação e contato ausentes | Definir responsável real, canal de atendimento, papéis de controlador/operador e contratos antes de comercializar. |
| Alta | Acesso central automático em contas novas | Justificar finalidade de suporte, informar clientes, restringir acesso e avaliar se deve exigir autorização específica. O aviso atual torna essa característica explícita; não legitima automaticamente esse acesso. |
| Alta | Uso como registro oficial de jornada | Validar Portaria MTP 671 e demais normas aplicáveis, arquivos/documentos exigidos, assinaturas e responsabilidades. Não foi verificado registro de programa no INPI nem emitido atestado técnico. O limite atual de cinco minutos entre batidas e poderes de ajuste/exclusão merecem avaliação antes de uso oficial: não se presume conformidade por ter relatório ou RFID. |
| Alta | Dados em infraestrutura internacional | Confirmar região, fornecedores, subprocessadores, contratos e mecanismo de transferência internacional aplicável. O banco atual foi originalmente configurado nos EUA; não afirmar hospedagem exclusivamente brasileira. |
| Alta | Backups, chaves e incidentes | Proteger chave de serviço fora da pasta pública e do Git; limitar acesso aos backups e definir retenção. Criar plano de resposta a incidentes e avaliar comunicação nos termos da regulamentação, sem confundir correção técnica com inexistência de incidente. |
| Alta | Justificativas e saúde | Evitar diagnóstico/CID/documentos em campos livres sem necessidade. Se houver dado sensível, avaliar a hipótese do art. 11 e controles proporcionais. |
| Média | Retenção e eliminação | Definir tabela por categoria/finalidade, responsabilidades e revisão. Não fixar um prazo único para todos os dados nem apagar pontos ao revogar login. |
| Média | Cancelamento/reembolso | Não há checkout. Antes de cobrar, definir oferta real, confirmação e atendimento; preservar o art. 49 do CDC quando aplicável, sem renúncia genérica em contratos entre empresas. |
| Média | Direitos autorais e imagem | Inventário técnico não comprova licença das fotos enviadas. Verificar autorização, finalidade e direitos de imagem; manter licenças de dependências. A licença MIT do código foi preservada. |
| Média | Acessibilidade | Complementar testes automatizados com teclado real, TalkBack/leitor de tela, zoom e tamanho de fonte. Não usar selo de conformidade sem auditoria. |

As conclusões sobre adequação comercial e trabalhista são pontos de atenção decorrentes da arquitetura, não certificação ou conclusão jurídica definitiva.

## Acessibilidade implementada e seus limites

Foco visível, link para o conteúdo, contenção de foco e Escape nas sobreposições, restauração do foco ao fechar, controles rotulados, mensagens de status, alternativa textual adequada às fotos informativas e texto vazio nas decorativas/redundantes. O aviso de armazenamento fica no fluxo da página para não encobrir o foco. Novos textos e botões principais têm pares de cores testados com contraste mínimo 4,5:1. Movimento reduzido respeita a preferência do sistema.

No Android, rótulos são associados aos campos, botões principais adaptam altura ao texto, não há descrição de imagem inexistente e o texto usa unidades escaláveis. Não foi feita auditoria visual de todas as telas antigas nem validação em dispositivo físico. Esses limites impedem afirmar conformidade WCAG integral.

## Manutenção e sincronização

1. Editar os textos e os dados reais do responsável em `src/legal/politicas.json`. Usar versão nova em mudanças relevantes. Não preencher identificação fictícia.
2. No projeto Android, executar `node scripts/sync-legal.mjs`. `MIXPONTO_SITE_ROOT` permite indicar outro caminho do site. A cópia em `app/src/main/assets/politicas.json` não deve ser editada isoladamente.
3. Compilar Android com JDK 21 e executar `:app:assembleDebug :app:lintDebug`. Nova versão: 1.7, código 7.
4. Publicar código do site pelo servidor Node e as regras verificadas. `node --env-file=.env ativar-privacidade.mjs PASTA_NOVA --aplicar` não altera senhas do Firebase Authentication nem remove pontos.
5. Antes de produção comercial, revisar política, infraestrutura, papéis, contratos, acessibilidade e processo de atendimento. Desenvolvimento e operação precisam permanecer coerentes com os textos.

## Validação e ativação concluídas

- Site: 100 testes locais aprovados. Servidor: 20 testes aprovados. Regras: 72 testes aprovados nos emuladores, incluindo Android/RFID, isolamento, revogação, direitos pessoais, imutabilidade de resposta e proibição de cópias de senha.
- Android 1.7/código 7: compilação e lint aprovados com JDK 21, zero erros e um aviso sobre disponibilidade de versão mais recente do Firebase BOM. Textos internos do APK conferidos contra a fonte compartilhada. Não houve teste físico ou inspeção visual interativa.
- Na primeira ativação, uma cópia de senha foi removida. A ativação final publicou as regras testadas e reconsultou todas as três contas após bloquear novas gravações: nenhuma cópia nem campo legado conhecido permaneceu. Senhas do Authentication e registros de ponto não foram alterados. Isso não elimina cópias em backups históricos.
- O script foi corrigido para inventariar depois de publicar o bloqueio e verificar novamente todas as contas ao terminar, eliminando a corrida com clientes antigos. Relatórios contêm regras e contagens, sem valores de credenciais. A pasta pública é rejeitada como destino.
- Regras anteriores, novas e relatório final local: `servidor/relatorios-privacidade/ativacao-final-2026-10-20/`. Pasta ignorada pelo Git e não servida pelo site.
- Servidor local reiniciado em `http://127.0.0.1:8787/src/index.html`. Páginas de políticas, pedidos e JSON público responderam com sucesso e cabeçalhos de privacidade. Arquivos privados permaneceram indisponíveis nos testes HTTP. Funcionamento completo em navegador e auditoria WCAG não foram certificados.
- APK de validação: `C:\Users\Laerte\Desktop\mixponto-android\mixponto-android\dist\MixPonto-privacidade-1.7-debug.apk`. SHA256: `6294E1DB65D77EBE06144BA6D9249EBAD4886E7F4D81E735FBCB9A0ED59107E3`.

## Referências oficiais consultadas

- [LGPD, especialmente necessidade, direitos, bases e segurança](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
- [CDC, incluindo art. 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm).
- [Guia ANPD de cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).
- [ANPD — Resolução 19/2024, transferências internacionais](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024).
- [ANPD — comunicação de incidentes](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis).
- [MTE — perguntas sobre registro eletrônico de ponto](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP).
- [W3C — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).

Textos redigidos para o funcionamento observado, sem copiar políticas comerciais de terceiros.
