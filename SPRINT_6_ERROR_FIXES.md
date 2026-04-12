# Sprint 6 — Correções de Erros

## Bug: Torneio continua aparecendo na lista após exclusão

### Sintoma
Ao clicar em "Apagar Torneio" ou "Cancelar Torneio", o usuário era redirecionado para o Dashboard, mas o torneio deletado/cancelado ainda aparecia na lista de torneios.

### Causa Raiz

#### 1. `deleteTournament` — DELETE sem confirmação do banco
A função usava `.delete().eq('id', id)` sem `.select()`. O Supabase PostgREST, neste modo, **não retorna nenhum dado** e o cliente resolve a Promise sem aguardar a confirmação de que a linha foi de fato removida. Em condições de latência alta, o `fetchMyTournaments` subsequente era disparado antes do commit ser visível no banco.

#### 2. Erros nas dependências eram silenciosos
Os DELETEs de `participants` e `matches` usavam `await supabase...` sem verificar o `error` retornado. Se uma foreign key impedisse a remoção, o handler continuava e redirecionava o usuário sem avisar.

#### 3. `activeTournamentAtom` não era limpo antes do redirect
Após o DELETE + fetch, o atom `activeTournamentAtom` ainda apontava para o torneio removido. Qualquer re-render do `TournamentView` antes da troca de view poderia reprocessar um objeto stale.

---

### Correções Aplicadas

#### `src/lib/tournamentService.ts` — `deleteTournament`

```ts
// ANTES
await supabase.from('participants').delete().eq('tournament_id', id)  // sem verificação de erro
await supabase.from('matches').delete().eq('tournament_id', id)        // sem verificação de erro

const { error } = await supabase.from('tournaments').delete().eq('id', id)

// DEPOIS
const { error: participantsError } = await supabase
  .from('participants').delete().eq('tournament_id', id)
if (participantsError) throw new Error(...)

const { error: matchesError } = await supabase
  .from('matches').delete().eq('tournament_id', id)
if (matchesError) throw new Error(...)

const { error } = await supabase
  .from('tournaments').delete().eq('id', id)
  .select()   // ← faz o Supabase retornar a linha deletada,
  .single()   //   confirmando o commit antes de resolver a Promise
if (error) throw new Error(...)
```

#### `src/screen/TournamentView/TournamentView.tsx` — `handleDeleteTournament` / `handleCancelTournament`

```ts
// ANTES
await deleteTournament(tournament.id)
const updated = await fetchMyTournaments(user.id)
setMyTournaments(updated)
setCurrentView('dashboard')   // atom activeTournament ainda populado

// DEPOIS
await deleteTournament(tournament.id)
const updated = await fetchMyTournaments(user.id)  // aguarda confirmação real do banco
setMyTournaments(updated)
setActiveTournament(null)      // ← limpa o atom antes de trocar de view
setCurrentView('dashboard')
```

Para `handleCancelTournament` a mesma sequência foi aplicada: fetch completo → limpa atom → troca de view.

---

### Fluxo Correto Após a Correção

```
handleDeleteTournament()
  └─ window.confirm → usuário confirma
       └─ await deleteTournament(id)
            ├─ DELETE participants  (verifica erro → throw se falhar)
            ├─ DELETE matches       (verifica erro → throw se falhar)
            └─ DELETE tournaments .select().single()
                 └─ Promise resolve apenas após confirmação do Supabase
       └─ await fetchMyTournaments(user.id)
            └─ lista já não contém o torneio removido
       └─ setMyTournaments(updated)   ← atom atualizado com dados reais
       └─ setActiveTournament(null)   ← atom limpo
       └─ setCurrentView('dashboard') ← redirect seguro

  catch(err) → setError(message)     ← exibido inline, sem redirect
```

---

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/tournamentService.ts` | `deleteTournament`: erros nas dependências propagados; `.select().single()` adicionado ao DELETE final |
| `src/screen/TournamentView/TournamentView.tsx` | `handleDeleteTournament` e `handleCancelTournament`: `setActiveTournament(null)` antes do redirect |

---

## Como a Listagem de Torneios Funciona

### Visão Geral
O `Dashboard` chama `fetchMyTournaments(userId)` no mount via `useEffect`. O resultado é salvo no atom global `myTournamentsAtom` (Jotai) e renderizado como uma grade de `<TournamentCard>`.

### `fetchMyTournaments` — 3 etapas

**Etapa 1 — Torneios criados pelo usuário**
```sql
SELECT * FROM tournaments WHERE creator_id = userId
```

**Etapa 2 — Torneios onde o usuário é participante**
```sql
SELECT tournament_id FROM participants WHERE user_id = userId
-- em seguida:
SELECT * FROM tournaments WHERE id IN (...)
```

**Etapa 3 — Enriquecimento (N queries em `Promise.all`)**
```sql
-- Para cada torneio:
SELECT COUNT(*) FROM participants WHERE tournament_id = id
```
Cada objeto é enriquecido com `participantCount`, `isCreator` e `isParticipant`.

**Deduplicação:** os dois arrays são combinados e passados por `new Map(t.id → t)` para remover duplicatas (caso o criador também seja participante).

### Fluxo Completo

```
Dashboard monta
  └─ useEffect → fetchMyTournaments(user.id)
       ├─ Query 1: tournaments WHERE creator_id = userId
       ├─ Query 2: participants WHERE user_id = userId
       │            → tournaments WHERE id IN (...)
       └─ Query 3: COUNT(*) por torneio (Promise.all)
            └─ enriched[] → setMyTournamentsAtom
                 └─ myTournaments.map(t => <TournamentCard>)
```

### Sincronização após mutações
Toda operação que altera a lista chama `fetchMyTournaments` novamente:

| Operação | Onde |
|---|---|
| Criar torneio | `CreateTournament.handleSubmit` |
| Apagar torneio | `TournamentView.handleDeleteTournament` |
| Cancelar torneio | `TournamentView.handleCancelTournament` |
| Entrar via código | `JoinByCode` (refresh automático) |

### Limitação de Performance
O passo 3 dispara **N queries paralelas** (uma `COUNT` por torneio). Com muitos torneios isso escala mal. A solução ideal seria uma RPC no Supabase com `GROUP BY tournament_id` retornando os counts em uma única query.
