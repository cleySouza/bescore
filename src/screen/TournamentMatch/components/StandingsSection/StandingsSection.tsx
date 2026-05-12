import type { MatchWithTeams } from '../../../../types/tournament'
import StandingsTable from '../../../../components/StandingsTable/StandingsTable'
import styles from './StandingsSection.module.css'

interface StandingsSectionProps {
  matches?: MatchWithTeams[]
  playoffCutoff?: number
  onDataUpdate?: () => void
  isChampionshipFormat?: boolean
  leagueRoundCount?: number
}

function StandingsSection({ 
  matches,
  playoffCutoff, 
  onDataUpdate,
  isChampionshipFormat = false,
  leagueRoundCount = 0
}: StandingsSectionProps) {
  return (
    <div className={styles.wrapper}>
      <StandingsTable 
        matches={matches}
        onDataUpdate={onDataUpdate} 
        playoffCutoff={playoffCutoff}
        isChampionshipFormat={isChampionshipFormat}
        leagueRoundCount={leagueRoundCount}
      />
    </div>
  )
}

export default StandingsSection