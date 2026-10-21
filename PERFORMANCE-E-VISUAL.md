# Troca de contas e gestão — otimização

Mudanças feitas em 20/10/2026.

- A troca usa `/api/contas/{idInterno}` para verificar somente o destino. O servidor sempre consulta as permissões atuais; o identificador recebido não concede autorização.
- A indicação de troca é temporária, vinculada ao UID e descartada após o uso ou 60 segundos. Não contém dados nem permissões armazenadas. Um login normal continua aceitando convites e descobrindo as contas disponíveis.
- A lista completa é atualizada em segundo plano após abrir o ambiente escolhido. Não há consulta de convites no caminho da troca nem leitura duplicada dos metadados pelo navegador.
- As leituras independentes no servidor são paralelas, com limite de oito contas por lote. Nenhum índice global novo foi criado.
- Na gestão, abrir os detalhes consulta apenas a conta escolhida. Os contadores já exibidos são reutilizados nessa navegação; as permissões dos detalhes continuam validadas no servidor. Salvar uma alteração ou reabrir a gestão atualiza o resumo.
- O seletor tem pesquisa por nome/ID, empresa ativa destacada, navegação por setas, Escape e fechamento ao clicar fora. Nomes são inseridos como texto para impedir interpretação de HTML.
- O CSS da gestão inclui indicadores, cartões, formulários, botões de revogação e layouts para celular. A tela inicial de escolha também mostra o ID da empresa.

## Medição

Consulta administrativa de leitura no Firebase real, com três contas autorizadas:

| Caminho medido | Tempo observado | Leituras no banco |
| --- | ---: | ---: |
| Busca completa anterior | 1.353 ms | 10 |
| Busca completa otimizada | 1.392 ms | 8 |
| Conta de destino, caminho novo da troca | 413 ms | 2 |

Os tempos são amostras de consulta ao banco, sujeitas à rede, e não representam o carregamento completo da interface. O ganho principal é retirar a busca completa e a aceitação de convites do caminho que bloqueava a troca.

## Validação

88 testes locais do site e 16 do servidor, incluindo o novo endpoint, revogação, tentativas de atravessar contas, pesquisa e teclado do seletor. Os 67 testes dos emuladores também passaram; os testes de descoberta e gestão foram repetidos após a paralelização final.

O servidor local foi atualizado na porta 8787. Não houve alteração em dados ou regras do Firebase. Não foi feita inspeção visual interativa nem teste em dispositivo físico nesta alteração.
