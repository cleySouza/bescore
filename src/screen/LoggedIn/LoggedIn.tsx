import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { strapiCatalogAtom, strapiShieldsMapAtom } from '../../atoms/catalogAtom'
import {
  activeTournamentAtom,
  activeTournamentTabAtom,
  currentViewAtom,
  myTournamentsAtom,
  recentPlayersAtom,
  selectedMatchAtom,
  tournamentsErrorAtom,
} from '../../atoms/tournamentAtoms'
import { signOut } from '../../lib/authGoogle'
import { getTournamentByCode, getTournamentById } from '../../lib/tournamentService'
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
  const setCurrentView = useSetAtom(currentViewAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setActiveTournamentTab = useSetAtom(activeTournamentTabAtom)
  const setSelectedMatch = useSetAtom(selectedMatchAtom)
  const setRecentPlayers = useSetAtom(recentPlayersAtom)
  const setStrapiShieldsMap = useSetAtom(strapiShieldsMapAtom)
  const setStrapiCatalog = useSetAtom(strapiCatalogAtom)
  const setTournamentError = useSetAtom(tournamentsErrorAtom)

  useEffect(() => {
    if (!user) return

    const params = new URLSearchParams(window.location.search)
    const inviteCode = params.get('invite')?.trim().toUpperCase()
    if (!inviteCode) return

    let cancelled = false

    const openByInvite = async () => {
      try {
        const tournament = await getTournamentByCode(inviteCode)
        if (!tournament || cancelled) return

        const detailed = await getTournamentById(tournament.id, user.id)
        if (cancelled) return

        setActiveTournament(detailed)
        setCurrentView(detailed.status === 'active' ? 'tournament-match' : 'tournament-lobby')
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Convite inválido'
          setTournamentError(message)
          setCurrentView('join-by-code')
        }
      } finally {
        params.delete('invite')
        const newQuery = params.toString()
        const nextUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}${window.location.hash}`
        window.history.replaceState({}, '', nextUrl)
      }
    }

    openByInvite()

    return () => {
      cancelled = true
    }
  }, [user, setActiveTournament, setCurrentView, setTournamentError])

  const handleLogout = async () => {
    try {
      await signOut()
      setCurrentView('dashboard')
      setActiveTournament(null)
      setMyTournaments([])
      setActiveTournamentTab('matches')
      setSelectedMatch(null)
      setRecentPlayers([])
      setStrapiShieldsMap({})
      setStrapiCatalog(null)
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
