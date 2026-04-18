import { useState } from 'react'
import { getTeamInitials } from '../teamInitials'
import styles from './ScoreEntryTeamCrest.module.css'

interface ScoreEntryTeamCrestProps {
  teamName: string
  shieldsMap: Record<string, string>
}

function ScoreEntryTeamCrest({ teamName, shieldsMap }: ScoreEntryTeamCrestProps) {
  const shieldUrl = shieldsMap[teamName]
  const [imgError, setImgError] = useState(false)

  if (shieldUrl && !imgError) {
    return (
      <span className={styles.teamCrest}>
        <img
          src={shieldUrl}
          alt={teamName}
          className={styles.teamCrestImg}
          onError={() => setImgError(true)}
        />
      </span>
    )
  }

  return <span className={styles.teamCrest}>{getTeamInitials(teamName)}</span>
}

export default ScoreEntryTeamCrest
