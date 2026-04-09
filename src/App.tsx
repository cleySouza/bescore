import { useAtomValue, useSetAtom } from 'jotai'
import { isAuthenticatedAtom, userAtom } from './atoms/sessionAtom'
import { currentViewAtom } from './atoms/tournamentAtoms'
import { signOut } from './lib/authGoogle'
import { SignIn } from './screen/SingIn/SignIn'
import { Header } from './components/Header/Header'
import Dashboard from './components/Dashboard'
import TournamentView from './components/TournamentView'
import styles from './App.module.css'

function App() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const user = useAtomValue(userAtom)
  const currentView = useAtomValue(currentViewAtom)
  const setCurrentView = useSetAtom(currentViewAtom)

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (!isAuthenticated) {
    return <SignIn />
  }

  return (
    <div className={styles.appContainer}>
      <Header user={user} onLogout={handleLogout} />
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
