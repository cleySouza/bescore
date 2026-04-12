/**
 * Types para Tournament Settings (JSONB)
 */

export type TournamentFormat = 'roundRobin' | 'knockout' | 'groupsCrossed' | 'mixed' | 'campeonato'

export interface TournamentSettings {
  format: TournamentFormat
  hasReturnMatch?: boolean // Para Round Robin
  qualifiedCount?: number // Para Mixed (quantos avançam dos grupos)
  bracketGroups?: number // Para Grupos Cruzados (default: 2)
  playoffCutoff?: 4 | 2 // Para Campeonato: quantos avançam para mata-mata
}

export interface Match {
  id: string
  tournament_id: string
  home_participant_id: string | null
  away_participant_id: string | null
  round: number
  status: 'pending' | 'finished'
  home_score: number | null
  away_score: number | null
  created_at?: string
  updated_at?: string
}

export interface MatchWithTeams extends Match {
  homeTeam?: {
    id: string
    team_name: string
    profile?: {
      nickname: string | null
      avatar_url: string | null
    }
  }
  awayTeam?: {
    id: string
    team_name: string
    profile?: {
      nickname: string | null
      avatar_url: string | null
    }
  }
}

export interface StandingsRow {
  participant_id: string
  team_name: string | null
  user_nickname: string | null
  user_avatar_url: string | null
  total_matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  position: number
}

// Validação de settings
export const DEFAULT_SETTINGS: TournamentSettings = {
  format: 'roundRobin',
  hasReturnMatch: false,
  qualifiedCount: 2,
  bracketGroups: 2,
}

export function validateSettingsForFormat(
  format: TournamentFormat,
  participantCount: number
): { valid: boolean; error?: string } {
  switch (format) {
    case 'knockout': {
      // Knockout precisa de potência de 2 ou BYEs serão criados
      if (participantCount < 2) {
        return { valid: false, error: 'Knockout precisa de pelo menos 2 participantes' }
      }
      return { valid: true }
    }
    case 'groupsCrossed': {
      if (participantCount < 3) {
        return { valid: false, error: 'Grupos Cruzados precisa de pelo menos 3 participantes' }
      }
      return { valid: true }
    }
    case 'mixed': {
      if (participantCount < 4) {
        return { valid: false, error: 'Misto precisa de pelo menos 4 participantes' }
      }
      return { valid: true }
    }
    case 'campeonato': {
      if (participantCount < 4) {
        return { valid: false, error: 'Campeonato precisa de pelo menos 4 participantes' }
      }
      return { valid: true }
    }
    case 'roundRobin':
    default: {
      if (participantCount < 2) {
        return { valid: false, error: 'Round Robin precisa de pelo menos 2 participantes' }
      }
      return { valid: true }
    }
  }
}
