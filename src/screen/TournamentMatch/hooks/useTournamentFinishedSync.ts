import { useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { isTournamentRunComplete } from '../../../lib/tournamentCompletion'
import { markTournamentFinishedIfStillActive } from '../../../lib/tournamentService'
import type { TournamentWithParticipants } from '../../../atoms/tournamentAtoms'
import type { MatchWithTeams, TournamentSettings } from '../../../types/tournament'
import { effectiveParticipantCount } from '../utils/tournamentHelpers'

/**
 * Quando todas as partidas relevantes terminam, grava `tournaments.status = 'finished'`
 * e alinha os átomos (idempotente; cobre realtime e o caso em que o UPDATE já ocorreu em `updateMatchResult`).
 */
export function useTournamentFinishedSync(
  tournament: TournamentWithParticipants | null | undefined,
  matches: MatchWithTeams[],
  participantsLength: number,
  setActiveTournament: (value: TournamentWithParticipants) => void,
  setMyTournaments: (updater: (prev: TournamentWithParticipants[]) => TournamentWithParticipants[]) => void
): void {
  useEffect(() => {
    if (!tournament || tournament.status !== 'active') return
    const settings = tournament.settings as TournamentSettings | null
    const n = effectiveParticipantCount(participantsLength, matches)
    if (!isTournamentRunComplete(matches, settings, n)) return

    let cancelled = false

    ;(async () => {
      const didUpdate = await markTournamentFinishedIfStillActive(tournament.id)
      if (cancelled) return

      if (didUpdate) {
        const next: TournamentWithParticipants = { ...tournament, status: 'finished' }
        setActiveTournament(next)
        setMyTournaments((prev) =>
          prev.map((t) => (t.id === tournament.id ? { ...t, status: 'finished' } : t))
        )
        return
      }

      const { data: row } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournament.id)
        .maybeSingle()

      if (cancelled || row?.status !== 'finished') return

      const next: TournamentWithParticipants = { ...tournament, status: 'finished' }
      setActiveTournament(next)
      setMyTournaments((prev) =>
        prev.map((t) => (t.id === tournament.id ? { ...t, status: 'finished' } : t))
      )
    })()

    return () => {
      cancelled = true
    }
  }, [tournament, matches, participantsLength, setActiveTournament, setMyTournaments])
}
