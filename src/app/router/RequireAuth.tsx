import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { paths } from '../navigation/paths'
import { safeRedirectTarget } from './requireAuthPaths'

/** Rotas que exigem sessão — anon vai para /login com redirect seguro. */
export function RequireAuth() {
  const user = useAtomValue(userAtom)
  const location = useLocation()

  if (!user) {
    const next = `${location.pathname}${location.search}`
    const target = safeRedirectTarget(next)
    const loginSearch = target
      ? `?redirect=${encodeURIComponent(target)}`
      : ''
    return <Navigate to={`${paths.login}${loginSearch}`} replace />
  }

  return <Outlet />
}
