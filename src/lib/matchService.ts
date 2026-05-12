import { supabase } from './supabaseClient'
import type { MatchWithTeams, StandingsRow, TournamentSettings } from '../types/tournament'
import { validateKnockoutScoreSubmission, type KnockoutMatchCore } from './playoffKnockout'
import { isTournamentRunComplete } from './tournamentCompletion'
import { markTournamentFinishedIfStillActive } from './tournamentService'

function leagueRoundCountCampeonato(participantCount: number, hasReturnMatch: boolean): number {
  if (participantCount <= 1) return 0
  const baseCount = participantCount % 2 === 0 ? participantCount - 1 : participantCount
  return hasReturnMatch ? baseCount * 2 : baseCount
}

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
        user_id,
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
        user_id,
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

/** Omite colunas de pênaltis; use objeto para gravar ou limpar na fase final do campeonato. */
export type UpdateMatchPenaltyMode =
  | { mode: 'omit' }
  | { mode: 'set'; home: number | null; away: number | null }

/**
 * Atualiza o resultado de uma partida e muda seu status para 'finished'
 */
export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  penaltyMode: UpdateMatchPenaltyMode = { mode: 'omit' }
) {
  const { data: existingRow, error: fetchErr } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle()

  if (fetchErr) {
    console.error('Erro ao carregar partida:', fetchErr.message)
    throw new Error(`Falha ao carregar partida: ${fetchErr.message}`)
  }
  if (!existingRow?.tournament_id) {
    throw new Error('Partida não encontrada.')
  }

  const tournamentId = existingRow.tournament_id as string

  const { data: tournamentRow, error: tournamentErr } = await supabase
    .from('tournaments')
    .select('settings')
    .eq('id', tournamentId)
    .maybeSingle()

  if (tournamentErr) {
    throw new Error(`Falha ao carregar torneio: ${tournamentErr.message}`)
  }

  const settings = (tournamentRow?.settings ?? null) as TournamentSettings | null
  const format = settings?.format ?? 'roundRobin'

  const { count: participantCountRaw } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const participantCount = participantCountRaw ?? 0
  const leagueRc = leagueRoundCountCampeonato(participantCount, settings?.hasReturnMatch ?? false)
  const round = existingRow.round ?? 0

  if (format === 'campeonato' && round > leagueRc) {
    const { data: siblingsRaw } = await supabase
      .from('matches')
      .select(
        'id, round, status, home_participant_id, away_participant_id, home_score, away_score, home_penalties, away_penalties, playoff_pair_index, playoff_leg'
      )
      .eq('tournament_id', tournamentId)
      .eq('round', round)

    const siblingSameRound = (siblingsRaw ?? []) as KnockoutMatchCore[]

    validateKnockoutScoreSubmission({
      format,
      leagueRoundCount: leagueRc,
      playoffTwoLegged: settings?.playoffTwoLegged === true,
      match: existingRow as KnockoutMatchCore,
      siblingSameRound,
      homeScore,
      awayScore,
      homePenalties:
        penaltyMode.mode === 'set' ? penaltyMode.home : ((existingRow as { home_penalties?: number | null }).home_penalties ?? null),
      awayPenalties:
        penaltyMode.mode === 'set' ? penaltyMode.away : ((existingRow as { away_penalties?: number | null }).away_penalties ?? null),
    })
  }

  const patch: Record<string, unknown> = {
    home_score: homeScore,
    away_score: awayScore,
    status: 'finished',
    updated_at: new Date().toISOString(),
  }

  if (format === 'campeonato' && round > leagueRc && penaltyMode.mode === 'set') {
    patch.home_penalties = penaltyMode.home
    patch.away_penalties = penaltyMode.away
  }

  // Não usar .single(): com RLS, o UPDATE pode aplicar-se mas o SELECT devolver 0 linhas —
  // o PostgREST então falha com "Cannot coerce o resultado para um único objeto".
  const { data, error } = await supabase.from('matches').update(patch).eq('id', matchId).select('id')

  if (error) {
    console.error('Erro ao atualizar resultado:', error.message)
    throw new Error(`Falha ao atualizar resultado: ${error.message}`)
  }

  const rows = Array.isArray(data) ? data : data ? [data] : []
  if (rows.length === 0) {
    throw new Error(
      'Não foi possível salvar o placar (nenhuma linha atualizada). Peça ao admin para conferir no Supabase as políticas RLS de UPDATE/SELECT na tabela matches para participantes da partida.'
    )
  }

  const { data: completionMatchesRaw } = await supabase
    .from('matches')
    .select(
      'id, round, status, home_participant_id, away_participant_id, home_score, away_score, home_penalties, away_penalties, playoff_pair_index, playoff_leg'
    )
    .eq('tournament_id', tournamentId)

  const completionMatches = (completionMatchesRaw ?? []) as MatchWithTeams[]
  if (isTournamentRunComplete(completionMatches, settings, participantCount)) {
    await markTournamentFinishedIfStillActive(tournamentId)
  }

  return rows[0]
}

/** Filtro opcional: número = só aquela rodada; objeto = `maxRound` limita à fase de liga no campeonato */
export type TournamentStandingsQuery =
  | number
  | {
      round?: number
      maxRound?: number
    }

type FinishedMatchLite = {
  home_participant_id: string | null
  away_participant_id: string | null
  home_score: number | null
  away_score: number | null
}

type StandingsAccumulator = {
  participant_id: string
  user_id: string | null
  team_name: string
  user_nickname: string
  user_avatar_url: string | null
  total_matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  match_points: number
  penalty_points: number
  penalty_reason: string | null
  points: number
  position: number
}

