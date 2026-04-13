# Ciclo de Vida Completo do Torneio (beScore)

## Objetivo deste documento
Este documento descreve, em detalhes, todo o ciclo de vida do torneio no app beScore: criação, lobby, geração de partidas, execução, classificação, playoff, cancelamento/exclusão e pontos de integração entre estado global, serviços e UI.

---

## 1. Visão Geral do Fluxo

1. Usuário autenticado entra em `LoggedIn`.
2. Usuário navega para `CreateTournament`.
3. Torneio é criado com status `draft`.
4. Criador e demais jogadores entram no torneio (participantes).
5. Tela `TournamentLobby` administra inscrições e configuração.
6. Criador gera partidas via `TournamentConfig` + `matchGenerationEngine`.
7. Torneio muda para status `active`.
8. Tela `TournamentMatch` conduz rodadas, placares e classificação.
9. Em `campeonato`, ao fim da liga, criador pode gerar fase final (playoff).
10. Torneio pode seguir até conclusão esportiva (todas partidas) ou ser cancelado/excluído conforme regras.

---

## 2. Camadas e Responsabilidades

## 2.1 Estado Global (Jotai)
Arquivo central: `src/atoms/tournamentAtoms.ts`.

Principais átomos:
- `currentViewAtom`: controla navegação interna (`dashboard`, `tournament-lobby`, `tournament-match`, etc.).
- `activeTournamentAtom`: torneio atualmente selecionado.
- `myTournamentsAtom`: lista de torneios do usuário.
- `activeTournamentTabAtom`: aba ativa em telas com tabs (`matches`/`standings`).
- `tournamentsErrorAtom` / `tournamentsLoadingAtom`: sinais globais de erro/carregamento.
- `recentPlayersAtom`: jogadores recentes via conexões.

## 2.2 Orquestração de Telas
`src/screen/LoggedIn/LoggedIn.tsx` faz o roteamento por estado:
- `dashboard`
- `tournament-lobby`
- `tournament-match`
- `create-tournament`
- `join-by-code`

## 2.3 Serviços
- `src/lib/tournamentService.ts`: criação/entrada/listagem/participantes/cancelamento/exclusão/conexões.
- `src/lib/matchGenerationEngine.ts`: geração de calendário por formato e playoff.
- `src/lib/matchService.ts`: leitura de partidas, atualização de placar, classificação.

---

## 3. Modelo de Status do Torneio

Status usados no ciclo:
- `draft`: torneio criado, ainda sem calendário definitivo.
- `active`: partidas geradas e torneio em andamento.
- `cancelled`: encerramento administrativo forçado.

Observação:
- Exclusão (`deleteTournament`) remove registros do torneio (com limpeza de dependências).

---

## 4. Fase de Criação (`CreateTournament`)

Arquivo principal: `src/screen/CreateTournament/CreateTournament.tsx`.

## 4.1 Entrada de dados de criação
Campos relevantes:
- nome do torneio
- formato (liga / mata-mata / grupos / campeonato)
- game type
- limite de participantes
- privacidade
- ida/volta (`matchType: single/double` => `hasReturnMatch`)
- regras de playoff para campeonato (`top2`/`top4`)
- modo de times (pool pré-selecionado / atribuição)

## 4.2 Mapeamento de formato da UI para engine
Função `mapCreateFormatToTournamentFormat` converte:
- `liga` -> `roundRobin`
- `mata-mata` -> `knockout`
- `grupos` -> `groupsCrossed`
- `campeonato` -> `campeonato`

## 4.3 Persistência inicial
`createTournament(...)` grava:
- `status: draft`
- `invite_code` (6 caracteres alfanuméricos)
- `settings` iniciais (quando fornecidas)

## 4.4 Inscrição automática do criador (opcional)
Se `willPlay` for verdadeiro, o criador é inserido em `participants` via `joinTournamentById`.

