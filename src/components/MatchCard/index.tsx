import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom, globalToastAtom } from '../../atoms/tournamentAtoms'
import { updateMatchResult } from '../../lib/matchService'
import type { MatchWithTeams } from '../../types/tournament'
import styles from './MatchCard.module.css'

interface MatchCardProps {
  match: MatchWithTeams
  onResultUpdated?: () => void
}

function MatchCard({ match, onResultUpdated }: MatchCardProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const setGlobalToast = useSetAtom(globalToastAtom)

  const [homeScore, setHomeScore] = useState<number>(match.home_score ?? 0)
  const [awayScore, setAwayScore] = useState<number>(match.away_score ?? 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!tournament) return null

  const isCreator = tournament.creator_id === user?.id
  const isFinished = match.status === 'finished'
  const canEdit = isCreator && !isFinished

  const homeTeamName = match.homeTeam?.team_name || 'TBD'
  const awayTeamName = match.awayTeam?.team_name || 'TBD'
  const homeNickname = match.homeTeam?.profile?.nickname || 'Equipe A'
  const awayNickname = match.awayTeam?.profile?.nickname || 'Equipe B'

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)

    try {
      await updateMatchResult(match.id, homeScore, awayScore)
      setGlobalToast({
        type: 'success',
        message: 'Resultado salvo com sucesso.',
      })
      onResultUpdated?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao confirmar resultado'
      setError(message)
      setGlobalToast({
        type: 'error',
        message,
      })
      console.error('Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleIncrement = (team: 'home' | 'away') => {
    if (team === 'home') {
      setHomeScore((prev) => prev + 1)
    } else {
      setAwayScore((prev) => prev + 1)
    }
  }

  const handleDecrement = (team: 'home' | 'away') => {
    if (team === 'home') {
      setHomeScore((prev) => Math.max(0, prev - 1))
    } else {
      setAwayScore((prev) => Math.max(0, prev - 1))
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.round}>Rodada {match.round}</span>
        <span className={`${styles.status} ${styles[`status--${match.status}`]}`}>
          {isFinished ? '✅ Encerrado' : '⏳ Pendente'}
        </span>
      </div>

      <div className={styles.matchup}>
        {/* Home Team */}
        <div className={styles.team}>
          <div className={styles.teamHeader}>
            {match.homeTeam?.profile?.avatar_url ? (
              <img
                src={match.homeTeam.profile.avatar_url}
                alt={homeNickname}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>👤</div>
            )}
            <div className={styles.teamName}>
              <strong>{homeTeamName}</strong>
              <small>{homeNickname}</small>
            </div>
          </div>

          {canEdit ? (
            <div className={styles.scoreInput}>
              <button
                className={styles.scoreBtn}
                onClick={() => handleDecrement('home')}
                disabled={homeScore === 0}
                aria-label="Diminuir gols"
              >
                −
              </button>
              <input
                type="number"
                value={homeScore}
                onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
                className={styles.scorefield}
                min="0"
                disabled={loading}
              />
              <button
                className={styles.scoreBtn}
                onClick={() => handleIncrement('home')}
                disabled={loading}
                aria-label="Aumentar gols"
              >
                +
              </button>
            </div>
          ) : (
            <div className={styles.scoreDisplay}>{homeScore}</div>
          )}
        </div>

        {/* VS */}
        <div className={styles.separator}>vs</div>

        {/* Away Team */}
        <div className={styles.team}>
          <div className={styles.teamHeader}>
            {match.awayTeam?.profile?.avatar_url ? (
              <img
                src={match.awayTeam.profile.avatar_url}
                alt={awayNickname}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>👤</div>
            )}
            <div className={styles.teamName}>
              <strong>{awayTeamName}</strong>
              <small>{awayNickname}</small>
            </div>
          </div>

          {canEdit ? (
            <div className={styles.scoreInput}>
              <button
                className={styles.scoreBtn}
                onClick={() => handleDecrement('away')}
                disabled={awayScore === 0}
                aria-label="Diminuir gols"
              >
                −
              </button>
              <input
                type="number"
                value={awayScore}
                onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
                className={styles.scorefield}
                min="0"
                disabled={loading}
              />
              <button
                className={styles.scoreBtn}
                onClick={() => handleIncrement('away')}
                disabled={loading}
                aria-label="Aumentar gols"
              >
                +
              </button>
            </div>
          ) : (
            <div className={styles.scoreDisplay}>{awayScore}</div>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {canEdit && (
        <button
          className={styles.confirmBtn}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? '⏳ Confirmando...' : '✓ Confirmar Resultado'}
        </button>
      )}
    </div>
  )
}

export default MatchCard
