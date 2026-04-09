import styles from './PreviewCard.module.css'

interface PreviewCardProps {
  tournamentName: string
  gameType: string
}

const GAME_ICONS: Record<string, string> = {
  eFootball: '⚽',
  LoL: '🎮',
  CS2: '🔫',
  Valorant: '🔴',
  Outros: '❓',
}

const PREVIEW_RULES = [
  'Controle de partida será feito entre adm e usuários envolvidos na mesma.',
  'O sistema de punições será aberto votação para todos os usuários do torneio tendo o mínimo de 51%+ 1% para ser aprovado.',
]

const PREVIEW_TABS = ['Classificado', 'Melhor Ataque', 'Melhor Defesa']

export const PreviewCard = ({ tournamentName, gameType }: PreviewCardProps) => {
  const gameIcon = GAME_ICONS[gameType] || '🎮'

  return (
    <div className={styles.previewCard}>
      {/* Image Placeholder */}
      <div className={styles.previewImagePlaceholder}>
        <span className={styles.gameIcon}>{gameIcon}</span>
      </div>

      {/* Tournament Title */}
      <h2 className={styles.previewTitle}>{tournamentName || 'Seu Torneio'}</h2>

      {/* Rules Info */}
      <div className={styles.previewInfo}>
        <ul className={styles.rulesList}>
          {PREVIEW_RULES.map((rule, index) => (
            <li key={index}>• {rule}</li>
          ))}
        </ul>
      </div>

      {/* Preview Tabs */}
      <div className={styles.previewTabs}>
        {PREVIEW_TABS.map((tab, index) => (
          <button
            key={index}
            className={`${styles.tab} ${index === 0 ? styles.active : ''}`}
            disabled
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  )
}
