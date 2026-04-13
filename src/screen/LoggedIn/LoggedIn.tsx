import { useAtomValue } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { currentViewAtom } from '../../atoms/tournamentAtoms'
import { signOut } from '../../lib/authGoogle'
import { Header } from '../../components/Header/Header'
import Dashboard from '../Dashboard/Dashboard'
import TournamentLobby from '../TournamentLobby/TournamentLobby'
import TournamentMatch from '../TournamentMatch/TournamentMatch'
import CreateTournament from '../CreateTournament/CreateTournament'
import JoinByCode from '../JoinByCode/JoinByCode'
import styles from './LoggedIn.module.css'

export function LoggedIn() {
  const user = useAtomValue(userAtom)
  const currentView = useAtomValue(currentViewAtom)

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
        {currentView === 'tournament-lobby' && <TournamentLobby />}
        {currentView === 'tournament-match' && <TournamentMatch />}
        {currentView === 'create-tournament' && <CreateTournament />}
        {currentView === 'join-by-code' && <JoinByCode />}
      </main>
    </div>
  )
}
