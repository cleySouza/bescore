import StandingsTable from '../../../components/StandingsTable'

interface StandingsSectionProps {
  playoffCutoff: number | undefined
  onDataUpdate: () => void
}

function StandingsSection({ playoffCutoff, onDataUpdate }: StandingsSectionProps) {
  return <StandingsTable onDataUpdate={onDataUpdate} playoffCutoff={playoffCutoff} />
}

export default StandingsSection
