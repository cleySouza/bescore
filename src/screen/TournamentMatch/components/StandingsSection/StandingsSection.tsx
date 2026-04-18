import StandingsTable from '../../../../components/StandingsTable'
import styles from './StandingsSection.module.css'

interface StandingsSectionProps {
  playoffCutoff: number | undefined
  onDataUpdate: () => void
}

function StandingsSection({ playoffCutoff, onDataUpdate }: StandingsSectionProps) {
  return (
    <div className={styles.wrapper}>
      <StandingsTable onDataUpdate={onDataUpdate} playoffCutoff={playoffCutoff} />
    </div>
  )
}

export default StandingsSection
