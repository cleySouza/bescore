import { useAuth } from '../providers/AuthProvider'
import { useAccessControl } from '../hooks/useAccessControl'
import { SignIn } from '../screen/SingIn/SignIn'
import { LoggedIn } from '../screen/LoggedIn/LoggedIn'
import { Maintenance404 } from '../screen/Maintenance404/Maintenance404'

export function AppRouter() {
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useAccessControl(user)

  // Um único loading cobre auth + verificação de acesso
  if (authLoading || accessLoading) {
    return (
      <div className="app-loading-screen" role="status" aria-label="Carregando...">
        <div className="app-loading-spinner" aria-hidden="true" />
      </div>
    )
  }

  if (!user) {
    return <SignIn />
  }

  if (!hasAccess) {
    return <Maintenance404 />
  }

  return <LoggedIn />
}