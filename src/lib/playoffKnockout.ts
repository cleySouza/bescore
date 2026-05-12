import type { MatchWithTeams, TournamentFormat } from '../types/tournament'

/** Campos mínimos para validação / avanço de mata-mata */
export type KnockoutMatchCore = Pick<
  MatchWithTeams,
  | 'id'
  | 'round'
  | 'status'
  | 'home_participant_id'
  | 'away_participant_id'
  | 'home_score'
  | 'away_score'
  | 'home_penalties'
  | 'away_penalties'
  | 'playoff_pair_index'
  | 'playoff_leg'
>

export function inferScores(homeScore: number | null, awayScore: number | null): [number, number] | null {
  if (homeScore === null || awayScore === null) return null
  const h = Number(homeScore)
  const a = Number(awayScore)
  if (Number.isNaN(h) || Number.isNaN(a)) return null
  return [h, a]
}

/** Partida única de mata-mata: vencedor ou null se pendente / empate sem pênaltis válidos */
export function resolveSingleLegKnockoutWinner(m: KnockoutMatchCore): string | null {
  if (m.status !== 'finished') return null
  const scores = inferScores(m.home_score, m.away_score)
  if (!scores) return null
  const [hs, as] = scores
  if (hs > as && m.home_participant_id) return m.home_participant_id
  if (as > hs && m.away_participant_id) return m.away_participant_id
  const hp = m.home_penalties
  const ap = m.away_penalties
  if (typeof hp !== 'number' || typeof ap !== 'number' || hp === ap) return null
  if (hp > ap && m.home_participant_id) return m.home_participant_id
  if (ap > hp && m.away_participant_id) return m.away_participant_id
  return null
}

function sortLegs(a: KnockoutMatchCore, b: KnockoutMatchCore): number {
  return (a.playoff_leg ?? 0) - (b.playoff_leg ?? 0)
}

/**
 * leg1: mandante A vs visitante B
 * leg2: mandante B vs visitante A (invertido)
 */
export function resolveTwoLegKnockoutWinner(leg1: KnockoutMatchCore, leg2: KnockoutMatchCore): string | null {
  if (leg1.status !== 'finished' || leg2.status !== 'finished') return null

  const A = leg1.home_participant_id
  const B = leg1.away_participant_id
  if (!A || !B) return null
  if (leg2.home_participant_id !== B || leg2.away_participant_id !== A) return null

  const s1 = inferScores(leg1.home_score, leg1.away_score)
  const s2 = inferScores(leg2.home_score, leg2.away_score)
  if (!s1 || !s2) return null

  const goalsA = s1[0] + s2[1]
  const goalsB = s1[1] + s2[0]

  if (goalsA > goalsB) return A
  if (goalsB > goalsA) return B

  const hp = leg2.home_penalties
  const ap = leg2.away_penalties
  if (typeof hp !== 'number' || typeof ap !== 'number' || hp === ap) return null
  // Na volta, mandante é B (leg2.home)
  if (hp > ap && leg2.home_participant_id) return leg2.home_participant_id
  if (ap > hp && leg2.away_participant_id) return leg2.away_participant_id
  return null
}

export function groupKnockoutPairs(matches: KnockoutMatchCore[]): Map<number, KnockoutMatchCore[]> {
  const map = new Map<number, KnockoutMatchCore[]>()
  for (const m of matches) {
    const ix = m.playoff_pair_index
    if (ix === null || ix === undefined) continue
    if (!map.has(ix)) map.set(ix, [])
    map.get(ix)!.push(m)
  }
  for (const [, arr] of map) {
    arr.sort(sortLegs)
  }
  return map
}

/** Todas as duplas (ida+volta) com índice de confronto estão resolvidas com vencedor. */
export function allTwoLegPairsResolved(matches: KnockoutMatchCore[]): boolean {
  const pairs = groupKnockoutPairs(matches)
  if (pairs.size === 0) return false
  for (const [, legs] of pairs) {
    if (legs.length !== 2) return false
    const [l1, l2] = legs
    if (resolveTwoLegKnockoutWinner(l1, l2) === null) return false
  }
  return true
}

export function extractTwoLegWinners(matches: KnockoutMatchCore[]): string[] {
  const pairs = groupKnockoutPairs(matches)
  const sortedKeys = [...pairs.keys()].sort((a, b) => a - b)
  const winners: string[] = []
  for (const k of sortedKeys) {
    const legs = pairs.get(k)!
    const [l1, l2] = legs
    const w = resolveTwoLegKnockoutWinner(l1, l2)
    if (!w) throw new Error(`Confronto ${k} sem vencedor definido`)
    winners.push(w)
  }
  return winners
}

