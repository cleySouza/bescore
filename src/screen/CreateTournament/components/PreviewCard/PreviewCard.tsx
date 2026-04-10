import styles from './PreviewCard.module.css'

interface PreviewCardProps {
  tournamentName: string
  gameType: string
  tournamentImage?: string | null
  onImageChange?: (file: File) => void
  willPlay?: boolean
  adminDraft?: boolean
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

const PREVIEW_TAGS = ['Classificado', 'Melhor Ataque', 'Melhor Defesa']

export const PreviewCard = ({
  tournamentName,
  gameType,
  tournamentImage,
  onImageChange,
  willPlay = true,
  adminDraft = true,
}: PreviewCardProps) => {
  const gameIcon = GAME_ICONS[gameType] || '🎮'

  const draftRule = adminDraft
    ? 'Times pré-definidos pelo Organizador.'
    : 'Escolha de times livre (por ordem de entrada).'

  const adminRule = willPlay
    ? 'Criador participará como competidor.'
    : 'Torneio gerenciado por Admin externo.'

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImageChange?.(file)
    }
  }

  return (
    <div className={styles.previewCard}>
      {/* Image Placeholder - Small, Centered */}
      <div className={styles.imageContainer}>
        <div className={styles.imagePlaceholder}>
          {tournamentImage ? (
            <img src={tournamentImage} alt="Torneio" />
          ) : (
            <span className={styles.gameIcon}>{gameIcon}</span>
          )}
          <input
            type="file"
            accept="image/*"
            className={styles.imageInput}
            onChange={handleImageUpload}
            aria-label="Upload imagem do torneio"
          />
          <label className={styles.uploadLabel}>📷</label>
        </div>
      </div>

      {/* Tournament Title */}
      <h2 className={styles.previewTitle}>{tournamentName || 'Seu Torneio'}</h2>

      {/* Rules - Simple bullets */}
      <ul className={styles.rulesList}>
        {PREVIEW_RULES.map((rule, index) => (
          <li key={index}>{rule}</li>
        ))}
        <li key="draft-rule">{draftRule}</li>
        <li key="admin-rule">{adminRule}</li>
      </ul>

      {/* Tags - Horizontal pill container */}
      <div className={styles.tagsContainer}>
        {PREVIEW_TAGS.map((tag, index) => (
          <span key={index} className={`${styles.tag} ${index === 0 ? styles.primaryTag : ''}`}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
