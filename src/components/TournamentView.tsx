import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../atoms/sessionAtom'
import { activeTournamentAtom, currentViewAtom } from '../atoms/tournamentAtoms'
import { getTournamentParticipants } from '../lib/tournamentService'
import type { Participant } from '../atoms/tournamentAtoms'
import styles from './TournamentView.module.css'

interface ParticipantWithProfile extends Participant {
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

interface TournamentViewProps {
  onBackToDashboard: () => void
}

function TournamentView({ onBackToDashboard: _onBackToDashboard }: TournamentViewProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const setCurrentView = useSetAtom(currentViewAtom)

  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tournament) {
      setCurrentView('dashboard')
      return
    }

    const loadParticipants = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getTournamentParticipants(tournament.id)
        setParticipants(data as ParticipantWithProfile[])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar participantes'
        setError(message)
        console.error('Erro:', err)
      } finally {
        setLoading(false)
      }
    }

    loadParticipants()
  }, [tournament, setCurrentView])

  if (!tournament || !user) {
    return null
  }

  const isCreator = tournament.creator_id === user.id
  const participantCount = participants.length

  const handleSetupMatches = () => {
    console.log('Setup matches para torneio:', tournament.id)
    // Sprint 3: Implementar configuração de partidas
    alert('Sprint 3: Configuração de partidas virá aqui')
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => setCurrentView('dashboard')}>
          ← Voltar
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{tournament.name}</h1>
          <span className={styles.gameType}>{tournament.game_type}</span>
        </div>
        <div className={styles.spacer} />
      </header>

      <main className={styles.main}>
        <div className={styles.tournamentInfo}>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Código de Convite</div>
            <code className={styles.codeDisplay}>{tournament.invite_code}</code>
            <small className={styles.infoHint}>Compartilhe este código para convidar amigos</small>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Status</div>
            <div className={styles.statusBadge}>
              {tournament.status === 'draft' && '📝 Rascunho'}
              {tournament.status === 'active' && '🔴 Ativo'}
              {tournament.status === 'finished' && '✅ Finalizado'}
            </div>
          </div>

          {isCreator && (
            <button className={styles.setupBtn} onClick={handleSetupMatches}>
              ⚙️ Configurar Partidas
            </button>
          )}
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <section className={styles.participantsSection}>
          <h2 className={styles.sectionTitle}>Participantes ({participantCount})</h2>

          {loading ? (
            <div className={styles.loadingMessage}>Carregando participantes...</div>
          ) : participantCount < 2 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👥</div>
              <p className={styles.emptyText}>Aguardando oponentes...</p>
              <p className={styles.emptySubtext}>
                Compartilhe o código <strong>{tournament.invite_code}</strong> com seus amigos para começar!
              </p>
              <div className={styles.shareActions}>
                <button
                  className={styles.copyBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(tournament.invite_code)
                    alert('Código copiado!')
                  }}
                >
                  📋 Copiar Código
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.participantsList}>
              {participants.map((participant) => (
                <div key={participant.id} className={styles.participantCard}>
                  {participant.profile?.avatar_url ? (
                    <img
                      src={participant.profile.avatar_url}
                      alt={participant.profile.nickname || 'Avatar'}
                      className={styles.avatar}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>👤</div>
                  )}
                  <div className={styles.participantInfo}>
                    <div className={styles.teamName}>{participant.team_name || 'Sem time'}</div>
                    <small className={styles.userName}>
                      {participant.profile?.nickname || participant.profile?.email || 'Usuário'}
                    </small>
                  </div>
                  {participant.user_id === tournament.creator_id && (
                    <span className={styles.creatorBadge}>👑</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default TournamentView
