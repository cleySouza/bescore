import type { Tournament } from '../../../atoms/tournamentAtoms'
import type { MatchWithTeams, TournamentSettings } from '../../../types/tournament'

interface SideSummary {
  teamName: string
  nickname: string
}

function getRoundRobinRoundCount(participantCount: number, hasReturnMatch = false): number {
  if (participantCount <= 1) return 0
  const baseCount = participantCount % 2 === 0 ? participantCount - 1 : participantCount
  return hasReturnMatch ? baseCount * 2 : baseCount
}

export function getTournamentSettings(
  tournament: Tournament,
  userId: string,
  strapiShieldsMap: Record<string, string>,
  participantCount: number = 0
) {
  const isCreator = tournament.creator_id === userId
  const tournamentSettings = tournament.settings as TournamentSettings | null
  const isCampeonato = tournamentSettings?.format === 'campeonato'
  const hasReturnMatch = tournamentSettings?.hasReturnMatch ?? false
  const playoffCutoff = isCampeonato ? (tournamentSettings?.playoffCutoff ?? 2) : undefined
  
  const managedTeamOptions = Array.isArray(tournamentSettings?.selectedTeamNames)
    ? tournamentSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []

  const shieldsMap: Record<string, string> = {
    ...strapiShieldsMap,
    ...(tournamentSettings?.selectedTeamShields ?? {}),
  }

  // Calcular leagueRoundCount baseado nos participantes
  const leagueRoundCount = isCampeonato 
    ? getRoundRobinRoundCount(participantCount, hasReturnMatch)
    : 0

  return {
    isCreator,
    tournamentSettings,
    isCampeonato,
    hasReturnMatch,
    playoffCutoff,
    managedTeamOptions,
    shieldsMap,
    leagueRoundCount,
  }
}

export function getMatchesByPhase(
  matches: MatchWithTeams[],
  options: {
    isCampeonato: boolean
    leagueRoundCount: number
    phaseFilter: 'league' | 'playoff'
    legFilter: 'first' | 'second'
    hasReturnMatch: boolean
    participants: number
  }
) {
  const { isCampeonato, leagueRoundCount, phaseFilter, legFilter, hasReturnMatch, participants } = options

  const leagueMatches = isCampeonato
    ? matches.filter((m) => m.round !== null && m.round <= leagueRoundCount)
    : matches
    
  const playoffMatches = isCampeonato
    ? matches.filter((m) => m.round !== null && m.round > leagueRoundCount)
    : []

  const hasPlayoffStarted = playoffMatches.length > 0
  const isLeagueFinished = isCampeonato && leagueMatches.length > 0 && leagueMatches.every((m) => m.status === 'finished')
  const pendingCount = matches.filter((m) => m.status === 'pending').length

  // Group matches by round
  const matchesByRound = new Map<number, MatchWithTeams[]>()
  for (const m of matches) {
    const arr = matchesByRound.get(m.round) ?? []
    arr.push(m)
    matchesByRound.set(m.round, arr)
  }

  // Filter rounds based on phase and leg
  const entries = Array.from(matchesByRound.entries()).sort(([a], [b]) => a - b)
  let filteredRoundEntries: [number, MatchWithTeams[]][] = []

  if (isCampeonato && phaseFilter === 'playoff') {
    filteredRoundEntries = entries
      .filter(([round]) => round > leagueRoundCount)
      .sort(([a], [b]) => a - b)
  } else if (isCampeonato) {
    const leagueEntries = entries.filter(([round]) => round <= leagueRoundCount)
    if (!hasReturnMatch) {
      filteredRoundEntries = leagueEntries
    } else {
      const leagueBaseRoundCount = getRoundRobinRoundCount(participants, false)
      filteredRoundEntries = leagueEntries.filter(([round]) => {
        if (legFilter === 'first') return round <= leagueBaseRoundCount
        return round > leagueBaseRoundCount
      })
    }
  } else {
    if (!hasReturnMatch) {
      filteredRoundEntries = entries
    } else {
      const maxRound = matches.length > 0 ? Math.max(...matches.map((m) => m.round ?? 0)) : 0
      const regularSplitRound = Math.floor(maxRound / 2)
      filteredRoundEntries = entries.filter(([round]) => {
        if (legFilter === 'first') return round <= regularSplitRound
        return round > regularSplitRound
      })
    }
  }

  // Get playoff results
  const playoffFinalMatch = getPlayoffFinalMatch(playoffMatches)
  const playoffChampion = playoffFinalMatch ? getFinishedWinner(playoffFinalMatch) : null
  const playoffVice = playoffFinalMatch ? getFinishedLoser(playoffFinalMatch) : null

  return {
    leagueMatches,
    playoffMatches,
    hasPlayoffStarted,
    isLeagueFinished,
    pendingCount,
    filteredRoundEntries,
    playoffChampion,
    playoffVice,
  }
}

function getPlayoffFinalMatch(playoffMatches: MatchWithTeams[]): MatchWithTeams | undefined {
  const playoffRounds = [...new Set(playoffMatches.map((m) => m.round))].sort((a, b) => a - b)
  const finalsRoundMatches = playoffRounds.length > 1
    ? playoffMatches.filter((m) => m.round === playoffRounds[1])
    : playoffMatches
  return finalsRoundMatches[0]
}

function getMatchSideSummary(match: MatchWithTeams, side: 'home' | 'away'): SideSummary {
  const team = side === 'home' ? match.homeTeam : match.awayTeam
  return {
    teamName: team?.team_name || 'A definir',
    nickname: team?.profile?.nickname || '—',
  }
}

function getFinishedWinner(match: MatchWithTeams): SideSummary | null {
  if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
    return null
  }
  if (match.home_score === match.away_score) return null
  return match.home_score > match.away_score
    ? getMatchSideSummary(match, 'home')
    : getMatchSideSummary(match, 'away')
}

function getFinishedLoser(match: MatchWithTeams): SideSummary | null {
  if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
    return null
  }
  if (match.home_score === match.away_score) return null
  return match.home_score < match.away_score
    ? getMatchSideSummary(match, 'home')
    : getMatchSideSummary(match, 'away')
}

export function getRoundLabel(round: number, isCampeonato: boolean, leagueRoundCount: number, playoffCutoff?: number): string {
  if (isCampeonato && round > leagueRoundCount) {
    const playoffRound = round - leagueRoundCount
    if (playoffCutoff === 4) {
      if (playoffRound === 1) return '🏆 Semifinais'
      if (playoffRound === 2) return '🏆 Final'
    } else if (playoffCutoff === 2) {
      return '🏆 Final'
    }
    return `🏆 Fase Final ${playoffRound}`
  }
  return `Rodada ${round}`
}