## 4.5 Pós-criação
- Recarrega `myTournaments`.
- Busca torneio enriquecido via `getTournamentById`.
- Define `activeTournament`.
- Redireciona para visão de torneio.

---

## 5. Fase de Lobby (`TournamentLobby`)

Arquivo principal: `src/screen/TournamentLobby/TournamentLobby.tsx`.

## 5.1 Objetivo
Gerenciar o período de preparação antes de iniciar partidas:
- participantes
- entrada por código
- bloqueios de lotação/privacidade
- abertura de modal de configuração de partidas

## 5.2 Cálculos e permissões
- `isCreator`: compara `creator_id` com usuário logado.
- `isPrivate`, `maxParticipants`, `isFull` via `settings`.
- `isParticipant` e `isVisitor` para definir UX de entrada.

## 5.3 Entrada de visitantes
Fluxos:
- aberto: botão direto para entrar.
- privado: exige código idêntico ao `invite_code`.

## 5.4 Ações administrativas no draft
- abrir `TournamentConfig` quando há participantes suficientes.
- editar participante (modal de gerenciamento).
- excluir torneio (`deleteTournament`) ainda no lobby.

## 5.5 Transição para fase ativa
Após gerar partidas com sucesso:
- atualiza torneio local para `active`.
- fecha modal de configuração.
- muda `currentView` para `tournament-match`.

---

## 6. Geração de Partidas (`TournamentConfig` + Engine)

`TournamentConfig` chama `generateMatchesByFormat(tournamentId, format, settings)`.

## 6.1 Pré-condições
- pelo menos 2 participantes.
- todos os participantes com time definido no contexto da configuração.
- validação de formato por quantidade de participantes.

## 6.2 Processo da engine
Em `generateMatchesByFormat`:
1. valida torneio e busca participantes.
2. valida compatibilidade do formato (`validateSettingsForFormat`).
3. gera partidas por estratégia do formato.
4. insere partidas em `matches`.
5. atualiza torneio para `status: active` e mescla settings.

## 6.3 Estratégias por formato

### Round Robin (`roundRobin` e `campeonato`)
- usa método de rotação (circle method).
- gera rodadas reais (`round = 1..N`).
- com ida/volta, gera espelho invertendo mandos e somando `N` ao round.

### Knockout (`knockout`)
- monta chave para próxima potência de 2.
- suporta BYEs.
- pode adicionar jogos de volta via `addReturnLegs`.

### Groups Crossed (`groupsCrossed`)
- divide em grupos.
- cada grupo enfrenta outro(s) conforme regra cruzada.
- suporte opcional a ida/volta.

### Mixed (`mixed`)
- combina fase de grupos + mata-mata com classificados.
- ajusta `round` da fase eliminatória para sequência após grupos.

---

## 7. Fase Ativa (`TournamentMatch`)

Arquivo principal: `src/screen/TournamentMatch/TournamentMatch.tsx`.

## 7.1 Objetivo
Operação do torneio em andamento:
- visualizar rodadas e partidas.
- lançar/editar placares (via `MatchCard`).
- acompanhar classificação (`StandingsTable`).
- administrar participantes e cancelamento (criador).

## 7.2 Carregamento e agrupamento
- busca paralela de participantes e partidas.
- agrupamento por rodada (`matchesByRound`).
- estado de accordion por rodada (`openRound`) e card expandido (`expandedMatchId`).

## 7.3 Comportamento do accordion
- inicializa com primeira rodada pendente.
- respeita estado “tudo colapsado” quando usuário fecha manualmente.
- usa componente genérico `Accordion` em `src/components/Accordion`.

## 7.4 Turno/Returno
Quando `hasReturnMatch` está ativo:
- filtro `first` (turno) / `second` (returno).
- lógica especial para `campeonato` baseada no total de rodadas de liga.

## 7.5 Atualização de placar
`updateMatchResult(matchId, homeScore, awayScore)`:
- persiste placar.
- muda status da partida para `finished`.
- força refresh da tela para recálculo de pendências e classificação.

