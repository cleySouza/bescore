import { useState } from 'react'
import { getTeamInitials } from '../teamInitials'
import styles from './TimelineCrest.module.css'

interface TimelineCrestProps {
  teamName: string | null | undefined
  shieldsMap: Record<string, string>
}

function TimelineCrest({ teamName, shieldsMap }: TimelineCrestProps) {
  const name = teamName || 'TBD'
  const shieldUrl = teamName ? shieldsMap[teamName] : undefined
  const [imgError, setImgError] = useState(false)

  if (shieldUrl && !imgError) {
    return (
      <span className={styles.timelineCrest}>
        <img
          src={shieldUrl}
          alt={name}
          className={styles.timelineCrestImg}
          onError={() => setImgError(true)}
        />
      </span>
    )
  }

  return <span className={styles.timelineCrest}>{getTeamInitials(teamName)}</span>
}

export default TimelineCrest
