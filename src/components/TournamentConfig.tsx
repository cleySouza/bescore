import { useState } from 'react'
import { useAtomValue } from 'jotai'
import { userAtom } from '../atoms/sessionAtom'
import { activeTournamentAtom, showConfigModalAtom } from '../atoms/tournamentAtoms'
import { generateMatchesByFormat } from '../lib/matchGenerationEngine'
import type { TournamentFormat, TournamentSettings } from '../types/tournament'
import styles from './TournamentConfig.module.css'

interface TournamentConfigProps {
  participantCount: number
  onClose: () => void
  onMatchesGenerated?: () => void
}

/**
 * Calcula informações sobre o formato Knockout
 */
function calculateKnockoutInfo(participantCount: number) {
  if (participantCount < 2) {
    return { valid: false, reason: 'Mata-Mata precisa de pelo menos 2 participantes' }
  }

  // Encontrar potência de 2 mais próxima
  const powerOf2 = Math.pow(2, Math.ceil(Math.log2(participantCount)))
  const byeCount = powerOf2 - participantCount
  const totalMatches = participantCount - 1 // Sempre n-1 partidas em eliminatória
  const rounds = Math.ceil(Math.log2(participantCount))

  return {
    valid: true,
    powerOf2,
    byeCount,
    totalMatches,
    rounds,
    description:
      byeCount > 0
        ? `${byeCount} ${byeCount === 1 ? 'vaga' : 'vagas'} de folga na primeira rodada`
        : 'Sem vagas de folga',
  }
}

/**
 * Calcula informações sobre o formato Round Robin
 */
function calculateRoundRobinInfo(participantCount: number, hasReturnMatch: boolean) {
  const matches = (participantCount * (participantCount - 1)) / 2
  const totalMatches = hasReturnMatch ? matches * 2 : matches
  const rounds = hasReturnMatch ? 2 : 1

  return {
    valid: participantCount >= 2,
    matches,
    totalMatches,
    rounds,
    description: `${totalMatches} ${totalMatches === 1 ? 'partida' : 'partidas'} em ${rounds} ${rounds === 1 ? 'rodada' : 'rodadas'}`,
  }
}

/**
 * Calcula informações sobre Grupos Cruzados
 */
function calculateGroupsInfo(participantCount: number, groupCount: number) {
  const perGroup = Math.floor(participantCount / groupCount)
  const extra = participantCount % groupCount
  const matchesPerGroup = (perGroup * (perGroup - 1)) / 2
  const crossMatches = (groupCount * (groupCount - 1)) / 2 * perGroup * perGroup

  return {
    valid: participantCount >= 3,
    perGroup,
    extra,
    totalMatches: groupCount * matchesPerGroup + crossMatches,
    description:
      extra > 0
        ? `${extra} ${extra === 1 ? 'grupo' : 'grupos'} com ${perGroup + 1}, ${groupCount - extra} com ${perGroup}`
        : `${groupCount} ${groupCount === 1 ? 'grupo' : 'grupos'} com ${perGroup} cada`,
  }
}

/**
 * Calcula informações sobre o formato Misto
 */
function calculateMixedInfo(
  participantCount: number,
  groupCount: number,
  qualifiedCount: number
) {
  if (participantCount < 4) {
    return { valid: false, reason: 'Misto precisa de pelo menos 4 participantes' }
  }

  if (qualifiedCount > participantCount) {
    return {
      valid: false,
      reason: `Não é possível qualificar ${qualifiedCount} de ${participantCount} participantes`,
    }
  }

  const perGroup = Math.floor(participantCount / groupCount)
  const groupMatches = (perGroup * (perGroup - 1)) / 2
  const knockoutMatches = qualifiedCount - 1

  return {
    valid: true,
    groupMatches: groupCount * groupMatches,
    knockoutMatches,
    totalMatches: groupCount * groupMatches + knockoutMatches,
    description: `${groupCount} grupos → ${qualifiedCount} avançam → ${Math.log2(qualifiedCount)} rodadas de mata-mata`,
  }
}

