import type { TournamentWithParticipants } from '../atoms/tournamentAtoms'
import styles from './TournamentCard.module.css'

interface TournamentCardProps {
  tournament: TournamentWithParticipants
  onClick: () => void
}

function TournamentCard({ tournament, onClick }: TournamentCardProps) {
  const createdDate = tournament.created_at
    ? new Date(tournament.created_at).toLocaleDateString('pt-BR')
    : 'Data desconhecida'

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.header}>
        <h3 className={styles.name}>{tournament.name}</h3>
        <span className={styles.badge}>{tournament.game_type}</span>
      </div>

      <div className={styles.info}>
        <div className={styles.infoItem}>
          <span className={styles.label}>Participantes:</span>
          <span className={styles.value}>{tournament.participantCount || 0}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.label}>Status:</span>
          <span className={`${styles.value} ${styles[`status_${tournament.status}`]}`}>
            {tournament.status === 'draft' && '📝 Rascunho'}
            {tournament.status === 'active' && '🔴 Ativo'}
            {tournament.status === 'finished' && '✅ Finalizado'}
          </span>
        </div>
      </div>

      <div className={styles.code}>
        <span className={styles.codeLabel}>Código:</span>
        <code className={styles.codeValue}>{tournament.invite_code}</code>
      </div>

      <div className={styles.footer}>
        <small className={styles.date}>Criado em {createdDate}</small>
        {tournament.isCreator && <span className={styles.creatorBadge}>👑 Criador</span>}
        {tournament.isParticipant && !tournament.isCreator && (
          <span className={styles.participantBadge}>👥 Participante</span>
        )}
      </div>

      <button className={styles.actionBtn}>Ver Torneio →</button>
    </div>
  )
}

export default TournamentCard
