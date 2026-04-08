import { signInWithGoogle } from '../../lib/authGoogle'
import styles from './SignIn.module.css'

interface SignInProps {
  onLoginSuccess?: () => void
}

export function SignIn({ onLoginSuccess }: SignInProps) {
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
      onLoginSuccess?.()
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  return (
    <div className={styles.loginContainer}>
      <h1>🏆 BeScore</h1>
      <p>Gerenciador de Campeonatos de eSports</p>
      <button onClick={handleGoogleLogin} className={styles.googleLoginBtn}>
        🚀 Entrar com Google
      </button>
    </div>
  )
}