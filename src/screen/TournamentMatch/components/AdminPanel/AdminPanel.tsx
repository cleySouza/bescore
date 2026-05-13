import { useState } from 'react'
import { useAtom } from 'jotai'
import type { ManagedParticipant } from '../../../TournamentView/components/ManageParticipantModal'
import { activeTournamentAtom } from '../../../../atoms/tournamentAtoms'
import { mergeTournamentSettings } from '../../../../lib/tournamentService'
import { profileDisplayName } from '../../../../lib/profileService'
import { SCORE_PROPOSAL_DEFAULT_DEADLINE_MS } from '../../../../lib/scoreProposalConstants'
import type { Json } from '../../../../types/supabase'
import type { TournamentSettings } from '../../../../types/tournament'
import { isScoreValidationEnabled } from '../../../../types/tournament'
import {
  HiOutlineCog6Tooth,
  HiOutlineXMark,
} from 'react-icons/hi2'
import styles from './AdminPanel.module.css'

interface ParticipantWithProfile {
  id: string
  team_name: string | null
  profile?: {
    nickname: string | null
    name?: string | null
    avatar_url: string | null
    email: string
  } | null
}

interface AdminPanelProps {
  participants: ParticipantWithProfile[]
  onClose: () => void
  onManageParticipant: (participant: ManagedParticipant) => void
  onCancelTournament: () => void
}

function AdminPanel({ participants, onClose, onManageParticipant, onCancelTournament }: AdminPanelProps) {
  const [tournament, setActiveTournament] = useAtom(activeTournamentAtom)
  const initialSv = tournament?.settings ? isScoreValidationEnabled(tournament.settings) : false
  const [scoreValidation, setScoreValidation] = useState(initialSv)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const saveScoreValidation = async () => {
    if (!tournament) return
    setSettingsSaving(true)
    setSettingsError(null)
    try {
      const merged = await mergeTournamentSettings(tournament.id, {
        scoreValidation,
      } satisfies Partial<TournamentSettings>)
      setActiveTournament({ ...tournament, settings: merged as unknown as Json })
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSettingsSaving(false)
    }
  }

  return (
    <div className={styles.adminModalOverlay} onClick={onClose}>
      <div className={styles.adminModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.adminModalHeader}>
          <h3 className={styles.adminModalTitle}>Ajustes Administrativos</h3>
          <button
            type="button"
            className={styles.adminModalCloseBtn}
            onClick={onClose}
            aria-label="Fechar ajustes administrativos"
          >
            <HiOutlineXMark aria-hidden size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.adminPanel}>
          <h4 className={styles.adminPanelTitle}>
            <HiOutlineCog6Tooth aria-hidden size={18} strokeWidth={2} />
            Validação de placar
          </h4>
          <p className={styles.adminSettingsHint}>
            Com votação ativa, participantes com conta aprovam propostas; quem propõe conta como um voto de
            aprovação. Prazo curto ({Math.round(SCORE_PROPOSAL_DEFAULT_DEADLINE_MS / 60000)} min) definido no servidor.
          </p>
          <label className={styles.adminCheckboxRow}>
            <input
              type="checkbox"
              checked={scoreValidation}
              onChange={(e) => setScoreValidation(e.target.checked)}
              disabled={settingsSaving}
            />
            <span>Exigir votação entre participantes para confirmar placar</span>
          </label>
          {settingsError && <p className={styles.adminSettingsError}>{settingsError}</p>}
          <button
            type="button"
            className={styles.adminSaveSettingsBtn}
            disabled={settingsSaving}
            onClick={() => void saveScoreValidation()}
          >
            {settingsSaving ? 'Salvando...' : 'Salvar configuração de placar'}
          </button>

          <h4 className={styles.adminPanelTitle}>
            <HiOutlineCog6Tooth aria-hidden size={18} strokeWidth={2} />
            Gerenciar Participantes
          </h4>
          <div className={styles.adminParticipantList}>
            {participants.map((p) => (
              <div key={p.id} className={styles.adminParticipantRow}>
                <div className={styles.participantInfo}>
                  {p.profile?.avatar_url && (
                    <img src={p.profile.avatar_url} alt="" className={styles.participantAvatar} />
                  )}
                  <div>
                    <span className={styles.adminParticipantName}>
                      {p.team_name || 'Sem time definido'}
                    </span>
                    <span className={styles.adminParticipantNick}>
                      {profileDisplayName(p.profile)}
                    </span>
                  </div>
                </div>
                <button
                  className={styles.manageBtn}
                  onClick={() => onManageParticipant(p as ManagedParticipant)}
                >
                  <HiOutlineCog6Tooth aria-hidden size={14} strokeWidth={2} />
                  Gerenciar
                </button>
              </div>
            ))}
          </div>

          <div className={styles.dangerZone}>
            <h5 className={styles.dangerZoneTitle}>🚨 Zona de Perigo</h5>
            <p className={styles.dangerZoneDesc}>Ações irreversíveis que afetam todo o torneio</p>
            <button className={styles.dangerBtn} onClick={onCancelTournament}>
              Cancelar Torneio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel
