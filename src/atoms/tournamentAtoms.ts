import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { Tables } from '../types/supabase'
import type { MatchWithTeams } from '../types/tournament'

export type Tournament = Tables<'tournaments'>
export type Participant = Tables<'participants'>

export interface TournamentWithParticipants extends Tournament {
  participantCount?: number
  isCreator?: boolean
  isParticipant?: boolean
}

// Estado do torneio ativo (selecionado)
export const activeTournamentAtom = atomWithStorage<TournamentWithParticipants | null>(
  'bescore.activeTournament',
  null
)

// Lista de torneios do usuário (criados ou participando)
export const myTournamentsAtom = atomWithStorage<TournamentWithParticipants[]>(
  'bescore.myTournaments',
  []
)

// Estado de carregamento
export const tournamentsLoadingAtom = atom<boolean>(false)

// Erros
export const tournamentsErrorAtom = atom<string | null>(null)

// Modal de criar torneio
export const showCreateModalAtom = atom<boolean>(false)

// Modal de entrar por código
export const showJoinModalAtom = atom<boolean>(false)

// Modal de configuração de partidas
export const showConfigModalAtom = atom<boolean>(false)

// Aba ativa em TournamentView: 'matches' ou 'standings'
export const activeTournamentTabAtom = atomWithStorage<'matches' | 'standings'>(
  'bescore.activeTournamentTab',
  'matches'
)

// View atual
export const currentViewAtom = atomWithStorage<
  'dashboard' | 'tournament-lobby' | 'tournament-match' | 'create-tournament' | 'join-by-code'
>('bescore.currentView', 'dashboard')

// Partida selecionada para edição de placar (drawer responsivo)
export const selectedMatchAtom = atom<MatchWithTeams | null>(null)

export interface GlobalToast {
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
}

// Notificacao global tipo push/toast (fora dos componentes locais)
export const globalToastAtom = atom<GlobalToast | null>(null)

// --- Conexões Recentes ---

export interface RecentPlayer {
  id: string
  name: string
  avatar: string | null
  lastPlayed: string // ISO date
}

/**
 * Lista de jogadores com quem o usuário já jogou (populado após participar/finalizar torneios).
 * Usado na seção "CONVIDAR RECENTES" do CreateTournament.
 */
export const recentPlayersAtom = atom<RecentPlayer[]>([])
