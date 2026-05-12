import { Navigate, useSearchParams } from 'react-router-dom'
import { paths } from '../navigation/paths'
import { safeRedirectTarget } from './requireAuthPaths'

/** Utilizador já autenticado em /login — convite deep-link ou redirect seguro pós-login. */
export function PostLoginRedirect() {
  const [searchParams] = useSearchParams()
  const invite = searchParams.get('invite')?.trim()
  if (invite) {
    return <Navigate to={`${paths.home}?invite=${encodeURIComponent(invite)}`} replace />
  }

  const redirect = safeRedirectTarget(searchParams.get('redirect'))
  if (redirect) {
    return <Navigate to={redirect} replace />
  }

  return <Navigate to={paths.home} replace />
}
