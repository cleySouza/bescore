import type { ReactNode } from 'react'
import styles from '../TournamentMatch.module.css'

interface MatchesSectionProps {
  pendingCount: number
  legSwitch: ReactNode
  loading: boolean
  content: ReactNode
}

function MatchesSection({ pendingCount, legSwitch, loading, content }: MatchesSectionProps) {
  return (
    <>
      <h2 className={styles.columnTitle}>
        Próximas partidas:
        {pendingCount > 0 && (
          <span className={styles.pendingCountBadge}>{pendingCount} pendentes</span>
        )}
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
