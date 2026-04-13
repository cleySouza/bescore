import { useEffect, useMemo, useRef, useState } from 'react'
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
import Accordion from '../../components/Accordion/Accordion'
import MatchCard from '../../components/MatchCard'
import ManageParticipantModal, { type ManagedParticipant } from '../TournamentView/components/ManageParticipantModal'
import MatchesSection from './components/MatchesSection'
import FinalPhaseSection from './components/FinalPhaseSection'
import StandingsSection from './components/StandingsSection'
import ScoutsSection from './components/ScoutsSection'
import styles from './TournamentMatch.module.css'

interface ParticipantWithProfile extends Participant {
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

function getRoundRobinRoundCount(participantCount: number, hasReturnMatch = false): number {
  if (participantCount <= 1) return 0
  const baseCount = participantCount % 2 === 0 ? participantCount - 1 : participantCount
  return hasReturnMatch ? baseCount * 2 : baseCount
}

type LegFilter = 'first' | 'second'
type PhaseFilter = 'league' | 'playoff'

interface SideSummary {
  teamName: string
  nickname: string
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
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [legFilter, setLegFilter] = useState<LegFilter>('first')
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('league')

  // Accordion state
  const [openRound, setOpenRound] = useState<number | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const accordionInitRef = useRef<string | null>(null)

  const tournamentId = tournament?.id

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

        // Initialize accordion once per tournament (not on every refresh)
        if (accordionInitRef.current !== tournament.id) {
          const rounds = [...new Set(matchesData.map((m) => m.round))].sort((a, b) => a - b)
          const firstPending = rounds.find((r) =>
            matchesData.some((m) => m.round === r && m.status === 'pending')
          )
          setOpenRound(firstPending ?? rounds[0] ?? null)
          setExpandedMatchId(null)
          accordionInitRef.current = tournament.id
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, setCurrentView, refreshKey])

  // Group matches by round
  const matchesByRound = useMemo(() => {
    const map = new Map<number, MatchWithTeams[]>()
    for (const m of matches) {
      const arr = map.get(m.round) ?? []
      arr.push(m)
      map.set(m.round, arr)
    }
    return map
  }, [matches])

  if (!tournament || !user) return null

  const isCreator = tournament.creator_id === user.id
  const tournamentSettings = tournament.settings as TournamentSettings | null
  const isCampeonato = tournamentSettings?.format === 'campeonato'
  const hasReturnMatch = tournamentSettings?.hasReturnMatch ?? false
  const playoffCutoff = isCampeonato ? (tournamentSettings?.playoffCutoff ?? 2) : undefined
  const leagueBaseRoundCount = isCampeonato ? getRoundRobinRoundCount(participants.length, false) : 0
  const leagueRoundCount = isCampeonato
    ? getRoundRobinRoundCount(participants.length, hasReturnMatch)
    : 0
  const maxRound = matches.length > 0 ? Math.max(...matches.map((m) => m.round ?? 0)) : 0
  const regularSplitRound = isCampeonato ? leagueBaseRoundCount : Math.floor(maxRound / 2)

  const pendingCount = matches.filter((m) => m.status === 'pending').length
  const leagueMatches = isCampeonato
    ? matches.filter((m) => m.round !== null && m.round <= leagueRoundCount)
    : matches
  const playoffMatches = isCampeonato
    ? matches.filter((m) => m.round !== null && m.round > leagueRoundCount)
    : []
  const hasPlayoffStarted = playoffMatches.length > 0
  const isLeagueFinished =
    isCampeonato && leagueMatches.length > 0 && leagueMatches.every((m) => m.status === 'finished')

  useEffect(() => {
    setLegFilter('first')
    setPhaseFilter('league')
  }, [tournamentId])

  useEffect(() => {
    if (!hasPlayoffStarted && phaseFilter === 'playoff') {
      setPhaseFilter('league')
    }
  }, [hasPlayoffStarted, phaseFilter])

