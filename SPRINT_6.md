# Sprint 6: Governança, Acesso e Ciclo de Vida dos Torneios

## Overview
Implementação completa do sistema de governança e controle de acesso aos torneios. Visitantes podem visualizar e ingressar em torneios (públicos ou privados). Criadores ganham controle sobre o ciclo de vida do torneio com ações de cancelamento e exclusão protegidas por confirmação.

---

## Features Implementadas

### 1. Tag de Papel no Cabeçalho
Badge inline ao lado do nome do torneio, indicando o papel do usuário logado:
- **[ORGANIZADOR]** — criador do torneio (cor ouro)
- **[PARTICIPANTE]** — membro inscrito (cor verde)
- **[VISITANTE]** — usuário sem vínculo (cor cinza)

### 2. Proteção por Papel (Visitor Guard)
- `isVisitor = !isCreator && !isParticipant` derivado automaticamente
- `isParticipant` lido do `activeTournamentAtom` (flag já enriquecida), com fallback para `participants.some()`
- Botões administrativos (`⚙️ Configurar Partidas`, `⚙️ Gerenciar`) permanecem visíveis apenas para o criador
- Stepper de placar em `MatchCard` já era protegido via `canEdit = isCreator && !isFinished` — sem alteração necessária

### 3. Lógica de Ingresso em Torneios (status draft)
Visitantes veem uma seção de ingresso abaixo da lista de participantes:
- **Torneio público** → botão direto "🎮 Entrar no Torneio"
- **Torneio privado** → campo de código + botão "Entrar" (valida contra `tournament.invite_code`)
- **Torneio lotado** → badge "🔒 Torneio Lotado"; nenhuma ação disponível

### 4. Zona de Perigo (Ciclo de Vida)
Seção exclusiva para o criador com ações irreversíveis, protegidas por `window.confirm`:

| Status do Torneio | Ação disponível |
|---|---|
| `draft` | **Apagar Torneio** — exclui participantes, partidas e o torneio |
| `active` | **Cancelar Torneio** — altera status para `cancelled` |

Após qualquer ação bem-sucedida: refresh do `myTournamentsAtom` + redirecionamento para o Dashboard.

---

## Arquitetura Técnica

### Arquivos Modificados

#### `src/types/tournament.ts`
```
TournamentSettings
├── isPrivate?: boolean       — exige código para ingressar
└── maxParticipants?: number  — limite máximo de participantes
```

#### `src/lib/tournamentService.ts`
```
createTournament(name, userId, gameType, initialSettings?)
└── Novo parâmetro: initialSettings { isPrivate, maxParticipants }
    Salva no campo settings (JSONB) ao criar

joinTournamentById(tournamentId, userId, teamName)  [NOVA]
├── Ingresso direto por ID (sem lookup por invite_code)
├── Verifica duplicidade antes de inserir
└── Retorna registro do participante

cancelTournament(id)  [NOVA]
└── UPDATE tournaments SET status = 'cancelled' WHERE id = $1

deleteTournament(id)  [NOVA]
├── DELETE participants WHERE tournament_id = $1
├── DELETE matches    WHERE tournament_id = $1
└── DELETE tournaments WHERE id = $1
    (remoção explícita das dependências — seguro com ou sem CASCADE)
```

#### `src/lib/matchGenerationEngine.ts`
```
generateMatchesByFormat()
└── Ao ativar torneio, mescla settings existentes antes de sobrescrever
    → Preserva isPrivate e maxParticipants definidos na criação
```

#### `src/screen/CreateTournament/CreateTournament.tsx`
```
handleSubmit
└── Passa { isPrivate, maxParticipants } do formulário para createTournament()
```

#### `src/screen/TournamentView/TournamentView.tsx`
```
Imports
└── + myTournamentsAtom, fetchMyTournaments
    + joinTournamentById, deleteTournament, cancelTournament

State
├── joinCode: string
├── joinCodeError: string | null
└── joiningTournament: boolean

Derivações
├── isParticipant  — atom flag com fallback para participants.some()
├── isVisitor      — !isCreator && !isParticipant
├── isPrivate      — tournamentSettings?.isPrivate ?? false
├── maxParticipants — tournamentSettings?.maxParticipants ?? null
└── isFull         — maxParticipants !== null && participantCount >= maxParticipants

Handlers
├── handleJoin()             — valida código (privado) → joinTournamentById → refreshKey++
├── handleDeleteTournament() — confirm → deleteTournament → refresh atom → dashboard
└── handleCancelTournament() — confirm → cancelTournament → refresh atom → dashboard

JSX — Header
└── <span roleTag roleTagOrganizer|Participant|Visitor>

JSX — Draft section
├── {isCreator && isDraft} → Zona de Perigo com botão "Apagar Torneio"
└── {isDraft && isVisitor} → joinSection (público / privado / lotado)

JSX — Active section (aba Classificação, adminPanel)
└── Zona de Perigo com botão "Cancelar Torneio"
```

#### `src/screen/TournamentView/TournamentView.module.css`
```
Novas classes — Governança
├── .roleTag / .roleTagOrganizer / .roleTagParticipant / .roleTagVisitor
├── .joinSection / .joinHint / .joinCodeRow
├── .joinCodeInput / .joinBtn / .joinError / .fullBadge

Novas classes — Zona de Perigo
├── .dangerZone    — container com borda/fundo vermelho sutil
├── .dangerZoneTitle — label em uppercase vermelho
└── .dangerBtn     — botão outline vermelho; hover com fundo #c62828
```

---

## Fluxo de Dados

```
CreateTournament
  └─ createTournament(..., { isPrivate, maxParticipants })
       └─ settings JSONB = { isPrivate, maxParticipants }

TournamentConfig → generateMatchesByFormat
  └─ merge(existingSettings, newFormatSettings)
       └─ settings JSONB = { isPrivate, maxParticipants, format, ... }

Visitante + torneio público + draft
  └─ handleJoin()
       └─ joinTournamentById(id, userId, teamName)
            └─ INSERT participants → refreshKey++ → isParticipant = true

Criador + draft → "Apagar Torneio"
  └─ confirm → deleteTournament(id)
       └─ DELETE participants, matches, tournaments
            └─ fetchMyTournaments → setMyTournaments → dashboard

Criador + active → "Cancelar Torneio"
  └─ confirm → cancelTournament(id)
       └─ UPDATE status = 'cancelled'
            └─ fetchMyTournaments → setMyTournaments → dashboard
```

---

## Notas de Implementação

- `isPrivate` e `maxParticipants` são armazenados no JSONB `settings` — **não requer migração de schema**
- Torneios anteriores à sprint tratam `isPrivate` como `false` (públicos por padrão)
- `maxParticipants` nulo = sem limite (comportamento anterior preservado)
- A validação do código de ingresso privado é feita no cliente; para produção, recomenda-se RLS adicional no Supabase
- `deleteTournament` remove dependências explicitamente antes do torneio, garantindo compatibilidade independente da configuração de `ON DELETE CASCADE`