export function extractSingleLegWinnersInOrder(matches: KnockoutMatchCore[]): string[] {
  const sorted = [...matches].sort((a, b) => {
    const pa = a.playoff_pair_index
    const pb = b.playoff_pair_index
    if (pa != null && pb != null && pa !== pb) return pa - pb
    if (pa != null && pb == null) return -1
    if (pa == null && pb != null) return 1
    return a.id.localeCompare(b.id)
  })
  return sorted.map((m) => {
    const w = resolveSingleLegKnockoutWinner(m)
    if (!w) throw new Error(`Partida ${m.id} sem vencedor definido`)
    return w
  })
}

/** Agregado com leg1 (ida: A x B) e placares da volta (mandante da volta = B). */
export function isTwoLegAggregateTie(
  leg1: KnockoutMatchCore,
  leg2HomeScore: number,
  leg2AwayScore: number
): boolean {
  const s1 = inferScores(leg1.home_score, leg1.away_score)
  if (!s1) return false
  const goalsA = s1[0] + leg2AwayScore
  const goalsB = s1[1] + leg2HomeScore
  return goalsA === goalsB
}

export function validateKnockoutScoreSubmission(opts: {
  format: TournamentFormat
  leagueRoundCount: number
  playoffTwoLegged: boolean
  match: KnockoutMatchCore
  siblingSameRound: KnockoutMatchCore[]
  homeScore: number
  awayScore: number
  homePenalties: number | null
  awayPenalties: number | null
}): void {
  const {
    format,
    leagueRoundCount,
    playoffTwoLegged,
    match,
    siblingSameRound,
    homeScore,
    awayScore,
    homePenalties,
    awayPenalties,
  } = opts
  const round = match.round ?? 0
  if (format !== 'campeonato' || round <= leagueRoundCount) return

  const pensOk =
    homePenalties !== null &&
    awayPenalties !== null &&
    Number.isFinite(homePenalties) &&
    Number.isFinite(awayPenalties) &&
    homePenalties !== awayPenalties

  if (!playoffTwoLegged || match.playoff_leg == null) {
    if (homeScore === awayScore && !pensOk) {
      throw new Error('Empate no mata-mata: informe os pênaltis (dois valores diferentes).')
    }
    return
  }

  const leg = match.playoff_leg
  if (leg === 1) return

  if (leg === 2) {
    const leg1 = siblingSameRound.find(
      (m) =>
        m.playoff_leg === 1 &&
        m.playoff_pair_index === match.playoff_pair_index &&
        m.id !== match.id
    )
    if (!leg1) throw new Error('Não foi encontrado o jogo de ida deste confronto.')
    if (leg1.status !== 'finished') throw new Error('Salve primeiro o resultado da ida.')

    const aggTie = isTwoLegAggregateTie(leg1, homeScore, awayScore)
    if (aggTie && !pensOk) {
      throw new Error('Empate no agregado: informe os pênaltis na volta (valores diferentes).')
    }
    if (!aggTie && pensOk) {
      throw new Error('O agregado já define o vencedor — não informe pênaltis.')
    }
  }
}

/** Semifinais todas finalizadas e com vencedor definido (inclui pênaltis quando necessário). */
export function canAdvanceFromSemifinalsToFinal(
  semifinalMatches: KnockoutMatchCore[],
  twoLegged: boolean
): boolean {
  if (semifinalMatches.length === 0) return false
  if (!semifinalMatches.every((m) => m.status === 'finished')) return false

  const hasIndexedTwoLeg =
    twoLegged && semifinalMatches.some((m) => m.playoff_leg === 1 || m.playoff_leg === 2)

  if (hasIndexedTwoLeg) {
    return semifinalMatches.length === 4 && allTwoLegPairsResolved(semifinalMatches)
  }

  return semifinalMatches.length >= 2 && semifinalMatches.every((m) => resolveSingleLegKnockoutWinner(m) !== null)
}

export function extractSemifinalWinnersForFinal(
  semifinalMatches: KnockoutMatchCore[],
  twoLegged: boolean
): string[] {
  const hasIndexedTwoLeg =
    twoLegged && semifinalMatches.some((m) => m.playoff_leg === 1 || m.playoff_leg === 2)

  if (hasIndexedTwoLeg) {
    return extractTwoLegWinners(semifinalMatches)
  }
  return extractSingleLegWinnersInOrder(semifinalMatches)
}
