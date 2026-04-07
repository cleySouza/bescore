import { supabase } from './supabaseClient'
import type { Tables } from '../types/supabase'
import type { TournamentWithParticipants, Participant } from '../atoms/tournamentAtoms'

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
  gameType?: string
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
