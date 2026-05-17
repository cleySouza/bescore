import { supabase } from './supabaseClient'
import { profileDisplayName } from './profileService'
import { logger } from './logger'
import type { Json, Tables } from '../types/supabase'
import type { TournamentWithParticipants, Participant } from '../atoms/tournamentAtoms'
import type { TournamentSettings } from '../types/tournament'

type Tournament = Tables<'tournaments'>

/** Colunas usadas pelo TournamentCard e listagens do dashboard (evita `*`). */
const TOURNAMENT_LIST_SELECT =
  'id,name,status,game_type,invite_code,created_at,creator_id,settings' as const

type TournamentListRow = Pick<
  Tournament,
  'id' | 'name' | 'status' | 'game_type' | 'invite_code' | 'created_at' | 'creator_id' | 'settings'
>

async function getParticipantCountsByTournament(tournamentIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (tournamentIds.length === 0) return counts

  const { data, error } = await supabase
    .from('participants')
    .select('tournament_id')
    .in('tournament_id', tournamentIds)

  if (error) {
    console.error('Erro ao contar participantes em lote:', error.message)
    return counts
  }

  for (const row of data ?? []) {
    const tid = row.tournament_id
    if (!tid) continue
    counts.set(tid, (counts.get(tid) ?? 0) + 1)
  }
  return counts
}

function isMissingTableError(error: { message?: string } | null | undefined, table: string): boolean {
  if (!error?.message) return false
  return error.message.includes(`Could not find the table 'public.${table}' in the schema cache`)
}

function getSetupErrorMessage(table: string): string {
  return `Banco de produção sem tabela '${table}'. Execute as migrations SQL do app (tournaments/participants/matches/connections).`
}

/**
 * Gera um código alfanumérico aleatório de 6 caracteres
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Cria um novo torneio
 */
export async function createTournament(
  name: string,
  userId: string,
  gameType?: string,
  initialSettings?: Partial<
    Pick<
      TournamentSettings,
      | 'isPrivate'
      | 'adminScores'
      | 'maxParticipants'
      | 'format'
      | 'playoffCutoff'
      | 'hasReturnMatch'
      | 'tournamentImage'
      | 'selectedTeamNames'
      | 'selectedTeamShields'
      | 'teamAssignMode'
      | 'playoffTwoLegged'
      | 'scoreValidation'
    >
  >
): Promise<Tournament> {
  const inviteCode = generateInviteCode()

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      creator_id: userId,
      invite_code: inviteCode,
      game_type: gameType || 'eFootball',
      status: 'draft',
      ...(initialSettings ? { settings: initialSettings } : {}),
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar torneio:', error.message)
    if (isMissingTableError(error, 'tournaments')) {
      throw new Error(getSetupErrorMessage('tournaments'))
    }
    throw new Error(`Falha ao criar torneio: ${error.message}`)
  }

  return data
}

/**
 * Mescla campos em `tournaments.settings` (só colunas existentes no JSON).
 */
export async function mergeTournamentSettings(
  tournamentId: string,
  patch: Partial<TournamentSettings>
): Promise<TournamentSettings> {
  const { data: row, error: fetchErr } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', tournamentId)
    .maybeSingle()

  if (fetchErr) {
    throw new Error(`Falha ao carregar torneio: ${fetchErr.message}`)
  }

  const base = (row?.settings ?? {}) as Record<string, unknown>
  const merged = { ...base, ...patch } as TournamentSettings

  const { error: updErr } = await supabase
    .from('tournaments')
    .update({ settings: merged as unknown as Json })
    .eq('id', tournamentId)

  if (updErr) {
    throw new Error(`Falha ao salvar configurações: ${updErr.message}`)
  }

  return merged
}

/**
 * Busca torneios visíveis para o usuário:
 * - todos os torneios públicos
 * - torneios privados que ele criou
 * - torneios privados em que ele participa
 */
