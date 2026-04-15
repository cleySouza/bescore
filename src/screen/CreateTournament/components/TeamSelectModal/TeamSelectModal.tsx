import { useState, useEffect } from 'react'
import styles from './TeamSelectModal.module.css'
import { fetchStrapiClubCatalog, type Continent, type League, type Club, type TeamDataMap } from '../../../../lib/strapiClubService'

interface TeamSelectModalProps {
  selectedIds: string[]
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
  const [continents, setContinents] = useState<Continent[]>([])
  const [leaguesByContinent, setLeaguesByContinent] = useState<{ [k: string]: League[] }>({})
  const [teamData, setTeamData] = useState<TeamDataMap>({})
  const [dataReady, setDataReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [step, setStep] = useState<'continents' | 'leagues' | 'clubs'>('continents')
  const [activeContinent, setActiveContinent] = useState<Continent | null>(null)
  const [activeLeague, setActiveLeague] = useState<League | null>(null)
  const [selected, setSelected] = useState<string[]>(initialSelected)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setDataReady(false)
      setLoadError(null)
      try {
        const { continents: c, leaguesByContinent: lbc, teamData: td } = await fetchStrapiClubCatalog()
        if (cancelled) return
        setContinents(c)
        setLeaguesByContinent(lbc)
        setTeamData(td)
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Erro ao carregar catálogo')
      } finally {
        if (!cancelled) setDataReady(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const isLimitReached = selected.length >= maxTeams

  const toggleClub = (clubId: string) => {
    setSelected((prev) => {
      if (prev.includes(clubId)) return prev.filter((id) => id !== clubId)
      if (prev.length >= maxTeams) return prev
      return [...prev, clubId]
    })
  }

  const handleContinentClick = (continent: Continent) => {
    setActiveContinent(continent)
    setStep('leagues')
  }

  const handleLeagueClick = (league: League) => {
    setActiveLeague(league)
    setStep('clubs')
  }

  const handleBack = () => {
    if (step === 'clubs') {
      setStep('leagues')
      setActiveLeague(null)
    } else {
      setStep('continents')
      setActiveContinent(null)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const leaguesInContinent = activeContinent ? (leaguesByContinent[activeContinent.id] ?? []) : []
  const clubs: Club[] = activeLeague ? (teamData[activeLeague.id] ?? []) : []

  const slideClass =
    step === 'leagues' ? styles.onLeagues :
    step === 'clubs'   ? styles.onClubs   : ''

  const headerTitle =
    step === 'continents' ? 'Continente' :
    step === 'leagues'    ? (activeContinent?.name ?? 'Ligas') :
    (activeLeague?.name ?? 'Clubes')

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Selecionar Times">

        {/* ── Header ── */}
        <div className={styles.header}>
          {step !== 'continents' && (
            <button className={styles.backBtn} type="button" onClick={handleBack}>
              ← Voltar
            </button>
          )}
          <h2 className={styles.headerTitle}>{headerTitle}</h2>
          <span className={`${styles.counter} ${selected.length > 0 ? styles.counterActive : ''}`}>
            {selected.length} / {maxTeams} selecionados
          </span>
          <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {/* ── Slides ── */}
        <div className={styles.slideWrap}>
          {!dataReady ? (
            <div className={styles.loading}>Carregando…</div>
          ) : loadError ? (
            <div className={styles.loading}>{loadError}</div>
          ) : (
            <div className={`${styles.slides} ${slideClass}`}>

              {/* Slide 0 — Continentes */}
              <div className={styles.slide} aria-hidden={step !== 'continents'}>
                <div className={styles.leagueGrid}>
                  {continents.map((continent) => (
                    <button
                      key={continent.id}
                      type="button"
                      className={styles.leagueCard}
                      onClick={() => handleContinentClick(continent)}
                    >
                      <LogoWithFallback
                        src={continent.logo}
                        alt={continent.name}
                        color="#5c2df5"
                        size={40}
                        className={styles.leagueLogo}
                        initialsClass={styles.leagueInitials}
                        label={continent.name}
                      />
                      <span className={styles.leagueName}>{continent.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slide 1 — Ligas */}
              <div className={styles.slide} aria-hidden={step !== 'leagues'}>
                <div className={styles.leagueGrid}>
                  {leaguesInContinent.map((league) => (
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

              {/* Slide 2 — Clubes */}
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
            disabled={selected.length !== maxTeams || !!loadError}
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
