import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom } from '../../atoms/tournamentAtoms'
import { getTournamentByIdForViewer } from '../../lib/tournamentService'
import { paths } from '../navigation/paths'
import { RouteSpinner } from '../layout/RouteSpinner'

/** /tournaments/:id → redireciona para lobby ou partidas conforme status */
export function TournamentIndexRedirect() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const user = useAtomValue(userAtom)
  const setActive = useSetAtom(activeTournamentAtom)
  const navigate = useNavigate()

  useEffect(() => {
    if (!tournamentId) return

    let cancelled = false

    getTournamentByIdForViewer(tournamentId, user?.id ?? null)
      .then((t) => {
        if (cancelled) return
        setActive(t)
        navigate(
          t.status === 'active' ? paths.tournamentMatches(tournamentId) : paths.tournamentLobby(tournamentId),
          { replace: true }
        )
      })
      .catch(() => {
        if (!cancelled) navigate(paths.home, { replace: true })
      })

    return () => {
      cancelled = true
    }
  }, [tournamentId, user?.id, navigate, setActive])

  if (!tournamentId) {
    return <Navigate to={paths.home} replace />
  }

  return <RouteSpinner label="Abrindo torneio…" />
}
