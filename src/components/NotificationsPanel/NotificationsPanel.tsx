import type { MatchScoreProposalStatus, ProposalNotificationRow } from '../../lib/scoreProposalService'
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

function formatClosedAt(updatedAt: string): string {
  try {
    const d = new Date(updatedAt)
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

function statusLabel(status: MatchScoreProposalStatus): string {
  switch (status) {
    case 'approved':
      return 'Votação encerrada — placar aprovado'
    case 'rejected':
      return 'Votação encerrada — placar recusado'
    case 'expired':
      return 'Votação encerrada — prazo expirado'
    default:
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
          <p className={styles.emptyTitle}>Nenhuma notificação</p>
          <p className={styles.emptyHint}>
            Propostas de placar pendentes aparecem aqui. As últimas votações encerradas ficam visíveis por alguns dias.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {proposals.map((row) => {
            const isPending = row.status === 'pending'
            const metaPending = isPending ? `Expira ${formatExpires(row.expires_at)}` : null
            const metaClosed = !isPending ? `Encerrada ${formatClosedAt(row.updated_at)}` : null

            return (
              <li key={row.id}>
                {isPending ? (
                  <button
                    type="button"
                    className={styles.rowBtn}
                    onClick={() => onOpenProposal(row.tournament_id, row.match_id)}
                  >
                    <span className={styles.rowTitle}>{row.tournaments?.name ?? 'Torneio'}</span>
                    <span className={styles.rowScore}>Placar sugerido: {formatProposalScore(row)}</span>
                    {metaPending ? <span className={styles.rowMeta}>{metaPending}</span> : null}
                  </button>
                ) : (
                  <div className={`${styles.rowBtn} ${styles.rowBtnDisabled}`} aria-disabled="true">
                    <span className={styles.rowTitle}>{row.tournaments?.name ?? 'Torneio'}</span>
                    <span className={styles.rowScore}>Placar sugerido: {formatProposalScore(row)}</span>
                    <span className={styles.rowStatus}>{statusLabel(row.status)}</span>
                    {metaClosed ? <span className={styles.rowMeta}>{metaClosed}</span> : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