export async function fetchMyTournaments(userId: string): Promise<TournamentWithParticipants[]> {
  // 1. Buscar torneios criados pelo usuário
  const { data: createdTournaments, error: createdError } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_LIST_SELECT)
    .eq('creator_id', userId)

  if (createdError) {
    console.error('Erro ao buscar torneios criados:', createdError.message)
    if (isMissingTableError(createdError, 'tournaments')) {
        logger.warn(getSetupErrorMessage('tournaments'))
      return []
    }
    throw new Error(`Falha ao buscar torneios: ${createdError.message}`)
  }

  // 2. Buscar torneios onde o usuário é participante
  const { data: participantTournaments, error: participantError } = await supabase
    .from('participants')
    .select('tournament_id')
    .eq('user_id', userId)

  if (participantError) {
    console.error('Erro ao buscar participações:', participantError.message)
    if (isMissingTableError(participantError, 'participants')) {
        logger.warn(getSetupErrorMessage('participants'))
      return []
    }
    throw new Error(`Falha ao buscar participações: ${participantError.message}`)
  }

  const tournamentIds = participantTournaments?.map((p) => p.tournament_id).filter((id): id is string => id !== null) || []
  const participantIdSet = new Set(tournamentIds)

  let joinedTournaments: TournamentListRow[] = []
  if (tournamentIds.length > 0) {
    const { data: joined, error: joinedError } = await supabase
      .from('tournaments')
      .select(TOURNAMENT_LIST_SELECT)
      .in('id', tournamentIds)

    if (joinedError) {
      console.error('Erro ao buscar torneios unidos:', joinedError.message)
    } else {
      joinedTournaments = (joined || []) as TournamentListRow[]
    }
  }

  // 3. Torneios públicos adicionais (só draft/active no servidor; não varre finished/cancelled)
  const createdIds = new Set((createdTournaments || []).map((t) => t.id))
  const joinedIds = new Set(joinedTournaments.map((t) => t.id))
  const excludePublicIds = new Set([...createdIds, ...joinedIds])

  const { data: joinableRowsRaw, error: joinableError } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_LIST_SELECT)
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false })

  if (joinableError) {
    console.error('Erro ao buscar torneios públicos:', joinableError.message)
    throw new Error(`Falha ao buscar torneios públicos: ${joinableError.message}`)
  }

  const additionalPublic = (joinableRowsRaw || []).filter((tournament) => {
    if (excludePublicIds.has(tournament.id)) return false
    const settings = tournament.settings as TournamentSettings | null
    return settings?.isPrivate !== true
  }) as TournamentListRow[]

  // 4. Combinar e remover duplicatas
  const allTournaments: TournamentListRow[] = [
    ...(createdTournaments || []) as TournamentListRow[],
    ...joinedTournaments,
    ...additionalPublic,
  ]
  const uniqueTournaments = Array.from(new Map(allTournaments.map((t) => [t.id, t])).values()).sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  const uniqueIds = uniqueTournaments.map((t) => t.id)
  const participantCounts = await getParticipantCountsByTournament(uniqueIds)

  const enriched: TournamentWithParticipants[] = uniqueTournaments.map((tournament) => {
    const isCreator = tournament.creator_id === userId
    const isParticipant = participantIdSet.has(tournament.id)

    return {
      ...tournament,
      participantCount: participantCounts.get(tournament.id) ?? 0,
      isCreator,
      isParticipant,
    } as TournamentWithParticipants
  })

  return enriched
}

/**
 * Lista torneios públicos em aberto — pensado para utilizador não autenticado (RLS anon).
 * Filtra client-side por status e isPrivate como em {@link fetchMyTournaments}.
 */
export async function fetchPublicTournaments(): Promise<TournamentWithParticipants[]> {
  const { data: rows, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_LIST_SELECT)
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar torneios públicos:', error.message)
    if (isMissingTableError(error, 'tournaments')) {
      logger.warn(getSetupErrorMessage('tournaments'))
      return []
    }
    throw new Error(`Falha ao buscar torneios públicos: ${error.message}`)
  }

  const filtered = (rows || []).filter((tournament) => {
    const settings = tournament.settings as TournamentSettings | null
    return settings?.isPrivate !== true
  }) as TournamentListRow[]

  const ids = filtered.map((t) => t.id)
  const participantCounts = await getParticipantCountsByTournament(ids)

  return filtered.map((tournament) => ({
    ...tournament,
    participantCount: participantCounts.get(tournament.id) ?? 0,
    isCreator: false,
    isParticipant: false,
  })) as TournamentWithParticipants[]
}

/**
 * Busca um torneio pelo invite_code
 */
export async function getTournamentByCode(code: string): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('invite_code', code)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Nenhum resultado encontrado
      return null
    }
    console.error('Erro ao buscar torneio:', error.message)
    throw new Error(`Falha ao buscar torneio: ${error.message}`)
  }

  return data
}

