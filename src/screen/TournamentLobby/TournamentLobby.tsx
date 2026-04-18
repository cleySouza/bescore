import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  activeTournamentAtom,
  myTournamentsAtom,
  currentViewAtom,
  showConfigModalAtom,
} from '../../atoms/tournamentAtoms'
import {
  fetchMyTournaments,
  getTournamentParticipants,
  joinTournamentById,
  deleteTournament,
  seedMockParticipants,
} from '../../lib/tournamentService'
import { env } from '../../config/env'
import type { Participant } from '../../atoms/tournamentAtoms'
import type { TournamentSettings } from '../../types/tournament'
import TournamentConfig from '../../components/TournamentConfig'
import ManageParticipantModal, { type ManagedParticipant } from '../TournamentView/components/ManageParticipantModal'
import styles from './TournamentLobby.module.css'

interface ParticipantWithProfile extends Participant {
  profile?: {
    nickname: string | null
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
  const setCurrentView = useSetAtom(currentViewAtom)
  const setShowConfigModal = useSetAtom(showConfigModalAtom)

  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [managedParticipant, setManagedParticipant] = useState<ManagedParticipant | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null)
  const [joiningTournament, setJoiningTournament] = useState(false)

  useEffect(() => {
    if (!tournament) {
      setCurrentView('dashboard')
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
  }, [tournament, setCurrentView, refreshKey])

  if (!tournament || !user) return null

  const isCreator = tournament.creator_id === user.id
  const participantCount = participants.length
  const tournamentSettings = tournament.settings as TournamentSettings | null
  const managedTeamOptions = Array.isArray(tournamentSettings?.selectedTeamNames)
    ? tournamentSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []
  const isAutoTeamMode = (tournamentSettings?.teamAssignMode ?? 'auto') === 'auto'
  const teamShields =
    typeof tournamentSettings?.selectedTeamShields === 'object' && tournamentSettings?.selectedTeamShields
      ? (tournamentSettings.selectedTeamShields as Record<string, string>)
      : {}
  const isPrivate = tournamentSettings?.isPrivate ?? false
  const maxParticipants = tournamentSettings?.maxParticipants ?? null
  const isFull = maxParticipants !== null && participantCount >= maxParticipants
  const isParticipant = tournament.isParticipant ?? participants.some((p) => p.user_id === user.id)
  const isVisitor = !isCreator && !isParticipant
  const isMockSeedEnabled = env.features.enableMockSeed
  const isCreatorAlreadyParticipant = participants.some((p) => p.user_id === tournament.creator_id)
  const seedTargetTotal = Math.max(2, maxParticipants ?? (isCreatorAlreadyParticipant ? participantCount + 1 : participantCount + 2))
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
    setCurrentView('tournament-match')
    fetchMyTournaments(user!.id).then(setMyTournaments).catch(() => {})
  }

  const handleDeleteTournament = async () => {
    if (!window.confirm('⚠️ Esta ação não pode ser desfeita. O torneio será removido permanentemente.')) return
    try {
      await deleteTournament(tournament.id)
      const updated = await fetchMyTournaments(user.id)
      setMyTournaments(updated)
      setActiveTournament(null)
      setCurrentView('dashboard')
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
    setJoinCodeError(null)
    setJoiningTournament(true)
    try {
      await joinTournamentById(tournament.id, user.id, user.email?.split('@')[0] ?? 'Jogador')
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      setJoinCodeError(err instanceof Error ? err.message : 'Erro ao entrar no torneio')
    } finally {
      setJoiningTournament(false)
    }
  }

  // ─── DEV ONLY ──────────────────────────────────────────────────────────────
  const handleSeedParticipants = async () => {
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
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => setCurrentView('dashboard')}>
          <span className={styles.backBtnIcon}>←</span>
          <span>Voltar</span>
        </button>

        <div className={styles.headerContent}>
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
              ⚙️ Configurar Partidas
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
                📋 Copiar Código
              </button>
            </div>
          ) : (
            <div className={styles.participantsList}>
              {participants.map((p, index) => {
                const displayName =
                  p.profile?.nickname ||
                  p.profile?.email ||
                  getMockName(p.id, index)
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
                      ⚙️ Gerenciar
                    </button>
                  )}
                </div>
                )
              })}
            </div>
          )}

          {/* Seed (feature-flag): preenche o lobby até o limite configurado */}
          {isMockSeedEnabled && isCreator && seedMissingCount > 0 && (
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <button
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

          {/* Visitor: join */}
          {isVisitor && (
            <div className={styles.joinSection}>
              {isFull ? (
                <span className={styles.fullBadge}>🔒 Torneio Lotado</span>
              ) : isPrivate ? (
                <>
                  <p className={styles.joinHint}>Torneio privado. Insira o código para participar.</p>
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
                      disabled={joinCode.trim().length === 0 || joiningTournament}
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
                  <button className={styles.joinBtn} disabled={joiningTournament} onClick={handleJoin}>
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
          canEditTeamAssignment={!isAutoTeamMode}
          onClose={() => setManagedParticipant(null)}
          onSaved={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
    </div>
  )
}

export default TournamentLobby
