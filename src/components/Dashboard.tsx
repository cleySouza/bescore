import { useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../atoms/sessionAtom'
import {
  myTournamentsAtom,
  activeTournamentAtom,
  tournamentsLoadingAtom,
  tournamentsErrorAtom,
  showCreateModalAtom,
  showJoinModalAtom,
  currentViewAtom,
} from '../atoms/tournamentAtoms'
import { fetchMyTournaments } from '../lib/tournamentService'
import TournamentCard from './TournamentCard'
import CreateTournament from './CreateTournament'
import JoinByCode from './JoinByCode'
import styles from './Dashboard.module.css'

function Dashboard() {
  const user = useAtomValue(userAtom)
  const [myTournaments, setMyTournaments] = useAtom(myTournamentsAtom)
  const [loading, setLoading] = useAtom(tournamentsLoadingAtom)
  const [error, setError] = useAtom(tournamentsErrorAtom)
  const [showModal, setShowModal] = useAtom(showCreateModalAtom)
  const [showJoinModal, setShowJoinModal] = useAtom(showJoinModalAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setCurrentView = useSetAtom(currentViewAtom)

  useEffect(() => {
    if (!user) return

    const loadTournaments = async () => {
      setLoading(true)
      setError(null)
      try {
        const tournaments = await fetchMyTournaments(user.id)
        setMyTournaments(tournaments)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar torneios'
        setError(message)
        console.error('Erro:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTournaments()
  }, [user, setMyTournaments, setLoading, setError])

  const handleSelectTournament = (tournamentId: string) => {
    const tournament = myTournaments.find((t) => t.id === tournamentId)
    if (tournament) {
      setActiveTournament(tournament)
      setCurrentView('tournament')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Meus Torneios</h1>
        <div className={styles.actions}>
          <button
            className={styles.joinBtn}
            onClick={() => setShowJoinModal(true)}
            aria-label="Entrar em um torneio"
          >
            🔓 Entrar
          </button>
          <button
            className={styles.createBtn}
            onClick={() => setShowModal(true)}
            aria-label="Criar novo torneio"
          >
            ➕ Novo Torneio
          </button>
        </div>
      </div>

      {showModal && (
        <CreateTournament onClose={() => setShowModal(false)} onTournamentCreated={() => {}} />
      )}

      {showJoinModal && <JoinByCode onClose={() => setShowJoinModal(false)} />}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {loading ? (
        <div className={styles.loadingMessage}>Carregando torneios...</div>
      ) : myTournaments.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Nenhum torneio ainda.</p>
          <button
            className={styles.emptyCreateBtn}
            onClick={() => setShowModal(true)}
          >
            Crie seu primeiro torneio
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {myTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onClick={() => handleSelectTournament(tournament.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
