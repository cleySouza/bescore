import { supabase } from './supabaseClient'
import type { MatchWithTeams, StandingsRow } from '../types/tournament'

/**
 * Atualiza dados administrativos de um participante (somente criador).
 * Permite alterar team_name, penalty_points e penalty_reason.
 */
export async function updateParticipantAdmin(
  participantId: string,
  updates: {
    team_name?: string
    penalty_points?: number
    penalty_reason?: string | null
  }
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update(updates)
    .eq('id', participantId)

  if (error) {
    throw new Error(`Falha ao atualizar participante: ${error.message}`)
  }
}

/**
 * Busca todas as partidas de um torneio com dados dos participantes
 */
export async function getTournamentMatches(tournamentId: string): Promise<MatchWithTeams[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      `
      *,
      home_team:home_participant_id (
        id,
        team_name,
        profile:user_id (
          id,
          nickname,
          avatar_url,
          email
        )
      ),
      away_team:away_participant_id (
        id,
        team_name,
        profile:user_id (
          id,
          nickname,
          avatar_url,
          email
        )
      )
    `
    )
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })

  if (error) {
    console.error('Erro ao buscar partidas:', error.message)
    throw new Error(`Falha ao buscar partidas: ${error.message}`)
  }

  // Supabase retorna os joins como home_team / away_team (snake_case).
  // MatchWithTeams espera homeTeam / awayTeam — mapeamos aqui.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((m: any) => ({
    ...m,
    homeTeam: m.home_team ?? null,
    awayTeam: m.away_team ?? null,
  })) as MatchWithTeams[]
}

/**
 * Atualiza o resultado de uma partida e muda seu status para 'finished'
 */
export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number
) {
  const { data, error } = await supabase
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: 'finished',
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar resultado:', error.message)
    throw new Error(`Falha ao atualizar resultado: ${error.message}`)
  }

  return data
}

/**
 * Calcula a classificação de um torneio a partir dos matches finalizados
 * Cálculo automático: vitórias, empates, derrotas, gols, pontos
 * @param roundFilter - se informado, considera apenas partidas deste round
 */
export async function getTournamentStandings(tournamentId: string, roundFilter?: number): Promise<StandingsRow[]> {
  try {
    // Busca dados dos participantes do torneio
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select(
        `
        id,
        team_name,
        user_id,
        penalty_points,
        penalty_reason,
        profile:user_id (
          id,
          nickname,
          avatar_url
        )
      `
      )
      .eq('tournament_id', tournamentId)

    if (participantsError) throw participantsError

    // Busca matches finalizados (opcionalmente filtrado por round)
    let query = supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')

    if (roundFilter !== undefined) {
      query = query.eq('round', roundFilter)
    }

    const { data: matches, error: matchesError } = await query

    if (matchesError) throw matchesError

    // Cálcula standings
    const standings = new Map<string, any>()

    // Inicializa cada participante
    participants?.forEach((p) => {
      standings.set(p.id, {
        participant_id: p.id,
        user_id: p.user_id,
        team_name: p.team_name || '',
        user_nickname: p.profile?.nickname || 'Sem nome',
        user_avatar_url: p.profile?.avatar_url || null,
        total_matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        match_points: 0,       // pontos acumulados apenas das partidas
        penalty_points: p.penalty_points ?? 0,
        penalty_reason: p.penalty_reason ?? null,
        points: 0,
        position: 0,
      })
    })

    // Processa matches
    matches?.forEach((match) => {
      if (match.home_score === null || match.away_score === null) return // Ignora matches sem scores completos
      if (!match.home_participant_id || !match.away_participant_id) return // Ignora matches incompletos

      const homeRow = standings.get(match.home_participant_id)
      const awayRow = standings.get(match.away_participant_id)

      if (!homeRow || !awayRow) return

      // Atualiza matches jogados
      homeRow.total_matches += 1
      awayRow.total_matches += 1

      // Atualiza gols
      homeRow.goals_for += match.home_score
      homeRow.goals_against += match.away_score
      awayRow.goals_for += match.away_score
      awayRow.goals_against += match.home_score

      // Calcula resultado
      if (match.home_score > match.away_score) {
        homeRow.wins += 1
        homeRow.match_points += 3
        awayRow.losses += 1
      } else if (match.home_score < match.away_score) {
        homeRow.losses += 1
        awayRow.wins += 1
        awayRow.match_points += 3
      } else {
        homeRow.draws += 1
        homeRow.match_points += 1
        awayRow.draws += 1
        awayRow.match_points += 1
      }
    })

    // Calcula saldo de gols, aplica penalty_points e ordena
    const result = Array.from(standings.values())
      .map((row) => ({
        ...row,
        goal_difference: row.goals_for - row.goals_against,
        points: row.match_points + (row.penalty_points ?? 0),
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return b.goal_difference - a.goal_difference
      })
      .map((row, index) => ({
        ...row,
        position: index + 1,
      }))

    return result as StandingsRow[]
  } catch (error) {
    console.error('Erro ao calcular classificação:', error)
    throw new Error(`Falha ao buscar classificação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}
