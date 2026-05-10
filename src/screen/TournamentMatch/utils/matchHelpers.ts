import type { MatchWithTeams } from '../../../types/tournament'

interface SnapshotStatRow {
  participantId: string
  points: number
  wins: number
  goalsFor: number
  goalsAgainst: number
}

export function getMatchesWithSnapshotPositions(matches: MatchWithTeams[]) {
  const stats = new Map<string, SnapshotStatRow>()

  const ensureStat = (participantId: string | null | undefined) => {
    if (!participantId) return
    if (stats.has(participantId)) return
    stats.set(participantId, {
      participantId,
      points: 0,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    })
  }

  const sortedMatches = [...matches].sort((left, right) => {
    const leftStamp = left.updated_at ?? left.created_at ?? ''
    const rightStamp = right.updated_at ?? right.created_at ?? ''
    return leftStamp.localeCompare(rightStamp)
  })

  return sortedMatches.map((match) => {
    const homeId = match.home_participant_id
    const awayId = match.away_participant_id
    const isFinished = match.status === 'finished' && match.home_score !== null && match.away_score !== null

    ensureStat(homeId)
    ensureStat(awayId)

    if (isFinished && homeId && awayId) {
      const homeStat = stats.get(homeId)
      const awayStat = stats.get(awayId)

      if (homeStat && awayStat) {
        homeStat.goalsFor += match.home_score ?? 0
        homeStat.goalsAgainst += match.away_score ?? 0
        awayStat.goalsFor += match.away_score ?? 0
        awayStat.goalsAgainst += match.home_score ?? 0

        if ((match.home_score ?? 0) > (match.away_score ?? 0)) {
          homeStat.points += 3
          homeStat.wins += 1
        } else if ((match.home_score ?? 0) < (match.away_score ?? 0)) {
          awayStat.points += 3
          awayStat.wins += 1
        } else {
          homeStat.points += 1
          awayStat.points += 1
        }
      }
    }

    const ranking = [...stats.values()].sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points
      if (right.wins !== left.wins) return right.wins - left.wins

      const leftGoalDiff = left.goalsFor - left.goalsAgainst
      const rightGoalDiff = right.goalsFor - right.goalsAgainst
      if (rightGoalDiff !== leftGoalDiff) return rightGoalDiff - leftGoalDiff

      if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor
      return left.participantId.localeCompare(right.participantId)
    })

    const positionByParticipant = new Map(ranking.map((row, index) => [row.participantId, index + 1]))

    return {
      match,
      homePosition: homeId ? positionByParticipant.get(homeId) ?? null : null,
      awayPosition: awayId ? positionByParticipant.get(awayId) ?? null : null,
    }
  })
}

export function normalizeMatchForDrawer(match: MatchWithTeams): MatchWithTeams {
  return {
    ...match,
    homeTeam: match.homeTeam
      ? {
          id: String(match.homeTeam.id),
          team_name: String(match.homeTeam.team_name ?? 'TBD'),
          profile: match.homeTeam.profile
            ? {
                id: match.homeTeam.profile.id ?? null,
                nickname: match.homeTeam.profile.nickname ?? null,
                avatar_url: match.homeTeam.profile.avatar_url ?? null,
                email: match.homeTeam.profile.email ?? null,
              }
            : undefined,
        }
      : undefined,
    awayTeam: match.awayTeam
      ? {
          id: String(match.awayTeam.id),
          team_name: String(match.awayTeam.team_name ?? 'TBD'),
          profile: match.awayTeam.profile
            ? {
                id: match.awayTeam.profile.id ?? null,
                nickname: match.awayTeam.profile.nickname ?? null,
                avatar_url: match.awayTeam.profile.avatar_url ?? null,
                email: match.awayTeam.profile.email ?? null,
              }
            : undefined,
        }
      : undefined,
  }
}