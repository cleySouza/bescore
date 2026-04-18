import type { ReactNode } from 'react'
import styles from './FinalPhaseSection.module.css'

interface FinalPhaseSectionProps {
  pendingCount: number
  loading: boolean
  content: ReactNode
}

function FinalPhaseSection({ pendingCount, loading, content }: FinalPhaseSectionProps) {
  return (
    <>
      <h2 className={styles.title}>
        Fase final:
        {pendingCount > 0 && (
          <span className={styles.pendingCountBadge}>{pendingCount} pendentes</span>
        )}
      </h2>
      {loading ? (
        <div className={styles.loadingMessage}>Carregando jogos...</div>
      ) : (
        content
      )}
    </>
  )
}

export default FinalPhaseSection
