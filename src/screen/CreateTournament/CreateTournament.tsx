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
import { PreviewCard } from './components'
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
  const [tournamentImage, setTournamentImage] = useState<string | null>(null)

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

  const handleImageChange = (file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      setTournamentImage(reader.result as string)
    }
    reader.readAsDataURL(file)
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
        <div className={styles.contentMain}>
          <div className={styles.content}>
            {/* Form Section - Left */}
            <div className={styles.formSectionShell}>
              <form id="create-form" onSubmit={handleSubmit} className={styles.formSection}>
                {/* Liga/Torneio Input */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Liga/torneio</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Selecione uma liga/torneio"
                    className={styles.fieldInput}
                    disabled={loading}
                    maxLength={100}
                    required
                  />
                </div>

                {/* Formato Select */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Formato</label>
                  <select
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                    className={styles.fieldSelect}
                    disabled={loading}
                  >
                    <option value="">Selecione um formato</option>
                    <option value="liga">Liga</option>
                    <option value="mata-mata">Mata-mata</option>
                    <option value="grupos">Grupos</option>
                  </select>
                </div>

                {/* Jogo Select */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Jogo</label>
                  <select
                    name="gameType"
                    value={formData.gameType}
                    onChange={handleInputChange}
                    className={styles.fieldSelect}
                    disabled={loading}
                  >
                    <option value="">Selecione um jogo</option>
                    <option value="eFootball">⚽ eFootball 2025</option>
                    <option value="LoL">🎮 League of Legends</option>
                    <option value="CS2">🔫 Counter-Strike 2</option>
                    <option value="Valorant">🔴 Valorant</option>
                  </select>
                </div>

                {/* Participants Row - 3 fields inline */}
                <div className={styles.participantsRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>N. Participantes</label>
                    <select
                      name="maxParticipants"
                      value={formData.maxParticipants}
                      onChange={handleInputChange}
                      className={styles.fieldSelect}
                      disabled={loading}
                    >
                      <option value="4">4</option>
                      <option value="8">8</option>
                      <option value="16">16</option>
                      <option value="32">32</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Participantes</label>
                    <input
                      type="text"
                      value={formData.maxParticipants}
                      className={`${styles.fieldInput} ${styles.disabledInput}`}
                      disabled
                      readOnly
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Times</label>
                    <input
                      type="text"
                      value={formData.maxParticipants > 8 ? Math.ceil(formData.maxParticipants / 4) : 2}
                      className={`${styles.fieldInput} ${styles.disabledInput}`}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                {/* Toggles Section */}
                <div className={styles.togglesSection}>
                  {/* TIMES */}
                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleGroupLabel}>TIMES</div>
                    <div className={styles.togglePills}>
                      <button
                        type="button"
                        className={`${styles.togglePill} ${formData.autoTeams ? styles.active : ''}`}
                        onClick={() => handleToggle('autoTeams')}
                      >
                        <span className={styles.toggleCircle} />
                        AUTO
                      </button>
                      <button
                        type="button"
                        className={`${styles.togglePill} ${!formData.autoTeams ? styles.active : ''}`}
                        onClick={() => handleToggle('autoTeams')}
                      >
                        <span className={styles.toggleCircle} />
                        NÃO
                      </button>
                    </div>
                  </div>

                  {/* PRIVADO */}
                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleGroupLabel}>PRIVADO</div>
                    <div className={styles.togglePills}>
                      <button
                        type="button"
                        className={`${styles.togglePill} ${!formData.isPrivate ? styles.active : ''}`}
                        onClick={() => handleToggle('isPrivate')}
                      >
                        <span className={styles.toggleCircle} />
                        NÃO
                      </button>
                      <button
                        type="button"
                        className={`${styles.togglePill} ${formData.isPrivate ? styles.active : ''}`}
                        onClick={() => handleToggle('isPrivate')}
                      >
                        <span className={styles.toggleCircle} />
                        ADM
                      </button>
                    </div>
                  </div>

                  {/* TIPO SORTEIO */}
                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleGroupLabel}>TIPO SORTEIO</div>
                    <select className={styles.fieldSelect} disabled={loading}>
                      <option>ADM</option>
                    </select>
                  </div>

                  {/* TIPO */}
                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleGroupLabel}>TIPO</div>
                    <div className={styles.togglePills}>
                      <button
                        type="button"
                        className={`${styles.togglePill} ${formData.matchType === 'PA' ? styles.active : ''}`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            matchType: prev.matchType === 'PA' ? 'PA' : 'PA',
                          }))
                        }
                      >
                        <span className={styles.toggleCircle} />
                        PA
                      </button>
                    </div>
                  </div>
                </div>

              </form>
            </div>

            {/* Preview Section - Right */}
            <div className={styles.previewSectionShell}>
              <div className={styles.previewSection}>
                <PreviewCard
                  tournamentName={formData.name}
                  gameType={formData.gameType}
                  tournamentImage={tournamentImage}
                  onImageChange={handleImageChange}
                />
              </div>
            </div>
          </div>
          {/* Submit Button — fora do grid, centralizado */}
          <div className={styles.submitRow}>
            {localError && <div className={styles.errorMessage}>{localError}</div>}
            <button
              type="submit"
              form="create-form"
              className={styles.submitBtn}
              // disabled={loading || !formData.name.trim()}
            >
              {loading ? <span className={styles.spinner} /> : 'Criar Torneio'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateTournament
