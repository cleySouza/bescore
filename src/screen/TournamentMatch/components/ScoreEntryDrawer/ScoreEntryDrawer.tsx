import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../../../atoms/sessionAtom'
import { activeTournamentAtom, globalToastAtom, selectedMatchAtom } from '../../../../atoms/tournamentAtoms'
import { updateMatchResult, type UpdateMatchPenaltyMode } from '../../../../lib/matchService'
import {
  castProposalVote,
  createMatchScoreProposal,
  fetchPendingProposalForMatch,
  fetchVotesForProposal,
  finalizeMatchScoreProposal,
  type MatchScoreProposal,
  type ProposalVoteRow,
} from '../../../../lib/scoreProposalService'
import { isTwoLegAggregateTie } from '../../../../lib/playoffKnockout'
import type { MatchWithTeams, TournamentSettings } from '../../../../types/tournament'
import { isAdminOnlyScoring, isScoreValidationEnabled } from '../../../../types/tournament'
import ScoreEntryTeamCrest from '../ScoreEntryTeamCrest/ScoreEntryTeamCrest'
import './scoreEntry.css'

export interface ScoreDrawerParticipant {
  id: string
  user_id: string | null
  team_name: string | null
  profile?: {
    nickname: string | null
    avatar_url: string | null
    email: string
  } | null
}

interface ScoreEntryDrawerProps {
  matches: MatchWithTeams[]
  leagueRoundCount: number
  onResultSaved?: () => void
  /** Id na tabela participants do utilizador logado; não depende de RLS nos joins da partida */
  myParticipantId?: string | null
  participants?: ScoreDrawerParticipant[]
}

function getDisplayName(
  nickname: string | null | undefined,
  email: string | null | undefined,
  profileId: string | null | undefined,
  currentUserId: string | undefined,
  currentUserName: string
) {
  if (typeof nickname === 'string' && nickname.trim()) {
    return nickname
  }

  if (typeof email === 'string' && email.trim()) {
    return email.split('@')[0]
  }

  if (profileId && currentUserId && profileId === currentUserId) {
    return currentUserName
  }

  return 'Responsavel'
}

