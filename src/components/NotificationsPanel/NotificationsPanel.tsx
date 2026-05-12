import type { ProposalNotificationRow } from '../../lib/scoreProposalService'
import styles from './NotificationsPanel.module.css'

function formatProposalScore(row: ProposalNotificationRow): string {
  let base = `${row.home_score}–${row.away_score}`
  if (row.home_penalties != null && row.away_penalties != null) {
    base += ` (${row.home_penalties}–${row.away_penalties} pen.)`
  }
  return base
}

function formatExpires(expiresAt: string): string {
  try {
    const d = new Date(expiresAt)
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

interface NotificationsPanelProps {
  proposals: ProposalNotificationRow[]
  onBack: () => void
  onOpenProposal: (tournamentId: string, matchId: string) => void
}

export function NotificationsPanel({ proposals, onBack, onOpenProposal }: NotificationsPanelProps) {
  return (
    <div className={styles.root}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        ← Voltar
      </button>

      {proposals.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhuma proposta pendente</p>
          <p className={styles.emptyHint}>Quando alguém sugerir um placar num torneio seu, aparece aqui.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {proposals.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={styles.rowBtn}
                onClick={() => onOpenProposal(row.tournament_id, row.match_id)}
              >
                <span className={styles.rowTitle}>{row.tournaments?.name ?? 'Torneio'}</span>
                <span className={styles.rowScore}>Placar sugerido: {formatProposalScore(row)}</span>
                <span className={styles.rowMeta}>Expira {formatExpires(row.expires_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
