import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom } from '../../atoms/tournamentAtoms'
import { getTournamentById } from '../../lib/tournamentService'
import { paths } from '../navigation/paths'
import { RouteSpinner } from '../layout/RouteSpinner'

/** /tournaments/:id → redireciona para lobby ou partidas conforme status */
export function TournamentIndexRedirect() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const user = useAtomValue(userAtom)
  const setActive = useSetAtom(activeTournamentAtom)
  const navigate = useNavigate()

  useEffect(() => {
    if (!tournamentId || !user?.id) return

    let cancelled = false

    getTournamentById(tournamentId, user.id)
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

  if (!user?.id || !tournamentId) {
    return <Navigate to={paths.home} replace />
  }

  return <RouteSpinner label="Abrindo torneio…" />
}
