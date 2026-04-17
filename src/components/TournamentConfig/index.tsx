import { useState, useEffect, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom, globalToastAtom, showConfigModalAtom } from '../../atoms/tournamentAtoms'
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

function getTeamInitials(name: string) {
  return name
    .split(/[\s\-_&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TM'
}

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
  const setGlobalToast = useSetAtom(globalToastAtom)

  const savedSettings = tournament?.settings as TournamentSettings | null
  const isAutoAssignment = (savedSettings?.teamAssignMode ?? 'auto') === 'auto'
  const initialFormat: TournamentFormat = savedSettings?.format ?? 'roundRobin'
  const [format] = useState<TournamentFormat>(initialFormat)
  const [settings] = useState<TournamentSettings>({
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
  const [participantQuery, setParticipantQuery] = useState('')
  const [teamPickerQuery, setTeamPickerQuery] = useState('')
  const wasModalOpenRef = useRef(false)

  // Inicializa nomes somente ao ABRIR o modal (evita reset apos sortear no modo AUTO)
  useEffect(() => {
    const modalJustOpened = showModal && !wasModalOpenRef.current

    if (modalJustOpened) {
      const hasLocalAssignments = Object.values(editableNames).some(
        (name) => (name ?? '').trim().length > 0
      )

      if (!hasLocalAssignments) {
        setEditableNames(
          Object.fromEntries(
            participants.map((p) => [p.id, isAutoAssignment ? '' : (p.team_name ?? '')])
          )
        )
      }

      setParticipantQuery('')
      setTeamPickerQuery('')
      setPickerOpenFor(null)
      setRandomizeFeedback(null)
    }

    wasModalOpenRef.current = showModal
  }, [showModal, participants, isAutoAssignment, editableNames])

  if (!user || !tournament || !showModal) {
    return null
  }

  const isCreator = tournament.creator_id === user.id

  if (!isCreator) {
    return null
  }

  // Bloqueia configuração se o torneio não está mais em rascunho
  const isDraft = tournament.status === 'draft'

  const selectedTeamNames = Array.isArray(savedSettings?.selectedTeamNames)
    ? savedSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []

  const teamPool = selectedTeamNames.length > 0 ? selectedTeamNames : FALLBACK_CLUBS
  const teamShields =
    typeof savedSettings?.selectedTeamShields === 'object' && savedSettings?.selectedTeamShields
      ? (savedSettings.selectedTeamShields as Record<string, string>)
      : {}

  const closeTeamPicker = () => {
    setPickerOpenFor(null)
    setTeamPickerQuery('')
  }

  const handleRandomize = () => {
    const preSelected = selectedTeamNames
    const source = preSelected.length >= participants.length
      ? preSelected
      : FALLBACK_CLUBS
    const shuffled = [...source].sort(() => Math.random() - 0.5)
    const newNames = { ...editableNames }
    participants.forEach((p, i) => {
      newNames[p.id] = shuffled[i % source.length]
    })
    setEditableNames(newNames)
    const feedbackMsg = preSelected.length >= participants.length
      ? `Times sorteados dos ${preSelected.length} clubes pré-selecionados ✅`
      : 'Times sorteados do pool genérico 🌍'
    setRandomizeFeedback(null)
    setGlobalToast({ message: `✅ ${feedbackMsg}`, type: 'success' })
  }

  const handleClearTeams = () => {
    if (!window.confirm('Remover todos os times atribuídos antes do sorteio?')) return
    const cleared = { ...editableNames }
    participants.forEach((p) => {
      cleared[p.id] = ''
    })
    setEditableNames(cleared)
    setRandomizeFeedback('Times limpos. Você pode redefinir e sortear novamente.')
    setTimeout(() => setRandomizeFeedback(null), 2500)
  }

  const allTeamsAssigned =
    participants.length > 0 &&
    participants.every((p) => (editableNames[p.id] ?? '').trim().length > 0)

  const assignedCount = participants.filter((p) => (editableNames[p.id] ?? '').trim().length > 0).length
  const pendingCount = Math.max(0, participants.length - assignedCount)
  const progressPercent = participants.length > 0
    ? Math.round((assignedCount / participants.length) * 100)
    : 0

  const participantQueryNormalized = participantQuery.trim().toLowerCase()
  const filteredParticipants = participantQueryNormalized
    ? participants.filter((p) => {
        const nickname = (p.profile?.nickname ?? '').toLowerCase()
        const email = (p.profile?.email ?? '').toLowerCase()
        const team = (editableNames[p.id] ?? '').toLowerCase()
        return (
          nickname.includes(participantQueryNormalized) ||
          email.includes(participantQueryNormalized) ||
          team.includes(participantQueryNormalized)
        )
      })
    : participants

  const pickerOpenName = pickerOpenFor
    ? (participants.find((p) => p.id === pickerOpenFor)?.profile?.nickname ?? 'Jogador')
    : ''

  const teamPickerQueryNormalized = teamPickerQuery.trim().toLowerCase()
  const filteredTeamPool = teamPickerQueryNormalized
    ? teamPool.filter((name) => name.toLowerCase().includes(teamPickerQueryNormalized))
    : teamPool

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
                <div className={styles.lobbyActions}>
                  {isAutoAssignment && (
                    <button
                      type="button"
                      className={styles.randomizeBtn}
                      onClick={handleRandomize}
                      disabled={loading || participants.length === 0}
                    >
                      🎲 Sortear Times
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={handleClearTeams}
                    disabled={loading || assignedCount === 0}
                  >
                    🧹 Limpar
                  </button>
                </div>
              </div>

              <div className={styles.modeHint}>
                {isAutoAssignment
                  ? 'Modo AUTO: times so podem ser definidos pelo sorteio automatico.'
                  : 'Modo MANUAL: o criador escolhe individualmente o time de cada participante.'}
              </div>

              <div className={styles.lobbyProgressCard}>
                <div className={styles.lobbyProgressTop}>
                  <span>{assignedCount}/{participants.length} com time</span>
                  <span>{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</span>
                </div>
                <div className={styles.lobbyProgressBar}>
                  <span className={styles.lobbyProgressFill} style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className={styles.lobbySearchWrap}>
                <input
                  type="text"
                  className={styles.lobbySearchInput}
                  value={participantQuery}
                  onChange={(e) => setParticipantQuery(e.target.value)}
                  placeholder="Buscar jogador ou time..."
                  disabled={loading || participants.length === 0}
                />
              </div>

              {randomizeFeedback && (
                <div className={styles.randomizeFeedback}>
                  ✅ {randomizeFeedback}
                </div>
              )}
              <div className={styles.lobbyList}>
                {filteredParticipants.map((p) => (
                  <div key={p.id} className={styles.lobbyItem}>
                    {p.profile?.avatar_url ? (
                      <img src={p.profile.avatar_url} alt="" className={styles.lobbyAvatar} />
                    ) : (
                      <div className={styles.lobbyAvatarPlaceholder}>👤</div>
                    )}
                    <span className={styles.lobbyNickname}>
                      {p.profile?.nickname || p.profile?.email || 'Jogador'}
                    </span>
                    <button
                      type="button"
                      className={`${styles.lobbyTeamBtn}${editableNames[p.id] ? ` ${styles.lobbyTeamBtnFilled}` : ''}`}
                      onClick={() => {
                        if (isAutoAssignment) return
                        setPickerOpenFor(p.id)
                      }}
                      disabled={loading || isAutoAssignment}
                    >
                      {editableNames[p.id] ? (
                        <span className={styles.teamChoiceLine}>
                          <span className={styles.teamChoiceCrest}>
                            {teamShields[editableNames[p.id]] ? (
                              <img
                                src={teamShields[editableNames[p.id]]}
                                alt={editableNames[p.id]}
                                className={styles.teamChoiceCrestImg}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : (
                              getTeamInitials(editableNames[p.id])
                            )}
                          </span>
                          <span className={styles.teamChoiceText}>{editableNames[p.id]}</span>
                        </span>
                      ) : (
                        isAutoAssignment ? 'Aguardando sorteio...' : 'Escolher time...'
                      )}
                    </button>
                  </div>
                ))}

                {filteredParticipants.length === 0 && (
                  <div className={styles.lobbyEmptyFilter}>
                    Nenhum participante encontrado para "{participantQuery}".
                  </div>
                )}
              </div>
              {!allTeamsAssigned && participants.length > 0 && (
                <p className={styles.lobbyWarning}>
                  ⚠️ Todos os participantes precisam ter um time definido para gerar as partidas.
                </p>
              )}
            </div>

            {/* ── Picker de Time (substituir time) ── */}
            {!isAutoAssignment && pickerOpenFor && (
              <div className={styles.teamPickerOverlay} onClick={closeTeamPicker}>
                <div className={styles.teamPickerPanel} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.teamPickerHeader}>
                    <span>🏆 Escolher Time - {pickerOpenName}</span>
                    <button
                      type="button"
                      className={styles.teamPickerClose}
                      onClick={closeTeamPicker}
                    >
                      ✕
                    </button>
                  </div>
                  <div className={styles.teamPickerSearchWrap}>
                    <input
                      type="text"
                      className={styles.teamPickerSearchInput}
                      value={teamPickerQuery}
                      onChange={(e) => setTeamPickerQuery(e.target.value)}
                      placeholder="Buscar time..."
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.teamPickerClearBtn}
                      onClick={() => {
                        if (!pickerOpenFor) return
                        setEditableNames((prev) => ({ ...prev, [pickerOpenFor]: '' }))
                        closeTeamPicker()
                      }}
                    >
                      Limpar seleção
                    </button>
                  </div>
                  <div className={styles.teamPickerList}>
                    {filteredTeamPool.map((name) => {
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
                            if (!pickerOpenFor) return
                            setEditableNames((prev) => ({ ...prev, [pickerOpenFor]: name }))
                            closeTeamPicker()
                          }}
                        >
                          <span className={styles.teamPickerChoiceLine}>
                            <span className={styles.teamChoiceCrest}>
                              {teamShields[name] ? (
                                <img
                                  src={teamShields[name]}
                                  alt={name}
                                  className={styles.teamChoiceCrestImg}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              ) : (
                                getTeamInitials(name)
                              )}
                            </span>
                            <span className={styles.teamChoiceText}>{name}</span>
                          </span>
                          {takenByOther && <span className={styles.takenBadge}>Ocupado</span>}
                        </button>
                      )
                    })}

                    {filteredTeamPool.length === 0 && (
                      <div className={styles.teamPickerEmpty}>Nenhum time encontrado.</div>
                    )}
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
