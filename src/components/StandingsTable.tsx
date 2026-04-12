import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { activeTournamentAtom } from '../atoms/tournamentAtoms'
import { supabase } from '../lib/supabaseClient'
import { getTournamentStandings } from '../lib/matchService'
import type { StandingsRow } from '../types/tournament'
import styles from './StandingsTable.module.css'

interface StandingsTableProps {
  onDataUpdate?: () => void
  playoffCutoff?: number
}

function StandingsTable({ onDataUpdate, playoffCutoff }: StandingsTableProps) {
  const tournament = useAtomValue(activeTournamentAtom)
  const [standings, setStandings] = useState<StandingsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tournament) return

    const loadStandings = async () => {
      try {
        setError(null)
        const data = await getTournamentStandings(tournament.id)
        setStandings(data)
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

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.position}>Pos</th>
            <th className={styles.team}>Time</th>
            <th className={styles.stat}>J</th>
            <th className={styles.stat}>V</th>
            <th className={styles.stat}>E</th>
            <th className={styles.stat}>D</th>
            <th className={styles.stat}>GF</th>
            <th className={styles.stat}>GA</th>
            <th className={styles.stat}>SG</th>
            <th className={styles.stat} title="Ajuste de pontos (punição/bônus)">Adj</th>
            <th className={styles.points}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, idx) => {
            const isInPlayoffZone = playoffCutoff !== undefined && idx + 1 <= playoffCutoff
            return (
              <tr
                key={row.participant_id}
                className={[
                  idx % 2 === 0 ? styles.even : styles.odd,
                  isInPlayoffZone ? styles.inPlayoffZone : '',
                ].join(' ')}
              >
                <td className={styles.position}>
                  <strong>{row.position}</strong>
                </td>
                <td className={styles.team}>
                  <div className={styles.teamCell}>
                    <span className={styles.teamName}>{row.team_name || 'Equipe'}</span>
                    <small>{row.user_nickname || 'Usuário'}</small>
                  </div>
                </td>
                <td className={styles.stat}>{row.total_matches}</td>
                <td className={styles.stat}>{row.wins}</td>
                <td className={styles.stat}>{row.draws}</td>
                <td className={styles.stat}>{row.losses}</td>
                <td className={styles.stat}>{row.goals_for}</td>
                <td className={styles.stat}>{row.goals_against}</td>
                <td className={`${styles.stat} ${row.goal_difference >= 0 ? styles.positive : styles.negative}`}>
                  {row.goal_difference > 0 ? '+' : ''}{row.goal_difference}
                </td>
                <td className={styles.stat}>
                  {row.penalty_points !== 0 ? (
                    <span
                      className={row.penalty_points < 0 ? styles.penaltyNegative : styles.penaltyPositive}
                      title={row.penalty_reason ?? undefined}
                    >
                      {row.penalty_points > 0 ? '+' : ''}{row.penalty_points}
                      {row.penalty_reason && <span className={styles.penaltyIcon}> ⚠️</span>}
                    </span>
                  ) : (
                    <span className={styles.penaltyZero}>—</span>
                  )}
                </td>
                <td className={styles.points}>
                  <strong>{row.points}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className={styles.legend}>
        <small>J = Jogos | V = Vitórias | E = Empates | D = Derrotas | GF = Gols Favor | GA = Gols Contra | SG = Saldo | Adj = Ajuste | Pts = Pontos</small>
      </div>

      {playoffCutoff !== undefined && (
        <div className={styles.playoffLegend}>
          <span className={styles.playoffDot} />
          <small>Top {playoffCutoff} avançam para a Fase Final</small>
        </div>
      )}
    </div>
  )
}

export default StandingsTable
