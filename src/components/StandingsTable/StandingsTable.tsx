import { useEffect, useRef, useState, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom } from '../../atoms/tournamentAtoms'
import { supabase } from '../../lib/supabaseClient'
import { getTournamentMatches, getTournamentStandings } from '../../lib/matchService'
import type { MatchWithTeams, StandingsRow } from '../../types/tournament'
import styles from './StandingsTable.module.css'

interface StandingsCacheEntry {
  standings: StandingsRow[]
  matches: MatchWithTeams[]
}

export const standingsCache = new Map<string, StandingsCacheEntry>()

interface StandingsTableProps {
  onDataUpdate?: () => void
  playoffCutoff?: number
  isChampionshipFormat?: boolean
  leagueRoundCount?: number
}

type FormResult = 'win' | 'draw' | 'loss'

function getInitials(name: string | null | undefined) {
  if (!name) return 'BS'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'BS'
}

function getRecentForm(participantId: string, matches: MatchWithTeams[]): FormResult[] {
  return matches
    .filter(
      (match) =>
        match.status === 'finished' &&
        match.home_score !== null &&
        match.away_score !== null &&
        (match.home_participant_id === participantId || match.away_participant_id === participantId)
    )
    .sort((left, right) => {
      const leftStamp = left.updated_at ?? left.created_at ?? ''
      const rightStamp = right.updated_at ?? right.created_at ?? ''
      return rightStamp.localeCompare(leftStamp)
    })
    .slice(0, 5)
    .map((match) => {
      const isHome = match.home_participant_id === participantId
      const goalsFor = isHome ? match.home_score ?? 0 : match.away_score ?? 0
      const goalsAgainst = isHome ? match.away_score ?? 0 : match.home_score ?? 0

      if (goalsFor > goalsAgainst) return 'win'
      if (goalsFor < goalsAgainst) return 'loss'
      return 'draw'
    })
    .reverse()
}

