import { useMemo, useState } from 'react'
import { updateParticipantAdmin } from '../../../lib/matchService'
import styles from './ManageParticipantModal.module.css'

export interface ManagedParticipant {
  id: string
  team_name: string | null
  penalty_points?: number | null
  penalty_reason?: string | null
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

interface ManageParticipantModalProps {
  participant: ManagedParticipant
  onClose: () => void
  onSaved: () => void
  showScoreAdjustments?: boolean
  teamOptions?: string[]
  canEditTeamAssignment?: boolean
}

function ManageParticipantModal({
  participant,
  onClose,
  onSaved,
  showScoreAdjustments = true,
  teamOptions = [],
  canEditTeamAssignment = true,
}: ManageParticipantModalProps) {
  const [teamName, setTeamName] = useState(participant.team_name ?? '')
  const [penaltyPoints, setPenaltyPoints] = useState<number>(participant.penalty_points ?? 0)
  const [penaltyReason, setPenaltyReason] = useState(participant.penalty_reason ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName =
    participant.profile?.nickname || participant.profile?.email || 'Participante'

  const normalizedTeamOptions = useMemo(() => {
    const clean = teamOptions
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    const unique = Array.from(new Set(clean))
    const current = teamName.trim()
    if (current && !unique.includes(current)) {
      unique.unshift(current)
    }

    return unique
  }, [teamOptions, teamName])

  const hasEditableFields = canEditTeamAssignment || showScoreAdjustments

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const updates: {
        team_name?: string
        penalty_points?: number
        penalty_reason?: string | null
      } = {
      }

      if (canEditTeamAssignment) {
        updates.team_name = teamName.trim() || undefined
      }

      if (showScoreAdjustments) {
        updates.penalty_points = penaltyPoints
        updates.penalty_reason = penaltyReason.trim() || null
      }

      await updateParticipantAdmin(participant.id, {
        ...updates,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerIcon}>⚙️</span>
            <div>
              <h3 className={styles.title}>Gerenciar Participante</h3>
              <span className={styles.subtitle}>{displayName}</span>
              {!showScoreAdjustments && (
                <span className={styles.subtitle}>Modo rascunho: apenas troca de time</span>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Troca de Time */}
          <div className={styles.group}>
            <label className={styles.label} htmlFor="teamName">
              🛡️ Nome do Time
            </label>
            {canEditTeamAssignment ? (
              <select
                id="teamName"
                className={styles.input}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={loading}
              >
                <option value="">Selecionar time...</option>
                {normalizedTeamOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="teamName"
                className={styles.input}
                value={teamName || 'Definido somente no sorteio automatico'}
                disabled
                readOnly
              />
            )}
          </div>

          {showScoreAdjustments && (
            <div className={styles.group}>
              <label className={styles.label} htmlFor="penaltyPoints">
                ⚖️ Ajuste de Pontos
                <span className={styles.labelHint}>(negativo = punição, positivo = bônus)</span>
              </label>
              <div className={styles.penaltyRow}>
                <button
                  type="button"
                  className={styles.penaltyStep}
                  onClick={() => setPenaltyPoints((v) => v - 1)}
                  disabled={loading}
                >
                  −
                </button>
                <input
                  id="penaltyPoints"
                  type="number"
                  className={styles.penaltyInput}
                  value={penaltyPoints}
                  onChange={(e) => setPenaltyPoints(Number(e.target.value))}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.penaltyStep}
                  onClick={() => setPenaltyPoints((v) => v + 1)}
                  disabled={loading}
                >
                  +
                </button>
              </div>
              {penaltyPoints !== 0 && (
                <span className={penaltyPoints < 0 ? styles.penaltyNegativeHint : styles.penaltyPositiveHint}>
                  {penaltyPoints < 0
                    ? `${penaltyPoints} pts (punição)`
                    : `+${penaltyPoints} pts (bônus)`}
                </span>
              )}
            </div>
          )}

          {/* Motivo / Tooltip */}
          {showScoreAdjustments && penaltyPoints !== 0 && (
            <div className={styles.group}>
              <label className={styles.label} htmlFor="penaltyReason">
                📝 Motivo <span className={styles.labelHint}>(exibido como tooltip na tabela)</span>
              </label>
              <input
                id="penaltyReason"
                type="text"
                className={styles.input}
                value={penaltyReason}
                onChange={(e) => setPenaltyReason(e.target.value)}
                placeholder="Ex: Escalação irregular na rodada 3"
                maxLength={120}
                disabled={loading}
              />
            </div>
          )}

          {error && <div className={styles.error}>⚠️ {error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              {hasEditableFields ? 'Cancelar' : 'Fechar'}
            </button>
            {hasEditableFields && (
              <button type="submit" className={styles.saveBtn} disabled={loading}>
                {loading ? 'Salvando...' : showScoreAdjustments ? '💾 Salvar' : '💾 Salvar time'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default ManageParticipantModal
