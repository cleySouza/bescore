# Documentação Técnica — Tela de Sucesso (Pós-Criação de Torneio)

## 1. Visão Geral

Após a submissão bem-sucedida do formulário de criação, o componente `CreateTournament` troca condicionalmente seu corpo principal pela tela de sucesso. Não há rota nova nem componente separado — é um **branch de renderização inline** controlado pelo estado `success`.

A tela exibe um feedback visual imediato (`✅` + mensagem), e após **1500ms** redireciona automaticamente para a view do torneio recém-criado via atom `currentViewAtom`.

---

## 2. Arquitetura de Pastas

```
src/
├── atoms/
│   └── tournamentAtoms.ts      ← activeTournamentAtom, currentViewAtom, myTournamentsAtom
├── lib/
│   └── tournamentService.ts    ← createTournament, fetchMyTournaments, getTournamentById
└── screen/CreateTournament/
    ├── CreateTournament.tsx     ← orquestrador; contém o branch success
    └── CreateTournament.module.css
        ├── .successContainer
        ├── .successIcon
        └── .successMessage
```

---

## 3. Estado que Controla a Tela

```typescript
const [success, setSuccess] = useState(false)
```

Único booleano local. Quando `true`, o corpo principal do formulário é substituído pelo bloco de sucesso:

```tsx
{success ? (
  <div className={styles.successContainer}>
    <div className={styles.successIcon}>✅</div>
    <p className={styles.successMessage}>Torneio criado com sucesso!</p>
    <small>Redirecionando...</small>
  </div>
) : (
  <div className={styles.contentMain}>
    {/* ... formulário completo ... */}
  </div>
)}
```

---

## 4. Fluxo Completo de `handleSubmit`

```
handleSubmit(e)
  │
  ├─ [guard] name vazio           → setLocalError('Nome do torneio é obrigatório')
  ├─ [guard] name.length < 3      → setLocalError('Nome deve ter pelo menos 3 caracteres')
  ├─ [guard] campeonato + min     → setLocalError('Mínimo de N jogadores...')
  │
  ├─ setLoading(true)
  │
  ├─ await createTournament(name, user.id, gameType)
  │     └─ Supabase INSERT tournaments → retorna Tournament
  │
  ├─ setSuccess(true)             ← TELA DE SUCESSO APARECE AQUI
  │
  ├─ await fetchMyTournaments(user.id)
  │     └─ setMyTournaments(tournaments)
  │
  ├─ await getTournamentById(newTournament.id, user.id)
  │     └─ setActiveTournament(tournamentWithDetails)
  │
  ├─ setTimeout(1500ms)
  │     └─ setCurrentView('tournament')   ← REDIRECIONAMENTO
  │
  └─ setFormData({ ...defaults })        ← limpa formulário

  catch(err) → setLocalError(message) + setError(message)
  finally    → setLoading(false)
```

### Observação sobre ordenação

`setSuccess(true)` é chamado **imediatamente após** `createTournament`, antes das chamadas de enriquecimento (`fetchMyTournaments`, `getTournamentById`). Isso garante que o feedback visual seja instantâneo, independente da latência das queries seguintes.

---

## 5. Serviços Chamados no Submit

### `createTournament(name, userId, gameType)`

```typescript
export async function createTournament(
  name: string,
  userId: string,
  gameType?: string
): Promise<Tournament> {
  const inviteCode = generateInviteCode()  // 6 chars alfanuméricos [A-Z0-9]

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      creator_id: userId,
      invite_code: inviteCode,
      game_type: gameType || 'eFootball',
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`Falha ao criar torneio: ${error.message}`)
  return data
}
```

**Invite Code gerado localmente:**

```typescript
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
// Exemplo de saída: "K7MR2X"
```

> O código tem espaço amostral de 36⁶ ≈ 2,1 bilhões de combinações. Colisões são improváveis mas não tratadas com retry no lado cliente — a constraint UNIQUE do Supabase lançará erro que será capturado pelo `catch`.

### `fetchMyTournaments(userId)`

- Busca torneios `creator_id = userId` + torneios onde existe registro em `participants`
- Remove duplicatas via `Map(id → tournament)`
- Enriquece cada torneio com `participantCount` (COUNT via `head: true`), `isCreator`, `isParticipant`

### `getTournamentById(id, userId)`

