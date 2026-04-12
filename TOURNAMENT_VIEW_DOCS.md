# Documentação Técnica — TournamentView

## 1. Visão Geral

`TournamentView` é a tela principal de um torneio ativo. É renderizada pelo `LoggedIn` quando `currentViewAtom === 'tournament'` e `activeTournamentAtom !== null`. Não possui rota própria — é um branch de view controlado por atom.

Comportamento por status:

| Status | O que é exibido |
|---|---|
| `'draft'` | Lista de participantes + botão "Configurar Partidas" (somente criador) |
| `'active'` | Tabs: 🎮 Jogos / 📊 Classificação |
| `'finished'` | *(sem tratamento de UI diferenciado atualmente)* |

---

## 2. Arquitetura de Pastas

```
src/
├── atoms/
│   └── tournamentAtoms.ts          ← activeTournamentAtom, currentViewAtom,
│                                      showConfigModalAtom, activeTournamentTabAtom
├── lib/
│   ├── matchService.ts             ← getTournamentMatches, updateMatchResult,
│   │                                  getTournamentStandings
│   └── matchGenerationEngine.ts    ← generateMatchesByFormat
├── types/
│   └── tournament.ts               ← TournamentFormat, TournamentSettings,
│                                      Match, MatchWithTeams, StandingsRow
└── components/
    ├── TournamentView.tsx           ← orquestrador da view
    ├── TournamentView.module.css
    ├── TournamentView.tabs.css      ← estilos das tabs (importado separado)
    ├── TournamentConfig.tsx         ← modal de configuração de partidas
    ├── TournamentConfig.module.css
    ├── MatchCard.tsx                ← card de partida com stepper de placar
    ├── MatchCard.module.css
    ├── StandingsTable.tsx           ← tabela de classificação + realtime
    └── StandingsTable.module.css
```

---

## 3. TournamentView.tsx — Estado e Dados

### Props

```typescript
interface TournamentViewProps {
  onBackToDashboard: () => void  // recebida mas não usada internamente (_prefixado)
}
```

### Atoms consumidos

```typescript
const user        = useAtomValue(userAtom)           // autenticação
const tournament  = useAtomValue(activeTournamentAtom) // torneio ativo
const setCurrentView = useSetAtom(currentViewAtom)   // navegação
const setShowConfigModal = useSetAtom(showConfigModalAtom) // abre TournamentConfig
const [activeTab, setActiveTab] = useAtom(activeTournamentTabAtom) // 'matches' | 'standings'
```

### Estado local

```typescript
const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
const [matches, setMatches]           = useState<MatchWithTeams[]>([])
const [loading, setLoading]           = useState(true)
const [error, setError]               = useState<string | null>(null)
const [refreshKey, setRefreshKey]     = useState(0) // incrementado para forçar reload
```

### Derivações

```typescript
const isCreator       = tournament.creator_id === user.id
const participantCount = participants.length
const isDraft         = tournament.status === 'draft'
const isActive        = tournament.status === 'active'
const pendingMatches  = matches.filter((m) => m.status === 'pending')
const finishedMatches = matches.filter((m) => m.status === 'finished')
```

---

## 4. Ciclo de Dados (useEffect)

```
useEffect([tournament, refreshKey])
  │
  ├─ !tournament → setCurrentView('dashboard')  [guard]
  │
  └─ loadData()
       ├─ await getTournamentParticipants(tournament.id)
       │     └─ setParticipants(data)
       │
       └─ if (tournament.status === 'active')
             await getTournamentMatches(tournament.id)
             └─ setMatches(data)
```

`refreshKey` é incrementado por `handleMatchesGenerated` e `handleMatchResultUpdated`, causando re-execução do effect sem precisar recarregar a página.

---

## 5. Fluxo por Status

### 5.1 Status `'draft'`

```
participantCount < 2
  └─ EmptyState: "Aguardando oponentes..."
       └─ Exibe invite_code + botão "Copiar Código"

participantCount >= 2
  └─ Lista de participantCard
       ├─ avatar_url (img) || avatarPlaceholder (👤)
       ├─ team_name || 'Sem time'
       ├─ nickname || email || 'Usuário'
       └─ 👑 badge se user_id === creator_id

isCreator && isDraft
  └─ Botão "⚙️ Configurar Partidas" → setShowConfigModal(true)
```

