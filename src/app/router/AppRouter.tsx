import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider'
import { useAccessControl } from '../../hooks/useAccessControl'
import { Maintenance404 } from '../../screen/Maintenance404/Maintenance404'
import { LoginLayout } from '../layout/LoginLayout'
import { AuthenticatedLayout } from '../layout/AuthenticatedLayout'
import { TournamentContextGate } from './TournamentContextGate'
import { TournamentIndexRedirect } from './TournamentIndexRedirect'
import { RedirectToLogin } from './RedirectToLogin'
import { PostLoginRedirect } from './PostLoginRedirect'
import { RouteSpinner } from '../layout/RouteSpinner'
import Dashboard from '../../screen/Dashboard/Dashboard'
import TournamentLobby from '../../screen/TournamentLobby/TournamentLobby'
import TournamentMatch from '../../screen/TournamentMatch/TournamentMatch'
import CreateTournament from '../../screen/CreateTournament/CreateTournament'
import JoinByCode from '../../screen/JoinByCode/JoinByCode'
import { paths } from '../navigation/paths'

/**
 * Raiz de navegação: um BrowserRouter, URLs estáveis (sem “view” em atom persistido).
 */
export function AppRouter() {
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useAccessControl(user)

  const waitingSessionOrRollout = authLoading || (!!user && accessLoading)

  return (
    <BrowserRouter>
      {waitingSessionOrRollout ? (
        <RouteSpinner />
      ) : !user ? (
        <Routes>
          <Route path="/login" element={<LoginLayout />} />
          <Route path="*" element={<RedirectToLogin />} />
        </Routes>
      ) : !hasAccess ? (
        <Maintenance404 />
      ) : (
        <Routes>
          <Route element={<AuthenticatedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path={paths.join} element={<JoinByCode />} />
            <Route path={paths.createTournament} element={<CreateTournament />} />
            <Route path="/tournaments/:tournamentId" element={<TournamentIndexRedirect />} />
            <Route element={<TournamentContextGate />}>
              <Route path="/tournaments/:tournamentId/lobby" element={<TournamentLobby />} />
              <Route path="/tournaments/:tournamentId/matches" element={<TournamentMatch />} />
            </Route>
          </Route>
          <Route path="/login" element={<PostLoginRedirect />} />
          <Route path="*" element={<Navigate to={paths.home} replace />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
