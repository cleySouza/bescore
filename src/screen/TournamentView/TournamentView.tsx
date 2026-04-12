import { useEffect, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  currentViewAtom,
  showConfigModalAtom,
  activeTournamentTabAtom,
} from '../../atoms/tournamentAtoms'
import { getTournamentParticipants } from '../../lib/tournamentService'
import { getTournamentMatches } from '../../lib/matchService'
import { generatePlayoffMatches } from '../../lib/matchGenerationEngine'
import type { Participant } from '../../atoms/tournamentAtoms'
import type { MatchWithTeams, TournamentSettings } from '../../types/tournament'
import TournamentConfig from '../../components/TournamentConfig'
import MatchCard from '../../components/MatchCard'
import StandingsTable from '../../components/StandingsTable'
import styles from './TournamentView.module.css'

interface ParticipantWithProfile extends Participant {
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

interface TournamentViewProps {
  onBackToDashboard: () => void
}

function TournamentView({ onBackToDashboard: _onBackToDashboard }: TournamentViewProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const setCurrentView = useSetAtom(currentViewAtom)
  const setShowConfigModal = useSetAtom(showConfigModalAtom)
  const [activeTab, setActiveTab] = useAtom(activeTournamentTabAtom)
  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [generatingPlayoff, setGeneratingPlayoff] = useState(false)

  useEffect(() => {
    if (!tournament) {
      setCurrentView('dashboard')
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const participantsData = await getTournamentParticipants(tournament.id)
        setParticipants(participantsData as ParticipantWithProfile[])

        // Load matches if tournament is active
        if (tournament.status === 'active') {
          const matchesData = await getTournamentMatches(tournament.id)
          setMatches(matchesData)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar dados'
        setError(message)
        console.error('Erro:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tournament, setCurrentView, refreshKey])

  if (!tournament || !user) {
    return null
  }

  const isCreator = tournament.creator_id === user.id
  const participantCount = participants.length
  const isDraft = tournament.status === 'draft'
  const isActive = tournament.status === 'active'

  // Campeonato: extrair settings salvos no torneio
  const tournamentSettings = tournament.settings as TournamentSettings | null
  const isCampeonato = tournamentSettings?.format === 'campeonato'
  const playoffCutoff = isCampeonato ? (tournamentSettings?.playoffCutoff ?? 2) : undefined

  // Derivações de fase
  const leagueMatches = matches.filter((m) => m.round === 1)
  const playoffMatches = matches.filter((m) => m.round === 2)
  const hasPlayoffStarted = playoffMatches.length > 0
  const isLeagueFinished =
    isCampeonato &&
    isActive &&
    leagueMatches.length > 0 &&
    leagueMatches.every((m) => m.status === 'finished')

  const handleGeneratePlayoff = async () => {
    if (!tournament) return
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

  const handleSetupMatches = () => {
    setShowConfigModal(true)
  }

  const handleMatchesGenerated = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleMatchResultUpdated = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const pendingMatches = matches.filter((m) => m.status === 'pending')
  const finishedMatches = matches.filter((m) => m.status === 'finished')

  // Agrupamento por round para campeonato
  const round1Pending = pendingMatches.filter((m) => m.round === 1)
  const round1Finished = finishedMatches.filter((m) => m.round === 1)
  const round2Pending = pendingMatches.filter((m) => m.round === 2)
  const round2Finished = finishedMatches.filter((m) => m.round === 2)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => setCurrentView('dashboard')}>
          ← Voltar
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{tournament.name}</h1>
          <span className={styles.gameType}>{tournament.game_type}</span>
        </div>
        <div className={styles.spacer} />
      </header>

      <main className={styles.main}>
        <div className={styles.tournamentInfo}>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Código de Convite</div>
            <code className={styles.codeDisplay}>{tournament.invite_code}</code>
            <small className={styles.infoHint}>Compartilhe este código para convidar amigos</small>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Status</div>
            <div className={styles.statusBadge}>
              {tournament.status === 'draft' && '📝 Rascunho'}
              {tournament.status === 'active' && '🔴 Ativo'}
              {tournament.status === 'finished' && '✅ Finalizado'}
            </div>
          </div>

          {isCreator && isDraft && (
            <button className={styles.setupBtn} onClick={handleSetupMatches}>
              ⚙️ Configurar Partidas
            </button>
          )}
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        {isDraft ? (
          // Draft View: Show participants list
          <section className={styles.participantsSection}>
            <h2 className={styles.sectionTitle}>Participantes ({participantCount})</h2>

            {loading ? (
              <div className={styles.loadingMessage}>Carregando participantes...</div>
            ) : participantCount < 2 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <p className={styles.emptyText}>Aguardando oponentes...</p>
                <p className={styles.emptySubtext}>
                  Compartilhe o código <strong>{tournament.invite_code}</strong> com seus amigos para
                  começar!
                </p>
                <div className={styles.shareActions}>
                  <button
                    className={styles.copyBtn}
                    onClick={() => {
                      navigator.clipboard.writeText(tournament.invite_code)
                      alert('Código copiado!')
                    }}
                  >
                    📋 Copiar Código
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.participantsList}>
                {participants.map((participant) => (
                  <div key={participant.id} className={styles.participantCard}>
                    {participant.profile?.avatar_url ? (
                      <img
                        src={participant.profile.avatar_url}
                        alt={participant.profile.nickname || 'Avatar'}
                        className={styles.avatar}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>👤</div>
                    )}
                    <div className={styles.participantInfo}>
                      <div className={styles.teamName}>{participant.team_name || 'Sem time'}</div>
                      <small className={styles.userName}>
                        {participant.profile?.nickname || participant.profile?.email || 'Usuário'}
                      </small>
                    </div>
                    {participant.user_id === tournament.creator_id && (
                      <span className={styles.creatorBadge}>👑</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : isActive ? (
          // Active View: Show tabs (Matches / Standings)
          <div className={styles.tabsContainer}>
            {/* Banner: Liga finalizada — só aparece para o criador se playoff ainda não gerado */}
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
                        // Campeonato: agrupar por fase (round 1 = Liga, round 2 = Fase Final)
                        <>
                          {(round1Pending.length > 0 || round1Finished.length > 0) && (
                            <div>
                              <h3 className={styles.matchesPhaseTitle}>⚽ Fase de Liga</h3>
                              {round1Pending.length > 0 && (
                                <div>
                                  <h4 className={styles.matchesSubtitle}>Pendentes ({round1Pending.length})</h4>
                                  <div className={styles.matchesGrid}>
                                    {round1Pending.map((match) => (
                                      <MatchCard key={match.id} match={match} onResultUpdated={handleMatchResultUpdated} />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {round1Finished.length > 0 && (
                                <div>
                                  <h4 className={styles.matchesSubtitle}>Encerrados ({round1Finished.length})</h4>
                                  <div className={styles.matchesGrid}>
                                    {round1Finished.map((match) => (
                                      <MatchCard key={match.id} match={match} onResultUpdated={handleMatchResultUpdated} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {hasPlayoffStarted && (
                            <div>
                              <h3 className={styles.matchesPhaseTitle}>
                                🏆 {playoffCutoff === 4 ? 'Semifinais' : 'Final'}
                              </h3>
                              {round2Pending.length > 0 && (
                                <div>
                                  <h4 className={styles.matchesSubtitle}>Pendentes ({round2Pending.length})</h4>
                                  <div className={styles.matchesGrid}>
                                    {round2Pending.map((match) => (
                                      <MatchCard key={match.id} match={match} onResultUpdated={handleMatchResultUpdated} />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {round2Finished.length > 0 && (
                                <div>
                                  <h4 className={styles.matchesSubtitle}>Encerrados ({round2Finished.length})</h4>
                                  <div className={styles.matchesGrid}>
                                    {round2Finished.map((match) => (
                                      <MatchCard key={match.id} match={match} onResultUpdated={handleMatchResultUpdated} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        // Outros formatos: lista flat de pendentes + encerrados
                        <>
                          {pendingMatches.length > 0 && (
                            <div>
                              <h3 className={styles.matchesSubtitle}>Pendentes ({pendingMatches.length})</h3>
                              <div className={styles.matchesGrid}>
                                {pendingMatches.map((match) => (
                                  <MatchCard key={match.id} match={match} onResultUpdated={handleMatchResultUpdated} />
                                ))}
                              </div>
                            </div>
                          )}
                          {finishedMatches.length > 0 && (
                            <div>
                              <h3 className={styles.matchesSubtitle}>Encerrados ({finishedMatches.length})</h3>
                              <div className={styles.matchesGrid}>
                                {finishedMatches.map((match) => (
                                  <MatchCard key={match.id} match={match} onResultUpdated={handleMatchResultUpdated} />
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
                  <StandingsTable
                    onDataUpdate={handleMatchResultUpdated}
                    playoffCutoff={playoffCutoff}
                  />
                </section>
              )}
            </div>
          </div>
        ) : null}
      </main>

      <TournamentConfig
        participantCount={participantCount}
        onClose={() => setShowConfigModal(false)}
        onMatchesGenerated={handleMatchesGenerated}
      />
    </div>
  )
}

export default TournamentView
