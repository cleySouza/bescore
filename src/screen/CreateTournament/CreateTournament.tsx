import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  myTournamentsAtom,
  tournamentsErrorAtom,
  activeTournamentAtom,
  currentViewAtom,
  recentPlayersAtom,
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
  const recentPlayers = useAtomValue(recentPlayersAtom)

  const [formData, setFormData] = useState({
    name: '',
    format: 'liga',
    gameType: 'eFootball',
    maxParticipants: 8,
    isPrivate: false,
    autoTeams: true,
    adminDraft: true,    // true = admin escolhe times; false = participante escolhe na inscrição
    adminScores: true,   // true = só admin lança placares; false = jogadores lançam próprias partidas
    matchType: 'PA',
    willPlay: true,
  })
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tournamentImage, setTournamentImage] = useState<string | null>(null)
  const [invitedPlayers, setInvitedPlayers] = useState<string[]>([])

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

  const handleParticipantsInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      setFormData((prev) => ({ ...prev, maxParticipants: 0 }))
      return
    }
    const parsed = parseInt(raw)
    if (!isNaN(parsed) && parsed >= 0) {
      setFormData((prev) => ({ ...prev, maxParticipants: parsed }))
    }
  }

  const handleParticipantsBlur = () => {
    setFormData((prev) => ({
      ...prev,
      maxParticipants: Math.max(2, prev.maxParticipants),
    }))
  }

  const stepParticipants = (delta: number) => {
    setFormData((prev) => ({
      ...prev,
      maxParticipants: Math.max(2, prev.maxParticipants + delta),
    }))
  }

  const handleToggle = (key: keyof typeof formData) => {
    if (typeof formData[key] === 'boolean') {
      setFormData((prev) => ({
        ...prev,
        [key]: !prev[key],
      }))
    }
  }

  const toggleInvite = (playerId: string) => {
    setInvitedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    )
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
      autoTeams: true,
      adminDraft: true,
      adminScores: true,
      matchType: 'PA',
      willPlay: true,
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
        autoTeams: true,
        adminDraft: true,
        adminScores: true,
        matchType: 'PA',
        willPlay: true,
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
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => stepParticipants(-1)}
                        disabled={loading || formData.maxParticipants <= 2}
                        aria-label="Diminuir participantes"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className={styles.stepperInput}
                        value={formData.maxParticipants || ''}
                        onChange={handleParticipantsInput}
                        onBlur={handleParticipantsBlur}
                        disabled={loading}
                        min={2}
                      />
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => stepParticipants(1)}
                        disabled={loading}
                        aria-label="Aumentar participantes"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Participantes</label>
                    <input
                      type="text"
                      value={
                        formData.willPlay
                          ? formData.maxParticipants
                          : `${formData.maxParticipants} vagas`
                      }
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
                    <button
                      type="button"
                      className={`${styles.slideToggle} ${formData.autoTeams ? styles.active : ''}`}
                      onClick={() => handleToggle('autoTeams')}
                    >
                      <span className={styles.slideKnob} />
                      <span className={styles.slideLabel}>
                        {formData.autoTeams ? 'AUTO' : 'MANUAL'}
                      </span>
                    </button>
                  </div>

                  {/* PRIVADO */}
                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleGroupLabel}>ACESSO</div>
                    <button
                      type="button"
                      className={`${styles.slideToggle} ${formData.isPrivate ? styles.active : ''}`}
                      onClick={() => handleToggle('isPrivate')}
                    >
                      <span className={styles.slideKnob} />
                      <span className={styles.slideLabel}>
                        {formData.isPrivate ? 'PRIVADO' : 'ABERTO'}
                      </span>
                    </button>
                  </div>

                  {/* TIPO SORTEIO */}
                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleGroupLabel}>SORTEIO</div>
                    <button
                      type="button"
                      className={`${styles.slideToggle} ${formData.adminDraft ? styles.active : ''}`}
                      onClick={() => handleToggle('adminDraft')}
                    >
                      <span className={styles.slideKnob} />
                      <span className={styles.slideLabel}>
                        {formData.adminDraft ? 'ADMIN' : 'LIVRE'}
                      </span>
                    </button>
                  </div>

                  {/* TIPO — quem lança placares */}
                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleGroupLabel}>PLACARES</div>
                    <button
                      type="button"
                      className={`${styles.slideToggle} ${formData.adminScores ? styles.active : ''}`}
                      onClick={() => handleToggle('adminScores')}
                    >
                      <span className={styles.slideKnob} />
                      <span className={styles.slideLabel}>
                        {formData.adminScores ? 'ADMIN' : 'JOGAD.'}
                      </span>
                    </button>
                  </div>

                  {/* VOU JOGAR — span full width */}
                  <div className={`${styles.toggleGroup} ${styles.toggleGroupFull}`}>
                    <div className={styles.toggleGroupLabel}>VOU JOGAR</div>
                    <button
                      type="button"
                      className={`${styles.slideToggle} ${formData.willPlay ? styles.active : ''}`}
                      onClick={() => handleToggle('willPlay')}
                    >
                      <span className={styles.slideKnob} />
                      <span className={styles.slideLabel}>
                        {formData.willPlay ? 'SIM' : 'NÃO'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* CONVIDAR RECENTES */}
                <div className={styles.recentSection}>
                  <div className={styles.recentLabel}>CONVIDAR RECENTES</div>
                  {recentPlayers.length === 0 ? (
                    <p className={styles.recentEmpty}>
                      Seus jogadores recentes aparecerão aqui.
                    </p>
                  ) : (
                    <div className={styles.recentList}>
                      {recentPlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          className={`${styles.recentPill} ${
                            invitedPlayers.includes(player.id) ? styles.recentPillSelected : ''
                          }`}
                          onClick={() => toggleInvite(player.id)}
                          aria-pressed={invitedPlayers.includes(player.id)}
                        >
                          <span className={styles.recentAvatar}>
                            {player.avatar ? (
                              <img src={player.avatar} alt={player.name} />
                            ) : (
                              player.name.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className={styles.recentName}>{player.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {invitedPlayers.length > 0 && (
                    <p className={styles.recentCount}>
                      {invitedPlayers.length} jogador{invitedPlayers.length > 1 ? 'es' : ''} pré-selecionado{invitedPlayers.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

              </form>
            </div>

            {/* Preview Section - Right */}
            <div className={styles.previewSectionShell}>
              <div className={styles.previewSection}>
                <PreviewCard
                  tournamentName={formData.name}
                  gameType={formData.gameType}
                  willPlay={formData.willPlay}
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
