import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  myTournamentsAtom,
  showConfigModalAtom,
} from '../../atoms/tournamentAtoms'
import { paths } from '../../app/navigation/paths'
import {
  fetchMyTournaments,
  getTournamentById,
  getTournamentParticipants,
  joinTournamentById,
  deleteTournament,
  seedMockParticipants,
  removeParticipantFromTournament,
} from '../../lib/tournamentService'
import { updateParticipantAdmin } from '../../lib/matchService'
import {
  clearPendingCreatorTeamPickSession,
  hasPendingCreatorTeamPickSession,
} from '../../lib/pendingCreatorTeamPick'
import { strapiShieldsMapAtom } from '../../atoms/catalogAtom'
import { profileDisplayName } from '../../lib/profileService'
import { env } from '../../config/env'
import type { Participant } from '../../atoms/tournamentAtoms'
import {
  type TournamentSettings,
  getMergedTeamShieldsMap,
  getTournamentBadgeInitials,
  getTournamentCoverImage,
} from '../../types/tournament'
import TournamentConfig from '../../components/TournamentConfig'
import ManageParticipantModal, { type ManagedParticipant } from '../TournamentView/components/ManageParticipantModal'
import { CatalogTeamPickField, type CatalogClubPick } from '../../components/CatalogTeamPickField/CatalogTeamPickField'
import {
  HiOutlineArrowLeft,
  HiOutlineClipboardDocument,
  HiOutlineCog6Tooth,
} from 'react-icons/hi2'
import styles from './TournamentLobby.module.css'

interface ParticipantWithProfile extends Participant {
  profile?: {
    nickname: string | null
    name?: string | null
    avatar_url: string | null
    email: string
  } | null
}

const MOCK_PLAYER_NAMES = [
  'Bruno Castro',
  'Diego Lima',
  'Rafael Nunes',
  'Matheus Alves',
  'Lucas Moraes',
  'Felipe Rocha',
  'Vinicius Prado',
  'Caio Mendes',
]

function getTeamInitials(name: string | null | undefined) {
  if (!name) return 'TM'
  return name
    .split(/\s+/)
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getMockName(seed: string, index: number): string {
  const raw = `${seed}-${index}`
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) % 2147483647
  }
  return MOCK_PLAYER_NAMES[Math.abs(hash) % MOCK_PLAYER_NAMES.length]
}