/**
 * Remove um participante do torneio (criador ou o próprio utilizador — ver RLS).
 * Tipicamente usado pelo organizador no rascunho para cancelar uma inscrição.
 */
export async function removeParticipantFromTournament(
  tournamentId: string,
  participantId: string
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)

  if (error) {
    console.error('Erro ao remover participante:', error.message)
    throw new Error(`Falha ao remover participante: ${error.message}`)
  }
}

/**
 * Permite que um usuário se junte a um torneio usando o invite_code
 */
export async function joinTournament(
  inviteCode: string,
  userId: string,
  teamName: string
): Promise<Participant> {
  // 1. Validar que o torneio existe
  const tournament = await getTournamentByCode(inviteCode)
  if (!tournament) {
    throw new Error('Código de convite inválido ou não encontrado')
  }

  // 2. Verificar se o usuário já é participante
  const { data: existingParticipant } = await supabase
    .from('participants')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('user_id', userId)
    .single()

  if (existingParticipant) {
    throw new Error('Você já é participante deste torneio')
  }

  const normalizedTeamName = teamName.trim() || null

  // 3. Inserir novo participante
  const { data, error } = await supabase
    .from('participants')
    .insert({
      tournament_id: tournament.id,
      user_id: userId,
      team_name: normalizedTeamName,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao entrar no torneio:', error.message)
    throw new Error(`Falha ao entrar no torneio: ${error.message}`)
  }

  return data
}

/**
 * Permite que um usuário se junte a um torneio diretamente pelo ID
 * (usado na TournamentView quando o torneio já está visível)
 */
export async function joinTournamentById(
  tournamentId: string,
  userId: string,
  teamName: string
): Promise<Participant> {
  // 1. Verificar se o usuário já é participante
  const { data: existingParticipant } = await supabase
    .from('participants')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .single()

  if (existingParticipant) {
    throw new Error('Você já é participante deste torneio')
  }

  const normalizedTeamName = teamName.trim() || null

  // 2. Inserir novo participante
  const { data, error } = await supabase
    .from('participants')
    .insert({
      tournament_id: tournamentId,
      user_id: userId,
      team_name: normalizedTeamName,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao entrar no torneio:', error.message)
    throw new Error(`Falha ao entrar no torneio: ${error.message}`)
  }

  return data
}

/**
 * Busca um torneio por ID com enriquecimento. Sem `viewerUserId`, não consulta participação
 * (visitante anônimo: `isCreator` / `isParticipant` falsos). RLS restringe torneios privados.
 */
export async function getTournamentByIdForViewer(
  id: string,
  viewerUserId?: string | null
): Promise<TournamentWithParticipants> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Erro ao buscar torneio:', error.message)
    throw new Error(`Falha ao buscar torneio: ${error.message}`)
  }

  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', id)

  let isCreator = false
  let isParticipant = false

  if (viewerUserId) {
    isCreator = data.creator_id === viewerUserId
    const { data: participantData } = await supabase
      .from('participants')
      .select('id')
      .eq('tournament_id', id)
      .eq('user_id', viewerUserId)
      .maybeSingle()

    isParticipant = !!participantData
  }

  return {
    ...data,
    participantCount: count || 0,
    isCreator,
    isParticipant,
  }
}

/**
 * Busca um torneio por ID com enriquecimento de dados (utilizador autenticado)
 */
export async function getTournamentById(id: string, userId: string): Promise<TournamentWithParticipants> {
  return getTournamentByIdForViewer(id, userId)
}

/**
 * Busca todos os participantes de um torneio com dados do perfil
 */
export async function getTournamentParticipants(
  tournamentId: string
): Promise<Array<Participant & {
  profile?: { nickname: string | null; avatar_url: string | null; email: string } | null
}>> {
  const { data, error } = await supabase
    .from('participants')
    .select(
      `
      *,
      profile:user_id (
        nickname,
        avatar_url,
        email
      )
    `
    )
    .eq('tournament_id', tournamentId)

  if (error) {
    console.error('Erro ao buscar participantes:', error.message)
    throw new Error(`Falha ao buscar participantes: ${error.message}`)
  }

  return (data || []) as Array<Participant & {
    profile?: { nickname: string | null; avatar_url: string | null; email: string } | null
  }>
}