function TournamentConfig({ participantCount, onClose, onMatchesGenerated }: TournamentConfigProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const showModal = useAtomValue(showConfigModalAtom)

  const [format, setFormat] = useState<TournamentFormat>('roundRobin')
  const [settings, setSettings] = useState<TournamentSettings>({
    format: 'roundRobin',
    hasReturnMatch: false,
    qualifiedCount: 2,
    bracketGroups: 2,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!user || !tournament || !showModal) {
    return null
  }

  const isCreator = tournament.creator_id === user.id

  if (!isCreator) {
    return null
  }

  // Bloqueia configuração se o torneio não está mais em rascunho
  const isDraft = tournament.status === 'draft'

  const handleFormatChange = (newFormat: TournamentFormat) => {
    setFormat(newFormat)
    setSettings((prev) => ({ ...prev, format: newFormat }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validar apenas se for mathematicamente impossível
    let isValid = true
    let validationMessage = ''

    switch (format) {
      case 'knockout':
        if (participantCount < 2) {
          isValid = false
          validationMessage = 'Mata-Mata precisa de pelo menos 2 participantes'
        }
        break
      case 'groupsCrossed':
        if (participantCount < 3) {
          isValid = false
          validationMessage = 'Grupos Cruzados precisa de pelo menos 3 participantes'
        }
        break
      case 'mixed':
        if (participantCount < 4) {
          isValid = false
          validationMessage = 'Misto precisa de pelo menos 4 participantes'
        }
        break
      case 'roundRobin':
      default:
        if (participantCount < 2) {
          isValid = false
          validationMessage = 'Round Robin precisa de pelo menos 2 participantes'
        }
    }

    if (!isValid) {
      setError(validationMessage)
      return
    }

    setLoading(true)

    try {
      await generateMatchesByFormat(tournament.id, format, settings)
      setSuccess(true)

      onMatchesGenerated?.()

      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar partidas'
      setError(message)
      console.error('Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calcular informações para preview
  const knockoutInfo = calculateKnockoutInfo(participantCount)
  const roundRobinInfo = calculateRoundRobinInfo(participantCount, settings.hasReturnMatch || false)
  const groupsInfo = calculateGroupsInfo(participantCount, settings.bracketGroups || 2)
  const mixedInfo = calculateMixedInfo(
    participantCount,
    settings.bracketGroups || 2,
    settings.qualifiedCount || 2
  )

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>⚙️ Montar Campeonato</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {!isDraft ? (
          // Torneio já iniciado — configurações bloqueadas
          <div className={styles.lockedContainer}>
            <div className={styles.lockedIcon}>🔒</div>
            <p className={styles.lockedTitle}>Configurações bloqueadas</p>
            <p className={styles.lockedSubtext}>
              As configurações de formato, privacidade e vagas não podem ser alteradas
              após o torneio ser iniciado.
            </p>
            <button className={styles.cancelBtn} onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : success ? (
          <div className={styles.successContainer}>
            <div className={styles.successIcon}>✅</div>
            <p className={styles.successMessage}>Campeonato montado com sucesso!</p>
            <small>Redirecionando...</small>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.participantInfo}>
              👥 <strong>{participantCount}</strong> {participantCount === 1 ? 'participante' : 'participantes'} inscritos
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Escolha o Formato</label>
              <div className={styles.formatGrid}>
                <button
                  type="button"
                  className={`${styles.formatCard} ${format === 'roundRobin' ? styles.active : ''}`}
                  onClick={() => handleFormatChange('roundRobin')}
                  disabled={loading}
                >
                  <div className={styles.formatCard__icon}>🔄</div>
                  <div className={styles.formatCard__title}>Pontos Corridos</div>
                  <div className={styles.formatCard__subtitle}>Todos vs Todos</div>
                  <div className={styles.formatCard__info}>{roundRobinInfo.description}</div>
                </button>

                <button
                  type="button"
                  className={`${styles.formatCard} ${format === 'knockout' ? styles.active : ''}`}
                  onClick={() => handleFormatChange('knockout')}
                  disabled={loading}
                >
                  <div className={styles.formatCard__icon}>🏆</div>
                  <div className={styles.formatCard__title}>Mata-Mata</div>
                  <div className={styles.formatCard__subtitle}>Eliminatória Direta</div>
                  {knockoutInfo.valid ? (
                    <div className={styles.formatCard__info}>{knockoutInfo.description}</div>
                  ) : (
                    <div className={styles.formatCard__warning}>{knockoutInfo.reason}</div>
                  )}
                </button>

                <button
                  type="button"
                  className={`${styles.formatCard} ${format === 'groupsCrossed' ? styles.active : ''}`}
                  onClick={() => handleFormatChange('groupsCrossed')}
                  disabled={loading}
                >
                  <div className={styles.formatCard__icon}>👥</div>
                  <div className={styles.formatCard__title}>Grupos Cruzados</div>
                  <div className={styles.formatCard__subtitle}>Fase de Grupos</div>
                  {groupsInfo.valid ? (
                    <div className={styles.formatCard__info}>{groupsInfo.description}</div>
                  ) : (
                    <div className={styles.formatCard__warning}>Mínimo 3 participantes</div>
                  )}
                </button>

                <button
                  type="button"
                  className={`${styles.formatCard} ${format === 'mixed' ? styles.active : ''}`}
                  onClick={() => handleFormatChange('mixed')}
                  disabled={loading}
                >
                  <div className={styles.formatCard__icon}>⚡</div>
                  <div className={styles.formatCard__title}>Misto</div>
                  <div className={styles.formatCard__subtitle}>Grupos + Eliminatória</div>
                  {mixedInfo.valid ? (
                    <div className={styles.formatCard__info}>{mixedInfo.description}</div>
                  ) : (
                    <div className={styles.formatCard__warning}>
                      {mixedInfo.reason || 'Mínimo 4 participantes'}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Configurações específicas por formato */}
            {format === 'roundRobin' && (
              <div className={styles.configSection}>
                <div className={styles.configTitle}>⚙️ Configurações do Pontos Corridos</div>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={settings.hasReturnMatch || false}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        hasReturnMatch: e.target.checked,
                      }))
                    }
                    disabled={loading}
                  />
                  <span>Turno e Returno</span>
                </label>
                <small className={styles.configHint}>
                  Cada time joga 2 vezes contra cada adversário (aumenta de{' '}
                  {roundRobinInfo.matches} para{' '}
                  {calculateRoundRobinInfo(participantCount, true).totalMatches} partidas)
                </small>
              </div>
            )}

            {format === 'knockout' && (
              <div className={styles.configSection}>
                <div className={styles.configTitle}>🏆 Estrutura do Mata-Mata</div>
                {knockoutInfo.valid && (
                  <div className={styles.previewBox}>
                    <div className={styles.previewRow}>
                      <span>Chave ao melhor de:</span>
                      <strong>{Math.pow(2, (knockoutInfo.rounds || 1))}</strong>
                    </div>
                    <div className={styles.previewRow}>
                      <span>Rodadas:</span>
                      <strong>{knockoutInfo.rounds}</strong>
                    </div>
                    <div className={styles.previewRow}>
                      <span>Partidas:</span>
                      <strong>{knockoutInfo.totalMatches}</strong>
                    </div>
                    {(knockoutInfo.byeCount || 0) > 0 && (
                      <div className={styles.previewRow}>
                        <span>Vagas de folga:</span>
                        <strong>{knockoutInfo.byeCount}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {format === 'groupsCrossed' && (
              <div className={styles.configSection}>
                <div className={styles.configTitle}>👥 Configurar Grupos</div>
                <div className={styles.configControl}>
                  <label htmlFor="bracketGroups" className={styles.selectLabel}>
                    Número de Grupos
                  </label>
                  <select
                    id="bracketGroups"
                    value={settings.bracketGroups || 2}
                    onChange={(e) => {
                      const newGroupCount = parseInt(e.target.value)
                      setSettings((prev) => ({
                        ...prev,
                        bracketGroups: newGroupCount,
                      }))
                    }}
                    className={styles.select}
                    disabled={loading}
                  >
                    <option value="2">2 Grupos</option>
                    <option value="3">3 Grupos</option>
                    <option value="4">4 Grupos</option>
                  </select>
                </div>
                <div className={styles.previewBox}>
                  <div className={styles.previewRow}>
                    <span>Distribuição:</span>
                    <strong>{groupsInfo.description}</strong>
                  </div>
                  <div className={styles.previewRow}>
                    <span>Total de partidas:</span>
                    <strong>{groupsInfo.totalMatches}</strong>
                  </div>
                </div>
              </div>
            )}

            {format === 'mixed' && (
              <div className={styles.configSection}>
                <div className={styles.configTitle}>⚡ Configurar Fases</div>
                <div className={styles.configControl}>
                  <label htmlFor="bracketGroups2" className={styles.selectLabel}>
                    Fase de Grupos
                  </label>
                  <select
                    id="bracketGroups2"
                    value={settings.bracketGroups || 2}
                    onChange={(e) => {
                      const newGroupCount = parseInt(e.target.value)
                      setSettings((prev) => ({
                        ...prev,
                        bracketGroups: newGroupCount,
                      }))
                    }}
                    className={styles.select}
                    disabled={loading}
                  >
                    <option value="2">2 Grupos</option>
                    <option value="3">3 Grupos</option>
                    <option value="4">4 Grupos</option>
                  </select>
                </div>

                <div className={styles.configControl}>
                  <label htmlFor="qualifiedCount" className={styles.selectLabel}>
                    Quantos Avançam?
                  </label>
                  <select
                    id="qualifiedCount"
                    value={settings.qualifiedCount || 2}
                    onChange={(e) => {
                      const newQualified = parseInt(e.target.value)
                      setSettings((prev) => ({
                        ...prev,
                        qualifiedCount: newQualified,
                      }))
                    }}
                    className={styles.select}
                    disabled={loading}
                  >
                    <option value="2">2 (Semifinal)</option>
                    <option value="4">4 (Quartafinal)</option>
                    <option value="8">8 (Oitavas)</option>
                  </select>
                </div>

                {mixedInfo.valid && (
                  <div className={styles.previewBox}>
                    <div className={styles.previewRow}>
                      <span>Partidas de grupo:</span>
                      <strong>{mixedInfo.groupMatches}</strong>
                    </div>
                    <div className={styles.previewRow}>
                      <span>Partidas de mata-mata:</span>
                      <strong>{mixedInfo.knockoutMatches}</strong>
                    </div>
                    <div className={styles.previewRow}>
                      <span>Total:</span>
                      <strong>{mixedInfo.totalMatches}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <div className={styles.errorMessage}>⚠️ {error}</div>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? '⏳ Gerando campeonato...' : '✨ Gerar Partidas'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default TournamentConfig
