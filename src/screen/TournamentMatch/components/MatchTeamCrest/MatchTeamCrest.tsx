import { getTeamInitials } from '../teamInitials'
import { useImageFallback } from '../useImageFallback'
import styles from './MatchTeamCrest.module.css'

interface MatchTeamCrestProps {
  teamName: string | null | undefined
  shieldsMap: Record<string, string>
}

function MatchTeamCrest({ teamName, shieldsMap }: MatchTeamCrestProps) {
  const name = teamName || 'TBD'
  const shieldUrl = teamName ? shieldsMap[teamName] : undefined
  const { imgError, setImgError } = useImageFallback(shieldUrl)

  if (shieldUrl && !imgError) {
    return (
      <span className={styles.matchCrest}>
        <img
          src={shieldUrl}
          alt={name}
          className={styles.matchCrestImg}
          onError={() => setImgError(true)}
        />
      </span>
    )
  }

  return <span className={styles.matchCrest}>{getTeamInitials(teamName)}</span>
}

export default MatchTeamCrest