/**
 * Garante que existe uma conexão entre dois usuários na tabela `connections`.
 *
 * Gatilho: chamado quando um jogador entra em um lobby OU quando um torneio é finalizado.
 * Para cada par (participante ↔ admin) e (participante ↔ participante) que ainda não
 * possuir registro, insere uma nova linha.
 *
 * Esquema esperado na tabela `connections`:
 *   id          uuid primary key
 *   user_a      uuid references auth.users
 *   user_b      uuid references auth.users
 *   source      text ('tournament' | 'lobby')
 *   created_at  timestamptz
 *
 * Constraint: UNIQUE (LEAST(user_a, user_b), GREATEST(user_a, user_b))
 * garantindo que a conexão é bidirecional e sem duplicatas.
 *
 * @param userA  - ID do primeiro usuário (ex: participante)
 * @param userB  - ID do segundo usuário (ex: admin ou outro participante)
 * @param source - Origem do vínculo ('tournament' | 'lobby')
 */
export async function ensureConnection(
  userA: string,
  userB: string,
  source: 'tournament' | 'lobby' = 'tournament'
): Promise<void> {
  if (userA === userB) return

  // upsert ignora conflito caso a conexão já exista (onConflict = constraint única)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('connections')
    .upsert(
      {
        user_a: userA < userB ? userA : userB,
        user_b: userA < userB ? userB : userA,
        source,
      },
      { onConflict: 'user_a,user_b', ignoreDuplicates: true }
    )

  if (error) {
    console.error('Erro ao registrar conexão:', error.message)
  }
}

/**
 * Busca os jogadores recentes de um usuário (últimas conexões registradas),
 * retornando dados de perfil para popular o `recentPlayersAtom`.
 *
 * @param userId - ID do usuário autenticado
 * @param limit  - Número máximo de conexões retornadas (padrão: 20)
 */
export async function fetchRecentPlayers(
  userId: string,
  limit = 20
): Promise<Array<{ id: string; name: string; avatar: string | null; lastPlayed: string }>> {
  // Busca conexões onde o usuário é user_a ou user_b, ordenado pelo mais recente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('connections')
    .select(
      `
      created_at,
      user_a,
      user_b,
      profile_a:user_a ( nickname, avatar_url, email ),
      profile_b:user_b ( nickname, avatar_url, email )
    `
    )
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Erro ao buscar conexões recentes:', error.message)
    return []
  }

  return (data || []).map((row: any) => {
    const isA = row.user_a === userId
    const otherId = isA ? row.user_b : row.user_a
    const profile = isA ? row.profile_b : row.profile_a
    return {
      id: otherId,
      name: profileDisplayName(profile),
      avatar: profile?.avatar_url || null,
      lastPlayed: row.created_at,
    }
  })
}

/**
 * Cancela um torneio ativo, alterando seu status para 'cancelled'
 */
export async function cancelTournament(id: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) {
    console.error('Erro ao cancelar torneio:', error.message)
    throw new Error(`Falha ao cancelar torneio: ${error.message}`)
  }
}

/**
 * Marca o torneio como encerrado no banco, apenas se ainda estiver `active` (idempotente).
 * Retorna true se uma linha foi atualizada.
 */
export async function markTournamentFinishedIfStillActive(tournamentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('tournaments')
    .update({ status: 'finished' })
    .eq('id', tournamentId)
    .eq('status', 'active')
    .select('id')

  if (error) {
    console.error('Erro ao finalizar torneio:', error.message)
    return false
  }

  const rows = Array.isArray(data) ? data : data ? [data] : []
  return rows.length > 0
}

/**
 * Atualiza o nome do time de um participante (usado pelo Lobby de Atribuição)
 */
export async function updateParticipantTeamName(
  participantId: string,
  teamName: string
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update({ team_name: teamName })
    .eq('id', participantId)

  if (error) {
    console.error('Erro ao atualizar nome do time:', error.message)
    throw new Error(`Falha ao atualizar time: ${error.message}`)
  }
}

/**
 * Popula um torneio com participantes fictícios para testes (UI só se {@link env.features.enableMockSeed}).
 */
