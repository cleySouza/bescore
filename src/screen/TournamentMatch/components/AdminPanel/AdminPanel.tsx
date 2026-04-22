import type { ManagedParticipant } from '../../../TournamentView/components/ManageParticipantModal'
import styles from './AdminPanel.module.css'

interface ParticipantWithProfile {
  id: string
  team_name: string | null
  profile?: {
    nickname: string | null
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
            ✕
          </button>
        </div>
        
        <div className={styles.adminPanel}>
          <h4 className={styles.adminPanelTitle}>⚙️ Gerenciar Participantes</h4>
          <div className={styles.adminParticipantList}>
            {participants.map((p) => (
              <div key={p.id} className={styles.adminParticipantRow}>
                <div className={styles.participantInfo}>
                  {p.profile?.avatar_url && (
                    <img 
                      src={p.profile.avatar_url} 
                      alt="" 
                      className={styles.participantAvatar}
                    />
                  )}
                  <div>
                    <span className={styles.adminParticipantName}>
                      {p.team_name || 'Sem time definido'}
                    </span>
                    <span className={styles.adminParticipantNick}>
                      {p.profile?.nickname || 'Sem nickname'}
                    </span>
                  </div>
                </div>
                <button
                  className={styles.manageBtn}
                  onClick={() => onManageParticipant(p as ManagedParticipant)}
                >
                  ⚙️ Gerenciar
                </button>
              </div>
            ))}
          </div>
          
          <div className={styles.dangerZone}>
            <h5 className={styles.dangerZoneTitle}>🚨 Zona de Perigo</h5>
            <p className={styles.dangerZoneDesc}>
              Ações irreversíveis que afetam todo o torneio
            </p>
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