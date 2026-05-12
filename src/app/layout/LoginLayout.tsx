import { Navigate } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider'
import { SignIn } from '../../screen/SingIn/SignIn'
import styles from '../../App.module.css'
import { paths } from '../navigation/paths'

export function LoginLayout() {
  const { user } = useAuth()

  if (user) {
    return <Navigate to={paths.home} replace />
  }

  return (
    <div className={styles.appWithFooter}>
      <div className={styles.appContainer}>
        <SignIn />
      </div>
      <footer className={styles.footer}>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className={styles.privacyLink}>
          Política de Privacidade
        </a>
      </footer>
    </div>
  )
}
