import { useEffect, useMemo, useRef, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  myTournamentsAtom,
  currentViewAtom,
  activeTournamentTabAtom,
  selectedMatchAtom,
} from '../../atoms/tournamentAtoms'
import { fetchMyTournaments, getTournamentParticipants, cancelTournament } from '../../lib/tournamentService'
import { getTournamentMatches, getTournamentStandings } from '../../lib/matchService'
import { standingsCache } from '../../components/StandingsTable'
import { fetchStrapiClubCatalog } from '../../lib/strapiClubService'
import { supabase } from '../../lib/supabaseClient'
import { generatePlayoffMatches } from '../../lib/matchGenerationEngine'
import type { Participant, Tournament } from '../../atoms/tournamentAtoms'
import type { MatchWithTeams, TournamentSettings } from '../../types/tournament'
import Accordion from '../../components/Accordion/Accordion'
import ManageParticipantModal, { type ManagedParticipant } from '../TournamentView/components/ManageParticipantModal'
import MatchesSection from './components/MatchesSection/MatchesSection'
import FinalPhaseSection from './components/FinalPhaseSection/FinalPhaseSection'
import StandingsSection from './components/StandingsSection/StandingsSection'
import ScoutsSection from './components/ScoutsSection/ScoutsSection'
import MatchTeamCrest from './components/MatchTeamCrest/MatchTeamCrest'
import TimelineCrest from './components/TimelineCrest/TimelineCrest'
import ScoreEntryDrawer from './components/ScoreEntryDrawer/ScoreEntryDrawer'
import ScoreEntryDrawerBoundary from './components/ScoreEntryDrawerBoundary/ScoreEntryDrawerBoundary'
import styles from './TournamentMatch.module.css'

interface ParticipantWithProfile extends Participant {
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

interface RecentTimelineMatch extends MatchWithTeams {
  loggedParticipantId: string
  tournamentName: string
  tournamentImage: string | null
  homePosition: number | null
  awayPosition: number | null
}

interface SnapshotStatRow {
  participantId: string
  points: number
  wins: number
  goalsFor: number
  goalsAgainst: number
}

interface TournamentMatchCacheEntry {
  participants: ParticipantWithProfile[]
  matches: MatchWithTeams[]
  recentTimelineMatches: RecentTimelineMatch[]
  strapiShieldsMap: Record<string, string>
  openRound: number | null
}

const tournamentMatchCache = new Map<string, TournamentMatchCacheEntry>()

function getMatchesWithSnapshotPositions(matches: MatchWithTeams[]) {
  const stats = new Map<string, SnapshotStatRow>()

  const ensureStat = (participantId: string | null | undefined) => {
    if (!participantId) return
    if (stats.has(participantId)) return
    stats.set(participantId, {
      participantId,
      points: 0,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    })
  }

  const sortedMatches = [...matches].sort((left, right) => {
    const leftStamp = left.updated_at ?? left.created_at ?? ''
    const rightStamp = right.updated_at ?? right.created_at ?? ''
    return leftStamp.localeCompare(rightStamp)
  })

  return sortedMatches.map((match) => {
    const homeId = match.home_participant_id
    const awayId = match.away_participant_id
    const isFinished = match.status === 'finished' && match.home_score !== null && match.away_score !== null

    ensureStat(homeId)
    ensureStat(awayId)

    if (isFinished && homeId && awayId) {
      const homeStat = stats.get(homeId)
      const awayStat = stats.get(awayId)

      if (homeStat && awayStat) {
        homeStat.goalsFor += match.home_score ?? 0
        homeStat.goalsAgainst += match.away_score ?? 0
        awayStat.goalsFor += match.away_score ?? 0
        awayStat.goalsAgainst += match.home_score ?? 0

        if ((match.home_score ?? 0) > (match.away_score ?? 0)) {
          homeStat.points += 3
          homeStat.wins += 1
        } else if ((match.home_score ?? 0) < (match.away_score ?? 0)) {
          awayStat.points += 3
          awayStat.wins += 1
        } else {
          homeStat.points += 1
          awayStat.points += 1
        }
      }
    }

    const ranking = [...stats.values()].sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points
      if (right.wins !== left.wins) return right.wins - left.wins

      const leftGoalDiff = left.goalsFor - left.goalsAgainst
      const rightGoalDiff = right.goalsFor - right.goalsAgainst
      if (rightGoalDiff !== leftGoalDiff) return rightGoalDiff - leftGoalDiff

      if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor
      return left.participantId.localeCompare(right.participantId)
    })

    const positionByParticipant = new Map(ranking.map((row, index) => [row.participantId, index + 1]))

    return {
      match,
      homePosition: homeId ? positionByParticipant.get(homeId) ?? null : null,
      awayPosition: awayId ? positionByParticipant.get(awayId) ?? null : null,
    }
  })
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

