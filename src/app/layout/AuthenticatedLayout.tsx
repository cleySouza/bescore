import { Outlet, useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  activeTournamentTabAtom,
  myTournamentsAtom,
  recentPlayersAtom,
  selectedMatchAtom,
} from '../../atoms/tournamentAtoms'
import { signOut } from '../../lib/authGoogle'
import { Header } from '../../components/Header/Header'
import { useCatalog } from '../../hooks/useCatalog'
import { GlobalToast } from './GlobalToast'
import { GlobalRecentMatchesCarousel } from './GlobalRecentMatchesCarousel'
import { InviteDeepLinkHandler } from './InviteDeepLinkHandler'
import { paths } from '../navigation/paths'
import styles from '../../screen/LoggedIn/LoggedIn.module.css'

export function AuthenticatedLayout() {
  const user = useAtomValue(userAtom)
  const navigate = useNavigate()
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setActiveTournamentTab = useSetAtom(activeTournamentTabAtom)
  const setSelectedMatch = useSetAtom(selectedMatchAtom)
  const setRecentPlayers = useSetAtom(recentPlayersAtom)

  useCatalog()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate(paths.login, { replace: true })
      setActiveTournament(null)
      setMyTournaments([])
      setActiveTournamentTab('matches')
      setSelectedMatch(null)
      setRecentPlayers([])
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (!user) return null

  return (
    <div className={styles.appContainer}>
      <InviteDeepLinkHandler />
      <Header user={user} onLogout={handleLogout} />
      <main className={styles.main}>
        <GlobalRecentMatchesCarousel />
        <Outlet />
      </main>
      <GlobalToast />
    </div>
  )
}