### 5.2 Status `'active'`

```
Tabs Nav:
├─ "🎮 Jogos (N)" → activeTab === 'matches'
└─ "📊 Classificação" → activeTab === 'standings'

Tab Jogos:
├─ pendingMatches.length > 0
│     └─ Grid de MatchCard (pending)
└─ finishedMatches.length > 0
      └─ Grid de MatchCard (finished)

Tab Classificação:
  └─ <StandingsTable onDataUpdate={handleMatchResultUpdated} />
```

---

## 6. TournamentConfig — Modal de Geração de Partidas

### Props

```typescript
interface TournamentConfigProps {
  participantCount: number
  onClose: () => void
  onMatchesGenerated?: () => void
}
```

### Visibilidade

Controlado pelo `showConfigModalAtom`. Só renderiza quando `showModal === true && isCreator`.

### Formatos disponíveis

```typescript
type TournamentFormat = 'roundRobin' | 'knockout' | 'groupsCrossed' | 'mixed'
```

| Formato | Nome UI | Mínimo | Notas |
|---|---|---|---|
| `roundRobin` | Liga (todos contra todos) | 2 | `hasReturnMatch` opcional — dobra o número de partidas |
| `knockout` | Mata-mata (eliminatório) | 2 | BYEs calculados automaticamente para a potência de 2 mais próxima |
| `groupsCrossed` | Grupos Cruzados | 3 | `bracketGroups` configurável |
| `mixed` | Misto (Grupos + Knockout) | 4 | `qualifiedCount` configurável |

### Cálculos pré-geração (UI informativa)

```typescript
// roundRobin
const matches = (N * (N - 1)) / 2
const totalMatches = hasReturnMatch ? matches * 2 : matches

// knockout
const powerOf2 = 2^ceil(log2(N))
const byeCount = powerOf2 - N
const totalMatches = N - 1   // sempre N-1 em eliminatória

// groupsCrossed (2 grupos)
const perGroup = floor(N / groupCount)
const matchesPerGroup = (perGroup * (perGroup - 1)) / 2
const crossMatches = C(groupCount, 2) * perGroup²

// mixed (grupos + fase final)
const groupMatches = groupCount * (perGroup * (perGroup-1)) / 2
const knockoutMatches = qualifiedCount - 1
```

### Geração (handleSubmit)

```typescript
await generateMatchesByFormat(tournament.id, format, settings)
// → atualiza tournament.status para 'active'
// → insere rows em 'matches'
// → onMatchesGenerated?.()  → refreshKey++
```

---

## 7. `generateMatchesByFormat` — Motor de Geração

Localização: `src/lib/matchGenerationEngine.ts`

```typescript
export async function generateMatchesByFormat(
  tournamentId: string,
  format: TournamentFormat,
  settings: TournamentSettings
): Promise<void>
```

**Pipeline:**

```
1. SELECT tournaments WHERE id = tournamentId
2. SELECT participants WHERE tournament_id = tournamentId
3. validateSettingsForFormat(format, participants.length) → throw se inválido
4. shuffle(participantIds)
5. Gerar array de Match conforme o formato
6. supabase.from('matches').insert(matches)
7. supabase.from('tournaments').update({ status: 'active' })
```

---

## 8. MatchCard

### Props

```typescript
interface MatchCardProps {
  match: MatchWithTeams
  onResultUpdated?: () => void
}
```

### Lógica de permissão

```typescript
const isCreator  = tournament.creator_id === user?.id
const isFinished = match.status === 'finished'
const canEdit    = isCreator && !isFinished  // somente criador pode editar partidas pendentes
```

### Interface de placar

- Dois steppers independentes (home/away): `handleIncrement('home'|'away')` e `handleDecrement` com `Math.max(0, prev - 1)`
- Botão "Confirmar" só visível quando `canEdit`

### `updateMatchResult`