function getTournamentInitials(name: string | null | undefined) {
  if (!name) return 'TR'
  return name
    .split(/[\s\-_&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('') || 'TR'
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return 'Ativo'
    case 'draft':
      return 'Rascunho'
    case 'finished':
      return 'Finalizado'
    case 'cancelled':
      return 'Cancelado'
    default:
      return 'Ativo'
  }
}

function formatTimelineDate(input: string | null | undefined) {
  if (!input) return '--/--'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '--/--'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function normalizeMatchForDrawer(match: MatchWithTeams): MatchWithTeams {
  return {
    ...match,
    homeTeam: match.homeTeam
      ? {
          id: String(match.homeTeam.id),
          team_name: String(match.homeTeam.team_name ?? 'TBD'),
          profile: match.homeTeam.profile
            ? {
                id: match.homeTeam.profile.id ?? null,
                nickname: match.homeTeam.profile.nickname ?? null,
                avatar_url: match.homeTeam.profile.avatar_url ?? null,
                email: match.homeTeam.profile.email ?? null,
              }
            : undefined,
        }
      : undefined,
    awayTeam: match.awayTeam
      ? {
          id: String(match.awayTeam.id),
          team_name: String(match.awayTeam.team_name ?? 'TBD'),
          profile: match.awayTeam.profile
            ? {
                id: match.awayTeam.profile.id ?? null,
                nickname: match.awayTeam.profile.nickname ?? null,
                avatar_url: match.awayTeam.profile.avatar_url ?? null,
                email: match.awayTeam.profile.email ?? null,
              }
            : undefined,
        }
      : undefined,
  }
}

function TournamentMatch() {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const myTournaments = useAtomValue(myTournamentsAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setCurrentView = useSetAtom(currentViewAtom)
  const setSelectedMatch = useSetAtom(selectedMatchAtom)
  const selectedMatch = useAtomValue(selectedMatchAtom)
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
  const [strapiShieldsMap, setStrapiShieldsMap] = useState<Record<string, string>>({})
  const [recentTimelineMatches, setRecentTimelineMatches] = useState<RecentTimelineMatch[]>([])

  // Accordion state
  const [openRound, setOpenRound] = useState<number | null>(null)
  const accordionInitRef = useRef<string | null>(null)
  const recentTimelineRef = useRef<HTMLDivElement | null>(null)
  const recentTimelineIndexRef = useRef(0)
  const hydratedFromCacheRef = useRef(false)

  const tournamentId = tournament?.id

  useEffect(() => {
    if (!tournament) {
      setCurrentView('dashboard')
      return
    }

    const cached = tournamentMatchCache.get(tournament.id)
    if (cached && !hydratedFromCacheRef.current) {
      setParticipants(cached.participants)
      setMatches(cached.matches)
      setRecentTimelineMatches(cached.recentTimelineMatches)
      if (Object.keys(cached.strapiShieldsMap).length > 0) {
        setStrapiShieldsMap(cached.strapiShieldsMap)
      }
      setOpenRound(cached.openRound)
      setSelectedMatch(null)
      setLoading(false)
      hydratedFromCacheRef.current = true
      accordionInitRef.current = tournament.id
    }

    const loadData = async () => {
      if (!hydratedFromCacheRef.current) {
        setLoading(true)
      }
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
          setSelectedMatch(null)
          accordionInitRef.current = tournament.id
        }
        hydratedFromCacheRef.current = true

        // Pre-fetch standings in the background so the tab loads instantly
        getTournamentStandings(tournament.id)
          .then((standingsData) => {
            standingsCache.set(tournament.id, { standings: standingsData, matches: matchesData })
          })
          .catch(() => { /* silencioso — StandingsTable vai buscar novamente ao montar */ })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, setCurrentView, refreshKey, setSelectedMatch])

  useEffect(() => {
    setSelectedMatch(null)
  }, [tournamentId, setSelectedMatch])

  useEffect(() => {
    if (!tournamentId) return

    tournamentMatchCache.set(tournamentId, {
      participants,
      matches,
      recentTimelineMatches,
      strapiShieldsMap,
      openRound,
    })
  }, [tournamentId, participants, matches, recentTimelineMatches, strapiShieldsMap, openRound])

  // Carregar escudos do Strapi (funciona para torneios novos e antigos)
  useEffect(() => {
    let cancelled = false
    fetchStrapiClubCatalog()
      .then(({ teamData }) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const clubs of Object.values(teamData)) {
          for (const club of clubs) {
            if (club.logo) map[club.name] = club.logo
          }
        }
        setStrapiShieldsMap(map)
      })
      .catch(() => { /* silencioso — fallback para iniciais */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const userId = user?.id

    const loadRecentTimelineMatches = async () => {
      try {
        if (!userId) {
          if (!cancelled) setRecentTimelineMatches([])
          return
        }

        const freshTournaments = await fetchMyTournaments(userId).catch(() => myTournaments)

        const { data: myParticipantRows } = await supabase
          .from('participants')
          .select('id')
          .eq('user_id', userId)

        const myParticipantIds = new Set((myParticipantRows ?? []).map((row) => row.id))

        const sourceTournaments = Array.from(
          new Map(
            [...freshTournaments, ...myTournaments, tournament]
              .filter((item): item is Tournament => Boolean(item))
              .map((item) => [item.id, item])
          ).values()
        )

        if (sourceTournaments.length === 0 || !user?.id) {
          if (!cancelled) setRecentTimelineMatches([])
          return
        }

        const matchesPerTournament = await Promise.all(
          sourceTournaments.map(async (t) => {
            try {
              const tournamentMatches = await getTournamentMatches(t.id)
              return { tournament: t, matches: tournamentMatches }
            } catch {
              return { tournament: t, matches: [] as MatchWithTeams[] }
            }
          })
        )

        const normalized = matchesPerTournament
          .flatMap(({ tournament: t, matches: tournamentMatches }) => {
            const snapshotMatches = getMatchesWithSnapshotPositions(tournamentMatches)
            const settings = (t.settings as TournamentSettings | null) ?? null
            const tournamentName = t.name || 'Torneio'
            const tournamentImage =
              typeof settings?.tournamentImage === 'string' ? settings.tournamentImage : null

            return snapshotMatches.map(({ match, homePosition, awayPosition }) => {
              const loggedIsHome = Boolean(
                (match.home_participant_id && myParticipantIds.has(match.home_participant_id)) ||
                match.homeTeam?.profile?.id === userId
              )
              const loggedIsAway = Boolean(
                (match.away_participant_id && myParticipantIds.has(match.away_participant_id)) ||
                match.awayTeam?.profile?.id === userId
              )

              let loggedParticipantId = ''
              if (loggedIsHome && match.home_participant_id) {
                loggedParticipantId = match.home_participant_id
              }
              if (loggedIsAway && match.away_participant_id) {
                loggedParticipantId = match.away_participant_id
              }

              return {
                ...match,
                loggedParticipantId,
                tournamentName,
                tournamentImage,
                homePosition,
                awayPosition,
              } as RecentTimelineMatch
            })
          })
          .filter((match) =>
            match.status === 'finished' &&
            match.home_score !== null &&
            match.away_score !== null &&
            Boolean(match.loggedParticipantId)
          )
          .sort((left, right) => {
            const leftDate = left.updated_at ?? left.created_at ?? ''
            const rightDate = right.updated_at ?? right.created_at ?? ''
            return rightDate.localeCompare(leftDate)
          })
          .slice(0, 3)
          .sort((left, right) => {
            const leftDate = left.updated_at ?? left.created_at ?? ''
            const rightDate = right.updated_at ?? right.created_at ?? ''
            return leftDate.localeCompare(rightDate)
          })

        if (!cancelled) setRecentTimelineMatches(normalized)
      } catch {
        if (!cancelled) setRecentTimelineMatches([])
      }
    }

    if (user?.id) {
      loadRecentTimelineMatches()
    }

    return () => {
      cancelled = true
    }
  }, [user?.id, refreshKey, myTournaments, tournament])

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
  const tournamentImage = typeof tournamentSettings?.tournamentImage === 'string'
    ? tournamentSettings.tournamentImage
    : null
  const tournamentInitials = getTournamentInitials(tournament.name)
  const tournamentStatusLabel = getStatusLabel(tournament.status)
  const managedTeamOptions = Array.isArray(tournamentSettings?.selectedTeamNames)
    ? tournamentSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []
  // Merge: settings salvos (torneios novos) + catálogo Strapi ao vivo (todos os torneios)
  const shieldsMap: Record<string, string> = {
    ...strapiShieldsMap,
    ...(tournamentSettings?.selectedTeamShields ?? {}),
  }
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
    recentTimelineIndexRef.current = 0
  }, [tournamentId])

  useEffect(() => {
    const timelineList = recentTimelineRef.current
    if (!timelineList || recentTimelineMatches.length <= 1) {
      return
    }

    const AUTO_SCROLL_DELAY = 3600

    const tick = () => {
      if (window.innerWidth > 900) {
        return
      }

      const cards = Array.from(timelineList.children) as HTMLElement[]
      if (cards.length <= 1) {
        return
      }

      const nextIndex = (recentTimelineIndexRef.current + 1) % cards.length
      recentTimelineIndexRef.current = nextIndex
      cards[nextIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }

    const intervalId = window.setInterval(tick, AUTO_SCROLL_DELAY)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [recentTimelineMatches])

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
      setSelectedMatch(null)
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
    setSelectedMatch(null)
  }, [filteredRoundEntries, openRound, setSelectedMatch])

  const getRoundLabel = (round: number): string => {
    if (isCampeonato) {
      if (round <= leagueRoundCount) return `Rodada ${round}`
      if (round === leagueRoundCount + 1) return playoffCutoff === 4 ? '🏆 Semifinais' : '🏆 Final'
      return `🏆 Fase Final ${round - leagueRoundCount}`
    }
    return `Rodada ${round}`
  }

  const handleMatchResultUpdated = () => {
    setSelectedMatch(null)
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
                  setSelectedMatch(null)
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
          <span className={styles.backBtnIcon}>←</span>
          <span>Voltar</span>
        </button>

        <div className={styles.headerContent}>
          <div className={styles.headerThumb} aria-hidden>
            {tournamentImage ? (
              <img src={tournamentImage} alt={tournament.name} className={styles.headerThumbImg} />
            ) : (
              <span className={styles.headerThumbFallback}>{tournamentInitials}</span>
            )}
          </div>

          <div className={styles.headerTextBlock}>
            <h1 className={styles.title}>{tournament.name}</h1>
            <span className={styles.gameType}>{tournament.game_type}</span>
          </div>
        </div>

        <span className={styles.statusBadge}>{tournamentStatusLabel}</span>
      </header>

      <main className={styles.main}>
        {recentTimelineMatches.length > 0 && (
          <section className={styles.recentTimeline}>
            <h2 className={styles.recentTimelineTitle}>Resultado ultimas partidas</h2>
            <div ref={recentTimelineRef} className={styles.recentTimelineList}>
              {recentTimelineMatches.map((match) => {
                const loggedIsHome = match.home_participant_id === match.loggedParticipantId
                const myTeam = loggedIsHome ? match.homeTeam : match.awayTeam
                const opponentTeam = loggedIsHome ? match.awayTeam : match.homeTeam
                const myScore = loggedIsHome ? match.home_score : match.away_score
                const opponentScore = loggedIsHome ? match.away_score : match.home_score
                const myPosition = loggedIsHome ? match.homePosition : match.awayPosition
                const opponentPosition = loggedIsHome ? match.awayPosition : match.homePosition

                const resultTone =
                  myScore! > opponentScore!
                    ? styles.timelineResultWin
                    : myScore! < opponentScore!
                      ? styles.timelineResultLoss
                      : styles.timelineResultDraw

                return (
                  <article key={match.id} className={styles.recentCard}>
                    <div className={styles.recentThumb}>
                      {match.tournamentImage ? (
                        <img src={match.tournamentImage} alt={match.tournamentName} className={styles.recentThumbImg} />
                      ) : (
                        <span className={styles.recentThumbFallback}>{getTournamentInitials(match.tournamentName)}</span>
                      )}
                    </div>

                    <div className={styles.recentMeta}>
                      <span className={styles.recentMetaName}>{match.tournamentName}</span>
                      <strong className={styles.recentMetaDate}>{formatTimelineDate(match.updated_at ?? match.created_at)}</strong>
                    </div>

                    <div className={styles.recentScoreWrap}>
                      <span className={styles.recentPositionTag}>P{myPosition ?? '-'}</span>
                      <TimelineCrest teamName={myTeam?.team_name} shieldsMap={shieldsMap} />

                      <span className={styles.recentScoreBox}>{myScore}</span>
                      <span className={`${styles.recentScoreCross} ${resultTone}`}>x</span>
                      <span className={styles.recentScoreBox}>{opponentScore}</span>

                      <TimelineCrest teamName={opponentTeam?.team_name} shieldsMap={shieldsMap} />
                      <span className={styles.recentPositionTag}>P{opponentPosition ?? '-'}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

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
