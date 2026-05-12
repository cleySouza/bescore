import { Navigate, useSearchParams } from 'react-router-dom'
import { paths } from '../navigation/paths'

/** Utilizador já autenticado em /login: envia convite para home para o InviteDeepLinkHandler processar. */
export function PostLoginRedirect() {
  const [searchParams] = useSearchParams()
  const invite = searchParams.get('invite')?.trim()
  if (invite) {
    return <Navigate to={`${paths.home}?invite=${encodeURIComponent(invite)}`} replace />
  }
  return <Navigate to={paths.home} replace />
}