function miniLeagueMap(
  memberIds: Set<string>,
  matches: FinishedMatchLite[]
): Map<string, { wins: number; draws: number; losses: number; gf: number; ga: number }> {
  const map = new Map<string, { wins: number; draws: number; losses: number; gf: number; ga: number }>()
  for (const id of memberIds) {
    map.set(id, { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 })
  }

  for (const m of matches) {
    const h = m.home_participant_id
    const a = m.away_participant_id
    if (!h || !a || !memberIds.has(h) || !memberIds.has(a)) continue
    if (m.home_score === null || m.away_score === null) continue

    const hs = Number(m.home_score)
    const as = Number(m.away_score)
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue

    const rh = map.get(h)
    const ra = map.get(a)
    if (!rh || !ra) continue

    rh.gf += hs
    rh.ga += as
    ra.gf += as
    ra.ga += hs

    if (hs > as) {
      rh.wins += 1
      ra.losses += 1
    } else if (hs < as) {
      ra.wins += 1
      rh.losses += 1
    } else {
      rh.draws += 1
      ra.draws += 1
    }
  }

  return map
}

function compareMiniLeague(
  aId: string,
  bId: string,
  mini: Map<string, { wins: number; draws: number; losses: number; gf: number; ga: number }>
): number {
  const a = mini.get(aId)
  const b = mini.get(bId)
  if (!a || !b) return aId.localeCompare(bId)

  const pts = (x: typeof a) => x.wins * 3 + x.draws
  const gd = (x: typeof a) => x.gf - x.ga

  if (pts(b) !== pts(a)) return pts(b) - pts(a)
  if (b.wins !== a.wins) return b.wins - a.wins
  const gdB = gd(b)
  const gdA = gd(a)
  if (gdB !== gdA) return gdB - gdA
  if (b.gf !== a.gf) return b.gf - a.gf
  return aId.localeCompare(bId)
}

/** Critério: pontos (só jogos) → vitórias → saldo → gols pró → confronto direto entre empatados */
function sortStandingsWithCriteria(rows: StandingsAccumulator[], matches: FinishedMatchLite[]): StandingsAccumulator[] {
  const primaryCmp = (a: StandingsAccumulator, b: StandingsAccumulator): number => {
    if (b.match_points !== a.match_points) return b.match_points - a.match_points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return 0
  }

  const sorted = [...rows].sort(primaryCmp)

  const sameBucket = (a: StandingsAccumulator, b: StandingsAccumulator) =>
    a.match_points === b.match_points &&
    a.wins === b.wins &&
    a.goal_difference === b.goal_difference &&
    a.goals_for === b.goals_for

  const out: StandingsAccumulator[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && sameBucket(sorted[i], sorted[j])) j++

    const slice = sorted.slice(i, j)
    if (slice.length === 1) {
      out.push(slice[0])
    } else {
      const ids = new Set(slice.map((r) => r.participant_id))
      const mini = miniLeagueMap(ids, matches)
      slice.sort((a, b) => compareMiniLeague(a.participant_id, b.participant_id, mini))
      out.push(...slice)
    }
    i = j
  }

  return out
}

/**
 * Calcula a classificação a partir dos jogos finalizados.
 * Ordenação: pontos (jogos) → vitórias → saldo → gols pró → confronto direto.
 */
export async function getTournamentStandings(
  tournamentId: string,
  query?: TournamentStandingsQuery
): Promise<StandingsRow[]> {
  try {
    let roundEq: number | undefined
    let maxRound: number | undefined

    if (typeof query === 'number') {
      roundEq = query
    } else if (query && typeof query === 'object') {
      roundEq = query.round
      maxRound = query.maxRound
    }

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

    let dbQuery = supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')

    if (roundEq !== undefined) {
      dbQuery = dbQuery.eq('round', roundEq)
    } else if (maxRound !== undefined) {
      dbQuery = dbQuery.lte('round', maxRound)
    }

    const { data: matches, error: matchesError } = await dbQuery

    if (matchesError) throw matchesError

    const standings = new Map<string, StandingsAccumulator>()

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
        match_points: 0,
        penalty_points: p.penalty_points ?? 0,
        penalty_reason: p.penalty_reason ?? null,
        points: 0,
        position: 0,
      })
    })

    matches?.forEach((match) => {
      if (match.home_score === null || match.away_score === null) return
      if (!match.home_participant_id || !match.away_participant_id) return

      const homeRow = standings.get(match.home_participant_id)
      const awayRow = standings.get(match.away_participant_id)

      if (!homeRow || !awayRow) return

      const hs = Number(match.home_score)
      const as = Number(match.away_score)
      if (!Number.isFinite(hs) || !Number.isFinite(as)) return

      homeRow.total_matches += 1
      awayRow.total_matches += 1

      homeRow.goals_for += hs
      homeRow.goals_against += as
      awayRow.goals_for += as
      awayRow.goals_against += hs

      if (hs > as) {
        homeRow.wins += 1
        homeRow.match_points += 3
        awayRow.losses += 1
      } else if (hs < as) {
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

    const forSort: StandingsAccumulator[] = Array.from(standings.values()).map((row) => ({
      ...row,
      goal_difference: row.goals_for - row.goals_against,
      points: row.match_points + (row.penalty_points ?? 0),
    }))

    const tiebreakerMatches: FinishedMatchLite[] = (matches ?? []).map((m) => ({
      home_participant_id: m.home_participant_id,
      away_participant_id: m.away_participant_id,
      home_score: m.home_score,
      away_score: m.away_score,
    }))

    const sorted = sortStandingsWithCriteria(forSort, tiebreakerMatches)

    const result = sorted.map((row, index) => ({
      ...row,
      position: index + 1,
    }))

    return result as StandingsRow[]
  } catch (error) {
    console.error('Erro ao calcular classificação:', error)
    throw new Error(`Falha ao buscar classificação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}