- SELECT único por `id`
- Retorna `TournamentWithParticipants` com os mesmos campos de enriquecimento

---

## 6. Atoms Atualizados no Fluxo

```typescript
// Definidos em src/atoms/tournamentAtoms.ts

setMyTournaments(tournaments)
// → myTournamentsAtom: TournamentWithParticipants[]
// Atualiza o Dashboard com o novo torneio na lista

setActiveTournament(tournamentWithDetails)
// → activeTournamentAtom: TournamentWithParticipants | null
// Define o torneio que será exibido ao redirecionar

setCurrentView('tournament')
// → currentViewAtom: 'dashboard' | 'tournament'
// Desencadeia a troca de view no App.tsx após 1500ms
```

---

## 7. CSS da Tela de Sucesso

```css
/* CreateTournament.module.css */

.successContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  gap: 16px;
}

.successIcon {
  font-size: 64px;
}

.successMessage {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-dark);
  margin: 0;
}
```

O container herda o `container` pai (altura total da view). `min-height: 400px` garante centralização visual mesmo em telas menores.

---

## 8. Botão de Submit e Spinner

Antes da tela de sucesso aparecer, o botão exibe um spinner enquanto `loading === true`:

```tsx
<button
  type="submit"
  form="create-form"
  className={styles.submitBtn}
>
  {loading ? <span className={styles.spinner} /> : 'Criar Torneio'}
</button>
```

```css
.submitBtn {
  padding: 12px 80px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: var(--color-dark-100);
  color: var(--color-white);
  transition: all 0.2s;
  min-height: 44px;
}

.submitBtn:hover:not(:disabled) {
  background: var(--color-be);
}

.submitBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Spinner CSS puro — sem dependência de biblioteca */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-gray-200);
  border-top-color: var(--color-be);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 9. Tratamento de Erros

Erros são exibidos **acima** do botão de submit (dentro do `.submitRow`):

```tsx
<div className={styles.submitRow}>
  {localError && <div className={styles.errorMessage}>{localError}</div>}
  <button type="submit" form="create-form" ...>
    {loading ? <span className={styles.spinner} /> : 'Criar Torneio'}
  </button>
</div>
```

| Origem | Mensagem |
|---|---|
| `name` vazio | `'Nome do torneio é obrigatório'` |
| `name.length < 3` | `'Nome deve ter pelo menos 3 caracteres'` |
| `campeonato + top4 + participantes < 6` | `'Mínimo de 6 jogadores para gerar semifinais.'` |
| `campeonato + top2 + participantes < 4` | `'Mínimo de 4 jogadores para este formato.'` |
| Erro Supabase (INSERT) | `err.message` (propagado do `throw` em `createTournament`) |

`setError(message)` também escreve no `tournamentsErrorAtom` para surfacing global.

---

## 10. Reset do Formulário

Executado no `try` **após** `setSuccess(true)`, não no `finally`, garantindo que o formulário só reseta se a criação tiver sido confirmada:

```typescript
setFormData({
  name: '',
  format: 'liga',
  gameType: 'eFootball',
  maxParticipants: 8,
  isPrivate: false,
  autoTeams: true,
  adminDraft: true,
  adminScores: true,
  matchType: 'PA',
  willPlay: true,
  teamNames: '',
  selectedTeamIds: [],
  playoffCutoff: 'top4',
})
```

`setSelectedTeamsPreview([])` **não** é chamado aqui (legacy do fluxo), mas o `handleBack` zera também o preview. Na prática o formulário fica oculto pela tela de sucesso até o redirect ocorrer.

---

## 11. Pontos de Extensão Futuros

| Feature | Onde Implementar |
|---|---|
| Exibir o `invite_code` na tela de sucesso para compartilhamento | `successContainer` — recuperar via `activeTournamentAtom` |
| Botão "Copiar código" | Dentro do `successContainer`, `navigator.clipboard.writeText(code)` |
| Animação de entrada (fade/scale) | `.successContainer { animation: fadeIn 0.4s ease }` |
| Toast/snackbar global em vez de troca de view | `tournamentsErrorAtom` + componente global de feedback |
| Persistência de `selectedTeamIds` no Supabase | Chamada adicional após `createTournament` no `try` block |
| Convites automáticos dos `invitedPlayers` | Loop sobre `invitedPlayers` chamando `invitePlayer(tournamentId, playerId)` |
