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
  const isPrivate = tournamentSettings?.isPrivate ?? false
  const maxParticipants = tournamentSettings?.maxParticipants ?? null
  const isFull = maxParticipants !== null && participantCount >= maxParticipants
  const isParticipant = tournament.isParticipant ?? participants.some((p) => p.user_id === user.id)
  const isVisitor = !isCreator && !isParticipant

  const handleMatchesGenerated = async () => {
    if (tournament) {
      setActiveTournament({ ...tournament, status: 'active' })
    }
    setShowConfigModal(false)
    setCurrentView('tournament-match')
    fetchMyTournaments(user.id).then(setMyTournaments).catch(() => {})
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
      await seedMockParticipants(tournament.id)
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
          ← Voltar
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{tournament.name}</h1>
          <span className={styles.gameType}>{tournament.game_type}</span>
          <span className={styles.statusBadge}>📝 Rascunho</span>
        </div>
        <div className={styles.spacer} />
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
              {participants.map((p) => (
                <div key={p.id} className={styles.participantCard}>
                  {p.profile?.avatar_url ? (
                    <img src={p.profile.avatar_url} alt="" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>👤</div>
                  )}
                  <div className={styles.participantInfo}>
                    <div className={styles.teamName}>{p.team_name || 'Sem time'}</div>
                    <small className={styles.userName}>
                      {p.profile?.nickname || p.profile?.email || 'Usuário'}
                    </small>
                  </div>
                  {p.user_id === tournament.creator_id && (
                    <span className={styles.creatorBadge}>👑</span>
                  )}
                  {isCreator && (
                    <button
                      className={styles.manageBtn}
                      onClick={() => setManagedParticipant(p as ManagedParticipant)}
                    >
                      ⚙️
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* DEV: Seed */}
          {isCreator && participantCount < 2 && (
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
                🌱 Injetar 5 Jogadores (Dev)
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
              <h5 className={styles.dangerZoneTitle}>🚨 Zona de Perigo</h5>
              <button className={styles.dangerBtn} onClick={handleDeleteTournament}>
                Apagar Torneio
              </button>
            </div>
          )}
        </section>
      </main>

      <TournamentConfig
        participantCount={participantCount}
        participants={participants}
        onClose={() => setShowConfigModal(false)}
        onMatchesGenerated={handleMatchesGenerated}
      />

      {managedParticipant && (
        <ManageParticipantModal
          participant={managedParticipant}
          onClose={() => setManagedParticipant(null)}
          onSaved={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
    </div>
  )
}

export default TournamentLobby
