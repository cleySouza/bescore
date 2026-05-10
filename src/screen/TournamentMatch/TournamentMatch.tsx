import { useState, useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  currentViewAtom,
  activeTournamentTabAtom,
  selectedMatchAtom,
} from '../../atoms/tournamentAtoms'
import { useTournamentData } from './hooks/useTournamentData'
import { useRecentTimeline } from './hooks/useRecentTimeline'
import { getTournamentSettings, getMatchesByPhase, getRoundLabel } from './utils/tournamentHelpers'
import { normalizeMatchForDrawer } from './utils/matchHelpers'
import TournamentHeader from './components/TournamentHeader/TournamentHeader'
import RecentTimeline from './components/RecentTimeline/RecentTimeline'
import PhaseControls from './components/PhaseControls/PhaseControls'
import AdminPanel from './components/AdminPanel/AdminPanel'
import MatchesSection from './components/MatchesSection/MatchesSection'
import FinalPhaseSection from './components/FinalPhaseSection/FinalPhaseSection'
import StandingsSection from './components/StandingsSection/StandingsSection'
import ScoutsSection from './components/ScoutsSection/ScoutsSection'
import ScoreEntryDrawer from './components/ScoreEntryDrawer/ScoreEntryDrawer'
import ScoreEntryDrawerBoundary from './components/ScoreEntryDrawerBoundary/ScoreEntryDrawerBoundary'
import Accordion from '../../components/Accordion/Accordion'
import MatchTeamCrest from './components/MatchTeamCrest/MatchTeamCrest'
import ManageParticipantModal, { type ManagedParticipant } from '../TournamentView/components/ManageParticipantModal'
import type { MatchWithTeams } from '../../types/tournament'
import styles from './TournamentMatch.module.css'

type LegFilter = 'first' | 'second'
type PhaseFilter = 'league' | 'playoff'

