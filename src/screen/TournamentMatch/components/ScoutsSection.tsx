import styles from '../TournamentMatch.module.css'

interface SideSummary {
  teamName: string
  nickname: string
}

interface ScoutsSectionProps {
  champion: SideSummary | null
  vice: SideSummary | null
}

function ScoutsSection({ champion, vice }: ScoutsSectionProps) {
  return (
    <div className={styles.playoffScoutPanel}>
      <h3 className={styles.playoffScoutTitle}>SCOUTS</h3>
      <div className={styles.scoutTrophy}>🏆</div>
      <div className={styles.scoutTeamBlock}>
        <span className={styles.scoutLabel}>Campeão</span>
        <strong>{champion?.teamName || 'A definir'}</strong>
        <small>{champion?.nickname || '—'}</small>
      </div>
      <div className={styles.scoutTeamBlock}>
        <span className={styles.scoutLabel}>Vice</span>
        <strong>{vice?.teamName || 'A definir'}</strong>
        <small>{vice?.nickname || '—'}</small>
      </div>
    </div>
  )
}

export default ScoutsSection
