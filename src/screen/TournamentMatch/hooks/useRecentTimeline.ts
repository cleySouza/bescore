import { useEffect, useState, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { myTournamentsAtom, activeTournamentAtom } from '../../../atoms/tournamentAtoms'
import { fetchMyTournaments } from '../../../lib/tournamentService'
import { getTournamentMatches } from '../../../lib/matchService'
import { supabase } from '../../../lib/supabaseClient'
import type { MatchWithTeams, TournamentSettings } from '../../../types/tournament'
import { getMatchesWithSnapshotPositions } from '../utils/matchHelpers'

interface RecentTimelineMatch extends MatchWithTeams {
  loggedParticipantId: string
  tournamentName: string
  tournamentImage: string | null
  homePosition: number | null
  awayPosition: number | null
}

export function useRecentTimeline(userId: string | undefined, refreshKey: number) {
  const myTournaments = useAtomValue(myTournamentsAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const [recentTimelineMatches, setRecentTimelineMatches] = useState<RecentTimelineMatch[]>([])
  const recentTimelineRef = useRef<HTMLDivElement | null>(null)
  const recentTimelineIndexRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    const loadRecentTimelineMatches = async () => {
      try {
        if (!userId) {
          if (!cancelled) setRecentTimelineMatches([])
          return
        }

        const freshTournaments = await fetchMyTournaments(userId).catch(() => myTournaments)

        const { data: myParticipantRows } = await supabase
          .from('participants')
          .select('id')
          .eq('user_id', userId)

        const myParticipantIds = new Set((myParticipantRows ?? []).map((row) => row.id))

        const sourceTournaments = Array.from(
          new Map(
            [...freshTournaments, ...myTournaments, tournament]
              .filter((item): item is NonNullable<typeof tournament> => Boolean(item))
              .map((item) => [item.id, item])
          ).values()
        )

        if (sourceTournaments.length === 0 || !userId) {
          if (!cancelled) setRecentTimelineMatches([])
          return
        }

        const matchesPerTournament = await Promise.all(
          sourceTournaments.map(async (t) => {
            try {
              const tournamentMatches = await getTournamentMatches(t.id)
              return { tournament: t, matches: tournamentMatches }
            } catch {
              return { tournament: t, matches: [] as MatchWithTeams[] }
            }
          })
        )

        const normalized = matchesPerTournament
          .flatMap(({ tournament: t, matches: tournamentMatches }) => {
            const snapshotMatches = getMatchesWithSnapshotPositions(tournamentMatches)
            const settings = (t.settings as TournamentSettings | null) ?? null
            const tournamentName = t.name || 'Torneio'
            const tournamentImage =
              typeof settings?.tournamentImage === 'string' ? settings.tournamentImage : null

            return snapshotMatches.map(({ match, homePosition, awayPosition }) => {
              const loggedIsHome = Boolean(
                (match.home_participant_id && myParticipantIds.has(match.home_participant_id)) ||
                match.homeTeam?.profile?.id === userId
              )
              const loggedIsAway = Boolean(
                (match.away_participant_id && myParticipantIds.has(match.away_participant_id)) ||
                match.awayTeam?.profile?.id === userId
              )

              let loggedParticipantId = ''
              if (loggedIsHome && match.home_participant_id) {
                loggedParticipantId = match.home_participant_id
              }
              if (loggedIsAway && match.away_participant_id) {
                loggedParticipantId = match.away_participant_id
              }

              return {
                ...match,
                loggedParticipantId,
                tournamentName,
                tournamentImage,
                homePosition,
                awayPosition,
              } as RecentTimelineMatch
            })
          })
          .filter((match) =>
            match.status === 'finished' &&
            match.home_score !== null &&
            match.away_score !== null &&
            Boolean(match.loggedParticipantId)
          )
          .sort((left, right) => {
            const leftDate = left.updated_at ?? left.created_at ?? ''
            const rightDate = right.updated_at ?? right.created_at ?? ''
            return rightDate.localeCompare(leftDate)
          })
          .slice(0, 3)
          .sort((left, right) => {
            const leftDate = left.updated_at ?? left.created_at ?? ''
            const rightDate = right.updated_at ?? right.created_at ?? ''
            return leftDate.localeCompare(rightDate)
          })

        if (!cancelled) setRecentTimelineMatches(normalized)
      } catch {
        if (!cancelled) setRecentTimelineMatches([])
      }
    }

    if (userId) {
      loadRecentTimelineMatches()
    }

    return () => {
      cancelled = true
    }
  }, [userId, refreshKey, myTournaments, tournament])

  // Auto-scroll timeline on mobile
  useEffect(() => {
    recentTimelineIndexRef.current = 0
  }, [tournament?.id])

  useEffect(() => {
    const timelineList = recentTimelineRef.current
    if (!timelineList || recentTimelineMatches.length <= 1) {
      return
    }

    const AUTO_SCROLL_DELAY = 3600

    const tick = () => {
      if (window.innerWidth > 900) {
        return
      }

      const cards = Array.from(timelineList.children) as HTMLElement[]
      if (cards.length <= 1) {
        return
      }

      const nextIndex = (recentTimelineIndexRef.current + 1) % cards.length
      recentTimelineIndexRef.current = nextIndex
      cards[nextIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }

    const intervalId = window.setInterval(tick, AUTO_SCROLL_DELAY)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [recentTimelineMatches])

  return {
    recentTimelineMatches,
    recentTimelineRef,
  }
}