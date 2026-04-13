import { useEffect, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  myTournamentsAtom,
  currentViewAtom,
  activeTournamentTabAtom,
} from '../../atoms/tournamentAtoms'
import { fetchMyTournaments, getTournamentParticipants, cancelTournament } from '../../lib/tournamentService'
import { getTournamentMatches } from '../../lib/matchService'
import { generatePlayoffMatches } from '../../lib/matchGenerationEngine'
import type { Participant } from '../../atoms/tournamentAtoms'
import type { MatchWithTeams, TournamentSettings } from '../../types/tournament'
import MatchCard from '../../components/MatchCard'
import StandingsTable from '../../components/StandingsTable'
import ManageParticipantModal, { type ManagedParticipant } from '../TournamentView/components/ManageParticipantModal'
import styles from './TournamentMatch.module.css'

interface ParticipantWithProfile extends Participant {
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

function TournamentMatch() {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setCurrentView = useSetAtom(currentViewAtom)
  const [activeTab, setActiveTab] = useAtom(activeTournamentTabAtom)

  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [generatingPlayoff, setGeneratingPlayoff] = useState(false)
  const [managedParticipant, setManagedParticipant] = useState<ManagedParticipant | null>(null)

  useEffect(() => {
    if (!tournament) {
      setCurrentView('dashboard')
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [participantsData, matchesData] = await Promise.all([
          getTournamentParticipants(tournament.id),
          getTournamentMatches(tournament.id),
        ])
        setParticipants(participantsData as ParticipantWithProfile[])
        setMatches(matchesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tournament, setCurrentView, refreshKey])

  if (!tournament || !user) return null

  const isCreator = tournament.creator_id === user.id
  const tournamentSettings = tournament.settings as TournamentSettings | null
  const isCampeonato = tournamentSettings?.format === 'campeonato'
  const playoffCutoff = isCampeonato ? (tournamentSettings?.playoffCutoff ?? 2) : undefined

  const pendingMatches = matches.filter((m) => m.status === 'pending')
  const finishedMatches = matches.filter((m) => m.status === 'finished')
  const leagueMatches = matches.filter((m) => m.round === 1)
  const playoffMatches = matches.filter((m) => m.round === 2)
  const hasPlayoffStarted = playoffMatches.length > 0
  const isLeagueFinished =
    isCampeonato &&
    leagueMatches.length > 0 &&
    leagueMatches.every((m) => m.status === 'finished')

  const round1Pending = pendingMatches.filter((m) => m.round === 1)
  const round1Finished = finishedMatches.filter((m) => m.round === 1)
  const round2Pending = pendingMatches.filter((m) => m.round === 2)
  const round2Finished = finishedMatches.filter((m) => m.round === 2)

  const handleMatchResultUpdated = () => setRefreshKey((prev) => prev + 1)

  const handleGeneratePlayoff = async () => {
    setGeneratingPlayoff(true)
    setError(null)
    try {
      await generatePlayoffMatches(tournament.id)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar fase final')
    } finally {
      setGeneratingPlayoff(false)
    }
  }

  const handleCancelTournament = async () => {
    if (!window.confirm('⚠️ O torneio será cancelado e nenhuma partida poderá ser registrada. Tem certeza?')) return
    try {
      await cancelTournament(tournament.id)
      const updated = await fetchMyTournaments(user.id)
      setMyTournaments(updated)
      setActiveTournament(null)
      setCurrentView('dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar torneio')
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => setCurrentView('dashboard')}>
          ← Voltar
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{tournament.name}</h1>
          <span className={styles.gameType}>{tournament.game_type}</span>
          <span className={styles.statusBadge}>🔴 Ativo</span>
        </div>
        <div className={styles.spacer} />
      </header>

      <main className={styles.main}>
        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* Playoff banner */}
        {isCreator && isLeagueFinished && !hasPlayoffStarted && (
          <div className={styles.playoffBanner}>
            <div className={styles.playoffBannerContent}>
              <span className={styles.playoffBannerIcon}>🏆</span>
              <div>
                <strong>Liga Finalizada!</strong>
                <p>Os top {playoffCutoff} estão classificados para a Fase Final.</p>
              </div>
            </div>
            <button
              className={styles.playoffBannerBtn}
              onClick={handleGeneratePlayoff}
              disabled={generatingPlayoff}
            >
              {generatingPlayoff ? 'Gerando...' : `Gerar ${playoffCutoff === 4 ? 'Semifinais' : 'Final'}`}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className={styles.tabsNav}>
          <button
            className={`${styles.tab} ${activeTab === 'matches' ? styles.active : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            🎮 Jogos {pendingMatches.length > 0 && `(${pendingMatches.length})`}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'standings' ? styles.active : ''}`}
            onClick={() => setActiveTab('standings')}
          >
            📊 Classificação
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'matches' && (
            <section className={styles.matchesSection}>
              {loading ? (
                <div className={styles.loadingMessage}>Carregando jogos...</div>
              ) : matches.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🎮</div>
                  <p className={styles.emptyText}>Nenhum jogo gerado ainda</p>
                </div>
              ) : (
                <div className={styles.matchesList}>
                  {isCampeonato ? (
                    <>
                      {(round1Pending.length > 0 || round1Finished.length > 0) && (
                        <div>
                          <h3 className={styles.phaseTitle}>⚽ Fase de Liga</h3>
                          {round1Pending.length > 0 && (
                            <div>
                              <h4 className={styles.groupTitle}>Pendentes ({round1Pending.length})</h4>
                              <div className={styles.matchesGrid}>
                                {round1Pending.map((m) => (
                                  <MatchCard key={m.id} match={m} onResultUpdated={handleMatchResultUpdated} />
                                ))}
                              </div>
                            </div>
                          )}
                          {round1Finished.length > 0 && (
                            <div>
                              <h4 className={styles.groupTitle}>Encerrados ({round1Finished.length})</h4>
                              <div className={styles.matchesGrid}>
                                {round1Finished.map((m) => (
                                  <MatchCard key={m.id} match={m} onResultUpdated={handleMatchResultUpdated} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {hasPlayoffStarted && (
                        <div>
                          <h3 className={styles.phaseTitle}>
                            🏆 {playoffCutoff === 4 ? 'Semifinais' : 'Final'}
                          </h3>
                          {round2Pending.length > 0 && (
                            <div>
                              <h4 className={styles.groupTitle}>Pendentes ({round2Pending.length})</h4>
                              <div className={styles.matchesGrid}>
                                {round2Pending.map((m) => (
                                  <MatchCard key={m.id} match={m} onResultUpdated={handleMatchResultUpdated} />
                                ))}
                              </div>
                            </div>
                          )}
                          {round2Finished.length > 0 && (
                            <div>
                              <h4 className={styles.groupTitle}>Encerrados ({round2Finished.length})</h4>
                              <div className={styles.matchesGrid}>
                                {round2Finished.map((m) => (
                                  <MatchCard key={m.id} match={m} onResultUpdated={handleMatchResultUpdated} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {pendingMatches.length > 0 && (
                        <div>
                          <h4 className={styles.groupTitle}>Pendentes ({pendingMatches.length})</h4>
                          <div className={styles.matchesGrid}>
                            {pendingMatches.map((m) => (
                              <MatchCard key={m.id} match={m} onResultUpdated={handleMatchResultUpdated} />
                            ))}
                          </div>
                        </div>
                      )}
                      {finishedMatches.length > 0 && (
                        <div>
                          <h4 className={styles.groupTitle}>Encerrados ({finishedMatches.length})</h4>
                          <div className={styles.matchesGrid}>
                            {finishedMatches.map((m) => (
                              <MatchCard key={m.id} match={m} onResultUpdated={handleMatchResultUpdated} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === 'standings' && (
            <section className={styles.standingsSection}>
              <StandingsTable onDataUpdate={handleMatchResultUpdated} playoffCutoff={playoffCutoff} />

              {isCreator && participants.length > 0 && (
                <div className={styles.adminPanel}>
                  <h4 className={styles.adminPanelTitle}>⚙️ Ajustes Administrativos</h4>
                  <div className={styles.adminParticipantList}>
                    {participants.map((p) => (
                      <div key={p.id} className={styles.adminParticipantRow}>
                        <span className={styles.adminParticipantName}>
                          {p.team_name || p.profile?.nickname || 'Participante'}
                        </span>
                        <button
                          className={styles.manageBtn}
                          onClick={() => setManagedParticipant(p as ManagedParticipant)}
                        >
                          ⚙️ Gerenciar
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={styles.dangerZone}>
                    <h5 className={styles.dangerZoneTitle}>🚨 Zona de Perigo</h5>
                    <button className={styles.dangerBtn} onClick={handleCancelTournament}>
                      Cancelar Torneio
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {managedParticipant && (
        <ManageParticipantModal
          participant={managedParticipant}
          onClose={() => setManagedParticipant(null)}
          onSaved={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
    </div>
  )
}

export default TournamentMatch
