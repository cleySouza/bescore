import type { ReactNode } from 'react'
import styles from './MatchesSection.module.css'

interface MatchesSectionProps {
  pendingCount: number
  legSwitch: ReactNode
  loading: boolean
  content: ReactNode
}

function MatchesSection({ legSwitch, loading, content }: MatchesSectionProps) {
  return (
    <>
      <h2 className={styles.title}>
        Proximas partidas:
      </h2>
      {legSwitch}
      {loading ? (
        <div className={styles.loadingMessage}>Carregando jogos...</div>
      ) : (
        content
      )}
    </>
  )
}

export default MatchesSection
