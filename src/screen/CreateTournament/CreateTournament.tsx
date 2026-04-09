import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  myTournamentsAtom,
  tournamentsErrorAtom,
  activeTournamentAtom,
  currentViewAtom,
} from '../../atoms/tournamentAtoms'
import { createTournament, fetchMyTournaments, getTournamentById } from '../../lib/tournamentService'
import { ToggleSwitch, PreviewCard } from './components'
import styles from './CreateTournament.module.css'

function CreateTournament() {
  const user = useAtomValue(userAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setError = useSetAtom(tournamentsErrorAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setCurrentView = useSetAtom(currentViewAtom)

  const [formData, setFormData] = useState({
    name: '',
    format: 'liga',
    gameType: 'eFootball',
    maxParticipants: 8,
    isPrivate: false,
    autoTeams: false,
    adminControl: false,
    matchType: 'PA',
  })
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!user) {
    return null
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'maxParticipants' ? parseInt(value) : value,
    }))
    setLocalError(null)
  }

  const handleToggle = (key: keyof typeof formData) => {
    if (typeof formData[key] === 'boolean') {
      setFormData((prev) => ({
        ...prev,
        [key]: !prev[key],
      }))
    }
  }

  const handleBack = () => {
    setCurrentView('dashboard')
    setFormData({
      name: '',
      format: 'liga',
      gameType: 'eFootball',
      maxParticipants: 8,
      isPrivate: false,
      autoTeams: false,
      adminControl: false,
      matchType: 'PA',
    })
    setLocalError(null)
    setSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    // Validação
    if (!formData.name.trim()) {
      setLocalError('Nome do torneio é obrigatório')
      return
    }

    if (formData.name.length < 3) {
      setLocalError('Nome deve ter pelo menos 3 caracteres')
      return
    }

    setLoading(true)

    try {
      // Criar torneio
      const newTournament = await createTournament(formData.name, user.id, formData.gameType)
      setSuccess(true)

      // Recarregar lista de torneios
      const tournaments = await fetchMyTournaments(user.id)
      setMyTournaments(tournaments)

      // Buscar o torneio com detalhes e setar como ativo
      const tournamentWithDetails = await getTournamentById(newTournament.id, user.id)
      setActiveTournament(tournamentWithDetails)

      // Mudar view para tournament
      setTimeout(() => {
        setCurrentView('tournament')
      }, 1500)

      // Limpar formulário
      setFormData({
        name: '',
        format: 'liga',
        gameType: 'eFootball',
        maxParticipants: 8,
        isPrivate: false,
        autoTeams: false,
        adminControl: false,
        matchType: 'PA',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar torneio'
      setLocalError(message)
      setError(message)
      console.error('Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={handleBack} aria-label="Voltar">
          ← Voltar
        </button>
        <h1 className={styles.title}>Criar Torneio</h1>
        <div style={{ width: '60px' }} />
      </div>

      {success ? (
        <div className={styles.successContainer}>
          <div className={styles.successIcon}>✅</div>
          <p className={styles.successMessage}>Torneio criado com sucesso!</p>
          <small>Redirecionando...</small>
        </div>
      ) : (
        <div className={styles.mainContent}>
          <form onSubmit={handleSubmit} className={styles.formSection}>
            {/* Liga/Torneio */}
            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.label}>
                Liga/Torneio
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Selecione uma liga/torneio"
                className={styles.input}
                disabled={loading}
                maxLength={100}
                required
              />
            </div>

            {/* Formato */}
            <div className={styles.formGroup}>
              <label htmlFor="format" className={styles.label}>
                Formato
              </label>
              <select
                id="format"
                name="format"
                value={formData.format}
                onChange={handleInputChange}
                className={styles.select}
                disabled={loading}
              >
                <option value="liga">Liga</option>
                <option value="mata-mata">Mata-mata</option>
                <option value="grupos">Grupos</option>
              </select>
            </div>

            {/* Jogo */}
            <div className={styles.formGroup}>
              <label htmlFor="gameType" className={styles.label}>
                Jogo
              </label>
              <select
                id="gameType"
                name="gameType"
                value={formData.gameType}
                onChange={handleInputChange}
                className={styles.select}
                disabled={loading}
              >
                <option value="eFootball">⚽ eFootball 2025</option>
                <option value="LoL">🎮 League of Legends</option>
                <option value="CS2">🔫 Counter-Strike 2</option>
                <option value="Valorant">🔴 Valorant</option>
                <option value="Outros">❓ Outros</option>
              </select>
            </div>

            {/* Linha de Métricas */}
            <div className={styles.metricsRow}>
              <div className={styles.formGroup}>
                <label htmlFor="maxParticipants" className={styles.label}>
                  N. Participantes
                </label>
                <input
                  id="maxParticipants"
                  type="number"
                  name="maxParticipants"
                  value={formData.maxParticipants}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={loading}
                  min="2"
                  max="128"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Participantes</label>
                <input
                  type="text"
                  placeholder="Participantes"
                  className={styles.input}
                  disabled
                  value={formData.maxParticipants}
                  readOnly
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Times</label>
                <input type="text" placeholder="Times" className={styles.input} disabled readOnly />
              </div>
            </div>

            {/* Linha de Toggles - Times */}
            <div className={styles.togglesRow}>
              <div className={styles.toggleGroup}>
                <label className={styles.toggleLabel}>Times</label>
                <div className={styles.toggleButtons}>
                  <ToggleSwitch
                    label="AUTO"
                    isActive={formData.autoTeams}
                    onClick={() => handleToggle('autoTeams')}
                  />
                  <ToggleSwitch
                    label="NÃO"
                    isActive={!formData.autoTeams}
                    onClick={() => handleToggle('autoTeams')}
                  />
                </div>
              </div>

              <div className={styles.toggleGroup}>
                <label className={styles.toggleLabel}>Privado</label>
                <div className={styles.toggleButtons}>
                  <ToggleSwitch
                    label="NÃO"
                    isActive={!formData.isPrivate}
                    onClick={() => handleToggle('isPrivate')}
                  />
                  <ToggleSwitch
                    label="ADM"
                    isActive={formData.isPrivate}
                    onClick={() => handleToggle('isPrivate')}
                  />
                </div>
              </div>

              <div className={styles.toggleGroup}>
                <label className={styles.toggleLabel}>Tipo sorteio</label>
                <select className={styles.select} disabled={loading}>
                  <option>ADM</option>
                </select>
              </div>

              <div className={styles.toggleGroup}>
                <label className={styles.toggleLabel}>Tipo</label>
                <div className={styles.singleToggleGroup}>
                  <ToggleSwitch
                    label="PA"
                    isActive={formData.matchType === 'PA'}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        matchType: prev.matchType === 'PA' ? 'PA' : 'PA',
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {localError && <div className={styles.errorMessage}>{localError}</div>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !formData.name.trim()}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  Criando...
                </>
              ) : (
                'Criar Torneio'
              )}
            </button>
          </form>

          {/* Preview Section */}
          <div className={styles.previewSection}>
            <PreviewCard tournamentName={formData.name} gameType={formData.gameType} />
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateTournament
