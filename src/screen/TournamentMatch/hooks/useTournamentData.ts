import { useEffect, useState, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../../atoms/sessionAtom'
import { myTournamentsAtom, activeTournamentAtom } from '../../../atoms/tournamentAtoms'
import { strapiShieldsMapAtom } from '../../../atoms/catalogAtom'
import { fetchMyTournaments, getTournamentParticipants, cancelTournament } from '../../../lib/tournamentService'
import { getTournamentMatches, getTournamentStandings } from '../../../lib/matchService'
import { generatePlayoffMatches } from '../../../lib/matchGenerationEngine'
import { fetchStrapiClubCatalog } from '../../../lib/strapiClubService'
import { standingsCache } from '../../../components/StandingsTable/StandingsTable'
import type { Tournament } from '../../../atoms/tournamentAtoms'
import type { MatchWithTeams, TournamentSettings } from '../../../types/tournament'

interface ParticipantWithProfile {
  id: string
  team_name: string | null
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

interface TournamentMatchCacheEntry {
  participants: ParticipantWithProfile[]
  matches: MatchWithTeams[]
  strapiShieldsMap: Record<string, string>
  openRound: number | null
}

const tournamentMatchCache = new Map<string, TournamentMatchCacheEntry>()

function getRoundRobinRoundCount(participantCount: number, hasReturnMatch = false): number {
  if (participantCount <= 1) return 0
  const baseCount = participantCount % 2 === 0 ? participantCount - 1 : participantCount
  return hasReturnMatch ? baseCount * 2 : baseCount
}

export function useTournamentData(tournament: Tournament | null) {
  const user = useAtomValue(userAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const globalStrapiShieldsMap = useAtomValue(strapiShieldsMapAtom)
  const setGlobalStrapiShieldsMap = useSetAtom(strapiShieldsMapAtom)

  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [generatingPlayoff, setGeneratingPlayoff] = useState(false)
  const [openRound, setOpenRound] = useState<number | null>(null)
  const [strapiShieldsMap, setStrapiShieldsMap] = useState<Record<string, string>>(globalStrapiShieldsMap)

  const accordionInitRef = useRef<string | null>(null)
  const hydratedFromCacheRef = useRef(false)

  // Load tournament data
  useEffect(() => {
    if (!tournament) return

    const cached = tournamentMatchCache.get(tournament.id)
    if (cached && !hydratedFromCacheRef.current) {
      setParticipants(cached.participants)
      setMatches(cached.matches)
      if (Object.keys(cached.strapiShieldsMap).length > 0) {
        setStrapiShieldsMap(cached.strapiShieldsMap)
      }
      setOpenRound(cached.openRound)
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

        // Initialize accordion once per tournament
        if (accordionInitRef.current !== tournament.id) {
          const rounds = [...new Set(matchesData.map((m) => m.round))].sort((a, b) => a - b)
          const firstPending = rounds.find((r) =>
            matchesData.some((m) => m.round === r && m.status === 'pending')
          )
          setOpenRound(firstPending ?? rounds[0] ?? null)
          accordionInitRef.current = tournament.id
        }
        hydratedFromCacheRef.current = true

        // Pre-fetch standings
        getTournamentStandings(tournament.id)
          .then((standingsData) => {
            standingsCache.set(tournament.id, { standings: standingsData, matches: matchesData })
          })
          .catch(() => {})
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tournament?.id, refreshKey])

  // Cache data
  useEffect(() => {
    if (!tournament?.id) return
    
    tournamentMatchCache.set(tournament.id, {
      participants,
      matches,
      strapiShieldsMap,
      openRound,
    })
  }, [tournament?.id, participants, matches, strapiShieldsMap, openRound])

  // Load Strapi shields
  useEffect(() => {
    if (Object.keys(globalStrapiShieldsMap).length > 0) {
      setStrapiShieldsMap(globalStrapiShieldsMap)
      return
    }

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
        if (Object.keys(map).length > 0) {
          setGlobalStrapiShieldsMap(map)
        }
      })
      .catch(() => {})
    
    return () => { cancelled = true }
  }, [globalStrapiShieldsMap, setGlobalStrapiShieldsMap])

  // Auto-generate final after semifinals
  useEffect(() => {
    if (!tournament || !user) return
    
    const tournamentSettings = tournament.settings as TournamentSettings | null
    const isCampeonato = tournamentSettings?.format === 'campeonato'
    const playoffCutoff = isCampeonato ? (tournamentSettings?.playoffCutoff ?? 2) : undefined
    const isCreator = tournament.creator_id === user.id
    
    if (!isCampeonato || !isCreator || playoffCutoff !== 4) return

    const leagueRoundCount = isCampeonato
      ? getRoundRobinRoundCount(participants.length, tournamentSettings?.hasReturnMatch ?? false)
      : 0

    const playoffMatches = matches.filter((m) => m.round !== null && m.round > leagueRoundCount)
    const playoffRounds = [...new Set(playoffMatches.map(m => m.round))].sort((a, b) => a - b)
    
    if (playoffRounds.length === 1) {
      const semifinalMatches = playoffMatches.filter(m => m.round === playoffRounds[0])
      const allSemifinalsFinished = semifinalMatches.every(m => m.status === 'finished')
      
      if (allSemifinalsFinished && semifinalMatches.length === 2) {
        const generateFinal = async () => {
          try {
            await generatePlayoffMatches(tournament.id)
            setRefreshKey(prev => prev + 1)
          } catch (err) {
            console.error('Erro ao gerar final:', err)
            setError('Erro ao gerar final automaticamente')
          }
        }
        generateFinal()
      }
    }
  }, [matches, tournament, user, participants.length])

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

  const handleCancelTournament = async () => {
    if (!tournament || !user) return
    
    if (!window.confirm('⚠️ O torneio será cancelado e nenhuma partida poderá ser registrada. Tem certeza?')) return
    
    try {
      await cancelTournament(tournament.id)
      const updated = await fetchMyTournaments(user.id)
      setMyTournaments(updated)
      setActiveTournament(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar torneio')
    }
  }

  return {
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
  }
}