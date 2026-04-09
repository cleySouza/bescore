import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { currentViewAtom } from '../../atoms/tournamentAtoms'
import { signOut } from '../../lib/authGoogle'
import { Header } from '../../components/Header/Header'
import Dashboard from '../../components/Dashboard'
import TournamentView from '../../components/TournamentView'
import CreateTournament from '../CreateTournament/CreateTournament'
import JoinByCode from '../JoinByCode/JoinByCode'
import styles from './LoggedIn.module.css'

export function LoggedIn() {
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

  return (
    <div className={styles.appContainer}>
      <Header user={user} onLogout={handleLogout} />
      <main className={styles.main}>
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'tournament' && <TournamentView onBackToDashboard={() => setCurrentView('dashboard')} />}
        {currentView === 'create-tournament' && <CreateTournament />}
        {currentView === 'join-by-code' && <JoinByCode />}
      </main>
    </div>
  )
}