  const filteredRoundEntries = useMemo(() => {
    const entries = Array.from(matchesByRound.entries()).sort(([a], [b]) => a - b)

    if (isCampeonato && phaseFilter === 'playoff') {
      return entries.filter(([round]) => round > leagueRoundCount)
    }

    if (isCampeonato) {
      const leagueEntries = entries.filter(([round]) => round <= leagueRoundCount)
      if (!hasReturnMatch) return leagueEntries
      return leagueEntries.filter(([round]) => {
        if (legFilter === 'first') return round <= leagueBaseRoundCount
        return round > leagueBaseRoundCount
      })
    }

    if (!hasReturnMatch) {
      return entries
    }

    return entries.filter(([round]) => {
      if (isCampeonato) {
        if (round > leagueRoundCount) return false
        if (legFilter === 'first') return round <= leagueBaseRoundCount
        return round > leagueBaseRoundCount && round <= leagueRoundCount
      }

      if (legFilter === 'first') return round <= regularSplitRound
      return round > regularSplitRound
    })
  }, [
    matchesByRound,
    phaseFilter,
    hasReturnMatch,
    legFilter,
    isCampeonato,
    leagueRoundCount,
    leagueBaseRoundCount,
    regularSplitRound,
  ])

  useEffect(() => {
    if (filteredRoundEntries.length === 0) {
      setOpenRound(null)
      setExpandedMatchId(null)
      return
    }

    // Respect explicit "all collapsed" state chosen by the user.
    if (openRound === null) {
      return
    }

    const visibleRounds = filteredRoundEntries.map(([round]) => round)
    if (visibleRounds.includes(openRound)) {
      return
    }

    const firstPending = filteredRoundEntries.find(([, roundMatches]) =>
      roundMatches.some((match) => match.status === 'pending')
    )

    setOpenRound(firstPending?.[0] ?? visibleRounds[0])
    setExpandedMatchId(null)
  }, [filteredRoundEntries, openRound])

  const getRoundLabel = (round: number): string => {
    if (isCampeonato) {
      if (round <= leagueRoundCount) return `Rodada ${round}`
      if (round === leagueRoundCount + 1) return playoffCutoff === 4 ? '🏆 Semifinais' : '🏆 Final'
      return `🏆 Fase Final ${round - leagueRoundCount}`
    }
    return `Rodada ${round}`
  }

  const handleMatchResultUpdated = () => {
    setExpandedMatchId(null)
    setRefreshKey((prev) => prev + 1)
  }

