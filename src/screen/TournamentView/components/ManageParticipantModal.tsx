import { useState } from 'react'
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
}

function ManageParticipantModal({ participant, onClose, onSaved }: ManageParticipantModalProps) {
  const [teamName, setTeamName] = useState(participant.team_name ?? '')
  const [penaltyPoints, setPenaltyPoints] = useState<number>(participant.penalty_points ?? 0)
  const [penaltyReason, setPenaltyReason] = useState(participant.penalty_reason ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName =
    participant.profile?.nickname || participant.profile?.email || 'Participante'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await updateParticipantAdmin(participant.id, {
        team_name: teamName.trim() || undefined,
        penalty_points: penaltyPoints,
        penalty_reason: penaltyReason.trim() || null,
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
            <input
              id="teamName"
              type="text"
              className={styles.input}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Nome do clube"
              maxLength={60}
              disabled={loading}
            />
          </div>

          {/* Ajuste de Pontos */}
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

          {/* Motivo / Tooltip */}
          {penaltyPoints !== 0 && (
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
              Cancelar
            </button>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? 'Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ManageParticipantModal
