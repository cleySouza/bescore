import type { Tournament } from '../../../../atoms/tournamentAtoms'
import {
  type TournamentSettings,
  getTournamentBadgeInitials,
  getTournamentCoverImage,
} from '../../../../types/tournament'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import styles from './TournamentHeader.module.css'

interface TournamentHeaderProps {
  tournament: Tournament
  tournamentSettings: TournamentSettings | null
  onBack: () => void
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return 'Ativo'
    case 'draft':
      return 'Rascunho'
    case 'finished':
      return 'Finalizado'
    case 'cancelled':
      return 'Cancelado'
    default:
      return 'Ativo'
  }
}

function TournamentHeader({ tournament, tournamentSettings, onBack }: TournamentHeaderProps) {
  const tournamentImage = getTournamentCoverImage(tournamentSettings)
  const tournamentInitials = getTournamentBadgeInitials(tournament.name)
  const tournamentStatusLabel = getStatusLabel(tournament.status)

  return (
    <header className={styles.header}>
      <button className={styles.backBtn} onClick={onBack}>
        <span className={styles.backBtnIcon}>
          <HiOutlineArrowLeft aria-hidden size={18} strokeWidth={2} />
        </span>
        <span>Voltar</span>
      </button>

      <div className={styles.headerContent}>
        <div className={styles.headerThumb} aria-hidden>
          {tournamentImage ? (
            <img src={tournamentImage} alt={tournament.name} className={styles.headerThumbImg} />
          ) : (
            <span className={styles.headerThumbFallback}>{tournamentInitials}</span>
          )}
        </div>

        <div className={styles.headerTextBlock}>
          <h1 className={styles.title}>{tournament.name}</h1>
          <span className={styles.gameType}>{tournament.game_type}</span>
        </div>
      </div>

      <span className={styles.statusBadge}>{tournamentStatusLabel}</span>
    </header>
  )
}

export default TournamentHeader