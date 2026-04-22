import StandingsTable from '../../../../components/StandingsTable/StandingsTable'
import styles from './StandingsSection.module.css'

interface StandingsSectionProps {
  playoffCutoff?: number
  onDataUpdate?: () => void
  isChampionshipFormat?: boolean
  leagueRoundCount?: number
}

function StandingsSection({ 
  playoffCutoff, 
  onDataUpdate,
  isChampionshipFormat = false,
  leagueRoundCount = 0
}: StandingsSectionProps) {
  return (
    <div className={styles.wrapper}>
      <StandingsTable 
        onDataUpdate={onDataUpdate} 
        playoffCutoff={playoffCutoff}
        isChampionshipFormat={isChampionshipFormat}
        leagueRoundCount={leagueRoundCount}
      />
    </div>
  )
}

export default StandingsSection