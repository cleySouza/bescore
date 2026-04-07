import { useAtomValue } from 'jotai'
import { isAuthenticatedAtom, userAtom } from './atoms/sessionAtom'
import { signInWithGoogle, signOut } from './lib/authGoogle'
import styles from './App.module.css'
function App() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const user = useAtomValue(userAtom)

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (!isAuthenticated) {
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

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <h1>🏆 BeScore</h1>
        <div className={styles.userInfo}>
          <img src={user?.user_metadata?.avatar_url} alt="Avatar" />
          <span>{user?.user_metadata?.name}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Sair
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <h2>Bem-vindo ao BeScore!</h2>
        <p>Seu gerenciador de campeonatos de eSports está pronto! 🎮</p>
      </main>
    </div>
  )
}

export default App
