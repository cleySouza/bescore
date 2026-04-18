import styles from './ScoutsSection.module.css'

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
    <div className={styles.panel}>
      <h3 className={styles.title}>SCOUTS</h3>
      <div className={styles.trophy}>🏆</div>
      <div className={styles.teamBlock}>
        <span className={styles.label}>Campeao</span>
        <strong>{champion?.teamName || 'A definir'}</strong>
        <small>{champion?.nickname || '-'}</small>
      </div>
      <div className={styles.teamBlock}>
        <span className={styles.label}>Vice</span>
        <strong>{vice?.teamName || 'A definir'}</strong>
        <small>{vice?.nickname || '-'}</small>
      </div>
    </div>
  )
}

export default ScoutsSection
