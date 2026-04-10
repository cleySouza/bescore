import { atom } from 'jotai'
import type { Tables } from '../types/supabase'

export type Tournament = Tables<'tournaments'>
export type Participant = Tables<'participants'>

export interface TournamentWithParticipants extends Tournament {
  participantCount?: number
  isCreator?: boolean
  isParticipant?: boolean
}

// Estado do torneio ativo (selecionado)
export const activeTournamentAtom = atom<TournamentWithParticipants | null>(null)

// Lista de torneios do usuário (criados ou participando)
export const myTournamentsAtom = atom<TournamentWithParticipants[]>([])

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
export const activeTournamentTabAtom = atom<'matches' | 'standings'>('matches')

// View atual: 'dashboard' ou 'tournament'
export const currentViewAtom = atom<'dashboard' | 'tournament'>('dashboard')

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
