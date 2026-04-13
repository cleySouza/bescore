import styles from './PreviewCard.module.css'

interface PreviewCardProps {
  tournamentName: string
  gameType: string
  tournamentImage?: string | null
  onImageChange?: (file: File) => void
  willPlay?: boolean
  adminDraft?: boolean
  autoTeams?: boolean
  format?: string
  playoffCutoff?: 'top4' | 'top2'
  hasReturnMatch?: boolean
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
  autoTeams = true,
  format = 'liga',
  playoffCutoff = 'top4',
  hasReturnMatch = false,
}: PreviewCardProps) => {
  const gameIcon = GAME_ICONS[gameType] || '🎮'

  const draftRule = adminDraft
    ? 'O organizador define os times de cada vaga.'
    : 'Os participantes escolhem seus times ao entrar.'

  const autoTeamsRule = adminDraft
    ? (autoTeams
        ? 'O sistema sorteará os times entre os inscritos.'
        : 'O Admin atribuirá os times manualmente aos jogadores.')
    : null

  const adminRule = willPlay
    ? 'Criador participará como competidor.'
    : 'Torneio gerenciado por Admin externo.'

  const isCampeonato = format === 'campeonato'
  const isKnockout = format === 'mata-mata'
  const isGroups = format === 'grupos'
  const playoffN = playoffCutoff === 'top4' ? 4 : 2
  const leagueRule = hasReturnMatch
    ? 'Todos se enfrentam em turno e returno.'
    : 'Todos se enfrentam em turno único.'
  const knockoutRule = hasReturnMatch
    ? 'Os confrontos de mata-mata terão ida e volta.'
    : 'Os confrontos de mata-mata serão em jogo único.'
  const groupsRule = hasReturnMatch
    ? 'Os confrontos entre grupos terão ida e volta.'
    : 'Os confrontos entre grupos serão em turno único.'

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
        {isCampeonato ? (
          <>
            <li key="camp-rule1">{leagueRule}</li>
            <li key="camp-rule2">Os {playoffN} melhores avançam para o mata-mata.</li>
          </>
        ) : isKnockout ? (
          <>
            <li key="knockout-rule">{knockoutRule}</li>
            <li key="draft-rule">{draftRule}</li>
            {autoTeamsRule && <li key="autoteams-rule">{autoTeamsRule}</li>}
          </>
        ) : isGroups ? (
          <>
            <li key="groups-rule">{groupsRule}</li>
            <li key="draft-rule">{draftRule}</li>
            {autoTeamsRule && <li key="autoteams-rule">{autoTeamsRule}</li>}
          </>
        ) : format === 'liga' ? (
          <>
            <li key="league-rule">{leagueRule}</li>
            <li key="draft-rule">{draftRule}</li>
            {autoTeamsRule && <li key="autoteams-rule">{autoTeamsRule}</li>}
          </>
        ) : (
          <>
            <li key="draft-rule">{draftRule}</li>
            {autoTeamsRule && <li key="autoteams-rule">{autoTeamsRule}</li>}
          </>
        )}
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
