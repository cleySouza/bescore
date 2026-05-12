import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  myTournamentsAtom,
  activeTournamentAtom,
  tournamentsLoadingAtom,
  tournamentsErrorAtom,
} from '../../atoms/tournamentAtoms'
import type { TournamentWithParticipants } from '../../atoms/tournamentAtoms'
import { fetchMyTournaments, fetchPublicTournaments } from '../../lib/tournamentService'
import TournamentCard from '../../components/TournamentCard'
import { paths } from '../../app/navigation/paths'
import styles from './Dashboard.module.css'

function matchesFilter(t: TournamentWithParticipants, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const name = (t.name ?? '').toLowerCase()
  const code = (t.invite_code ?? '').toLowerCase().replace(/\s/g, '')
  const needleCode = needle.replace(/\s/g, '')
  const game = (t.game_type ?? '').toLowerCase()
  return (
    name.includes(needle) ||
    code.includes(needleCode) ||
    game.includes(needle)
  )
}

function Dashboard() {
  const user = useAtomValue(userAtom)
  const userId = user?.id
  const [myTournaments, setMyTournaments] = useAtom(myTournamentsAtom)
  const [publicTournaments, setPublicTournaments] = useState<TournamentWithParticipants[]>([])
  const [loading, setLoading] = useAtom(tournamentsLoadingAtom)
  const [error, setError] = useAtom(tournamentsErrorAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const navigate = useNavigate()

  const [filterOpen, setFilterOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (userId) {
        const hasCachedTournaments = myTournaments.length > 0
        setLoading(!hasCachedTournaments)
        setError(null)
        try {
          const tournaments = await fetchMyTournaments(userId)
          if (!cancelled) setMyTournaments(tournaments)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro ao carregar torneios'
          if (!cancelled) setError(message)
          console.error('Erro:', err)
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      setLoading(true)
      setError(null)
      try {
        const list = await fetchPublicTournaments()
        if (!cancelled) setPublicTournaments(list)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao carregar torneios públicos'
        if (!cancelled) setError(message)
        console.error('Erro:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
    // `myTournaments.length` omitido de deps: atualização pós-fetch não deve recarregar.
  }, [userId, setMyTournaments, setLoading, setError])

  const displayList = user ? myTournaments : publicTournaments

  const filteredList = useMemo(() => {
    if (!filterOpen || !filterText.trim()) return displayList
    return displayList.filter((t) => matchesFilter(t, filterText))
  }, [displayList, filterOpen, filterText])

  const handleSelectTournament = (tournamentId: string) => {
    const tournament = filteredList.find((t) => t.id === tournamentId)
    if (!tournament) return

    setActiveTournament(tournament)
    navigate(
      tournament.status === 'active'
        ? paths.tournamentMatches(tournament.id)
        : paths.tournamentLobby(tournament.id)
    )
  }

  const toggleBuscar = () => {
    setFilterOpen((prev) => {
      const next = !prev
      if (!next) setFilterText('')
      return next
    })
  }

  const title = user ? 'Torneios' : 'Torneios públicos'
  const emptyPrimary = user ? 'Nenhum torneio ainda.' : 'Nenhum torneio público em aberto.'
  const emptyHint = user ? null : 'Entre na conta para criar torneios ou ver os seus privados.'
  const filterActive = filterOpen && filterText.trim().length > 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.joinBtn}${filterOpen ? ` ${styles.joinBtnActive}` : ''}`}
              onClick={toggleBuscar}
              aria-expanded={filterOpen}
              aria-controls="dashboard-search-panel"
              aria-label={filterOpen ? 'Fechar filtro da lista' : 'Filtrar lista de torneios'}
            >
              Buscar
            </button>
            {user && (
              <button
                type="button"
                className={styles.createBtn}
                onClick={() => navigate(paths.createTournament)}
                aria-label="Criar novo torneio"
              >
                Novo Torneio
              </button>
            )}
          </div>
        </div>

        {filterOpen && (
          <div id="dashboard-search-panel" className={styles.searchPanel}>
            <input
              type="search"
              className={styles.searchInput}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Nome do torneio, código ou jogo…"
              aria-label="Filtrar torneios"
              autoComplete="off"
            />
            {filterText.trim().length > 0 && (
              <button
                type="button"
                className={styles.clearFilterBtn}
                onClick={() => setFilterText('')}
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {loading && displayList.length === 0 ? (
        <div className={styles.loadingMessage}>Carregando torneios...</div>
      ) : displayList.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{emptyPrimary}</p>
          {emptyHint && <p className={styles.emptyHint}>{emptyHint}</p>}
          {user ? (
            <button
              type="button"
              className={styles.emptyCreateBtn}
              onClick={() => navigate(paths.createTournament)}
            >
              Crie seu primeiro torneio
            </button>
          ) : (
            <button type="button" className={styles.emptyCreateBtn} onClick={() => navigate(paths.login)}>
              Entrar ou criar conta
            </button>
          )}
        </div>
      ) : filterActive && filteredList.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Nenhum torneio corresponde à busca.</p>
          <button type="button" className={styles.emptyCreateBtn} onClick={() => setFilterText('')}>
            Limpar filtro
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredList.map((tournament) => (
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
