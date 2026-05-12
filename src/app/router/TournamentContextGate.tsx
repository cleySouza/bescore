import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useEnsureActiveTournament } from '../hooks/useEnsureActiveTournament'
import { RouteSpinner } from '../layout/RouteSpinner'
import { paths } from '../navigation/paths'

export function TournamentContextGate() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const status = useEnsureActiveTournament(tournamentId)

  if (!tournamentId) return <Navigate to={paths.home} replace />

  if (status === 'idle' || status === 'loading') {
    return <RouteSpinner label="Carregando torneio…" />
  }

  if (status === 'error') {
    return <Navigate to={paths.home} replace />
  }

  return <Outlet />
}
