import { signInWithGoogle } from '../../lib/authGoogle'
import logo from '../../assets/logo.svg'
import googleLogo from '../../assets/google-logo.svg'
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
      <img src={logo} alt="BeScore Logo" className={styles.logo} />
      <section>
        <p>Escolha uma forma de login</p>
        <button onClick={handleGoogleLogin} className={styles.googleLoginBtn} title="Entrar com Google">
          <img src={googleLogo} alt="Google" className={styles.googleLogoIcon} />
        </button>
      </section>
    </div>
  )
}