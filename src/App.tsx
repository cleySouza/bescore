import { useAtomValue, useSetAtom } from 'jotai'
import { isAuthenticatedAtom, userAtom } from './atoms/sessionAtom'
import { currentViewAtom } from './atoms/tournamentAtoms'
import { signInWithGoogle, signOut } from './lib/authGoogle'
import Dashboard from './components/Dashboard'
import TournamentView from './components/TournamentView'
import styles from './App.module.css'

function App() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const user = useAtomValue(userAtom)
  const currentView = useAtomValue(currentViewAtom)
  const setCurrentView = useSetAtom(currentViewAtom)

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
          <img src={user?.user_metadata?.avatar_url} alt="Avatar" className={styles.avatar} />
          <span className={styles.userName}>{user?.user_metadata?.name}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Sair
          </button>
        </div>
      </header>
      <main className={styles.main}>
        {currentView === 'dashboard' ? (
          <Dashboard />
        ) : (
          <TournamentView onBackToDashboard={() => setCurrentView('dashboard')} />
        )}
      </main>
    </div>
  )
}

export default App