function TournamentMatch() {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const setCurrentView = useSetAtom(currentViewAtom)
  const setSelectedMatch = useSetAtom(selectedMatchAtom)
  const selectedMatch = useAtomValue(selectedMatchAtom)
  const [activeTab, setActiveTab] = useAtom(activeTournamentTabAtom)

  // ✅ EARLY RETURN ANTES DE TODOS OS HOOKS
  if (!tournament || !user) return null

  // Local state
  const [legFilter, setLegFilter] = useState<LegFilter>('first')
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('league')
  const [managedParticipant, setManagedParticipant] = useState<ManagedParticipant | null>(null)
  const [showAdminModal, setShowAdminModal] = useState(false)

  // Custom hooks
  const {
    participants,
    matches,
    loading,
    error,
    refreshKey,
    setRefreshKey,
    generatingPlayoff,
    handleGeneratePlayoff,
    handleCancelTournament,
    openRound,
    setOpenRound,
    strapiShieldsMap,
  } = useTournamentData(tournament)

  const { recentTimelineMatches, recentTimelineRef } = useRecentTimeline(user?.id, refreshKey)

  // Tournament settings
  const {
    isCreator,
    tournamentSettings,
    isCampeonato,
    hasReturnMatch,
    playoffCutoff,
    leagueRoundCount,
    managedTeamOptions,
    shieldsMap,
  } = getTournamentSettings(tournament, user.id, strapiShieldsMap, participants.length)

  // Match filtering
  const {
    leagueMatches,
    playoffMatches,
    hasPlayoffStarted,
    isLeagueFinished,
    pendingCount,
    filteredRoundEntries,
    playoffChampion,
    playoffVice,
  } = getMatchesByPhase(matches, {
    isCampeonato,
    leagueRoundCount,
    phaseFilter,
    legFilter,
    hasReturnMatch,
    participants: participants.length,
  })

  // Reset filters when tournament changes
  useEffect(() => {
    setLegFilter('first')
    setPhaseFilter('league')
  }, [tournament?.id])

  // Auto-switch to league phase if playoff not started
  useEffect(() => {
    if (!hasPlayoffStarted && phaseFilter === 'playoff') {
      setPhaseFilter('league')
    }
  }, [hasPlayoffStarted, phaseFilter])

  // Auto-open first pending round
  useEffect(() => {
    if (filteredRoundEntries.length === 0) {
      setOpenRound(null)
      setSelectedMatch(null)
      return
    }

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
    setSelectedMatch(null)
  }, [filteredRoundEntries, openRound, setSelectedMatch])

  const handleMatchResultUpdated = () => {
    setSelectedMatch(null)
    setRefreshKey((prev) => prev + 1)
  }

  const handleBackToDashboard = () => {
    setCurrentView('dashboard')
  }

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
                setSelectedMatch(null)
              }}
              header={(
                <div className={styles.roundHeaderLeft}>
                  <span className={`${styles.roundLabel} ${isRoundComplete ? styles.roundLabelComplete : ''}`}>
                    {getRoundLabel(round, isCampeonato, leagueRoundCount, playoffCutoff)}
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
              {roundMatches.map((m, index) => {
                const isExpanded = selectedMatch?.id === m.id
                return (
                  <div key={m.id}>
                    <button
                      className={`${styles.matchRow} ${m.status === 'finished' ? styles.matchRowFinished : ''} ${isExpanded ? styles.matchRowActive : ''}`}
                      onClick={() => {
                        setSelectedMatch((prev) => (prev?.id === m.id ? null : normalizeMatchForDrawer(m)))
                      }}
                    >
                      <div className={styles.matchRowMain}>
                        <div className={styles.matchTeamBlock}>
                          <span className={styles.matchClub}>{m.homeTeam?.team_name || 'TBD'}</span>
                          <span className={`${styles.matchBrand} ${m.homeTeam?.profile?.id === user.id ? styles.matchBrandCurrentUser : ''}`}>
                            {m.homeTeam?.profile?.nickname || 'csbeep'}
                          </span>
                        </div>

                        <MatchTeamCrest teamName={m.homeTeam?.team_name} shieldsMap={shieldsMap} />

                        <div className={styles.matchScoreGroup}>
                          <span className={styles.scoreBox}>
                            {m.status === 'finished' && m.home_score !== null ? m.home_score : ''}
                          </span>
                          <span className={styles.scoreCross}>x</span>
                          <span className={styles.scoreBox}>
                            {m.status === 'finished' && m.away_score !== null ? m.away_score : ''}
                          </span>
                        </div>

                        <MatchTeamCrest teamName={m.awayTeam?.team_name} shieldsMap={shieldsMap} />

                        <div className={`${styles.matchTeamBlock} ${styles.matchTeamAway}`}>
                          <span className={styles.matchClub}>{m.awayTeam?.team_name || 'TBD'}</span>
                          <span className={`${styles.matchBrand} ${m.awayTeam?.profile?.id === user.id ? styles.matchBrandCurrentUser : ''}`}>
                            {m.awayTeam?.profile?.nickname || 'csbeep'}
                          </span>
                        </div>
                      </div>

                      <span className={styles.expandIcon} aria-hidden>
                        {isExpanded ? '−' : '+'}
                      </span>
                    </button>

                    {index < roundMatches.length - 1 && <div className={styles.matchRowDivider} />}
                  </div>
                )
              })}
            </Accordion>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return <div className={styles.container}>Carregando torneio...</div>
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <TournamentHeader
        tournament={tournament}
        tournamentSettings={tournamentSettings}
        onBack={handleBackToDashboard}
      />

      <main className={styles.main}>
        <RecentTimeline
          matches={recentTimelineMatches}
          shieldsMap={shieldsMap}
          ref={recentTimelineRef}
        />

        {error && <div className={styles.errorMessage}>{error}</div>}

        <PhaseControls
          isCampeonato={isCampeonato}
          hasReturnMatch={hasReturnMatch}
          isLeagueFinished={isLeagueFinished}
          hasPlayoffStarted={hasPlayoffStarted}
          playoffCutoff={playoffCutoff}
          phaseFilter={phaseFilter}
          legFilter={legFilter}
          onPhaseChange={setPhaseFilter}
          onLegChange={setLegFilter}
          onGeneratePlayoff={handleGeneratePlayoff}
          generatingPlayoff={generatingPlayoff}
          isCreator={isCreator}
        />

        {/* Desktop Layout */}
        <div className={styles.dashboardGrid}>
          <div className={styles.leftColumn}>
            {isCampeonato && phaseFilter === 'playoff' ? (
              <FinalPhaseSection
                pendingCount={pendingCount}
                loading={false}
                content={renderRoundList()}
              />
            ) : (
              <MatchesSection
                pendingCount={pendingCount}
                legSwitch={hasReturnMatch && (!isCampeonato || phaseFilter === 'league') ? (
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
                ) : null}
                loading={false}
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
                isChampionshipFormat={isCampeonato}
                leagueRoundCount={leagueRoundCount}
              />
            )}
          </div>
        </div>

        {/* Mobile Layout */}
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
                  loading={false}
                  content={renderRoundList()}
                />
              ) : (
                <MatchesSection
                  pendingCount={pendingCount}
                  legSwitch={hasReturnMatch && (!isCampeonato || phaseFilter === 'league') ? (
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
                  ) : null}
                  loading={false}
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
                  isChampionshipFormat={isCampeonato}
                  leagueRoundCount={leagueRoundCount}
                />
              )}
            </div>
          )}
        </div>

        {isCreator && participants.length > 0 && (
          <button
            type="button"
            className={styles.adminOpenBtn}
            onClick={() => setShowAdminModal(true)}
          >
            ⚙️ Ajustes administrativos
          </button>
        )}
      </main>

      {/* Modals */}
      {showAdminModal && (
        <AdminPanel
          participants={participants}
          onClose={() => setShowAdminModal(false)}
          onManageParticipant={setManagedParticipant}
          onCancelTournament={handleCancelTournament}
        />
      )}

      {managedParticipant && (
        <ManageParticipantModal
          participant={managedParticipant}
          showScoreAdjustments={true}
          teamOptions={managedTeamOptions}
          onClose={() => setManagedParticipant(null)}
          onSaved={() => setRefreshKey((prev) => prev + 1)}
        />
      )}

      <ScoreEntryDrawerBoundary key={selectedMatch?.id ?? 'no-match-selected'}>
        <ScoreEntryDrawer onResultSaved={handleMatchResultUpdated} />
      </ScoreEntryDrawerBoundary>
    </div>
  )
}

export default TournamentMatch