import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom } from '../../atoms/tournamentAtoms'
import { getTournamentById } from '../../lib/tournamentService'

export type EnsureTournamentStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Garante que {@link activeTournamentAtom} corresponde ao torneio da URL antes de renderizar lobby/partidas.
 */
export function useEnsureActiveTournament(tournamentId: string | undefined): EnsureTournamentStatus {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const setActive = useSetAtom(activeTournamentAtom)
  const [status, setStatus] = useState<EnsureTournamentStatus>('idle')

  useEffect(() => {
    if (!tournamentId || !user?.id) {
      setStatus('idle')
      return
    }

    if (tournament?.id === tournamentId) {
      setStatus('ready')
      return
    }

    let cancelled = false
    setStatus('loading')

    getTournamentById(tournamentId, user.id)
      .then((t) => {
        if (cancelled) return
        setActive(t)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [tournamentId, user?.id, tournament?.id, setActive])

  return status
}
