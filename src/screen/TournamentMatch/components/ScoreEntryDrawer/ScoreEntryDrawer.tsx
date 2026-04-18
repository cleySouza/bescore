import { useEffect, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../../../atoms/sessionAtom'
import { activeTournamentAtom, globalToastAtom, selectedMatchAtom } from '../../../../atoms/tournamentAtoms'
import { updateMatchResult } from '../../../../lib/matchService'
import ScoreEntryTeamCrest from '../ScoreEntryTeamCrest/ScoreEntryTeamCrest'
import './scoreEntry.css'

interface ScoreEntryDrawerProps {
  onResultSaved?: () => void
}

function getDisplayName(
  nickname: string | null | undefined,
  email: string | null | undefined,
  profileId: string | null | undefined,
  currentUserId: string | undefined,
  currentUserName: string
) {
  if (typeof nickname === 'string' && nickname.trim()) {
    return nickname
  }

  if (typeof email === 'string' && email.trim()) {
    return email.split('@')[0]
  }

  if (profileId && currentUserId && profileId === currentUserId) {
    return currentUserName
  }

  return 'Responsavel'
}

function ScoreEntryDrawer({ onResultSaved }: ScoreEntryDrawerProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const [selectedMatch, setSelectedMatch] = useAtom(selectedMatchAtom)
  const setGlobalToast = useSetAtom(globalToastAtom)

  const [homeScore, setHomeScore] = useState<number | null>(null)
  const [awayScore, setAwayScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedMatch) return
    setHomeScore(selectedMatch.home_score)
    setAwayScore(selectedMatch.away_score)
    setError(null)
  }, [selectedMatch])

  if (!selectedMatch || !tournament) return null

  const isCreator = tournament.creator_id === user?.id
  const isFinished = selectedMatch.status === 'finished'
  const canEdit = isCreator && !isFinished
  const canConfirm = canEdit && homeScore !== null && awayScore !== null

  const homeTeamName = selectedMatch.homeTeam?.team_name || 'TBD'
  const awayTeamName = selectedMatch.awayTeam?.team_name || 'TBD'
  const currentUserName =
    (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim())
      ? user.user_metadata.name
      : user?.email?.split('@')[0] ?? 'Usuario'
  const homeNickname = getDisplayName(
    selectedMatch.homeTeam?.profile?.nickname,
    selectedMatch.homeTeam?.profile?.email,
    selectedMatch.homeTeam?.profile?.id,
    user?.id,
    currentUserName
  )
  const awayNickname = getDisplayName(
    selectedMatch.awayTeam?.profile?.nickname,
    selectedMatch.awayTeam?.profile?.email,
    selectedMatch.awayTeam?.profile?.id,
    user?.id,
    currentUserName
  )
  const tournamentSettings = tournament.settings as { selectedTeamShields?: Record<string, string> } | null
  const shieldsMap = tournamentSettings?.selectedTeamShields ?? {}

  const closeDrawer = () => {
    if (loading) return
    setSelectedMatch(null)
  }

  const increment = (side: 'home' | 'away') => {
    if (!canEdit || loading) return
    if (side === 'home') setHomeScore((prev) => (prev === null ? 1 : prev + 1))
    else setAwayScore((prev) => (prev === null ? 1 : prev + 1))
  }

  const decrement = (side: 'home' | 'away') => {
    if (!canEdit || loading) return
    if (side === 'home') setHomeScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
    else setAwayScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
  }

  const handleInputChange = (side: 'home' | 'away', rawValue: string) => {
    if (!canEdit || loading) return

    if (rawValue === '') {
      if (side === 'home') setHomeScore(null)
      else setAwayScore(null)
      return
    }

    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return

    const normalized = Math.max(0, Math.floor(parsed))
    if (side === 'home') setHomeScore(normalized)
    else setAwayScore(normalized)
  }

  const handleConfirm = async () => {
    if (!canConfirm || loading) {
      if (canEdit && (homeScore === null || awayScore === null)) {
        const message = 'Preencha o placar dos dois times antes de confirmar.'
        setError(message)
        setGlobalToast({
          type: 'warning',
          message,
        })
      }
      return
    }
    setError(null)
    setLoading(true)
    try {
      await updateMatchResult(selectedMatch.id, homeScore, awayScore)
      setGlobalToast({
        type: 'success',
        message: 'Resultado salvo com sucesso.',
      })
      onResultSaved?.()
      setSelectedMatch(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar resultado'
      setError(message)
      setGlobalToast({
        type: 'error',
        message,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedMatch || !canEdit) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) return
      if (loading) return

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHomeScore((prev) => (prev === null ? 1 : prev + 1))
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHomeScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setAwayScore((prev) => (prev === null ? 1 : prev + 1))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setAwayScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (canConfirm) void handleConfirm()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedMatch, canEdit, loading, homeScore, awayScore])

  return (
    <div className="score-entry-overlay" onClick={closeDrawer} role="presentation">
      <aside
        className="score-entry-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Inserir placar da partida"
      >
        <div className="score-entry-handle" aria-hidden />

        <header className="score-entry-header">
          <div>
            <p className="score-entry-round">Rodada {selectedMatch.round}</p>
            <h3 className="score-entry-title">Inserir placar</h3>
          </div>
          <button type="button" className="score-entry-close" onClick={closeDrawer} aria-label="Fechar painel">
            ×
          </button>
        </header>

        <section className="score-entry-grid">
          <article className="score-entry-team">
            <div className="score-entry-team-head">
              <ScoreEntryTeamCrest teamName={homeTeamName} shieldsMap={shieldsMap} />
              <div className="score-entry-team-meta">
                <span className="score-entry-team-name">{homeTeamName}</span>
                <span className="score-entry-team-user">{homeNickname}</span>
              </div>
            </div>
            <div className="score-entry-stepper">
              <button type="button" onClick={() => decrement('home')} disabled={!canEdit || loading}>
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={homeScore ?? ''}
                onChange={(event) => handleInputChange('home', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
                    event.preventDefault()
                  }
                }}
                className="score-entry-input"
                placeholder="-"
                disabled={!canEdit || loading}
                aria-label="Placar mandante"
              />
              <button type="button" onClick={() => increment('home')} disabled={!canEdit || loading}>
                +
              </button>
            </div>
          </article>

          <span className="score-entry-separator">x</span>

          <article className="score-entry-team">
            <div className="score-entry-team-head">
              <ScoreEntryTeamCrest teamName={awayTeamName} shieldsMap={shieldsMap} />
              <div className="score-entry-team-meta">
                <span className="score-entry-team-name">{awayTeamName}</span>
                <span className="score-entry-team-user">{awayNickname}</span>
              </div>
            </div>
            <div className="score-entry-stepper">
              <button type="button" onClick={() => decrement('away')} disabled={!canEdit || loading}>
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={awayScore ?? ''}
                onChange={(event) => handleInputChange('away', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
                    event.preventDefault()
                  }
                }}
                className="score-entry-input"
                placeholder="-"
                disabled={!canEdit || loading}
                aria-label="Placar visitante"
              />
              <button type="button" onClick={() => increment('away')} disabled={!canEdit || loading}>
                +
              </button>
            </div>
          </article>
        </section>

        {!canEdit && (
          <p className="score-entry-note">
            Apenas o criador pode registrar o resultado de partidas pendentes.
          </p>
        )}

        {canEdit && (
          <p className="score-entry-shortcuts">
            Atalhos: ↑/↓ mandante, ←/→ visitante, Enter para salvar
          </p>
        )}

        {error && <p className="score-entry-error">{error}</p>}

        <footer className="score-entry-footer">
          <button type="button" className="score-entry-cancel" onClick={closeDrawer} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="score-entry-confirm" onClick={handleConfirm} disabled={!canConfirm || loading}>
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

export default ScoreEntryDrawer