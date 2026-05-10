import { useAuth } from '../providers/AuthProvider'
import { useAccessControl } from '../hooks/useAccessControl'
import { SignIn } from '../screen/SingIn/SignIn'
import { LoggedIn } from '../screen/LoggedIn/LoggedIn'
import { Maintenance404 } from '../screen/Maintenance404/Maintenance404'

export function AppRouter() {
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: accessLoading } = useAccessControl(user)

  // Loading de autenticação
  if (authLoading) {
    return (
      <div className="app-loading-screen" role="status" aria-label="Verificando autenticação...">
        <div className="app-loading-spinner" aria-hidden="true" />
        <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
          Verificando autenticação...
        </p>
      </div>
    )
  }

  // Não autenticado
  if (!user) {
    return <SignIn />
  }

  // Loading de acesso
  if (accessLoading) {
    return (
      <div className="app-loading-screen" role="status" aria-label="Verificando acesso...">
        <div className="app-loading-spinner" aria-hidden="true" />
        <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
          Verificando acesso...
        </p>
      </div>
    )
  }

  // Sem acesso
  if (!hasAccess) {
    return <Maintenance404 />
  }

  // Autenticado e com acesso
  return <LoggedIn />
}