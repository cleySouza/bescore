import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider'
import { LoginLayout } from '../layout/LoginLayout'
import { AppShellLayout } from '../layout/AppShellLayout'
import { TournamentContextGate } from './TournamentContextGate'
import { TournamentIndexRedirect } from './TournamentIndexRedirect'
import { RequireAuth } from './RequireAuth'
import { RouteSpinner } from '../layout/RouteSpinner'
import Dashboard from '../../screen/Dashboard/Dashboard'
import TournamentLobby from '../../screen/TournamentLobby/TournamentLobby'
import TournamentMatch from '../../screen/TournamentMatch/TournamentMatch'
import CreateTournament from '../../screen/CreateTournament/CreateTournament'
import JoinByCode from '../../screen/JoinByCode/JoinByCode'
import { paths } from '../navigation/paths'

/**
 * Raiz de navegação: um BrowserRouter, URLs estáveis (sem “view” em atom persistido).
 * Rotas públicas no shell; lobby/partidas do torneio leem dados via RLS. Criar/entrar exigem sessão ({@link RequireAuth}).
 */
export function AppRouter() {
  const { loading: authLoading } = useAuth()

  return (
    <BrowserRouter>
      {authLoading ? (
        <RouteSpinner />
      ) : (
        <Routes>
          <Route path="/login" element={<LoginLayout />} />
          <Route element={<AppShellLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tournaments/:tournamentId" element={<TournamentIndexRedirect />} />
            <Route element={<TournamentContextGate />}>
              <Route path="/tournaments/:tournamentId/lobby" element={<TournamentLobby />} />
              <Route path="/tournaments/:tournamentId/matches" element={<TournamentMatch />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path={paths.join} element={<JoinByCode />} />
              <Route path={paths.createTournament} element={<CreateTournament />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={paths.home} replace />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