export async function seedMockParticipants(
  tournamentId: string,
  targetTotalParticipants?: number,
  creatorUserId?: string
): Promise<{ inserted: number; totalAfterSeed: number; targetTotal: number }> {
  const normalizedTarget = Number.isFinite(targetTotalParticipants)
    ? Math.max(0, Math.floor(targetTotalParticipants as number))
    : 0

  const { count: currentCount, error: countError } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  if (countError) {
    console.error('Erro ao contar participantes antes do seed:', countError.message)
    throw new Error(`Falha ao preparar seed: ${countError.message}`)
  }

  const currentTotal = currentCount ?? 0
  const targetTotal = normalizedTarget > 0 ? normalizedTarget : currentTotal + 5

  if (currentTotal >= targetTotal) {
    return { inserted: 0, totalAfterSeed: currentTotal, targetTotal }
  }

  let latestTotal = currentTotal
  let attempts = 0
  const maxAttempts = 12

  while (latestTotal < targetTotal && attempts < maxAttempts) {
    attempts += 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('seed_mock_participants', { p_tournament_id: tournamentId })

    if (error) {
      console.error('Erro ao injetar participantes mock:', error.message)
      throw new Error(`Falha ao injetar participantes: ${error.message}`)
    }

    const { count: afterSeedCount, error: recountError } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    if (recountError) {
      console.error('Erro ao contar participantes após seed:', recountError.message)
      throw new Error(`Falha ao validar seed: ${recountError.message}`)
    }

    const nextTotal = afterSeedCount ?? latestTotal
    if (nextTotal <= latestTotal) {
      break
    }

    latestTotal = nextTotal
  }

  if (latestTotal > targetTotal) {
    const overflow = latestTotal - targetTotal

    const { data: seedCandidates, error: candidatesError } = await supabase
      .from('participants')
      .select(
        `
        id,
        user_id,
        joined_at,
        profile:user_id (
          id
        )
      `
      )
      .eq('tournament_id', tournamentId)

    if (candidatesError) {
      console.error('Erro ao buscar candidatos para ajuste de seed:', candidatesError.message)
      throw new Error(`Falha ao ajustar seed: ${candidatesError.message}`)
    }

    const removable = (seedCandidates || [])
      .filter((row) => row.id)
      .filter((row) => (creatorUserId ? row.user_id !== creatorUserId : true))
      .filter((row) => !row.profile)
      .sort((a, b) => {
        const aTime = a.joined_at ? new Date(a.joined_at).getTime() : 0
        const bTime = b.joined_at ? new Date(b.joined_at).getTime() : 0
        return bTime - aTime
      })
      .slice(0, overflow)

    if (removable.length > 0) {
      const idsToDelete = removable.map((row) => row.id)
      const { error: deleteError } = await supabase.from('participants').delete().in('id', idsToDelete)

      if (deleteError) {
        console.error('Erro ao remover excedente de seed mock:', deleteError.message)
        throw new Error(`Falha ao ajustar seed: ${deleteError.message}`)
      }

      latestTotal -= removable.length
    }
  }

  const { error: clearTeamsError } = await supabase
    .from('participants')
    .update({ team_name: null })
    .eq('tournament_id', tournamentId)

  if (clearTeamsError) {
    console.error('Erro ao limpar times apos seed mock:', clearTeamsError.message)
    throw new Error(`Falha ao limpar times apos seed: ${clearTeamsError.message}`)
  }

  if (latestTotal < targetTotal) {
    logger.warn('[seedMockParticipants] Seed parcial. Meta não alcançada.', {
      tournamentId,
      currentTotal,
      latestTotal,
      targetTotal,
      attempts,
    })
  }

  return {
    inserted: Math.max(0, latestTotal - currentTotal),
    totalAfterSeed: latestTotal,
    targetTotal,
  }
}

/**
 * Exclui permanentemente um torneio em rascunho.
 * Assume ON DELETE CASCADE para participantes e partidas;
 * caso contrário, remove as dependências antes.
 */
export async function deleteTournament(id: string): Promise<void> {
  // Remove dependências primeiro (compatível com ou sem ON DELETE CASCADE)
  const { error: participantsError } = await supabase
    .from('participants')
    .delete()
    .eq('tournament_id', id)

  if (participantsError) {
    console.error('Erro ao remover participantes:', participantsError.message)
    throw new Error(`Falha ao remover participantes: ${participantsError.message}`)
  }

  const { error: matchesError } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', id)

  if (matchesError) {
    console.error('Erro ao remover partidas:', matchesError.message)
    throw new Error(`Falha ao remover partidas: ${matchesError.message}`)
  }

  // .select().single() faz o Supabase retornar a linha deletada —
  // se a RLS bloquear ou a linha não existir, retorna PGRST116 (error != null)
  // em vez de um silencioso { data: null, error: null }
  const { error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao excluir torneio:', error.message, error.code)
    throw new Error(`Falha ao excluir torneio: ${error.message}`)
  }
}
