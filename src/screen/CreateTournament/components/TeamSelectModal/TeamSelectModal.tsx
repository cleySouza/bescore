import { useState, useEffect } from 'react'
import styles from './TeamSelectModal.module.css'
import type { League, Club, TeamDataMap } from './TEAM_DATA_MOCK'

interface TeamSelectModalProps {
  /** IDs already selected (controlled from parent formData) */
  selectedIds: string[]
  /** Maximum number of teams the admin can define */
  maxTeams: number
  onConfirm: (clubs: Club[]) => void
  onClose: () => void
}

export function TeamSelectModal({
  selectedIds: initialSelected,
  maxTeams,
  onConfirm,
  onClose,
}: TeamSelectModalProps) {
  const [leagues, setLeagues] = useState<League[]>([])
  const [teamData, setTeamData] = useState<TeamDataMap>({})
  const [dataReady, setDataReady] = useState(false)

  const [step, setStep] = useState<'leagues' | 'clubs'>('leagues')
  const [activeLeague, setActiveLeague] = useState<League | null>(null)
  const [selected, setSelected] = useState<string[]>(initialSelected)

  // Dynamic import — keeps the mock out of the initial bundle
  useEffect(() => {
    import('./TEAM_DATA_MOCK').then(({ LEAGUES, TEAM_DATA }) => {
      setLeagues(LEAGUES)
      setTeamData(TEAM_DATA)
      setDataReady(true)
    })
  }, [])

  const isLimitReached = selected.length >= maxTeams

  const toggleClub = (clubId: string) => {
    setSelected((prev) => {
      if (prev.includes(clubId)) return prev.filter((id) => id !== clubId)
      if (prev.length >= maxTeams) return prev
      return [...prev, clubId]
    })
  }

  const handleLeagueClick = (league: League) => {
    setActiveLeague(league)
    setStep('clubs')
  }

  const handleBack = () => {
    setStep('leagues')
    setActiveLeague(null)
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const clubs: Club[] = activeLeague ? (teamData[activeLeague.id] ?? []) : []

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Selecionar Times">

        {/* ── Header ── */}
        <div className={styles.header}>
          {step === 'clubs' && (
            <button className={styles.backBtn} type="button" onClick={handleBack}>
              ← Voltar
            </button>
          )}

          <h2 className={styles.headerTitle}>
            {step === 'leagues' ? 'Escolher Liga' : activeLeague?.name ?? 'Clubes'}
          </h2>

          <span className={`${styles.counter} ${selected.length > 0 ? styles.counterActive : ''}`}>
            {selected.length} / {maxTeams} selecionados
          </span>

          <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {/* ── Slides ── */}
        <div className={styles.slideWrap}>
          {!dataReady ? (
            <div className={styles.loading}>Carregando times…</div>
          ) : (
            <div className={`${styles.slides} ${step === 'clubs' ? styles.onClubs : ''}`}>

              {/* Step 1 — Leagues */}
              <div className={styles.slide} aria-hidden={step !== 'leagues'}>
                <div className={styles.leagueGrid}>
                  {leagues.map((league) => (
                    <button
                      key={league.id}
                      type="button"
                      className={styles.leagueCard}
                      onClick={() => handleLeagueClick(league)}
                    >
                      <LogoWithFallback
                        src={league.logo}
                        alt={league.name}
                        color={league.color}
                        size={40}
                        className={styles.leagueLogo}
                        initialsClass={styles.leagueInitials}
                        label={league.name}
                      />
                      <span className={styles.leagueName}>{league.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2 — Clubs */}
              <div className={styles.slide} aria-hidden={step !== 'clubs'}>
                <div className={styles.clubGrid}>
                  {clubs.map((club) => {
                    const isSelected = selected.includes(club.id)
                    const isDisabled = !isSelected && isLimitReached
                    return (
                      <button
                        key={club.id}
                        type="button"
                        className={`${styles.clubCard} ${isSelected ? styles.selected : ''}`}
                        onClick={() => toggleClub(club.id)}
                        disabled={isDisabled}
                        aria-pressed={isSelected}
                      >
                        <div className={styles.clubBadgeWrap}>
                          <LogoWithFallback
                            src={club.logo}
                            alt={club.name}
                            color={club.color}
                            size={44}
                            className={styles.clubLogo}
                            initialsClass={styles.clubInitials}
                            label={club.name}
                          />
                          {isSelected && <span className={styles.selectedTick}>✓</span>}
                        </div>
                        <span className={styles.clubName}>{club.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          {selected.length < maxTeams && (
            <span className={styles.footerHint}>
              Selecione mais {maxTeams - selected.length} time{maxTeams - selected.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => {
              const allClubs = Object.values(teamData).flat()
              const confirmedClubs = selected
                .map((id) => allClubs.find((c) => c.id === id))
                .filter((c): c is Club => c !== undefined)
              onConfirm(confirmedClubs)
            }}
            disabled={selected.length !== maxTeams}
          >
            Confirmar
          </button>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo with initials fallback (avoids broken-image icon)
// ─────────────────────────────────────────────────────────────────────────────
interface LogoProps {
  src: string
  alt: string
  color: string
  size: number
  className: string
  initialsClass: string
  label: string
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-_&]+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

function LogoWithFallback({ src, alt, color, size, className, initialsClass, label }: LogoProps) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <span
        className={initialsClass}
        style={{ background: color, width: size, height: size }}
        title={label}
      >
        {getInitials(alt)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  )
}