function StandingsTable({ 
  onDataUpdate, 
  playoffCutoff,
  isChampionshipFormat = false,
  leagueRoundCount = 0
}: StandingsTableProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)

  const cached = tournament?.id ? standingsCache.get(tournament.id) : undefined
  const [standings, setStandings] = useState<StandingsRow[]>(cached?.standings ?? [])
  const [matches, setMatches] = useState<MatchWithTeams[]>(cached?.matches ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const onDataUpdateRef = useRef(onDataUpdate)

  useEffect(() => {
    onDataUpdateRef.current = onDataUpdate
  }, [onDataUpdate])

  // ✅ Filtrar matches apenas da fase de liga para cálculos
  const leagueMatches = useMemo(() => {
    if (!isChampionshipFormat || leagueRoundCount === 0) return matches
    return matches.filter(m => m.round <= leagueRoundCount)
  }, [matches, isChampionshipFormat, leagueRoundCount])

  useEffect(() => {
    if (!tournament?.id) return
    
    const handler = (e: Event) => {
      const custom = e as CustomEvent
      const { matchId, homeScore, awayScore } = custom.detail || {}
      if (!matchId) return
      
      setMatches((prev: any) => {
        const updated = prev.map((m: any) => {
          if (m.id === matchId) {
            // ✅ Só atualiza se for match da fase de liga
            if (isChampionshipFormat && leagueRoundCount > 0 && m.round > leagueRoundCount) {
              return m // Não atualiza matches do mata-mata
            }
            return { 
              ...m, 
              home_score: homeScore, 
              away_score: awayScore, 
              status: 'finished', 
              updated_at: new Date().toISOString() 
            }
          }
          return m
        })
        return updated
      })
      
      // ✅ Só recalcula standings se não for mata-mata
      if (!isChampionshipFormat || leagueRoundCount === 0) {
        // Formato normal - recalcula sempre
        setStandings((prev) => {
          getTournamentStandings(tournament.id).then((standingsData) => {
            standingsCache.set(tournament.id, { standings: standingsData, matches })
            setStandings(standingsData)
          })
          return prev
        })
      } else {
        // Formato campeonato - só recalcula se for da liga
        setMatches((currentMatches) => {
          const matchToUpdate = currentMatches.find((m: any) => m.id === matchId)
          if (matchToUpdate && matchToUpdate.round <= leagueRoundCount) {
            getTournamentStandings(tournament.id).then((standingsData) => {
              standingsCache.set(tournament.id, { standings: standingsData, matches: currentMatches })
              setStandings(standingsData)
            })
          }
          return currentMatches
        })
      }
    }
    
    window.addEventListener('bescore:match-updated', handler)
    return () => window.removeEventListener('bescore:match-updated', handler)
  }, [tournament?.id, isChampionshipFormat, leagueRoundCount])

  useEffect(() => {
    if (!tournament?.id) return

    let isCancelled = false
    const hasCached = standingsCache.has(tournament.id)
    if (!hasCached) setLoading(true)

    // Defensive cleanup: remove stale channels for this tournament before creating a new one.
    const staleChannels = supabase
      .getChannels()
      .filter((c) => c.topic.startsWith(`realtime:matches:${tournament.id}`))
    staleChannels.forEach((c) => {
      supabase.removeChannel(c)
    })

    const loadStandings = async () => {
      try {
        setError(null)
        const [standingsData, matchesData] = await Promise.all([
          getTournamentStandings(tournament.id),
          getTournamentMatches(tournament.id),
        ])
        if (isCancelled) return
        standingsCache.set(tournament.id, { standings: standingsData, matches: matchesData })
        setStandings(standingsData)
        setMatches(matchesData)
      } catch (err) {
        if (isCancelled) return
        const message = err instanceof Error ? err.message : 'Erro ao carregar classificação'
        setError(message)
        console.error('Erro:', err)
      } finally {
        if (isCancelled) return
        setLoading(false)
      }
    }

    loadStandings()

    // Setup real-time listener for matches updates.
    const uniqueSuffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(`matches:${tournament.id}:${uniqueSuffix}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'matches',
            filter: `tournament_id=eq.${tournament.id}`,
          },
          (payload) => {
            // ✅ Só recarrega se for match da liga ou se não for campeonato
            const updatedMatch = payload.new as any
            if (!isChampionshipFormat || !leagueRoundCount || updatedMatch.round <= leagueRoundCount) {
              loadStandings()
              onDataUpdateRef.current?.()
            }
          }
        )
        .subscribe()
    } catch (err) {
      console.error('Erro ao iniciar realtime das classificacoes:', err)
      setError('Nao foi possivel iniciar atualizacao em tempo real.')
    }

    return () => {
      isCancelled = true
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [tournament?.id, isChampionshipFormat, leagueRoundCount])

  if (loading) {
    return <div className={styles.container}>Carregando classificação...</div>
  }

  if (error) {
    return <div className={styles.container}><div className={styles.error}>{error}</div></div>
  }

  if (standings.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Nenhum resultado registrado ainda</div>
      </div>
    )
  }

  const hasLoggedUserTeam = standings.some((row) => row.user_id === user?.id)

  return (
    <div className={styles.container}>
      <div className={styles.board}>
        <div className={styles.headerRow}>
          <h2 className={styles.headerTitle}>
            {isChampionshipFormat ? 'Classificação da Liga' : 'Classificação'}
          </h2>
          <div className={styles.headerStats}>
            <span className={styles.pointsHeader} data-label="P">P</span>
            <span data-label="J">J</span>
            <span data-label="V">V</span>
            <span data-label="E">E</span>
            <span data-label="D">D</span>
            <span data-label="Gol">Gol</span>
            <span data-label="SG">SG</span>
            <span data-label="Desempenho">Desempenho</span>
          </div>
        </div>

        <div className={styles.rows}>
          {standings.map((row, idx) => {
            const isInPlayoffZone = playoffCutoff !== undefined && idx + 1 <= playoffCutoff
            // ✅ Usar leagueMatches para calcular form
            const recentForm = getRecentForm(row.participant_id, leagueMatches)

            return (
              <div
                key={row.participant_id}
                className={`${styles.row} ${isInPlayoffZone ? styles.rowClassified : ''}`}
              >
                <div className={styles.positionCell}>{row.position}</div>

                <div className={styles.teamCell}>
                  {row.user_avatar_url ? (
                    <img src={row.user_avatar_url} alt="" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarFallback}>{getInitials(row.team_name || row.user_nickname)}</div>
                  )}

                  <div className={styles.identity}>
                    <strong className={`${styles.teamName} ${row.user_id === user?.id ? styles.teamNameCurrentUser : ''}`}>
                      {row.team_name || 'Equipe'}
                    </strong>
                    <div className={styles.metaRow}>
                      {row.penalty_points !== 0 && (
                        <span
                          className={row.penalty_points > 0 ? styles.adjustPositive : styles.adjustNegative}
                          title={row.penalty_reason ?? undefined}
                        >
                          {row.penalty_points > 0 ? '+' : ''}{row.penalty_points} adj
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.statCell} data-label="P">{row.points}</div>
                <div className={styles.statCell} data-label="J">{row.total_matches}</div>
                <div className={styles.statCell} data-label="V">{row.wins}</div>
                <div className={styles.statCell} data-label="E">{row.draws}</div>
                <div className={styles.statCell} data-label="D">{row.losses}</div>
                <div className={styles.statCell} data-label="Gol">{row.goals_for}:{row.goals_against}</div>
                <div
                  className={`${styles.statCell} ${row.goal_difference > 0 ? styles.goalPositive : row.goal_difference < 0 ? styles.goalNegative : ''}`}
                  data-label="SG"
                >
                  {row.goal_difference > 0 ? '+' : ''}{row.goal_difference}
                </div>

                <div className={styles.formCell} data-label="Desempenho">
                  {recentForm.length > 0 ? (
                    recentForm.map((result, formIndex) => (
                      <span
                        key={`${row.participant_id}-${formIndex}`}
                        className={`${styles.formBadge} ${styles[`formBadge${result[0].toUpperCase()}${result.slice(1)}`]}`}
                        title={result === 'win' ? 'Vitória' : result === 'draw' ? 'Empate' : 'Derrota'}
                      />
                    ))
                  ) : (
                    <span className={styles.noForm}>—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.footer}>
          <div className={styles.rules}>
            <strong className={styles.footerTitle}>Quando dois (ou mais) times empatam em pontos, as regras de desempate são:</strong>
            <ul className={styles.rulesList}>
              <li>Vitórias</li>
              <li>Saldo de gols</li>
              <li>Gols-pró</li>
              <li>Confronto direto</li>
            </ul>
          </div>

          <div className={styles.legendColumn}>
            <div className={styles.performanceLegend}>
              <span className={styles.legendTitle}>Desempenho {isChampionshipFormat ? '(Liga)' : ''}</span>
              <div className={styles.legendItems}>
                <span className={styles.legendItem}>
                  <span className={`${styles.performanceDot} ${styles.performanceDotWin}`} />
                  Vitória
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.performanceDot} ${styles.performanceDotDraw}`} />
                  Empate
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.performanceDot} ${styles.performanceDotLoss}`} />
                  Derrota
                </span>
              </div>
            </div>

            <div className={styles.statusLegendRow}>
              {playoffCutoff !== undefined && (
                <div className={styles.statusLegendItem}>
                  <span className={`${styles.statusSquare} ${styles.classifiedSquare}`} />
                  <span>Classificado para mata-mata</span>
                </div>
              )}

              {hasLoggedUserTeam && (
                <div className={styles.statusLegendItem}>
                  <span className={`${styles.statusSquare} ${styles.loggedUserSquare}`} />
                  <span>Seu time (roxo)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StandingsTable;
