import { supabase } from './supabaseClient'
import type { Tables } from '../types/supabase'
import type { TournamentWithParticipants, Participant } from '../atoms/tournamentAtoms'
import type { TournamentSettings } from '../types/tournament'

type Tournament = Tables<'tournaments'>

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
  initialSettings?: Pick<TournamentSettings, 'isPrivate' | 'maxParticipants' | 'format' | 'playoffCutoff'>
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
    throw new Error(`Falha ao criar torneio: ${error.message}`)
  }

  return data
}

/**
 * Busca torneios do usuário (como criador OU como participante)
 */
export async function fetchMyTournaments(userId: string): Promise<TournamentWithParticipants[]> {
  // 1. Buscar torneios criados pelo usuário
  const { data: createdTournaments, error: createdError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('creator_id', userId)

  if (createdError) {
    console.error('Erro ao buscar torneios criados:', createdError.message)
    throw new Error(`Falha ao buscar torneios: ${createdError.message}`)
  }

  // 2. Buscar torneios onde o usuário é participante
  const { data: participantTournaments, error: participantError } = await supabase
    .from('participants')
    .select('tournament_id')
    .eq('user_id', userId)

  if (participantError) {
    console.error('Erro ao buscar participações:', participantError.message)
    throw new Error(`Falha ao buscar participações: ${participantError.message}`)
  }

  const tournamentIds = participantTournaments?.map((p) => p.tournament_id).filter((id): id is string => id !== null) || []

  let joinedTournaments: Tournament[] = []
  if (tournamentIds.length > 0) {
    const { data: joined, error: joinedError } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', tournamentIds)

    if (joinedError) {
      console.error('Erro ao buscar torneios unidos:', joinedError.message)
    } else {
      joinedTournaments = joined || []
    }
  }

  // 3. Combinar e remover duplicatas
  const allTournaments = [...(createdTournaments || []), ...joinedTournaments]
  const uniqueTournaments = Array.from(
    new Map(allTournaments.map((t) => [t.id, t])).values()
  )

  // 4. Contar participantes e adicionar flags
  const enriched = await Promise.all(
    uniqueTournaments.map(async (tournament) => {
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)

      const isCreator = tournament.creator_id === userId
      const isParticipant = tournamentIds.includes(tournament.id)

      return {
        ...tournament,
        participantCount: count || 0,
        isCreator,
        isParticipant,
      } as TournamentWithParticipants
    })
  )

  return enriched
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

  // 3. Inserir novo participante
  const { data, error } = await supabase
    .from('participants')
    .insert({
      tournament_id: tournament.id,
      user_id: userId,
      team_name: teamName,
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

  // 2. Inserir novo participante
  const { data, error } = await supabase
    .from('participants')
    .insert({
      tournament_id: tournamentId,
      user_id: userId,
      team_name: teamName,
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
 * Busca um torneio por ID com enriquecimento de dados
 */
export async function getTournamentById(
  id: string,
  userId: string
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

  const isCreator = data.creator_id === userId
  const { data: participantData } = await supabase
    .from('participants')
    .select('id')
    .eq('tournament_id', id)
    .eq('user_id', userId)
    .single()

  const isParticipant = !!participantData

  return {
    ...data,
    participantCount: count || 0,
    isCreator,
    isParticipant,
  }
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
      profile_a:user_a ( nickname, avatar_url ),
      profile_b:user_b ( nickname, avatar_url )
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
      name: profile?.nickname || 'Jogador',
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

// ─── DEV ONLY ────────────────────────────────────────────────────────────────
/**
 * Popula um torneio com 5 participantes fictícios para testes em desenvolvimento.
 * Os user_id são UUIDs fixos dedicados ao mock — não são usuários reais.
 */
export async function seedMockParticipants(tournamentId: string): Promise<void> {
  // Usa RPC com SECURITY DEFINER para contornar RLS (user_id fictícios não existem em auth.users)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('seed_mock_participants', { p_tournament_id: tournamentId })

  if (error) {
    console.error('Erro ao injetar participantes mock:', error.message)
    throw new Error(`Falha ao injetar participantes: ${error.message}`)
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
