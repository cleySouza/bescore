import type { Json } from '../types/supabase'
import { isScoreValidationEnabled } from '../types/tournament'
import { supabase } from './supabaseClient'

export type MatchScoreProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface MatchScoreProposal {
  id: string
  match_id: string
  tournament_id: string
  proposed_by_user_id: string
  home_score: number
  away_score: number
  home_penalties: number | null
  away_penalties: number | null
  status: MatchScoreProposalStatus
  expires_at: string
  created_at: string
  updated_at: string
}

export type ProposalVote = 'approve' | 'reject'

export interface ProposalVoteRow {
  user_id: string
  vote: ProposalVote
}

export async function fetchPendingProposalForMatch(matchId: string): Promise<MatchScoreProposal | null> {
  const { data, error } = await supabase
    .from('match_score_proposals')
    .select('*')
    .eq('match_id', matchId)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) {
    console.error('fetchPendingProposalForMatch:', error.message)
    throw new Error(`Falha ao carregar proposta: ${error.message}`)
  }

  return (data as MatchScoreProposal | null) ?? null
}

export async function fetchVotesForProposal(proposalId: string): Promise<ProposalVoteRow[]> {
  const { data, error } = await supabase
    .from('match_score_proposal_votes')
    .select('user_id, vote')
    .eq('proposal_id', proposalId)

  if (error) {
    console.error('fetchVotesForProposal:', error.message)
    throw new Error(`Falha ao carregar votos: ${error.message}`)
  }

  return (data ?? []) as ProposalVoteRow[]
}

export async function createMatchScoreProposal(input: {
  matchId: string
  homeScore: number
  awayScore: number
  homePenalties: number | null
  awayPenalties: number | null
}): Promise<MatchScoreProposal> {
  const { data, error } = await supabase
    .from('match_score_proposals')
    .insert({
      match_id: input.matchId,
      home_score: input.homeScore,
      away_score: input.awayScore,
      home_penalties: input.homePenalties,
      away_penalties: input.awayPenalties,
    })
    .select('*')
    .single()

  if (error) {
    console.error('createMatchScoreProposal:', error.message)
    throw new Error(`Falha ao criar proposta: ${error.message}`)
  }

  return data as MatchScoreProposal
}

export async function castProposalVote(proposalId: string, vote: ProposalVote): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    throw new Error('Sessão inválida para votar.')
  }

  const { error } = await supabase.from('match_score_proposal_votes').upsert(
    {
      proposal_id: proposalId,
      user_id: userData.user.id,
      vote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proposal_id,user_id' }
  )

  if (error) {
    console.error('castProposalVote:', error.message)
    throw new Error(`Falha ao registrar voto: ${error.message}`)
  }
}

export interface ProposalNotificationTournament {
  id: string
  name: string
  settings: Json | null
}

export interface ProposalNotificationRow extends MatchScoreProposal {
  tournaments: ProposalNotificationTournament | null
}

function normalizeTournamentEmbed(raw: unknown): ProposalNotificationTournament | null {
  if (!raw) return null
  const row = Array.isArray(raw) ? raw[0] : raw
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null
  return { id: o.id, name: o.name, settings: (o.settings ?? null) as Json | null }
}

/** Últimas ~72h de propostas já encerradas ainda aparecem na lista (desabilitadas). */
const RECENT_SETTLED_MS = 72 * 60 * 60 * 1000

/**
 * Feed de notificações: propostas pendentes + encerradas recentes (aprovada/recusada/expirada).
 * Participante do torneio, scoreValidation ligado, não propostas pelo próprio utilizador.
 */
export async function fetchParticipantProposalNotificationFeed(userId: string): Promise<ProposalNotificationRow[]> {
  const { data: parts, error: pe } = await supabase
    .from('participants')
    .select('tournament_id')
    .eq('user_id', userId)

  if (pe) {
    console.error('fetchParticipantProposalNotificationFeed participants:', pe.message)
    throw new Error(`Falha ao carregar participações: ${pe.message}`)
  }

  const tournamentIds = [...new Set((parts ?? []).map((p) => p.tournament_id).filter(Boolean))] as string[]
  if (tournamentIds.length === 0) return []

  const { data, error } = await supabase
    .from('match_score_proposals')
    .select(
      `
      id,
      match_id,
      tournament_id,
      proposed_by_user_id,
      home_score,
      away_score,
      home_penalties,
      away_penalties,
      status,
      expires_at,
      created_at,
      updated_at,
      tournaments (
        id,
        name,
        settings
      )
    `
    )
    .neq('proposed_by_user_id', userId)
    .in('tournament_id', tournamentIds)
    .in('status', ['pending', 'approved', 'rejected', 'expired'])

  if (error) {
    console.error('fetchParticipantProposalNotificationFeed:', error.message)
    throw new Error(`Falha ao carregar notificações: ${error.message}`)
  }

  const cutoff = Date.now() - RECENT_SETTLED_MS
  const rows = (data ?? []) as Record<string, unknown>[]
  const out: ProposalNotificationRow[] = []
  for (const raw of rows) {
    const status = raw.status as MatchScoreProposalStatus
    if (status !== 'pending') {
      const u = Date.parse(typeof raw.updated_at === 'string' ? raw.updated_at : '')
      if (!Number.isFinite(u) || u < cutoff) continue
    }

    const tournaments = normalizeTournamentEmbed(raw.tournaments)
    if (!tournaments || !isScoreValidationEnabled(tournaments.settings)) continue
    out.push({
      id: raw.id as string,
      match_id: raw.match_id as string,
      tournament_id: raw.tournament_id as string,
      proposed_by_user_id: raw.proposed_by_user_id as string,
      home_score: raw.home_score as number,
      away_score: raw.away_score as number,
      home_penalties: (raw.home_penalties ?? null) as number | null,
      away_penalties: (raw.away_penalties ?? null) as number | null,
      status,
      expires_at: typeof raw.expires_at === 'string' ? raw.expires_at : '',
      created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
      updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : '',
      tournaments,
    })
  }

  out.sort((a, b) => {
    const ap = a.status === 'pending'
    const bp = b.status === 'pending'
    if (ap && !bp) return -1
    if (!ap && bp) return 1
    if (ap && bp) return Date.parse(a.expires_at) - Date.parse(b.expires_at)
    return Date.parse(b.updated_at) - Date.parse(a.updated_at)
  })

  return out
}

/** @deprecated Use {@link fetchParticipantProposalNotificationFeed}. */
export async function fetchParticipantPendingProposalNotifications(
  userId: string
): Promise<ProposalNotificationRow[]> {
  return fetchParticipantProposalNotificationFeed(userId)
}

export async function finalizeMatchScoreProposal(
  proposalId: string
): Promise<{ status: string; ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('finalize_match_score_proposal', {
    p_proposal_id: proposalId,
  })

  if (error) {
    console.error('finalizeMatchScoreProposal:', error.message)
    throw new Error(`Falha ao finalizar votação: ${error.message}`)
  }

  const raw = data as { ok?: boolean; status?: string; error?: string } | null
  return {
    ok: raw?.ok !== false,
    status: typeof raw?.status === 'string' ? raw.status : 'unknown',
    error: typeof raw?.error === 'string' ? raw.error : undefined,
  }
}
