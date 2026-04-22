import styles from './PhaseControls.module.css'

interface PhaseControlsProps {
  isCampeonato: boolean
  hasReturnMatch: boolean
  isLeagueFinished: boolean
  hasPlayoffStarted: boolean
  playoffCutoff?: number
  phaseFilter: 'league' | 'playoff'
  legFilter: 'first' | 'second'
  onPhaseChange: (phase: 'league' | 'playoff') => void
  onLegChange: (leg: 'first' | 'second') => void
  onGeneratePlayoff: () => void
  generatingPlayoff: boolean
  isCreator: boolean
}

function PhaseControls({
  isCampeonato,
  hasReturnMatch,
  isLeagueFinished,
  hasPlayoffStarted,
  playoffCutoff,
  phaseFilter,
  legFilter,
  onPhaseChange,
  onLegChange,
  onGeneratePlayoff,
  generatingPlayoff,
  isCreator,
}: PhaseControlsProps) {
  const showPlayoffBanner = isCreator && isLeagueFinished && !hasPlayoffStarted
  const showPhaseSwitch = isCampeonato && (isLeagueFinished || hasPlayoffStarted)
  const showLegSwitch = hasReturnMatch && (!isCampeonato || phaseFilter === 'league')

  return (
    <>
      {showPlayoffBanner && (
        <div className={styles.playoffBanner}>
          <div className={styles.playoffBannerContent}>
            <span className={styles.playoffBannerIcon}>🏆</span>
            <div>
              <strong>Liga Finalizada!</strong>
              <p>Os top {playoffCutoff} estão classificados para a Fase Final.</p>
            </div>
          </div>
          <button
            className={styles.playoffBannerBtn}
            onClick={onGeneratePlayoff}
            disabled={generatingPlayoff}
          >
            {generatingPlayoff ? 'Gerando...' : `Gerar ${playoffCutoff === 4 ? 'Semifinais' : 'Final'}`}
          </button>
        </div>
      )}

      {showPhaseSwitch && (
        <div className={styles.phaseSwitch} role="group" aria-label="Filtrar fases">
          <button
            type="button"
            className={`${styles.phaseOption} ${phaseFilter === 'league' ? styles.phaseOptionActive : ''}`}
            onClick={() => onPhaseChange('league')}
          >
            Primeira fase
          </button>
          <button
            type="button"
            className={`${styles.phaseOption} ${phaseFilter === 'playoff' ? styles.phaseOptionActive : ''}`}
            onClick={() => onPhaseChange('playoff')}
            disabled={!hasPlayoffStarted}
          >
            Segunda fase
          </button>
        </div>
      )}

      {showLegSwitch && (
        <div className={styles.legSwitch} role="group" aria-label="Filtrar turnos">
          <button
            type="button"
            className={`${styles.legOption} ${legFilter === 'first' ? styles.legOptionActive : ''}`}
            onClick={() => onLegChange('first')}
          >
            Turno
          </button>
          <button
            type="button"
            className={`${styles.legOption} ${legFilter === 'second' ? styles.legOptionActive : ''}`}
            onClick={() => onLegChange('second')}
          >
            Returno
          </button>
        </div>
      )}
    </>
  )
}

export default PhaseControls