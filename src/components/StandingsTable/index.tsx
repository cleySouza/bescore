import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom } from '../../atoms/tournamentAtoms'
import { supabase } from '../../lib/supabaseClient'
import { getTournamentMatches, getTournamentStandings } from '../../lib/matchService'
import type { MatchWithTeams, StandingsRow } from '../../types/tournament'
import styles from './StandingsTable.module.css'

interface StandingsTableProps {
  onDataUpdate?: () => void
  playoffCutoff?: number
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

function StandingsTable({ onDataUpdate, playoffCutoff }: StandingsTableProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const [standings, setStandings] = useState<StandingsRow[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tournament) return

    const loadStandings = async () => {
      try {
        setError(null)
        const [standingsData, matchesData] = await Promise.all([
          getTournamentStandings(tournament.id),
          getTournamentMatches(tournament.id),
        ])
        setStandings(standingsData)
        setMatches(matchesData)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar classificação'
        setError(message)
        console.error('Erro:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStandings()

    // Setup real-time listener for matches updates
    const channel = supabase
      .channel(`matches:${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournament.id}`,
        },
        () => {
          // Reload standings when a match is updated
          loadStandings()
          onDataUpdate?.()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [tournament, onDataUpdate])

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
          <h2 className={styles.headerTitle}>Classificação</h2>
          <div className={styles.headerStats}>
            <span className={styles.pointsHeader}>P</span>
            <span>J</span>
            <span>V</span>
            <span>E</span>
            <span>D</span>
            <span>Gol</span>
            <span>SG</span>
            <span>Desempenho</span>
          </div>
        </div>

        <div className={styles.rows}>
          {standings.map((row, idx) => {
            const isInPlayoffZone = playoffCutoff !== undefined && idx + 1 <= playoffCutoff
            const recentForm = getRecentForm(row.participant_id, matches)

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
                      >
                        {result === 'win' ? '✓' : result === 'draw' ? '−' : '×'}
                      </span>
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
              <span className={styles.legendTitle}>Desempenho</span>
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
                  <span>Classificado</span>
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

export default StandingsTable