---

## 8. Classificação (`matchService`)

Função: `getTournamentStandings(tournamentId, roundFilter?)`.

Cálculo:
- inicializa todos participantes com zero.
- processa somente partidas `finished`.
- atualiza vitórias/empates/derrotas, gols pró/contra e pontos.
- aplica `penalty_points` (pontos administrativos).
- ordena por pontos e saldo.
- define posição final.

---

## 9. Campeonato + Fase Final (Playoff)

Função: `generatePlayoffMatches(tournamentId)`.

## 9.1 Regras
- lê `playoffCutoff` de `settings` (padrão 2).
- identifica próxima rodada livre (`nextRound = maxRound + 1`).
- busca classificação atual.
- cria confrontos:
  - top4: semifinais (1x4 e 2x3)
  - top2: final direta (1x2)

## 9.2 Gatilho na UI
Em `TournamentMatch`:
- só criador vê banner de geração.
- banner aparece quando liga terminou e playoff ainda não começou.

---

## 10. Encerramento Administrativo

## 10.1 Cancelamento
`cancelTournament(id)`:
- atualiza status para `cancelled`.
- usado na fase ativa (zona de perigo).

## 10.2 Exclusão
`deleteTournament(id)`:
- remove participantes e partidas vinculadas.
- remove torneio.
- pensado para fluxo de draft/lobby.

---

## 11. Conexões Sociais (Recentes)

## 11.1 `ensureConnection`
Garante vínculo bidirecional entre dois usuários em `connections` (com upsert e chave única lógica).

## 11.2 `fetchRecentPlayers`
Recupera conexões mais recentes para alimentar convites rápidos em criação.

---

## 12. Estados de Falha e Tratamento

Padrão aplicado no ciclo:
- `try/catch` em ações assíncronas críticas.
- mensagens de erro local para feedback na tela.
- logs no console para diagnóstico técnico.

Falhas comuns tratadas:
- torneio inexistente
- código de convite inválido
- usuário já participante
- formato incompatível com número de participantes
- erro de inserção/atualização no Supabase

---

## 13. Resumo do Fluxo End-to-End

1. Criador define regras no `CreateTournament`.
2. Sistema cria torneio em `draft` com `invite_code`.
3. Participantes entram pelo lobby/código.
4. Criador define/ajusta times no `TournamentConfig`.
5. Engine gera calendário conforme formato.
6. Torneio vira `active`.
7. Rodadas são jogadas e classificação é recalculada.
8. Em campeonato, fase final pode ser gerada automaticamente por ranking.
9. Admin pode cancelar (fase ativa) ou excluir (fase de preparação), conforme contexto.

---

## 14. Arquivos-chave para manutenção

- Estado e navegação:
  - `src/atoms/tournamentAtoms.ts`
  - `src/screen/LoggedIn/LoggedIn.tsx`
- Criação e lobby:
  - `src/screen/CreateTournament/CreateTournament.tsx`
  - `src/screen/TournamentLobby/TournamentLobby.tsx`
  - `src/components/TournamentConfig.tsx`
- Execução das partidas:
  - `src/screen/TournamentMatch/TournamentMatch.tsx`
  - `src/components/MatchCard.tsx`
  - `src/components/StandingsTable.tsx`
  - `src/components/Accordion/Accordion.tsx`
- Regra de negócio:
  - `src/lib/tournamentService.ts`
  - `src/lib/matchGenerationEngine.ts`
  - `src/lib/matchService.ts`

---

## 15. Próximas evoluções sugeridas

- Persistir explicitamente “torneio concluído” (status final) quando todas partidas forem `finished`.
- Padronizar um estado de loading/error por fase para observabilidade.
- Adicionar testes automatizados de:
  - geração por formato
  - round-robin com ida/volta
  - cutoff de playoff
  - ranking com penalidade
- Instrumentar eventos (analytics) para medir abandono por fase do ciclo.
