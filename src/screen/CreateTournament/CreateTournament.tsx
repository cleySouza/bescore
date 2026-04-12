import { useState, useEffect, useRef } from 'react'
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
import { PreviewCard, TeamSelectModal } from './components'
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
    teamNames: '',
    selectedTeamIds: [] as string[],
    playoffCutoff: 'top4' as 'top4' | 'top2',
  })
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tournamentImage, setTournamentImage] = useState<string | null>(null)
  const [invitedPlayers, setInvitedPlayers] = useState<string[]>([])
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [selectedTeamsPreview, setSelectedTeamsPreview] = useState<
    { id: string; name: string; logo: string; color: string }[]
  >([])
  const [successData, setSuccessData] = useState<{ name: string; inviteCode: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  if (!user) {
    return null
  }

  const effectiveMin = formData.format === 'campeonato'
    ? (formData.playoffCutoff === 'top4' ? 6 : 4)
    : 2

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
      maxParticipants: Math.max(effectiveMin, prev.maxParticipants),
    }))
  }

  const stepParticipants = (delta: number) => {
    if (delta < 0 && formData.maxParticipants === formData.selectedTeamIds.length) return
    setFormData((prev) => ({
      ...prev,
      maxParticipants: Math.max(effectiveMin, prev.maxParticipants + delta),
    }))
  }

  const handleToggle = (key: keyof typeof formData) => {
    if (typeof formData[key] === 'boolean') {
      const newValue = !formData[key]
      if (key === 'adminDraft' && !newValue && formData.selectedTeamIds.length > 0) {
        const confirmed = window.confirm(
          'Mudar para o modo LIVRE removerá os times já selecionados. Deseja continuar?'
        )
        if (!confirmed) return
        setFormData((prev) => ({ ...prev, [key]: newValue, selectedTeamIds: [] }))
        setSelectedTeamsPreview([])
      } else if (key === 'adminDraft' && !newValue) {
        setFormData((prev) => ({ ...prev, [key]: newValue, selectedTeamIds: [] }))
        setSelectedTeamsPreview([])
      } else {
        setFormData((prev) => ({ ...prev, [key]: newValue }))
      }
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

  const handleCopy = () => {
    if (!successData) return
    navigator.clipboard.writeText(successData.inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Silently ignore — user can copy manually
    })
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    redirectTimerRef.current = setTimeout(() => setCurrentView('tournament'), 1500)
  }

  const handleShareClick = () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    redirectTimerRef.current = setTimeout(() => setCurrentView('tournament'), 1500)
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
      teamNames: '',
      selectedTeamIds: [],
      playoffCutoff: 'top4',
    })
    setLocalError(null)
    setSuccess(false)
    setSelectedTeamsPreview([])
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

    if (formData.format === 'campeonato' && formData.maxParticipants < effectiveMin) {
      setLocalError(
        formData.playoffCutoff === 'top4'
          ? 'Mínimo de 6 jogadores para gerar semifinais.'
          : 'Mínimo de 4 jogadores para este formato.'
      )
      return
    }

    setLoading(true)

    try {
      // Criar torneio
      const newTournament = await createTournament(formData.name, user.id, formData.gameType)
      setSuccessData({ name: formData.name, inviteCode: newTournament.invite_code ?? '' })
      setSuccess(true)

      // Recarregar lista de torneios
      const tournaments = await fetchMyTournaments(user.id)
      setMyTournaments(tournaments)

      // Buscar o torneio com detalhes e setar como ativo
      const tournamentWithDetails = await getTournamentById(newTournament.id, user.id)
      setActiveTournament(tournamentWithDetails)

      // Redirecionar após 3s (ou 1.5s se o usuário interagiu com os botões de compartilhar)
      redirectTimerRef.current = setTimeout(() => {
        setCurrentView('tournament')
      }, 3000)

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
        teamNames: '',
        selectedTeamIds: [],
        playoffCutoff: 'top4',
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

  const whatsappUrl = successData
    ? `https://wa.me/?text=${encodeURIComponent(
        `🏆 Participe do torneio *${successData.name}* no beScore!\n\nCódigo de convite: *${successData.inviteCode}*`
      )}`
    : '#'

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
          <div className={styles.successIconLarge}>🏆</div>
          <h2 className={styles.successTitle}>{successData?.name ?? 'Torneio'}</h2>
          <p className={styles.successSubtitle}>Torneio criado com sucesso!</p>

          <div className={styles.inviteCard}>
            <span className={styles.inviteLabel}>Código de Convite</span>
            <span className={styles.inviteCode}>{successData?.inviteCode}</span>
            <span className={styles.inviteHint}>Compartilhe com seus amigos para eles entrarem</span>
          </div>

          <div className={styles.successActions}>
            <button
              type="button"
              className={`${styles.actionBtn}${copied ? ` ${styles.actionBtnCopied}` : ''}`}
              onClick={handleCopy}
            >
              {copied ? '✓ Copiado!' : '📋 Copiar código'}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappBtn}
              onClick={handleShareClick}
            >
              📲 Convidar pelo WhatsApp
            </a>
          </div>

          <small className={styles.redirectHint}>Entrando no torneio em instantes…</small>
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
                    <option value="campeonato">Campeonato</option>
                  </select>
                </div>

                {/* Fase Final — só visível quando format === 'campeonato' */}
                <div className={`${styles.collapsibleSection}${formData.format !== 'campeonato' ? ` ${styles.collapsed}` : ''}`}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Fase Final</label>
                    <div className={styles.pillSelect}>
                      <button
                        type="button"
                        className={`${styles.pillOption}${formData.playoffCutoff === 'top4' ? ` ${styles.pillOptionActive}` : ''}`}
                        onClick={() => setFormData((prev) => ({ ...prev, playoffCutoff: 'top4' }))}
                        disabled={loading || formData.format !== 'campeonato'}
                        tabIndex={formData.format === 'campeonato' ? 0 : -1}
                      >
                        TOP 4
                        <span className={styles.pillOptionSub}>Semi + Final</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.pillOption}${formData.playoffCutoff === 'top2' ? ` ${styles.pillOptionActive}` : ''}`}
                        onClick={() => setFormData((prev) => ({ ...prev, playoffCutoff: 'top2' }))}
                        disabled={loading || formData.format !== 'campeonato'}
                        tabIndex={formData.format === 'campeonato' ? 0 : -1}
                      >
                        TOP 2
                        <span className={styles.pillOptionSub}>Final Direta</span>
                      </button>
                    </div>
                    {formData.maxParticipants < effectiveMin && (
                      <span className={styles.stepperHint}>
                        {formData.playoffCutoff === 'top4'
                          ? 'Mínimo de 6 jogadores para gerar semifinais.'
                          : 'Mínimo de 4 jogadores para este formato.'}
                      </span>
                    )}
                  </div>
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

                {/* Participants Row */}
                <div className={styles.participantsRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>N. Participantes</label>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => stepParticipants(-1)}
                        disabled={loading || formData.maxParticipants <= effectiveMin || formData.maxParticipants === formData.selectedTeamIds.length}
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
                    {formData.adminDraft && formData.maxParticipants === formData.selectedTeamIds.length && formData.selectedTeamIds.length > 0 && (
                      <span className={styles.stepperHint}>Remova times da lista para reduzir o número de participantes</span>
                    )}
                  </div>

                  <div className={`${styles.fieldGroup} ${styles.collapsibleSection}${!formData.adminDraft ? ` ${styles.collapsed}` : ''}`}>
                    <label className={styles.fieldLabel}>Times</label>
                    <button
                      type="button"
                      className={`${styles.fieldInput} ${styles.teamsPickerBtn}`}
                      onClick={() => setShowTeamModal(true)}
                      disabled={loading || !formData.adminDraft}
                      tabIndex={formData.adminDraft ? 0 : -1}
                    >
                      {selectedTeamsPreview.length > 0 ? (
                        <span className={styles.teamsBadgeList}>
                          {(selectedTeamsPreview.length > 8
                            ? selectedTeamsPreview.slice(0, 7)
                            : selectedTeamsPreview
                          ).map((team) => (
                            <span
                              key={team.id}
                              className={styles.teamsBadge}
                              style={{ backgroundColor: team.color }}
                              title={team.name}
                            >
                              <img
                                src={team.logo}
                                alt={team.name}
                                className={styles.teamsBadgeImg}
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                              />
                            </span>
                          ))}
                          {selectedTeamsPreview.length > 8 && (
                            <span className={styles.teamsBadgeOverflow}>
                              +{selectedTeamsPreview.length - 7}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className={styles.teamsPickerPlaceholder}>Escolher times…</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Toggles Section */}
                <div className={styles.togglesSection}>
                  {/* TIMES */}
                  <div className={`${styles.toggleGroup} ${styles.collapsibleSection}${!formData.adminDraft ? ` ${styles.collapsed}` : ''}`}>
                    <div className={styles.toggleGroupLabel}>TIMES</div>
                    <button
                      type="button"
                      className={`${styles.slideToggle} ${formData.autoTeams ? styles.active : ''}`}
                      onClick={() => handleToggle('autoTeams')}
                      disabled={!formData.adminDraft}
                      tabIndex={formData.adminDraft ? 0 : -1}
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
                    <div className={styles.toggleGroupLabel}>ESCOLHA</div>
                    <button
                      type="button"
                      className={`${styles.slideToggle} ${formData.adminDraft ? styles.active : ''}`}
                      onClick={() => handleToggle('adminDraft')}
                    >
                      <span className={styles.slideKnob} />
                      <span className={styles.slideLabel}>
                        {formData.adminDraft ? 'DEFINIR' : 'LIVRE'}
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
                  adminDraft={formData.adminDraft}
                  autoTeams={formData.autoTeams}
                  format={formData.format}
                  playoffCutoff={formData.playoffCutoff}
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

      {showTeamModal && (
        <TeamSelectModal
          selectedIds={formData.selectedTeamIds}
          maxTeams={formData.maxParticipants}
          onConfirm={(clubs) => {
            setSelectedTeamsPreview(clubs)
            setFormData((prev) => ({ ...prev, selectedTeamIds: clubs.map((c) => c.id) }))
            setShowTeamModal(false)
          }}
          onClose={() => setShowTeamModal(false)}
        />
      )}
    </div>
  )
}

export default CreateTournament