  const handleGeneratePlayoff = async () => {
    setGeneratingPlayoff(true)
    setError(null)
    try {
      await generatePlayoffMatches(tournament.id)
      setPhaseFilter('playoff')
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

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderRoundList = () => {
    if (matches.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎮</div>
          <p className={styles.emptyText}>Nenhum jogo gerado ainda</p>
        </div>
      )
    }

    if (filteredRoundEntries.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🗂️</div>
          <p className={styles.emptyText}>Nenhuma partida neste filtro</p>
        </div>
      )
    }

    return (
      <div className={styles.roundsList}>
        {filteredRoundEntries.map(([round, roundMatches]) => {
            const pendingInRound = roundMatches.filter((m) => m.status === 'pending').length
            const isRoundComplete = pendingInRound === 0
            const isOpen = openRound === round
            return (
              <Accordion
                key={round}
                className={isRoundComplete ? styles.roundAccordionComplete : undefined}
                isOpen={isOpen}
                onToggle={() => {
                  setOpenRound((prev) => (prev === round ? null : round))
                  setExpandedMatchId(null)
                }}
                header={(
                  <div className={styles.roundHeaderLeft}>
                    <span className={`${styles.roundLabel} ${isRoundComplete ? styles.roundLabelComplete : ''}`}>
                      {getRoundLabel(round)}
                    </span>
                    {pendingInRound > 0 ? (
                      <span className={styles.pendingBadge}>
                        {pendingInRound} pendente{pendingInRound !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className={styles.doneBadge}>✓ Completa</span>
                    )}
                  </div>
                )}
              >
                {roundMatches.map((m) => {
                  const isExpanded = expandedMatchId === m.id
                  return (
                    <div key={m.id}>
                      <button
                        className={`${styles.matchRow} ${m.status === 'finished' ? styles.matchRowFinished : ''} ${isExpanded ? styles.matchRowActive : ''}`}
                        onClick={() =>
                          setExpandedMatchId((prev) => (prev === m.id ? null : m.id))
                        }
                      >
                        <div className={styles.matchTeamCell}>
                          <span className={styles.matchClub}>
                            {m.homeTeam?.team_name || 'TBD'}
                          </span>
                          <span className={styles.matchNick}>
                            {m.homeTeam?.profile?.nickname || '—'}
                          </span>
                        </div>

                        <div className={styles.matchScoreCell}>
                          {m.status === 'finished' ? (
                            <span className={styles.resultScore}>
                              {m.home_score} – {m.away_score}
                            </span>
                          ) : (
                            <span className={styles.vsLabel}>vs</span>
                          )}
                        </div>

                        <div className={`${styles.matchTeamCell} ${styles.matchTeamAway}`}>
                          <span className={styles.matchClub}>
                            {m.awayTeam?.team_name || 'TBD'}
                          </span>
                          <span className={styles.matchNick}>
                            {m.awayTeam?.profile?.nickname || '—'}
                          </span>
                        </div>

                        <span className={styles.expandIcon} aria-hidden>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className={styles.matchCardWrap}>
                          <MatchCard match={m} onResultUpdated={handleMatchResultUpdated} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </Accordion>
            )
          })}
      </div>
    )
  }

  const renderLegSwitch =
    hasReturnMatch && matches.length > 0 && (!isCampeonato || phaseFilter === 'league') ? (
      <div className={styles.legSwitch} role="group" aria-label="Filtrar turnos">
        <button
          type="button"
          className={`${styles.legOption} ${legFilter === 'first' ? styles.legOptionActive : ''}`}
          onClick={() => setLegFilter('first')}
        >
          Turno
        </button>
        <button
          type="button"
          className={`${styles.legOption} ${legFilter === 'second' ? styles.legOptionActive : ''}`}
          onClick={() => setLegFilter('second')}
        >
          Returno
        </button>
      </div>
    ) : null

  const getMatchSideSummary = (match: MatchWithTeams, side: 'home' | 'away'): SideSummary => {
    const team = side === 'home' ? match.homeTeam : match.awayTeam
    return {
      teamName: team?.team_name || 'A definir',
      nickname: team?.profile?.nickname || '—',
    }
  }

  const getFinishedWinner = (match: MatchWithTeams): SideSummary | null => {
    if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
      return null
    }
    if (match.home_score === match.away_score) return null
    return match.home_score > match.away_score
      ? getMatchSideSummary(match, 'home')
      : getMatchSideSummary(match, 'away')
  }

  const getFinishedLoser = (match: MatchWithTeams): SideSummary | null => {
    if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
      return null
    }
    if (match.home_score === match.away_score) return null
    return match.home_score < match.away_score
      ? getMatchSideSummary(match, 'home')
      : getMatchSideSummary(match, 'away')
  }

  const playoffFinalMatch = useMemo(() => {
    const playoffRounds = [...new Set(playoffMatches.map((m) => m.round))].sort((a, b) => a - b)
    const finalsRoundMatches = playoffRounds.length > 1
      ? playoffMatches.filter((m) => m.round === playoffRounds[1])
      : playoffMatches
    return finalsRoundMatches[0]
  }, [playoffMatches])

  const playoffChampion = playoffFinalMatch ? getFinishedWinner(playoffFinalMatch) : null
  const playoffVice = playoffFinalMatch ? getFinishedLoser(playoffFinalMatch) : null

  const renderPhaseSwitch =
    isCampeonato && (isLeagueFinished || hasPlayoffStarted) ? (
      <div className={styles.phaseSwitch} role="group" aria-label="Filtrar fases">
        <button
          type="button"
          className={`${styles.phaseOption} ${phaseFilter === 'league' ? styles.phaseOptionActive : ''}`}
          onClick={() => setPhaseFilter('league')}
        >
          Primeira fase
        </button>
        <button
          type="button"
          className={`${styles.phaseOption} ${phaseFilter === 'playoff' ? styles.phaseOptionActive : ''}`}
          onClick={() => setPhaseFilter('playoff')}
          disabled={!hasPlayoffStarted}
        >
          Segunda fase
        </button>
      </div>
    ) : null

  const renderAdminPanel = () => (
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
  )

  const renderAdminButton = isCreator && participants.length > 0 ? (
    <button
      type="button"
      className={styles.adminOpenBtn}
      onClick={() => setShowAdminModal(true)}
    >
      ⚙️ Ajustes administrativos
    </button>
  ) : null

  // ── JSX ───────────────────────────────────────────────────────────────────

  const playoffBanner = isCreator && isLeagueFinished && !hasPlayoffStarted && (
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
  )

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

        {playoffBanner}
        {renderPhaseSwitch}

        {/* ── DESKTOP: dual-column dashboard ─────────────────────────── */}
        <div className={styles.dashboardGrid}>
          <div className={styles.leftColumn}>
            {isCampeonato && phaseFilter === 'playoff' ? (
              <FinalPhaseSection
                pendingCount={pendingCount}
                loading={loading}
                content={renderRoundList()}
              />
            ) : (
              <MatchesSection
                pendingCount={pendingCount}
                legSwitch={renderLegSwitch}
                loading={loading}
                content={renderRoundList()}
              />
            )}
          </div>

          <div className={styles.rightColumn}>
            {isCampeonato && phaseFilter === 'playoff' ? (
              <ScoutsSection champion={playoffChampion} vice={playoffVice} />
            ) : (
              <StandingsSection
                onDataUpdate={handleMatchResultUpdated}
                playoffCutoff={playoffCutoff}
              />
            )}
          </div>
        </div>

        {/* ── MOBILE: tab layout ──────────────────────────────────────── */}
        <div className={styles.mobileLayout}>
          <div className={styles.tabsNav}>
            <button
              className={`${styles.tab} ${activeTab === 'matches' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              🎮 Jogos {pendingCount > 0 && `(${pendingCount})`}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'standings' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('standings')}
            >
              Classificação
            </button>
          </div>

          {activeTab === 'matches' && (
            <div className={styles.mobileTabContent}>
              {isCampeonato && phaseFilter === 'playoff' ? (
                <FinalPhaseSection
                  pendingCount={pendingCount}
                  loading={loading}
                  content={renderRoundList()}
                />
              ) : (
                <MatchesSection
                  pendingCount={pendingCount}
                  legSwitch={renderLegSwitch}
                  loading={loading}
                  content={renderRoundList()}
                />
              )}
            </div>
          )}

          {activeTab === 'standings' && (
            <div className={styles.mobileTabContent}>
              {isCampeonato && phaseFilter === 'playoff' ? (
                <ScoutsSection champion={playoffChampion} vice={playoffVice} />
              ) : (
                <StandingsSection
                  onDataUpdate={handleMatchResultUpdated}
                  playoffCutoff={playoffCutoff}
                />
              )}
            </div>
          )}
        </div>

        {renderAdminButton}
      </main>

      {showAdminModal && (
        <div className={styles.adminModalOverlay} onClick={() => setShowAdminModal(false)}>
          <div className={styles.adminModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.adminModalHeader}>
              <h3 className={styles.adminModalTitle}>Ajustes Administrativos</h3>
              <button
                type="button"
                className={styles.adminModalCloseBtn}
                onClick={() => setShowAdminModal(false)}
                aria-label="Fechar ajustes administrativos"
              >
                ✕
              </button>
            </div>
            {renderAdminPanel()}
          </div>
        </div>
      )}

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
