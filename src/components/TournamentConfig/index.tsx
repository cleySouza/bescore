import { useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom, showConfigModalAtom } from '../../atoms/tournamentAtoms'
import { generateMatchesByFormat } from '../../lib/matchGenerationEngine'
import { updateParticipantTeamName } from '../../lib/tournamentService'
import type { TournamentFormat, TournamentSettings } from '../../types/tournament'
import styles from './TournamentConfig.module.css'

interface LobbyParticipant {
  id: string
  team_name: string | null
  user_id: string | null
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

const FALLBACK_CLUBS = [
  'Real Madrid', 'Barcelona', 'Manchester City', 'Liverpool', 'Bayern München',
  'PSG', 'Chelsea', 'Arsenal', 'Juventus', 'AC Milan', 'Inter Milan',
  'Atlético Madrid', 'Borussia Dortmund', 'Ajax', 'Porto', 'Benfica',
  'Roma', 'Napoli', 'Tottenham', 'Manchester United',
]

interface TournamentConfigProps {
  participantCount: number
  participants: LobbyParticipant[]
  onClose: () => void
  onMatchesGenerated?: () => void
}

function TournamentConfig({ participantCount, participants, onClose, onMatchesGenerated }: TournamentConfigProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const showModal = useAtomValue(showConfigModalAtom)

  const savedSettings = tournament?.settings as TournamentSettings | null
  const initialFormat: TournamentFormat = savedSettings?.format ?? 'roundRobin'
  const [format, setFormat] = useState<TournamentFormat>(initialFormat)
  const [settings, setSettings] = useState<TournamentSettings>({
    format: initialFormat,
    hasReturnMatch: savedSettings?.hasReturnMatch ?? false,
    qualifiedCount: savedSettings?.qualifiedCount ?? 2,
    bracketGroups: savedSettings?.bracketGroups ?? 2,
    playoffCutoff: savedSettings?.playoffCutoff ?? 4,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editableNames, setEditableNames] = useState<Record<string, string>>({})
  const [randomizeFeedback, setRandomizeFeedback] = useState<string | null>(null)
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null)

  // Sincroniza nomes quando o modal abre ou os participantes mudam
  useEffect(() => {
    if (showModal) {
      setEditableNames(Object.fromEntries(participants.map((p) => [p.id, p.team_name ?? ''])))
    }
  }, [showModal, participants])

  if (!user || !tournament || !showModal) {
    return null
  }

  const isCreator = tournament.creator_id === user.id

  if (!isCreator) {
    return null
  }

  // Bloqueia configuração se o torneio não está mais em rascunho
  const isDraft = tournament.status === 'draft'

  const isManualMode = savedSettings?.teamAssignMode === 'manual'
  const teamPool = savedSettings?.selectedTeamNames ?? FALLBACK_CLUBS

  const handleRandomize = () => {
    const preSelected = savedSettings?.selectedTeamNames
    const source = preSelected && preSelected.length >= participants.length
      ? preSelected
      : FALLBACK_CLUBS
    const shuffled = [...source].sort(() => Math.random() - 0.5)
    const newNames = { ...editableNames }
    participants.forEach((p, i) => {
      newNames[p.id] = shuffled[i % source.length]
    })
    setEditableNames(newNames)
    const feedbackMsg = preSelected && preSelected.length >= participants.length
      ? `Times sorteados dos ${preSelected.length} clubes pré-selecionados ✅`
      : 'Times sorteados do pool genérico 🌍'
    setRandomizeFeedback(feedbackMsg)
    setTimeout(() => setRandomizeFeedback(null), 2500)
  }

  const allTeamsAssigned =
    participants.length > 0 &&
    participants.every((p) => (editableNames[p.id] ?? '').trim().length > 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (participantCount < 2) {
      setError('Precisa de pelo menos 2 participantes para gerar partidas')
      return
    }

    setLoading(true)

    try {
      // Salva os team_names editados antes de gerar as partidas
      await Promise.all(
        participants.map((p) => {
          const newName = (editableNames[p.id] ?? '').trim()
          if (newName !== (p.team_name ?? '').trim()) {
            return updateParticipantTeamName(p.id, newName)
          }
          return Promise.resolve()
        })
      )

      await generateMatchesByFormat(tournament.id, format, settings)
      onMatchesGenerated?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar partidas'
      setError(message)
      console.error('Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>⚙️ Montar Campeonato</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {!isDraft ? (
          // Torneio já iniciado — configurações bloqueadas
          <div className={styles.lockedContainer}>
            <div className={styles.lockedIcon}>🔒</div>
            <p className={styles.lockedTitle}>Configurações bloqueadas</p>
            <p className={styles.lockedSubtext}>
              As configurações de formato, privacidade e vagas não podem ser alteradas
              após o torneio ser iniciado.
            </p>
            <button className={styles.cancelBtn} onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.participantInfo}>
              👥 <strong>{participantCount}</strong> {participantCount === 1 ? 'participante' : 'participantes'} inscritos
            </div>

            {/* ── Lobby de Atribuição de Times ── */}
            <div className={styles.lobbySection}>
              <div className={styles.lobbyHeader}>
                <span className={styles.lobbyTitle}>🏟️ Atribuição de Times</span>
                {!isManualMode && (
                  <button
                    type="button"
                    className={styles.randomizeBtn}
                    onClick={handleRandomize}
                    disabled={loading}
                  >
                    🎲 Sortear Times
                  </button>
                )}
              </div>
              {randomizeFeedback && (
                <div className={styles.randomizeFeedback}>
                  ✅ {randomizeFeedback}
                </div>
              )}
              <div className={styles.lobbyList}>
                {participants.map((p) => (
                  <div key={p.id} className={styles.lobbyItem}>
                    {p.profile?.avatar_url ? (
                      <img src={p.profile.avatar_url} alt="" className={styles.lobbyAvatar} />
                    ) : (
                      <div className={styles.lobbyAvatarPlaceholder}>👤</div>
                    )}
                    <span className={styles.lobbyNickname}>
                      {p.profile?.nickname || p.profile?.email || 'Jogador'}
                    </span>
                    {isManualMode ? (
                      <button
                        type="button"
                        className={`${styles.lobbyTeamBtn}${editableNames[p.id] ? ` ${styles.lobbyTeamBtnFilled}` : ''}`}
                        onClick={() => setPickerOpenFor(p.id)}
                        disabled={loading}
                      >
                        {editableNames[p.id] || 'Escolher time…'}
                      </button>
                    ) : (
                      <input
                        className={styles.lobbyInput}
                        value={editableNames[p.id] ?? ''}
                        onChange={(e) =>
                          setEditableNames((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        placeholder="Nome do time..."
                        maxLength={40}
                        disabled={loading}
                      />
                    )}
                  </div>
                ))}
              </div>
              {!allTeamsAssigned && participants.length > 0 && (
                <p className={styles.lobbyWarning}>
                  ⚠️ Todos os participantes precisam ter um time definido para gerar as partidas.
                </p>
              )}
            </div>

            {/* ── Picker de Time (modo manual) ── */}
            {pickerOpenFor && (
              <div className={styles.teamPickerOverlay} onClick={() => setPickerOpenFor(null)}>
                <div className={styles.teamPickerPanel} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.teamPickerHeader}>
                    <span>🏆 Escolher Time</span>
                    <button
                      type="button"
                      className={styles.teamPickerClose}
                      onClick={() => setPickerOpenFor(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className={styles.teamPickerList}>
                    {teamPool.map((name) => {
                      const takenByOther = participants
                        .filter((p) => p.id !== pickerOpenFor)
                        .some((p) => editableNames[p.id] === name)
                      return (
                        <button
                          key={name}
                          type="button"
                          className={`${styles.teamPickerItem}${takenByOther ? ` ${styles.teamPickerItemTaken}` : ''}`}
                          disabled={takenByOther}
                          onClick={() => {
                            setEditableNames((prev) => ({ ...prev, [pickerOpenFor]: name }))
                            setPickerOpenFor(null)
                          }}
                        >
                          {name}
                          {takenByOther && <span className={styles.takenBadge}>Ocupado</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {error && <div className={styles.errorMessage}>⚠️ {error}</div>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.submitBtn} disabled={loading || !allTeamsAssigned}>
                {loading ? '⏳ Gerando campeonato...' : '✨ Gerar Partidas'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default TournamentConfig
