import type { MatchWithTeams, TournamentSettings } from '../types/tournament'
import {
  resolveSingleLegKnockoutWinner,
  resolveTwoLegKnockoutWinner,
  type KnockoutMatchCore,
} from './playoffKnockout'

function leagueRoundCountCampeonato(participantCount: number, hasReturnMatch: boolean): number {
  if (participantCount <= 1) return 0
  const baseCount = participantCount % 2 === 0 ? participantCount - 1 : participantCount
  return hasReturnMatch ? baseCount * 2 : baseCount
}

/** Mata-mata do campeonato encerrado com campeão definido (espelha a lógica de UI em tournamentHelpers). */
function campeonatoPlayoffChampionResolved(playoffMatches: MatchWithTeams[]): boolean {
  if (playoffMatches.length === 0) return false
  const playoffRounds = [...new Set(playoffMatches.map((m) => m.round ?? 0))].sort((a, b) => a - b)
  const finalRound = playoffRounds[playoffRounds.length - 1]
  const finalsRoundMatches = playoffMatches.filter((m) => m.round === finalRound)
  const core = finalsRoundMatches as KnockoutMatchCore[]

  const twoLegFinal =
    finalsRoundMatches.length === 2 &&
    finalsRoundMatches.some((m) => m.playoff_leg === 1) &&
    finalsRoundMatches.some((m) => m.playoff_leg === 2)

  if (twoLegFinal) {
    const leg1 = core.find((m) => m.playoff_leg === 1)
    const leg2 = core.find((m) => m.playoff_leg === 2)
    if (!leg1 || !leg2) return false
    const winnerId = resolveTwoLegKnockoutWinner(leg1, leg2)
    return winnerId !== null
  }

  if (finalsRoundMatches.length !== 1) return false
  return resolveSingleLegKnockoutWinner(core[0]) !== null
}

/**
 * Indica se todas as partidas relevantes acabaram e o torneio pode ir para `status: 'finished'`.
 * — Formatos não-campeonato: todas as partidas com status `finished`.
 * — Campeonato: fase de pontos corridos completa, mata-mata já gerado, todas as partidas do mata-mata
 *   finalizadas e final com vencedor resolvido.
 */
export function isTournamentRunComplete(
  matches: MatchWithTeams[],
  settings: TournamentSettings | null,
  participantCount: number
): boolean {
  if (matches.length === 0) return false
  const format = settings?.format ?? 'roundRobin'
  if (format !== 'campeonato') {
    return matches.every((m) => m.status === 'finished')
  }

  const hasReturn = settings?.hasReturnMatch ?? false
  const leagueRc = leagueRoundCountCampeonato(participantCount, hasReturn)
  const leagueMatches = matches.filter((m) => m.round != null && (m.round ?? 0) <= leagueRc)
  const playoffMatches = matches.filter((m) => m.round != null && (m.round ?? 0) > leagueRc)

  const isLeagueFinished =
    leagueMatches.length > 0 && leagueMatches.every((m) => m.status === 'finished')
  if (!isLeagueFinished) return false
  if (playoffMatches.length === 0) return false
  if (!playoffMatches.every((m) => m.status === 'finished')) return false

  return campeonatoPlayoffChampionResolved(playoffMatches)
}