```typescript
await updateMatchResult(match.id, homeScore, awayScore)
// UPDATE matches SET home_score, away_score, status='finished', updated_at
```

### Estrutura `MatchWithTeams`

```typescript
interface MatchWithTeams extends Match {
  homeTeam?: { id; team_name; profile?: { nickname; avatar_url } }
  awayTeam?: { id; team_name; profile?: { nickname; avatar_url } }
}
```

---

## 9. StandingsTable

### Realtime

```typescript
const channel = supabase
  .channel(`matches:${tournament.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'matches',
    filter: `tournament_id=eq.${tournament.id}`,
  }, () => {
    loadStandings()
    onDataUpdate?.()
  })
  .subscribe()

// cleanup: channel.unsubscribe() no return do useEffect
```

Qualquer escrita na tabela `matches` para o torneio ativo dispara recalculo automático das standings no browser **sem polling**.

### Algoritmo de classificação (`getTournamentStandings`)

```typescript
// Para cada match com status='finished':
if (home_score > away_score)  → home: +3pts, +1W   away: +1L
if (home_score < away_score)  → away: +3pts, +1W   home: +1L
if (home_score === away_score) → ambos: +1pt, +1D

// Ordenação:
.sort((a, b) => b.points - a.points || b.goal_difference - a.goal_difference)
```

### Tipo `StandingsRow`

```typescript
interface StandingsRow {
  participant_id: string
  team_name: string | null
  user_nickname: string | null
  user_avatar_url: string | null
  total_matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  position: number   // 1-based, atribuído após ordenação
}
```

---

## 10. `getTournamentMatches` — Consulta com Joins

```typescript
supabase
  .from('matches')
  .select(`
    *,
    home_team:home_participant_id (
      id, team_name,
      profile:user_id ( nickname, avatar_url )
    ),
    away_team:away_participant_id (
      id, team_name,
      profile:user_id ( nickname, avatar_url )
    )
  `)
  .eq('tournament_id', tournamentId)
  .order('round', { ascending: true })
```

Joins em 2 níveis: `matches → participants → profiles`.

---

## 11. Navegação e Refresh

```
← Voltar
  └─ setCurrentView('dashboard')       ← sem reset do activeTournamentAtom
                                          (o Dashboard pode reutilizar o atom)

handleSetupMatches()
  └─ setShowConfigModal(true) → TournamentConfig renderiza

handleMatchesGenerated()
  └─ setRefreshKey((k) => k + 1)       ← force-reload no useEffect

handleMatchResultUpdated()
  └─ setRefreshKey((k) => k + 1)       ← mesmo mecanismo
  └─ (também disparado via Supabase realtime em StandingsTable)
```

---

## 12. Tabela de Schemas Supabase Relevantes

| Tabela | Colunas usadas nesta view |
|---|---|
| `tournaments` | `id`, `name`, `game_type`, `invite_code`, `status`, `creator_id` |
| `participants` | `id`, `tournament_id`, `user_id`, `team_name`, `joined_at` |
| `matches` | `id`, `tournament_id`, `home_participant_id`, `away_participant_id`, `round`, `status`, `home_score`, `away_score`, `updated_at` |
| `profiles` (via FK) | `nickname`, `avatar_url`, `email` |
| `connections` | escrita por `ensureConnection` após criação (não lida nesta view) |

---

## 13. Pontos de Extensão Futuros

| Feature | Onde Implementar |
|---|---|
| Status `'finished'` com tela de pódio | Branch `} else if (isFinished)` após o bloco `isActive` |
| Remover participante (somente criador, status draft) | `DELETE participants WHERE id = pid` + `refreshKey++` |
| Encerrar torneio manualmente | `UPDATE tournaments SET status='finished'` + novo button no header |
| Bracket visual para knockout | Componente `BracketView` usando `matches` com `round` como eixo |
| Notificações push em nova partida | Supabase Realtime channel em `TournamentView` (análogo ao de StandingsTable) |
| Placar lançado por jogadores (adminScores=false) | `canEdit` expandido para incluir `isHomePlayer || isAwayPlayer` |
