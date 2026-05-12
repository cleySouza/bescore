import { useAtomValue } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { strapiShieldsMapAtom } from '../../atoms/catalogAtom'
import { useRecentTimeline } from '../../hooks/useRecentTimeline'
import RecentTimeline from '../../screen/TournamentMatch/components/RecentTimeline/RecentTimeline'
import styles from './GlobalRecentMatchesCarousel.module.css'

/**
 * Últimas 3 partidas finalizadas do utilizador — visível em todo o shell autenticado.
 * Dados voltam a ser pedidos ao mudar de rota, ao regressar à aba do browser ou quando o epoch é incrementado (ex.: após guardar placar).
 */
export function GlobalRecentMatchesCarousel() {
  const user = useAtomValue(userAtom)
  const shieldsMap = useAtomValue(strapiShieldsMapAtom)
  const { recentTimelineMatches, recentTimelineRef } = useRecentTimeline(user?.id)

  if (!user || recentTimelineMatches.length === 0) return null

  return (
    <div className={styles.wrap}>
      <RecentTimeline
        matches={recentTimelineMatches}
        shieldsMap={shieldsMap}
        ref={recentTimelineRef}
      />
    </div>
  )
}
