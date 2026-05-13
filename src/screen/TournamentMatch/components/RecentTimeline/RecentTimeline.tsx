import { forwardRef } from 'react'
import TimelineCrest from '../TimelineCrest/TimelineCrest'
import styles from './RecentTimeline.module.css'

interface RecentTimelineMatch {
  id: string
  loggedParticipantId: string
  tournamentName: string
  tournamentImage: string | null
  homePosition: number | null
  awayPosition: number | null
  /** Participantes na mini-tabela da snapshot (para último lugar). */
  snapshotTableSize?: number
  tournamentFormat?: string | null
  /** Só formato campeonato: top N para mata-mata (igual StandingsTable). */
  playoffCutoff?: number | null
  home_participant_id: string | null
  away_participant_id: string | null
  home_score: number | null
  away_score: number | null
  updated_at?: string | null
  created_at?: string | null
  homeTeam?: {
    team_name: string | null
    profile?: {
      nickname: string | null
    } | null
  } | null
  awayTeam?: {
    team_name: string | null
    profile?: {
      nickname: string | null
    } | null
  } | null
}

interface RecentTimelineProps {
  matches: RecentTimelineMatch[]
  shieldsMap: Record<string, string>
}

function getTournamentInitials(name: string | null | undefined) {
  if (!name) return 'TR'
  return name
    .split(/[\s\-_&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('') || 'TR'
}

function formatTimelineDate(input: string | null | undefined) {
  if (!input) return '--/--'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '--/--'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

type PositionTone = 'leader' | 'last' | 'classified' | 'default'

/** Ordem: líder (1º) → último → zona de apuramento campeonato (top playoffCutoff), como na classificação. */
function resolvePositionTone(
  position: number | null,
  snapshotTableSize: number | undefined,
  tournamentFormat: string | null | undefined,
  playoffCutoff: number | null | undefined
): PositionTone {
  if (position == null || position < 1) return 'default'
  const n = snapshotTableSize ?? 0
  if (n < 1) return 'default'
  if (position === 1) return 'leader'
  if (n >= 2 && position === n) return 'last'
  if (
    tournamentFormat === 'campeonato' &&
    (playoffCutoff === 4 || playoffCutoff === 2) &&
    position <= playoffCutoff
  ) {
    return 'classified'
  }
  return 'default'
}

function positionToneClassName(tone: PositionTone): string {
  switch (tone) {
    case 'leader':
      return styles.recentPositionLeader
    case 'last':
      return styles.recentPositionLast
    case 'classified':
      return styles.recentPositionClassified
    default:
      return ''
  }
}

const RecentTimeline = forwardRef<HTMLDivElement, RecentTimelineProps>(
  ({ matches, shieldsMap }, ref) => {
    if (matches.length === 0) return null

    return (
      <section className={styles.recentTimeline}>
        <h2 className={styles.recentTimelineTitle}>Resultado ultimas partidas</h2>
        <div ref={ref} className={styles.recentTimelineList}>
          {matches.map((match) => {
            const loggedIsHome = match.home_participant_id === match.loggedParticipantId
            const myTeam = loggedIsHome ? match.homeTeam : match.awayTeam
            const opponentTeam = loggedIsHome ? match.awayTeam : match.homeTeam
            const myScore = loggedIsHome ? match.home_score : match.away_score
            const opponentScore = loggedIsHome ? match.away_score : match.home_score
            const myPosition = loggedIsHome ? match.homePosition : match.awayPosition
            const opponentPosition = loggedIsHome ? match.awayPosition : match.homePosition

            const myTone = resolvePositionTone(
              myPosition,
              match.snapshotTableSize,
              match.tournamentFormat,
              match.playoffCutoff
            )
            const oppTone = resolvePositionTone(
              opponentPosition,
              match.snapshotTableSize,
              match.tournamentFormat,
              match.playoffCutoff
            )
            const myPosClass = positionToneClassName(myTone)
            const oppPosClass = positionToneClassName(oppTone)

            const resultTone =
              myScore! > opponentScore!
                ? styles.timelineResultWin
                : myScore! < opponentScore!
                  ? styles.timelineResultLoss
                  : styles.timelineResultDraw

            return (
              <article key={match.id} className={styles.recentCard}>
                <div className={styles.recentThumb}>
                  {match.tournamentImage ? (
                    <img 
                      src={match.tournamentImage} 
                      alt={match.tournamentName} 
                      className={styles.recentThumbImg} 
                    />
                  ) : (
                    <span className={styles.recentThumbFallback}>
                      {getTournamentInitials(match.tournamentName)}
                    </span>
                  )}
                </div>

                <div className={styles.recentMeta}>
                  <span className={styles.recentMetaName}>{match.tournamentName}</span>
                  <strong className={styles.recentMetaDate}>
                    {formatTimelineDate(match.updated_at ?? match.created_at)}
                  </strong>
                </div>

                <div className={styles.recentScoreWrap}>
                  <span
                    className={[styles.recentPositionTag, myPosClass].filter(Boolean).join(' ')}
                  >
                    P{myPosition ?? '-'}
                  </span>
                  <TimelineCrest teamName={myTeam?.team_name} shieldsMap={shieldsMap} />

                  <span className={styles.recentScoreBox}>{myScore}</span>
                  <span className={`${styles.recentScoreCross} ${resultTone}`}>x</span>
                  <span className={styles.recentScoreBox}>{opponentScore}</span>

                  <TimelineCrest teamName={opponentTeam?.team_name} shieldsMap={shieldsMap} />
                  <span
                    className={[styles.recentPositionTag, oppPosClass].filter(Boolean).join(' ')}
                  >
                    P{opponentPosition ?? '-'}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    )
  }
)

RecentTimeline.displayName = 'RecentTimeline'

export default RecentTimeline