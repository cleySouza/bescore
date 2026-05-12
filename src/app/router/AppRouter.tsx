import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider'
import { LoginLayout } from '../layout/LoginLayout'
import { AppShellLayout } from '../layout/AppShellLayout'
import { TournamentContextGate } from './TournamentContextGate'
import { TournamentIndexRedirect } from './TournamentIndexRedirect'
import { RequireAuth } from './RequireAuth'
import { RouteSpinner } from '../layout/RouteSpinner'
import Dashboard from '../../screen/Dashboard/Dashboard'
import { paths } from '../navigation/paths'

const TournamentLobby = lazy(() => import('../../screen/TournamentLobby/TournamentLobby'))
const TournamentMatch = lazy(() => import('../../screen/TournamentMatch/TournamentMatch'))
const CreateTournament = lazy(() => import('../../screen/CreateTournament/CreateTournament'))
const JoinByCode = lazy(() => import('../../screen/JoinByCode/JoinByCode'))

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
              <Route
                path="/tournaments/:tournamentId/lobby"
                element={
                  <Suspense fallback={<RouteSpinner />}>
                    <TournamentLobby />
                  </Suspense>
                }
              />
              <Route
                path="/tournaments/:tournamentId/matches"
                element={
                  <Suspense fallback={<RouteSpinner />}>
                    <TournamentMatch />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<RequireAuth />}>
              <Route
                path={paths.join}
                element={
                  <Suspense fallback={<RouteSpinner />}>
                    <JoinByCode />
                  </Suspense>
                }
              />
              <Route
                path={paths.createTournament}
                element={
                  <Suspense fallback={<RouteSpinner />}>
                    <CreateTournament />
                  </Suspense>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={paths.home} replace />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
