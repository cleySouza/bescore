import { useEffect, useMemo, useState } from 'react'
import { updateParticipantAdmin } from '../../../lib/matchService'
import { profileDisplayName } from '../../../lib/profileService'
import {
  CatalogTeamPickField,
  type CatalogClubPick,
} from '../../../components/CatalogTeamPickField/CatalogTeamPickField'
import styles from './ManageParticipantModal.module.css'
import {
  HiOutlineCog6Tooth,
  HiOutlineShieldCheck,
  HiOutlineXMark,
} from 'react-icons/hi2'

export interface ManagedParticipant {
  id: string
  user_id?: string | null
  team_name: string | null
  penalty_points?: number | null
  penalty_reason?: string | null
  profile?: {
    nickname: string | null
    name?: string | null
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
  /** Times já usados por outros participantes — exclusão na escolha do catálogo (modo livre). */
  excludeCatalogTeamNames?: string[]
  /** Organizador pode remover inscrição (ex.: torneio em rascunho). */
  allowRemoveParticipant?: boolean
  onRemoveParticipant?: () => Promise<void>
}

function ManageParticipantModal({
  participant,
  onClose,
  onSaved,
  showScoreAdjustments = true,
  teamOptions = [],
  canEditTeamAssignment = true,
  excludeCatalogTeamNames,
  allowRemoveParticipant = false,
  onRemoveParticipant,
}: ManageParticipantModalProps) {
  const presetTeamNames = teamOptions ?? []
  const [teamName, setTeamName] = useState(participant.team_name ?? '')
  const [catalogClub, setCatalogClub] = useState<CatalogClubPick | null>(null)
  const [penaltyPoints, setPenaltyPoints] = useState<number>(participant.penalty_points ?? 0)
  const [penaltyReason, setPenaltyReason] = useState(participant.penalty_reason ?? '')
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName = profileDisplayName(participant.profile)

  useEffect(() => {
    setTeamName(participant.team_name ?? '')
    setCatalogClub(null)
  }, [participant.id, participant.team_name])

  const normalizedTeamOptions = useMemo(() => {
    const clean = presetTeamNames
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    const unique = Array.from(new Set(clean))
    const current = teamName.trim()
    if (current && !unique.includes(current)) {
      unique.unshift(current)
    }

    return unique
  }, [presetTeamNames, teamName])

  const catalogPickMode =
    canEditTeamAssignment && presetTeamNames.length === 0

  const hasEditableFields = canEditTeamAssignment || showScoreAdjustments

  const catalogTakenTeams = excludeCatalogTeamNames ??
    ([] as string[])

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
        let resolvedTeam = ''
        if (catalogPickMode) {
          resolvedTeam =
            catalogClub?.name.trim() ||
            teamName.trim() ||
            (participant.team_name ?? '').trim() ||
            ''
          if (!resolvedTeam) {
            setError('Escolha um time no catálogo')
            return
          }
        } else {
          resolvedTeam = teamName.trim()
        }
        updates.team_name = resolvedTeam ? resolvedTeam : undefined
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

  const handleRemoveParticipant = async () => {
    if (!onRemoveParticipant) return
    if (
      !window.confirm(
        'Remover este jogador do torneio? Ele deixa de constar como participante (inscrição cancelada).'
      )
    ) {
      return
    }
    setRemoving(true)
    setError(null)
    try {
      await onRemoveParticipant()
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover')
    } finally {
      setRemoving(false)
    }
  }

  const busy = loading || removing

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerIcon} aria-hidden>
              <HiOutlineCog6Tooth size={22} strokeWidth={2} />
            </span>
            <div>
              <h3 className={styles.title}>Gerenciar Participante</h3>
              <span className={styles.subtitle}>{displayName}</span>
              {!showScoreAdjustments && (
                <span className={styles.subtitle}>Modo rascunho: apenas troca de time</span>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <HiOutlineXMark aria-hidden size={22} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Troca de Time */}
          <div className={styles.group}>
            <label className={styles.label} htmlFor="teamName">
              <span className={styles.labelWithIcon}>
                <HiOutlineShieldCheck aria-hidden size={18} strokeWidth={2} />
                Nome do Time
              </span>
            </label>
            {canEditTeamAssignment ? (
              catalogPickMode ? (
                <CatalogTeamPickField
                  value={catalogClub}
                  onChange={(c) => {
                    setCatalogClub(c)
                    if (c?.name) setTeamName(c.name)
                  }}
                  takenTeamNames={catalogTakenTeams}
                  disabled={busy}
                  pendingNameFallback={catalogClub ? null : teamName.trim() || participant.team_name}
                  triggerClassName={styles.input}
                  placeholder="Escolher clube no catálogo…"
                />
              ) : (
                <select
                  id="teamName"
                  className={styles.input}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Selecionar time...</option>
                  {normalizedTeamOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )
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
                  disabled={busy}
                >
                  −
                </button>
                <input
                  id="penaltyPoints"
                  type="number"
                  className={styles.penaltyInput}
                  value={penaltyPoints}
                  onChange={(e) => setPenaltyPoints(Number(e.target.value))}
                  disabled={busy}
                />
                <button
                  type="button"
                  className={styles.penaltyStep}
                  onClick={() => setPenaltyPoints((v) => v + 1)}
                  disabled={busy}
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
                disabled={busy}
              />
            </div>
          )}

          {error && <div className={styles.error}>⚠️ {error}</div>}

          {allowRemoveParticipant && onRemoveParticipant && (
            <div className={styles.removeSection}>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => void handleRemoveParticipant()}
                disabled={busy}
              >
                {removing ? 'Removendo…' : 'Remover inscrição deste jogador'}
              </button>
              <p className={styles.removeHint}>
                Apenas enquanto o torneio está em rascunho; use para cancelar a participação de quem entrou por engano.
              </p>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={busy}
            >
              {hasEditableFields ? 'Cancelar' : 'Fechar'}
            </button>
            {hasEditableFields && (
              <button type="submit" className={styles.saveBtn} disabled={busy}>
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