function ScoreEntryDrawer({
  matches,
  leagueRoundCount,
  onResultSaved,
  myParticipantId = null,
  participants = [],
}: ScoreEntryDrawerProps) {
  const user = useAtomValue(userAtom)
  const tournament = useAtomValue(activeTournamentAtom)
  const [selectedMatch, setSelectedMatch] = useAtom(selectedMatchAtom)
  const setGlobalToast = useSetAtom(globalToastAtom)

  const [homeScore, setHomeScore] = useState<number | null>(null)
  const [awayScore, setAwayScore] = useState<number | null>(null)
  const [homePenalties, setHomePenalties] = useState<number | null>(null)
  const [awayPenalties, setAwayPenalties] = useState<number | null>(null)
  /** Passo 1: só placar; passo 2: pênaltis (só depois de confirmar empate no mata-mata). */
  const [scorePhase, setScorePhase] = useState<'scores' | 'penalties'>('scores')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingProposal, setPendingProposal] = useState<MatchScoreProposal | null>(null)
  const [proposalVotes, setProposalVotes] = useState<ProposalVoteRow[]>([])
  const [voteBusy, setVoteBusy] = useState(false)

  const onResultSavedRef = useRef(onResultSaved)
  onResultSavedRef.current = onResultSaved

  useEffect(() => {
    if (!selectedMatch) return
    setHomeScore(selectedMatch.home_score)
    setAwayScore(selectedMatch.away_score)
    setHomePenalties(selectedMatch.home_penalties ?? null)
    setAwayPenalties(selectedMatch.away_penalties ?? null)
    setScorePhase('scores')
    setError(null)
  }, [selectedMatch])

  const tournamentSettings = tournament?.settings as TournamentSettings | null
  const scoreValidationOn = isScoreValidationEnabled(tournamentSettings)
  const isCampeonato = tournamentSettings?.format === 'campeonato'
  const playoffTwoLegged = tournamentSettings?.playoffTwoLegged === true

  const eligibleVoters = useMemo(
    () => participants.filter((p): p is ScoreDrawerParticipant & { user_id: string } => typeof p.user_id === 'string'),
    [participants]
  )

  const round = selectedMatch?.round ?? 0
  const siblingRoundMatches = useMemo(
    () => matches.filter((m) => m.round === round),
    [matches, round]
  )

  const isKnockoutPhase = Boolean(selectedMatch && tournament && isCampeonato && round > leagueRoundCount)

  const myId = user?.id
  const adminOnlyScoring = tournament ? isAdminOnlyScoring(tournament.settings) : true

  const canEdit = useMemo(() => {
    if (!selectedMatch || !tournament || !user) return false
    const isCreator = tournament.creator_id === user?.id
    const isFinished = selectedMatch.status === 'finished'

    const byParticipantIds =
      typeof myParticipantId === 'string' &&
      (selectedMatch.home_participant_id === myParticipantId ||
        selectedMatch.away_participant_id === myParticipantId)
    const byEmbedded =
      (typeof selectedMatch.homeTeam?.user_id === 'string' && selectedMatch.homeTeam.user_id === myId) ||
      (typeof selectedMatch.awayTeam?.user_id === 'string' && selectedMatch.awayTeam.user_id === myId) ||
      selectedMatch.homeTeam?.profile?.id === myId ||
      selectedMatch.awayTeam?.profile?.id === myId

    const isParticipantInMatch = !adminOnlyScoring && (byParticipantIds || byEmbedded)

    return !isFinished && (isCreator || isParticipantInMatch)
  }, [selectedMatch, tournament, user, myParticipantId, myId, adminOnlyScoring])

  const scoresLocked = scoreValidationOn && !!pendingProposal
  const canEditScores = canEdit && !scoresLocked

  const knockoutNeedsPenalties = useMemo(() => {
    if (!selectedMatch || !tournament || homeScore === null || awayScore === null || !isKnockoutPhase) {
      return false
    }

    if (!playoffTwoLegged || selectedMatch.playoff_leg == null) {
      return homeScore === awayScore
    }

    if (selectedMatch.playoff_leg === 1) return false

    const leg1 = siblingRoundMatches.find(
      (m) =>
        m.playoff_leg === 1 &&
        m.playoff_pair_index === selectedMatch.playoff_pair_index &&
        m.id !== selectedMatch.id
    )
    if (!leg1 || leg1.status !== 'finished') return false
    return isTwoLegAggregateTie(leg1, homeScore, awayScore)
  }, [
    selectedMatch,
    tournament,
    homeScore,
    awayScore,
    isKnockoutPhase,
    playoffTwoLegged,
    siblingRoundMatches,
  ])

  const reloadProposalState = useCallback(async () => {
    if (!selectedMatch || !scoreValidationOn) {
      setPendingProposal(null)
      setProposalVotes([])
      return
    }
    try {
      const p = await fetchPendingProposalForMatch(selectedMatch.id)
      setPendingProposal(p)
      if (p) {
        const v = await fetchVotesForProposal(p.id)
        setProposalVotes(v)
        const fin = await finalizeMatchScoreProposal(p.id)
        if (fin.status === 'approved') {
          setGlobalToast({ type: 'success', message: 'Placar aprovado pela maioria.' })
          window.dispatchEvent(
            new CustomEvent('bescore:match-updated', {
              detail: {
                matchId: selectedMatch.id,
                homeScore: p.home_score,
                awayScore: p.away_score,
              },
            })
          )
          onResultSavedRef.current?.()
          setPendingProposal(null)
          setProposalVotes([])
          setSelectedMatch(null)
          return
        }
        if (fin.status === 'expired') {
          setGlobalToast({ type: 'warning', message: 'Proposta de placar expirou sem maioria a favor.' })
          setPendingProposal(null)
          setProposalVotes([])
        }
      } else {
        setProposalVotes([])
      }
    } catch (err) {
      console.error('reloadProposalState', err)
    }
  }, [selectedMatch, scoreValidationOn, setGlobalToast, setSelectedMatch])

  useEffect(() => {
    void reloadProposalState()
  }, [selectedMatch?.id, scoreValidationOn, reloadProposalState])

  useEffect(() => {
    if (!pendingProposal?.id || !scoreValidationOn) return
    const t = window.setInterval(() => {
      void reloadProposalState()
    }, 12000)
    return () => window.clearInterval(t)
  }, [pendingProposal?.id, scoreValidationOn, reloadProposalState])

  const [, setCountdownTick] = useState(0)
  useEffect(() => {
    if (!pendingProposal) return
    const i = window.setInterval(() => setCountdownTick((n) => n + 1), 1000)
    return () => window.clearInterval(i)
  }, [pendingProposal?.id])

  const pensFilled =
    homePenalties !== null &&
    awayPenalties !== null &&
    Number.isFinite(homePenalties) &&
    Number.isFinite(awayPenalties) &&
    homePenalties !== awayPenalties

  const canProceedScores = canEditScores && homeScore !== null && awayScore !== null
  const canSavePenalties = canEditScores && knockoutNeedsPenalties && pensFilled

  const persistResult = useCallback(
    async (opts: { needsKnockoutPenalties: boolean }) => {
      if (!selectedMatch || !tournament || homeScore === null || awayScore === null) {
        throw new Error('Estado inválido para salvar.')
      }

      let penaltyMode: UpdateMatchPenaltyMode = { mode: 'omit' }
      if (isKnockoutPhase) {
        penaltyMode = {
          mode: 'set',
          home: opts.needsKnockoutPenalties ? homePenalties : null,
          away: opts.needsKnockoutPenalties ? awayPenalties : null,
        }
      }

      if (scoreValidationOn) {
        await createMatchScoreProposal({
          matchId: selectedMatch.id,
          homeScore,
          awayScore,
          homePenalties: penaltyMode.mode === 'set' ? penaltyMode.home : null,
          awayPenalties: penaltyMode.mode === 'set' ? penaltyMode.away : null,
        })
        setGlobalToast({
          type: 'info',
          message: 'Proposta de placar enviada. Participe da votação abaixo.',
        })
        await reloadProposalState()
        return
      }

      await updateMatchResult(selectedMatch.id, homeScore, awayScore, penaltyMode)
      setGlobalToast({
        type: 'success',
        message: 'Resultado salvo com sucesso.',
      })
      window.dispatchEvent(
        new CustomEvent('bescore:match-updated', {
          detail: {
            matchId: selectedMatch.id,
            homeScore,
            awayScore,
          },
        })
      )
      onResultSaved?.()
      setSelectedMatch(null)
    },
    [
      selectedMatch,
      tournament,
      homeScore,
      awayScore,
      homePenalties,
      awayPenalties,
      isKnockoutPhase,
      scoreValidationOn,
      setGlobalToast,
      setSelectedMatch,
      onResultSaved,
      reloadProposalState,
    ]
  )

  const handleCastVote = useCallback(
    async (approve: boolean) => {
      if (!pendingProposal || !user || voteBusy) return
      setVoteBusy(true)
      setError(null)
      try {
        await castProposalVote(pendingProposal.id, approve ? 'approve' : 'reject')
        const fin = await finalizeMatchScoreProposal(pendingProposal.id)
        if (fin.status === 'approved') {
          setGlobalToast({ type: 'success', message: 'Placar aprovado pela maioria.' })
          window.dispatchEvent(
            new CustomEvent('bescore:match-updated', {
              detail: {
                matchId: pendingProposal.match_id,
                homeScore: pendingProposal.home_score,
                awayScore: pendingProposal.away_score,
              },
            })
          )
          onResultSaved?.()
          setSelectedMatch(null)
          return
        }
        if (fin.status === 'expired') {
          setGlobalToast({ type: 'warning', message: 'Proposta de placar expirou sem maioria a favor.' })
        }
        await reloadProposalState()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao votar'
        setError(message)
        setGlobalToast({ type: 'error', message })
      } finally {
        setVoteBusy(false)
      }
    },
    [pendingProposal, user, voteBusy, setGlobalToast, setSelectedMatch, onResultSaved, reloadProposalState]
  )

  const handleProceedScores = useCallback(async () => {
    if (!selectedMatch || !tournament || loading || !canEditScores) return

    if (homeScore === null || awayScore === null) {
      const message = 'Preencha o placar dos dois times antes de confirmar.'
      setError(message)
      setGlobalToast({ type: 'warning', message })
      return
    }

    setError(null)

    if (isKnockoutPhase && knockoutNeedsPenalties) {
      setHomePenalties(null)
      setAwayPenalties(null)
      setScorePhase('penalties')
      return
    }

    setLoading(true)
    try {
      await persistResult({ needsKnockoutPenalties: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar resultado'
      setError(message)
      setGlobalToast({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }, [
    selectedMatch,
    tournament,
    loading,
    canEditScores,
    homeScore,
    awayScore,
    isKnockoutPhase,
    knockoutNeedsPenalties,
    persistResult,
    setGlobalToast,
  ])

  const handleSavePenalties = useCallback(async () => {
    if (!selectedMatch || loading || !canEditScores) return

    if (!knockoutNeedsPenalties || !pensFilled) {
      const message = 'Informe os pênaltis com dois valores diferentes.'
      setError(message)
      setGlobalToast({ type: 'warning', message })
      return
    }

    setError(null)
    setLoading(true)
    try {
      await persistResult({ needsKnockoutPenalties: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar resultado'
      setError(message)
      setGlobalToast({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }, [
    selectedMatch,
    loading,
    canEditScores,
    knockoutNeedsPenalties,
    pensFilled,
    persistResult,
    setGlobalToast,
  ])

  const handleBackToScores = () => {
    if (loading) return
    setError(null)
    setScorePhase('scores')
    setHomePenalties(selectedMatch?.home_penalties ?? null)
    setAwayPenalties(selectedMatch?.away_penalties ?? null)
  }

  useEffect(() => {
    if (!selectedMatch || !canEditScores) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) return
      if (loading) return

      if (scorePhase === 'scores') {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setHomeScore((prev) => (prev === null ? 1 : prev + 1))
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          setHomeScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          setAwayScore((prev) => (prev === null ? 1 : prev + 1))
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setAwayScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          if (canProceedScores) void handleProceedScores()
        }
      } else if (scorePhase === 'penalties') {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setHomePenalties((prev) => (prev === null ? 1 : prev + 1))
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          setHomePenalties((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          setAwayPenalties((prev) => (prev === null ? 1 : prev + 1))
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setAwayPenalties((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          if (canSavePenalties) void handleSavePenalties()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    selectedMatch,
    canEditScores,
    loading,
    scorePhase,
    canProceedScores,
    canSavePenalties,
    handleProceedScores,
    handleSavePenalties,
  ])

  if (!selectedMatch || !tournament) return null

  const settings = tournament.settings as { adminScores?: boolean; selectedTeamShields?: Record<string, string> } | null

  const homeTeamName = selectedMatch.homeTeam?.team_name || 'TBD'
  const awayTeamName = selectedMatch.awayTeam?.team_name || 'TBD'
  const currentUserName =
    typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()
      ? user.user_metadata.name
      : user?.email?.split('@')[0] ?? 'Usuario'
  const homeNickname = getDisplayName(
    selectedMatch.homeTeam?.profile?.nickname,
    selectedMatch.homeTeam?.profile?.email,
    selectedMatch.homeTeam?.profile?.id,
    user?.id,
    currentUserName
  )
  const awayNickname = getDisplayName(
    selectedMatch.awayTeam?.profile?.nickname,
    selectedMatch.awayTeam?.profile?.email,
    selectedMatch.awayTeam?.profile?.id,
    user?.id,
    currentUserName
  )
  const shieldsMap = settings?.selectedTeamShields ?? {}

  const countdownLabel = (() => {
    if (!pendingProposal) return null
    const ms = new Date(pendingProposal.expires_at).getTime() - Date.now()
    if (ms <= 0) return 'Expirado'
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}:${s.toString().padStart(2, '0')}`
  })()

  const submitterIsParticipant =
    !!pendingProposal &&
    eligibleVoters.some((p) => p.user_id === pendingProposal.proposed_by_user_id)
  const approveVotesTally =
    (submitterIsParticipant ? 1 : 0) + proposalVotes.filter((v) => v.vote === 'approve').length
  const majorityNeed =
    eligibleVoters.length > 0 ? Math.floor(eligibleVoters.length / 2) + 1 : 0
  const canCastVote =
    !!pendingProposal &&
    !!user &&
    !!myParticipantId &&
    pendingProposal.proposed_by_user_id !== user.id

  const drawerRoundLabel =
    isKnockoutPhase && selectedMatch.playoff_leg === 1
      ? `Mata-mata · Ida · R${selectedMatch.round}`
      : isKnockoutPhase && selectedMatch.playoff_leg === 2
        ? `Mata-mata · Volta · R${selectedMatch.round}`
        : isKnockoutPhase
          ? `Mata-mata · R${selectedMatch.round}`
          : `Rodada ${selectedMatch.round}`

  const closeDrawer = () => {
    if (loading) return
    setSelectedMatch(null)
  }

  const increment = (side: 'home' | 'away') => {
    if (!canEditScores || loading || scorePhase === 'penalties') return
    if (side === 'home') setHomeScore((prev) => (prev === null ? 1 : prev + 1))
    else setAwayScore((prev) => (prev === null ? 1 : prev + 1))
  }

  const decrement = (side: 'home' | 'away') => {
    if (!canEditScores || loading || scorePhase === 'penalties') return
    if (side === 'home') setHomeScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
    else setAwayScore((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
  }

  const handleInputChange = (side: 'home' | 'away', rawValue: string) => {
    if (!canEditScores || loading || scorePhase === 'penalties') return

    if (rawValue === '') {
      if (side === 'home') setHomeScore(null)
      else setAwayScore(null)
      return
    }

    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return

    const normalized = Math.max(0, Math.floor(parsed))
    if (side === 'home') setHomeScore(normalized)
    else setAwayScore(normalized)
  }

  const handlePenaltyInput = (side: 'home' | 'away', rawValue: string) => {
    if (!canEditScores || loading || scorePhase !== 'penalties') return
    if (rawValue === '') {
      if (side === 'home') setHomePenalties(null)
      else setAwayPenalties(null)
      return
    }
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return
    const normalized = Math.max(0, Math.floor(parsed))
    if (side === 'home') setHomePenalties(normalized)
    else setAwayPenalties(normalized)
  }

  const incrementPenalty = (side: 'home' | 'away') => {
    if (!canEditScores || loading || scorePhase !== 'penalties') return
    if (side === 'home') setHomePenalties((prev) => (prev === null ? 1 : prev + 1))
    else setAwayPenalties((prev) => (prev === null ? 1 : prev + 1))
  }

  const decrementPenalty = (side: 'home' | 'away') => {
    if (!canEditScores || loading || scorePhase !== 'penalties') return
    if (side === 'home') setHomePenalties((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
    else setAwayPenalties((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
  }

  return (
    <div className="score-entry-overlay" onClick={closeDrawer} role="presentation">
      <aside
        className="score-entry-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={scorePhase === 'penalties' ? 'Registrar pênaltis da partida' : 'Inserir placar da partida'}
      >
        <div className="score-entry-handle" aria-hidden />

        <header className="score-entry-header">
          <div>
            <p className="score-entry-round">{drawerRoundLabel}</p>
            <h3 className="score-entry-title">
              {scorePhase === 'penalties' ? 'Disputa de pênaltis' : 'Inserir placar'}
            </h3>
          </div>
          <button type="button" className="score-entry-close" onClick={closeDrawer} aria-label="Fechar painel">
            ×
          </button>
        </header>

        <section
          className={`score-entry-grid${scorePhase === 'penalties' && canEditScores ? ' score-entry-grid--locked' : ''}`}
        >
          <article className="score-entry-team">
            <div className="score-entry-team-head">
              <ScoreEntryTeamCrest teamName={homeTeamName} shieldsMap={shieldsMap} />
              <div className="score-entry-team-meta">
                <span className="score-entry-team-name">{homeTeamName}</span>
                <span className="score-entry-team-user">{homeNickname}</span>
              </div>
            </div>
            <div className="score-entry-stepper">
              <button
                type="button"
                onClick={() => decrement('home')}
                disabled={!canEditScores || loading || scorePhase === 'penalties'}
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={homeScore ?? ''}
                onChange={(event) => handleInputChange('home', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
                    event.preventDefault()
                  }
                }}
                className="score-entry-input"
                placeholder="-"
                disabled={!canEditScores || loading || scorePhase === 'penalties'}
                aria-label="Placar mandante"
              />
              <button
                type="button"
                onClick={() => increment('home')}
                disabled={!canEditScores || loading || scorePhase === 'penalties'}
              >
                +
              </button>
            </div>
          </article>

          <span className="score-entry-separator">x</span>

          <article className="score-entry-team">
            <div className="score-entry-team-head">
              <ScoreEntryTeamCrest teamName={awayTeamName} shieldsMap={shieldsMap} />
              <div className="score-entry-team-meta">
                <span className="score-entry-team-name">{awayTeamName}</span>
                <span className="score-entry-team-user">{awayNickname}</span>
              </div>
            </div>
            <div className="score-entry-stepper">
              <button
                type="button"
                onClick={() => decrement('away')}
                disabled={!canEditScores || loading || scorePhase === 'penalties'}
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={awayScore ?? ''}
                onChange={(event) => handleInputChange('away', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
                    event.preventDefault()
                  }
                }}
                className="score-entry-input"
                placeholder="-"
                disabled={!canEditScores || loading || scorePhase === 'penalties'}
                aria-label="Placar visitante"
              />
              <button
                type="button"
                onClick={() => increment('away')}
                disabled={!canEditScores || loading || scorePhase === 'penalties'}
              >
                +
              </button>
            </div>
          </article>
        </section>

        {scorePhase === 'penalties' && knockoutNeedsPenalties && canEditScores && homeScore !== null && awayScore !== null && (
          <div className="score-entry-penalties">
            <p className="score-entry-score-recap">
              Placar confirmado:{' '}
              <strong>
                {homeScore} × {awayScore}
              </strong>
            </p>
            <p className="score-entry-penalties-hint">
              {playoffTwoLegged && selectedMatch.playoff_leg === 2
                ? 'Empate no agregado — informe os pênaltis (valores diferentes).'
                : 'Empate no tempo regulamentar — informe os pênaltis (valores diferentes).'}
            </p>
            <section className="score-entry-grid">
              <article className="score-entry-team">
                <div className="score-entry-team-head">
                  <ScoreEntryTeamCrest teamName={homeTeamName} shieldsMap={shieldsMap} />
                  <div className="score-entry-team-meta">
                    <span className="score-entry-team-name">{homeTeamName}</span>
                    <span className="score-entry-team-user">{homeNickname}</span>
                  </div>
                </div>
                <div className="score-entry-stepper">
                  <button
                    type="button"
                    onClick={() => decrementPenalty('home')}
                    disabled={!canEditScores || loading}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={homePenalties ?? ''}
                    onChange={(e) => handlePenaltyInput('home', e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
                        event.preventDefault()
                      }
                    }}
                    className="score-entry-input"
                    placeholder="-"
                    disabled={!canEditScores || loading}
                    aria-label="Pênaltis mandante"
                    aria-required
                  />
                  <button type="button" onClick={() => incrementPenalty('home')} disabled={!canEditScores || loading}>
                    +
                  </button>
                </div>
              </article>

              <span className="score-entry-separator">x</span>

              <article className="score-entry-team">
                <div className="score-entry-team-head">
                  <ScoreEntryTeamCrest teamName={awayTeamName} shieldsMap={shieldsMap} />
                  <div className="score-entry-team-meta">
                    <span className="score-entry-team-name">{awayTeamName}</span>
                    <span className="score-entry-team-user">{awayNickname}</span>
                  </div>
                </div>
                <div className="score-entry-stepper">
                  <button
                    type="button"
                    onClick={() => decrementPenalty('away')}
                    disabled={!canEditScores || loading}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={awayPenalties ?? ''}
                    onChange={(e) => handlePenaltyInput('away', e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
                        event.preventDefault()
                      }
                    }}
                    className="score-entry-input"
                    placeholder="-"
                    disabled={!canEditScores || loading}
                    aria-label="Pênaltis visitante"
                    aria-required
                  />
                  <button type="button" onClick={() => incrementPenalty('away')} disabled={!canEditScores || loading}>
                    +
                  </button>
                </div>
              </article>
            </section>
          </div>
        )}

        {!canEdit && !(scoreValidationOn && pendingProposal && myParticipantId) && (
          <p className="score-entry-note">
            {adminOnlyScoring
              ? 'Apenas o criador pode registrar o resultado de partidas pendentes.'
              : 'Apenas os jogadores desta partida podem registrar o resultado.'}
          </p>
        )}

        {scoreValidationOn && pendingProposal && scoresLocked && canEdit && (
          <p className="score-entry-note">
            Há uma proposta pendente — placar bloqueado até aprovação ou expiração. Maioria: mais de 50% dos{' '}
            {eligibleVoters.length} participantes com conta (abstenções não aumentam essa meta). Prazo:{' '}
            {countdownLabel ?? '—'}.
          </p>
        )}

        {scoreValidationOn && pendingProposal && myParticipantId && (
          <section className="score-entry-proposal-vote">
            <h4 className="score-entry-proposal-title">Votação do placar</h4>
            <p className="score-entry-proposal-meta">
              Proposta: {pendingProposal.home_score} × {pendingProposal.away_score}
              {countdownLabel ? ` · Tempo restante: ${countdownLabel}` : ''}
            </p>
            <p className="score-entry-proposal-majority">
              Aprovações: {approveVotesTally} — para aprovar precisa &gt; metade de {eligibleVoters.length}{' '}
              participante{eligibleVoters.length !== 1 ? 's' : ''} ({majorityNeed} ou mais).
            </p>
            <ul className="score-entry-proposal-list">
              {eligibleVoters.map((p) => {
                const uid = p.user_id
                const label = getDisplayName(
                  p.profile?.nickname,
                  p.profile?.email,
                  uid,
                  user?.id,
                  currentUserName
                )
                const isSubmitter = pendingProposal.proposed_by_user_id === uid
                const rowVote = proposalVotes.find((v) => v.user_id === uid)
                let status = 'Pendente'
                if (isSubmitter) status = 'Aprovação automática (quem propôs)'
                else if (rowVote?.vote === 'approve') status = 'Aprovou'
                else if (rowVote?.vote === 'reject') status = 'Rejeitou'
                return (
                  <li key={p.id} className="score-entry-proposal-list-item">
                    <span className="score-entry-proposal-name">{p.team_name || label}</span>
                    <span className="score-entry-proposal-status">{status}</span>
                  </li>
                )
              })}
            </ul>
            {user && pendingProposal.proposed_by_user_id === user.id && submitterIsParticipant && (
              <p className="score-entry-proposal-hint">Seu voto conta como aprovação automática.</p>
            )}
            {canCastVote && (
              <div className="score-entry-proposal-actions">
                <button
                  type="button"
                  className="score-entry-proposal-btn score-entry-proposal-btn-approve"
                  disabled={voteBusy || loading}
                  onClick={() => void handleCastVote(true)}
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  className="score-entry-proposal-btn score-entry-proposal-btn-reject"
                  disabled={voteBusy || loading}
                  onClick={() => void handleCastVote(false)}
                >
                  Rejeitar
                </button>
              </div>
            )}
          </section>
        )}

        {canEditScores && scorePhase === 'scores' && (
          <p className="score-entry-shortcuts">
            Atalhos: ↑/↓ mandante, ←/→ visitante, Enter para confirmar o placar
          </p>
        )}

        {canEditScores && scorePhase === 'penalties' && (
          <p className="score-entry-shortcuts">
            Atalhos: ↑/↓ mandante, ←/→ visitante, Enter para salvar
          </p>
        )}

        {error && <p className="score-entry-error">{error}</p>}

        {scorePhase === 'penalties' && knockoutNeedsPenalties && canEditScores ? (
          <footer className="score-entry-footer score-entry-footer-penalties">
            <button
              type="button"
              className="score-entry-back"
              onClick={handleBackToScores}
              disabled={loading}
            >
              Alterar placar
            </button>
            <button type="button" className="score-entry-cancel" onClick={closeDrawer} disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              className="score-entry-confirm"
              onClick={() => void handleSavePenalties()}
              disabled={!canSavePenalties || loading}
            >
              {loading ? 'Salvando...' : scoreValidationOn ? 'Enviar proposta' : 'Salvar resultado'}
            </button>
          </footer>
        ) : (
          <footer className="score-entry-footer">
            <button type="button" className="score-entry-cancel" onClick={closeDrawer} disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              className="score-entry-confirm"
              onClick={() => void handleProceedScores()}
              disabled={!canProceedScores || loading}
            >
              {loading ? 'Salvando...' : scoreValidationOn ? 'Enviar proposta' : 'Confirmar'}
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}

export default ScoreEntryDrawer