function TournamentLobby() {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const navigate = useNavigate()
  const location = useLocation()
  const setShowConfigModal = useSetAtom(showConfigModalAtom)
  const strapiShieldsMap = useAtomValue(strapiShieldsMapAtom)

  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [managedParticipant, setManagedParticipant] = useState<ManagedParticipant | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinTeam, setJoinTeam] = useState('')
  const [joinCatalogClub, setJoinCatalogClub] = useState<CatalogClubPick | null>(null)
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null)
  const [joiningTournament, setJoiningTournament] = useState(false)

  const suppressCreatorTeamPickModal = useRef(false)
  const [showCreatorTeamPickModal, setShowCreatorTeamPickModal] = useState(false)
  const [creatorPickJoinTeam, setCreatorPickJoinTeam] = useState('')
  const [creatorPickCatalog, setCreatorPickCatalog] = useState<CatalogClubPick | null>(null)
  const [creatorPickError, setCreatorPickError] = useState<string | null>(null)
  const [creatorPickSaving, setCreatorPickSaving] = useState(false)

  useEffect(() => {
    if (!tournament) {
      navigate(paths.home, { replace: true })
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const participantsData = await getTournamentParticipants(tournament.id)
        setParticipants(participantsData as ParticipantWithProfile[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tournament, navigate, refreshKey])

  useEffect(() => {
    if (!tournament) return
    if (!joinCatalogClub) return
    const settings = tournament.settings as TournamentSettings | null
    const pre = Array.isArray(settings?.selectedTeamNames)
      ? settings.selectedTeamNames.filter(
          (name): name is string => typeof name === 'string' && name.trim().length > 0
        )
      : []
    if (pre.length > 0) return
    const used = new Set(
      participants
        .map((p) => (p.team_name ?? '').trim())
        .filter((name) => name.length > 0)
    )
    if (used.has(joinCatalogClub.name.trim())) {
      setJoinCatalogClub(null)
    }
  }, [tournament, joinCatalogClub, participants])

  useEffect(() => {
    if (!showCreatorTeamPickModal || !tournament) return
    setCreatorPickJoinTeam('')
    setCreatorPickCatalog(null)
    setCreatorPickError(null)
  }, [showCreatorTeamPickModal, tournament])

  /** Pós-criação com “Vou jogar”: abre escolha de time uma vez (sem bloco Entrar). */
  useEffect(() => {
    if (!tournament || !user || loading) return
    if (suppressCreatorTeamPickModal.current) return
    if (!hasPendingCreatorTeamPickSession(tournament.id)) return
    if (user.id !== tournament.creator_id) {
      clearPendingCreatorTeamPickSession(tournament.id)
      return
    }

    const settings = tournament.settings as TournamentSettings | null
    const pre = Array.isArray(settings?.selectedTeamNames)
      ? settings.selectedTeamNames.filter(
          (name): name is string => typeof name === 'string' && name.trim().length > 0
        )
      : []
    const hasPre = pre.length > 0
    const isAuto = (settings?.teamAssignMode ?? 'auto') === 'auto'
    const isManualPre = hasPre && !isAuto
    const isAutoPre = hasPre && isAuto
    const isLivre = !hasPre

    const me = participants.find((p) => p.user_id === user.id)
    if (!me) return

    const hasTeam = (me.team_name ?? '').trim().length > 0
    const needsPick = (isManualPre || isLivre) && !hasTeam
    if (isAutoPre || !needsPick) {
      clearPendingCreatorTeamPickSession(tournament.id)
      suppressCreatorTeamPickModal.current = false
      setShowCreatorTeamPickModal(false)
      return
    }

    setShowCreatorTeamPickModal(true)
  }, [tournament, user, loading, participants])

  if (!tournament) return null

  const isCreator = !!user && tournament.creator_id === user.id
  const participantCount = participants.length
  const tournamentSettings = tournament.settings as TournamentSettings | null
  const tournamentCoverUrl = getTournamentCoverImage(tournamentSettings)
  const tournamentBadgeInitials = getTournamentBadgeInitials(tournament.name)
  const managedTeamOptions = Array.isArray(tournamentSettings?.selectedTeamNames)
    ? tournamentSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []
  const isAutoTeamMode = (tournamentSettings?.teamAssignMode ?? 'auto') === 'auto'
  const teamShields = getMergedTeamShieldsMap(strapiShieldsMap, tournamentSettings)
  const isPrivate = tournamentSettings?.isPrivate ?? false
  const maxParticipants = tournamentSettings?.maxParticipants ?? null
  const isFull = maxParticipants !== null && participantCount >= maxParticipants
  const predefinedTeams = Array.isArray(tournamentSettings?.selectedTeamNames)
    ? tournamentSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []
  const hasPredefinedTeams = predefinedTeams.length > 0
  const isManualPredefined = hasPredefinedTeams && !isAutoTeamMode
  const isAutoPredefined = hasPredefinedTeams && isAutoTeamMode
  const usedTeams = new Set(
    participants
      .map((p) => (p.team_name ?? '').trim())
      .filter((name) => name.length > 0)
  )
  const availableJoinTeams = predefinedTeams.filter((name) => !usedTeams.has(name))
  const isParticipant =
    !!user && (tournament.isParticipant || participants.some((p) => p.user_id === user.id))
  /** Inclui criador que marcou “Vou jogar” mas ainda não concluiu inscrição no lobby (mesmo bloco dos visitantes). */
  const showJoinSection = !isParticipant
  const isMockSeedEnabled = env.features.enableMockSeed
  const isCreatorAlreadyParticipant = participants.some((p) => p.user_id === tournament.creator_id)
  const seedTargetTotal = Math.max(
    2,
    maxParticipants ?? (isCreatorAlreadyParticipant ? participantCount + 1 : participantCount + 2)
  )
  const seedMissingCount = Math.max(0, seedTargetTotal - participantCount)
  const hasDrawnTeams =
    participants.length > 0 &&
    participants.every((p) => (p.team_name ?? '').trim().length > 0)

  const handleMatchesGenerated = async () => {
    if (tournament) {
      const updated = { ...tournament, status: 'active' }
      setActiveTournament(updated)
      setMyTournaments((prev) => prev.map((t) => (t.id === tournament.id ? { ...t, status: 'active' } : t)))
    }
    setShowConfigModal(false)
    navigate(paths.tournamentMatches(tournament.id))
    if (user) {
      fetchMyTournaments(user.id).then(setMyTournaments).catch(() => {})
    }
  }

  const handleDeleteTournament = async () => {
    if (!user) return
    if (!window.confirm('⚠️ Esta ação não pode ser desfeita. O torneio será removido permanentemente.')) return
    try {
      await deleteTournament(tournament.id)
      const updated = await fetchMyTournaments(user.id)
      setMyTournaments(updated)
      setActiveTournament(null)
      navigate(paths.home)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir torneio')
    }
  }

  const handleJoin = async () => {
    if (!user) return
    if (isPrivate && joinCode.trim().toUpperCase() !== tournament.invite_code.toUpperCase()) {
      setJoinCodeError('Código de convite inválido')
      return
    }

    if (isManualPredefined && availableJoinTeams.length === 0) {
      setJoinCodeError('Não há times disponíveis para este torneio')
      return
    }

    if (isManualPredefined && !joinTeam) {
      setJoinCodeError('Selecione um time para participar')
      return
    }

    if (!hasPredefinedTeams) {
      if (!joinCatalogClub?.name.trim()) {
        setJoinCodeError('Escolha um time no catálogo para participar')
        return
      }
    }

    const joinTeamName = isAutoPredefined
      ? ''
      : isManualPredefined
        ? joinTeam
        : joinCatalogClub!.name.trim()

    setJoinCodeError(null)
    setJoiningTournament(true)
    try {
      await joinTournamentById(tournament.id, user.id, joinTeamName)
      const updated = await getTournamentById(tournament.id, user.id)
      setActiveTournament(updated)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      setJoinCodeError(err instanceof Error ? err.message : 'Erro ao entrar no torneio')
    } finally {
      setJoiningTournament(false)
    }
  }

  const handleSeedParticipants = async () => {
    if (!user) return
    try {
      await seedMockParticipants(tournament.id, seedTargetTotal, tournament.creator_id)
      const updated = await fetchMyTournaments(user.id)
      setMyTournaments(updated)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao injetar participantes'
      alert('❌ Seed falhou: ' + msg)
    }
  }

  const creatorPickTakenNames = participants
    .filter((p) => p.user_id !== user?.id)
    .map((p) => (p.team_name ?? '').trim())
    .filter((n) => n.length > 0)

  const handleCreatorTeamPickConfirm = async () => {
    if (!user) return

    const me = participants.find((p) => p.user_id === user.id)
    if (!me) {
      setCreatorPickError('Participante não encontrado')
      return
    }

    if (isManualPredefined) {
      if (!creatorPickJoinTeam) {
        setCreatorPickError('Selecione um time')
        return
      }
    } else if (!hasPredefinedTeams) {
      if (!creatorPickCatalog?.name.trim()) {
        setCreatorPickError('Escolha um time no catálogo')
        return
      }
    }

    let teamResolved = ''
    if (isManualPredefined) teamResolved = creatorPickJoinTeam
    else teamResolved = creatorPickCatalog!.name.trim()

    setCreatorPickError(null)
    setCreatorPickSaving(true)
    try {
      await updateParticipantAdmin(me.id, { team_name: teamResolved || undefined })
      clearPendingCreatorTeamPickSession(tournament.id)
      setShowCreatorTeamPickModal(false)
      setRefreshKey((prev) => prev + 1)
      const updated = await getTournamentById(tournament.id, user.id)
      setActiveTournament(updated)
    } catch (err) {
      setCreatorPickError(err instanceof Error ? err.message : 'Erro ao salvar time')
    } finally {
      setCreatorPickSaving(false)
    }
  }

  const handleCreatorTeamPickClose = () => {
    suppressCreatorTeamPickModal.current = true
    clearPendingCreatorTeamPickSession(tournament.id)
    setShowCreatorTeamPickModal(false)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(paths.home)}>
          <span className={styles.backBtnIcon}>
            <HiOutlineArrowLeft aria-hidden size={16} strokeWidth={2} />
          </span>
          <span>Voltar</span>
        </button>

        <div className={styles.headerContent}>
          <div className={styles.headerThumb} aria-hidden>
            {tournamentCoverUrl ? (
              <img src={tournamentCoverUrl} alt="" className={styles.headerThumbImg} />
            ) : (
              <span className={styles.headerThumbFallback}>{tournamentBadgeInitials}</span>
            )}
          </div>
          <div className={styles.headerTextBlock}>
            <h1 className={styles.title}>{tournament.name}</h1>
            <span className={styles.gameType}>{tournament.game_type}</span>
          </div>
        </div>

        <span className={styles.statusBadge}>Rascunho</span>
      </header>

      <main className={styles.main}>
        <div className={styles.infoBar}>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Código de Convite</div>
            <code className={styles.codeDisplay}>{tournament.invite_code}</code>
            <small className={styles.infoHint}>Compartilhe para convidar</small>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Participantes</div>
            <div className={styles.participantCount}>{participantCount}{maxParticipants ? ` / ${maxParticipants}` : ''}</div>
          </div>
          {isCreator && participantCount >= 2 && (
            <button className={styles.setupBtn} onClick={() => setShowConfigModal(true)}>
              <HiOutlineCog6Tooth aria-hidden size={18} strokeWidth={2} />
              Configurar Partidas
            </button>
          )}
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <section className={styles.participantsSection}>
          <h2 className={styles.sectionTitle}>Participantes</h2>
          <p className={styles.sectionSubtitle}>
            {hasDrawnTeams
              ? 'Times sorteados e prontos para iniciar as partidas.'
              : 'Aguardando sorteio de times para iniciar o campeonato.'}
          </p>

          {loading ? (
            <div className={styles.loadingMessage}>Carregando...</div>
          ) : participantCount < 2 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👥</div>
              <p className={styles.emptyText}>Aguardando oponentes...</p>
              <p className={styles.emptySubtext}>
                Código: <strong>{tournament.invite_code}</strong>
              </p>
              <button
                className={styles.copyBtn}
                onClick={() => navigator.clipboard.writeText(tournament.invite_code)}
              >
                <HiOutlineClipboardDocument aria-hidden size={16} strokeWidth={2} />
                Copiar Código
              </button>
            </div>
          ) : (
            <div className={styles.participantsList}>
              {participants.map((p, index) => {
                const displayName = p.profile ? profileDisplayName(p.profile) : getMockName(p.id, index)
                const teamName = (p.team_name ?? '').trim()
                const showTeam = hasDrawnTeams && teamName.length > 0
                const teamShield = showTeam ? teamShields[teamName] : ''

                return (
                <div key={p.id} className={styles.participantCard}>
                  <div className={styles.participantTopRow}>
                    {p.profile?.avatar_url ? (
                      <img src={p.profile.avatar_url} alt="" className={styles.avatar} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>{displayName.charAt(0).toUpperCase()}</div>
                    )}
                    <div className={styles.participantInfo}>
                      <div className={styles.teamName}>
                        {showTeam ? (
                          <span className={styles.teamLine}>
                            {teamShield ? (
                              <span className={styles.teamCrest}>
                                <img
                                  src={teamShield}
                                  alt={teamName}
                                  className={styles.teamCrestImg}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              </span>
                            ) : (
                              <span className={styles.teamCrest}>{getTeamInitials(teamName)}</span>
                            )}
                            <span className={styles.teamText}>{teamName}</span>
                          </span>
                        ) : (
                          'Aguardando sorteio'
                        )}
                      </div>
                      <small className={styles.userName}>
                        {displayName}
                      </small>
                    </div>
                    {p.user_id === tournament.creator_id && (
                      <span className={styles.creatorBadge}>👑</span>
                    )}
                  </div>

                  {isCreator && (
                    <button
                      className={styles.manageBtn}
                      onClick={() => setManagedParticipant(p as ManagedParticipant)}
                    >
                      <HiOutlineCog6Tooth aria-hidden size={14} strokeWidth={2} />
                      Gerenciar
                    </button>
                  )}
                </div>
                )
              })}
            </div>
          )}

          {isMockSeedEnabled && isCreator && seedMissingCount > 0 && (
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <button
                type="button"
                onClick={handleSeedParticipants}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#2d6a2d',
                  color: '#fff',
                  border: '1px dashed #5ab55a',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🌱 Injetar {seedMissingCount} Jogador{seedMissingCount > 1 ? 'es' : ''}
              </button>
            </div>
          )}

          {/* Quem ainda não é participante (visitante ou organizador antes de entrar). */}
          {showJoinSection && (
            <div className={styles.joinSection}>
              {!user ? (
                <>
                  <p className={styles.joinHint}>Entre na sua conta para participar deste torneio.</p>
                  <button
                    type="button"
                    className={styles.joinBtn}
                    onClick={() => {
                      const target = `${location.pathname}${location.search}`
                      navigate(`${paths.login}?redirect=${encodeURIComponent(target)}`)
                    }}
                  >
                    Entrar ou criar conta
                  </button>
                </>
              ) : isFull ? (
                <span className={styles.fullBadge}>🔒 Torneio Lotado</span>
              ) : isPrivate ? (
                <>
                  <p className={styles.joinHint}>Torneio privado. Insira o código para participar.</p>
                  {isManualPredefined && (
                    <div className={styles.joinCodeRow}>
                      <select
                        className={`${styles.joinCodeInput} ${styles.joinTeamSelect}`}
                        value={joinTeam}
                        onChange={(e) => { setJoinTeam(e.target.value); setJoinCodeError(null) }}
                        disabled={availableJoinTeams.length === 0 || joiningTournament}
                      >
                        <option value="">Selecione seu time...</option>
                        {availableJoinTeams.map((team) => (
                          <option key={team} value={team}>
                            {team}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {isAutoPredefined && (
                    <p className={styles.joinHint}>Os times serão atribuídos automaticamente pelo organizador.</p>
                  )}
                  {!hasPredefinedTeams && (
                    <div className={styles.joinCodeRow}>
                      <CatalogTeamPickField
                        value={joinCatalogClub}
                        onChange={(c) => { setJoinCatalogClub(c); setJoinCodeError(null) }}
                        takenTeamNames={Array.from(usedTeams)}
                        disabled={joiningTournament}
                        triggerClassName={styles.joinCatalogTrigger}
                        placeholder="Escolher clube no catálogo…"
                      />
                    </div>
                  )}
                  <div className={styles.joinCodeRow}>
                    <input
                      className={styles.joinCodeInput}
                      placeholder="Código de convite"
                      value={joinCode}
                      onChange={(e) => { setJoinCode(e.target.value); setJoinCodeError(null) }}
                      maxLength={6}
                    />
                    <button
                      className={styles.joinBtn}
                      disabled={
                        joinCode.trim().length === 0 ||
                        joiningTournament ||
                        (isManualPredefined && !joinTeam) ||
                        (!hasPredefinedTeams && !joinCatalogClub)
                      }
                      onClick={handleJoin}
                    >
                      {joiningTournament ? 'Entrando...' : 'Entrar'}
                    </button>
                  </div>
                  {joinCodeError && <span className={styles.joinError}>{joinCodeError}</span>}
                </>
              ) : (
                <>
                  <p className={styles.joinHint}>Torneio aberto. Clique para participar!</p>
                  {isManualPredefined && (
                    <div className={styles.joinCodeRow}>
                      <select
                        className={`${styles.joinCodeInput} ${styles.joinTeamSelect}`}
                        value={joinTeam}
                        onChange={(e) => { setJoinTeam(e.target.value); setJoinCodeError(null) }}
                        disabled={availableJoinTeams.length === 0 || joiningTournament}
                      >
                        <option value="">Selecione seu time...</option>
                        {availableJoinTeams.map((team) => (
                          <option key={team} value={team}>
                            {team}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {isAutoPredefined && (
                    <p className={styles.joinHint}>Os times serão atribuídos automaticamente pelo organizador.</p>
                  )}
                  {!hasPredefinedTeams && (
                    <div className={styles.joinCodeRow}>
                      <CatalogTeamPickField
                        value={joinCatalogClub}
                        onChange={(c) => { setJoinCatalogClub(c); setJoinCodeError(null) }}
                        takenTeamNames={Array.from(usedTeams)}
                        disabled={joiningTournament}
                        triggerClassName={styles.joinCatalogTrigger}
                        placeholder="Escolher clube no catálogo…"
                      />
                    </div>
                  )}
                  <button
                    className={styles.joinBtn}
                    disabled={
                      joiningTournament ||
                      (isManualPredefined && !joinTeam) ||
                      (!hasPredefinedTeams && !joinCatalogClub)
                    }
                    onClick={handleJoin}
                  >
                    {joiningTournament ? 'Entrando...' : '🎮 Entrar no Torneio'}
                  </button>
                  {joinCodeError && <span className={styles.joinError}>{joinCodeError}</span>}
                </>
              )}
            </div>
          )}

          {/* Creator danger zone */}
          {isCreator && (
            <div className={styles.dangerZone}>
              <div className={styles.dangerZoneText}>
                <h5 className={styles.dangerZoneTitle}>🚨 Zona de Perigo</h5>
                <p className={styles.dangerZoneDesc}>Excluir este torneio remove participantes e histórico.</p>
              </div>
              <button className={styles.dangerBtn} onClick={handleDeleteTournament}>
                Apagar Torneio
              </button>
            </div>
          )}
        </section>
      </main>

      {showCreatorTeamPickModal && user && (
        <div className={styles.creatorPickOverlay} onClick={handleCreatorTeamPickClose}>
          <div
            className={styles.creatorPickModal}
            role="dialog"
            aria-labelledby="creator-team-pick-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="creator-team-pick-title" className={styles.creatorPickTitle}>
              Escolha seu time
            </h3>
            <p className={styles.creatorPickHint}>Finalize sua inscrição como organizador que vai jogar.</p>

            {isManualPredefined && (
              <div className={styles.joinCodeRow}>
                <select
                  className={`${styles.joinCodeInput} ${styles.joinTeamSelect}`}
                  value={creatorPickJoinTeam}
                  onChange={(e) => { setCreatorPickJoinTeam(e.target.value); setCreatorPickError(null) }}
                  disabled={creatorPickSaving || availableJoinTeams.length === 0}
                >
                  <option value="">Selecione seu time...</option>
                  {availableJoinTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!hasPredefinedTeams && (
              <div className={styles.joinCodeRow}>
                <CatalogTeamPickField
                  value={creatorPickCatalog}
                  onChange={(c) => { setCreatorPickCatalog(c); setCreatorPickError(null) }}
                  takenTeamNames={creatorPickTakenNames}
                  disabled={creatorPickSaving}
                  triggerClassName={styles.joinCatalogTrigger}
                  placeholder="Escolher clube no catálogo…"
                />
              </div>
            )}
            {creatorPickError && <span className={styles.joinError}>{creatorPickError}</span>}
            <div className={styles.creatorPickActions}>
              <button
                type="button"
                className={styles.creatorPickCancelBtn}
                onClick={handleCreatorTeamPickClose}
                disabled={creatorPickSaving}
              >
                Agora não
              </button>
              <button
                type="button"
                className={styles.joinBtn}
                disabled={
                  creatorPickSaving ||
                  (isManualPredefined && !creatorPickJoinTeam) ||
                  (!hasPredefinedTeams && !creatorPickCatalog)
                }
                onClick={() => void handleCreatorTeamPickConfirm()}
              >
                {creatorPickSaving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TournamentConfig
        participantCount={participantCount}
        participants={participants.map((participant) => ({
          ...participant,
          user_id: participant.user_id ?? '',
        }))}
        onClose={() => setShowConfigModal(false)}
        onMatchesGenerated={handleMatchesGenerated}
      />

      {managedParticipant && (
        <ManageParticipantModal
          participant={managedParticipant}
          showScoreAdjustments={false}
          teamOptions={managedTeamOptions}
          excludeCatalogTeamNames={participants
            .filter((p) => p.id !== managedParticipant.id)
            .map((p) => (p.team_name ?? '').trim())
            .filter((n) => n.length > 0)}
          canEditTeamAssignment={
            !(tournament.status === 'draft' && isAutoPredefined)
          }
          allowRemoveParticipant={
            !!user &&
            isCreator &&
            tournament.status === 'draft' &&
            !!managedParticipant.user_id &&
            managedParticipant.user_id !== tournament.creator_id
          }
          onRemoveParticipant={async () => {
            await removeParticipantFromTournament(tournament.id, managedParticipant.id)
            const updated = await fetchMyTournaments(user!.id)
            setMyTournaments(updated)
          }}
          onClose={() => setManagedParticipant(null)}
          onSaved={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
    </div>
  )
}

export default TournamentLobby
