import { useEffect, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  myTournamentsAtom,
  currentViewAtom,
  showConfigModalAtom,
  activeTournamentTabAtom,
} from '../../atoms/tournamentAtoms'
import { fetchMyTournaments, getTournamentParticipants, joinTournamentById, deleteTournament, cancelTournament, seedMockParticipants } from '../../lib/tournamentService'
import { getTournamentMatches } from '../../lib/matchService'
import { generatePlayoffMatches } from '../../lib/matchGenerationEngine'
import type { Participant } from '../../atoms/tournamentAtoms'
import type { MatchWithTeams, TournamentSettings } from '../../types/tournament'
import TournamentConfig from '../../components/TournamentConfig'
import MatchCard from '../../components/MatchCard'
import StandingsTable from '../../components/StandingsTable'
import ManageParticipantModal, { type ManagedParticipant } from './components/ManageParticipantModal'
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
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setCurrentView = useSetAtom(currentViewAtom)
  const setShowConfigModal = useSetAtom(showConfigModalAtom)
  const [activeTab, setActiveTab] = useAtom(activeTournamentTabAtom)
  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [generatingPlayoff, setGeneratingPlayoff] = useState(false)
  const [managedParticipant, setManagedParticipant] = useState<ManagedParticipant | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null)
  const [joiningTournament, setJoiningTournament] = useState(false)

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
  const isAutoTeamMode = (tournamentSettings?.teamAssignMode ?? 'auto') === 'auto'
  const managedTeamOptions = Array.isArray(tournamentSettings?.selectedTeamNames)
    ? tournamentSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []
  const isCampeonato = tournamentSettings?.format === 'campeonato'
  const playoffCutoff = isCampeonato ? (tournamentSettings?.playoffCutoff ?? 2) : undefined

  // Governance: papéis e controle de acesso
  const isParticipant = tournament.isParticipant ?? participants.some((p) => p.user_id === user.id)
  const isVisitor = !isCreator && !isParticipant
  const isPrivate = tournamentSettings?.isPrivate ?? false
  const maxParticipants = tournamentSettings?.maxParticipants ?? null
  const isFull = maxParticipants !== null && participantCount >= maxParticipants

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

  const handleMatchesGenerated = async () => {
    // 1. Atualização síncrona ANTES de fechar — garante que `isActive` já é true
    //    quando o React re-renderiza após o fechamento do modal
    if (tournament) {
      setActiveTournament({ ...tournament, status: 'active' })
    }
    setActiveTab('matches')
    setShowConfigModal(false)

    // 2. Sincroniza só a lista do dashboard em background (não sobrescreve o atom ativo)
    fetchMyTournaments(user!.id).then(setMyTournaments).catch(() => {})
  }

  const handleMatchResultUpdated = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleDeleteTournament = async () => {
    if (!window.confirm('⚠️ Esta ação não pode ser desfeita. O torneio e todos os seus dados serão removidos permanentemente. Tem certeza?')) return
    try {
      await deleteTournament(tournament.id)
      // Aguarda o fetch completo para garantir que o atom reflita o estado real do banco
      const updated = await fetchMyTournaments(user.id)
      setMyTournaments(updated)
      setActiveTournament(null)
      setCurrentView('dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir torneio')
    }
  }

  const handleCancelTournament = async () => {
    if (!window.confirm('⚠️ Esta ação não pode ser desfeita. O torneio será cancelado e nenhuma partida poderá ser registrada. Tem certeza?')) return
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

  // ─── DEV ONLY ──────────────────────────────────────────────────────────────
  const handleSeedParticipants = async () => {
    console.log('[DEV] seedMockParticipants → tournament.id:', tournament.id)
    try {
      await seedMockParticipants(tournament.id)
      console.log('[DEV] Seed concluído com sucesso')
      // Atualiza a lista de participantes na view e o atom do Dashboard
      const updated = await fetchMyTournaments(user.id)
      setMyTournaments(updated)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao injetar participantes'
      console.error('[DEV] Seed falhou:', err)
      alert('❌ Seed falhou: ' + msg)
      setError(msg)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const handleJoin = async () => {
    if (!user) return
    if (isPrivate && joinCode.trim().toUpperCase() !== tournament.invite_code.toUpperCase()) {
      setJoinCodeError('Código de convite inválido')
      return
    }
    setJoinCodeError(null)
    setJoiningTournament(true)
    try {
      await joinTournamentById(tournament.id, user.id, user.email?.split('@')[0] ?? 'Jogador')
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      setJoinCodeError(err instanceof Error ? err.message : 'Erro ao entrar no torneio')
    } finally {
      setJoiningTournament(false)
    }
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
          <span className={`${styles.roleTag} ${isCreator ? styles.roleTagOrganizer : isParticipant ? styles.roleTagParticipant : styles.roleTagVisitor}`}>
            {isCreator ? 'ORGANIZADOR' : isParticipant ? 'PARTICIPANTE' : 'VISITANTE'}
          </span>
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
                    {isCreator && (
                      <button
                        className={styles.manageBtn}
                        title="Gerenciar participante"
                        onClick={() => setManagedParticipant(participant as ManagedParticipant)}
                      >
                        ⚙️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dev: Seed button — only when creator has 0 opponents yet */}
            {isCreator && isDraft && participants.length < 2 && (
              <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                <button
                  onClick={handleSeedParticipants}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#2d6a2d',
                    color: '#fff',
                    border: '1px dashed #5ab55a',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  🌱 Injetar 5 Jogadores (Dev Mode)
                </button>
              </div>
            )}

            {/* Danger zone for creator in draft */}
            {isCreator && isDraft && (
              <div className={styles.dangerZone}>
                <h5 className={styles.dangerZoneTitle}>🚨 Zona de Perigo</h5>
                <button className={styles.dangerBtn} onClick={handleDeleteTournament}>
                  Apagar Torneio
                </button>
              </div>
            )}

            {/* Join section: only for visitors in draft status */}
            {isDraft && isVisitor && (
              <div className={styles.joinSection}>
                {isFull ? (
                  <span className={styles.fullBadge}>🔒 Torneio Lotado</span>
                ) : isPrivate ? (
                  <>
                    <p className={styles.joinHint}>Este torneio é privado. Insira o código de convite para participar.</p>
                    <div className={styles.joinCodeRow}>
                      <input
                        className={styles.joinCodeInput}
                        placeholder="Código de convite"
                        value={joinCode}
                        onChange={(e) => { setJoinCode(e.target.value); setJoinCodeError(null) }}
                        maxLength={6}
                      />
                      <button
                        className={styles.joinBtn}
                        disabled={joinCode.trim().length === 0 || joiningTournament}
                        onClick={handleJoin}
                      >
                        {joiningTournament ? 'Entrando...' : 'Entrar'}
                      </button>
                    </div>
                    {joinCodeError && <span className={styles.joinError}>{joinCodeError}</span>}
                  </>
                ) : (
                  <>
                    <p className={styles.joinHint}>Este torneio é aberto. Clique para participar!</p>
                    {joinCodeError && <span className={styles.joinError}>{joinCodeError}</span>}
                    <button
                      className={styles.joinBtn}
                      disabled={joiningTournament}
                      onClick={handleJoin}
                    >
                      {joiningTournament ? 'Entrando...' : '🎮 Entrar no Torneio'}
                    </button>
                  </>
                )}
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
                Classificação
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

                  {/* Painel de gerenciamento — apenas para o criador */}
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
                              title="Gerenciar participante"
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
          </div>
        ) : null}
      </main>

      <TournamentConfig
        participantCount={participantCount}
        participants={participants}
        onClose={() => setShowConfigModal(false)}
        onMatchesGenerated={handleMatchesGenerated}
      />

      {managedParticipant && (
        <ManageParticipantModal
          participant={managedParticipant}
          showScoreAdjustments={!isDraft}
          teamOptions={managedTeamOptions}
          canEditTeamAssignment={!(isDraft && isAutoTeamMode)}
          onClose={() => setManagedParticipant(null)}
          onSaved={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
    </div>
  )
}

export default TournamentView
