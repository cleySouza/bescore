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
  /** Ida e volta na semifinal e na final (só formato campeonato). */
  playoffTwoLegged?: boolean
  /** Quando true, placares pendentes passam por proposta + votação entre participantes (MVP). */
  scoreValidation?: boolean
  adminScores?: boolean // true = só admin lança placares; false = jogadores lançam suas próprias partidas
  isPrivate?: boolean // Torneio privado (requer código para entrar)
  maxParticipants?: number // Limite máximo de participantes
  tournamentImage?: string // Capa do torneio (data URL)
  selectedTeamNames?: string[] // Nomes dos clubes pré-selecionados pelo admin no modal de criação
  selectedTeamShields?: Record<string, string> // team_name → shield URL (para exibir escudos nas partidas)
  teamAssignMode?: 'auto' | 'manual' // Como os times são atribuídos no lobby
}

/** URL da capa do torneio em `settings` (data URL ou https). */
export function getTournamentCoverImage(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null
  const raw = (settings as TournamentSettings).tournamentImage
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

/**
 * Escudos por nome do clube: cache do catálogo Strapi + `selectedTeamShields` no torneio.
 * Valores em settings substituem o catálogo quando a chave coincide.
 */
export function getMergedTeamShieldsMap(
  catalogShields: Record<string, string>,
  settings: unknown
): Record<string, string> {
  if (!settings || typeof settings !== 'object') return { ...catalogShields }
  const raw = (settings as TournamentSettings).selectedTeamShields
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...catalogShields }
  return { ...catalogShields, ...(raw as Record<string, string>) }
}

/** Iniciais para avatar placeholder no cabeçalho (2 letras). */
export function getTournamentBadgeInitials(name: string | null | undefined): string {
  if (!name) return 'TR'
  const parts = name.split(/[\s\-_&]+/).filter(Boolean).slice(0, 2)
  const s = parts.map((chunk) => chunk[0]?.toUpperCase() ?? '').join('')
  return s || 'TR'
}

/** true = só criador registra placar; false = jogadores na própria partida. Aceita JSON estrito ou string acidental. */
export function isAdminOnlyScoring(settings: unknown): boolean {
  const raw = (settings as { adminScores?: unknown } | null)?.adminScores
  if (raw === false || raw === 0) return false
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'false') return false
  return true
}

/** Torneio com validação de placar por votação entre participantes. */
export function isScoreValidationEnabled(settings: unknown): boolean {
  const raw = (settings as { scoreValidation?: unknown } | null)?.scoreValidation
  if (raw === true || raw === 1) return true
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'true') return true
  return false
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
  /** Índice do confronto no mata-mata (mesmo valor nas duas pernas). */
  playoff_pair_index?: number | null
  /** 1 = ida, 2 = volta; omitido/null em partida única ou fase de grupos. */
  playoff_leg?: number | null
  home_penalties?: number | null
  away_penalties?: number | null
  created_at?: string
  updated_at?: string
}

export interface MatchWithTeams extends Match {
  homeTeam?: {
    id: string
    user_id?: string | null
    team_name: string
    profile?: {
      id?: string | null
      nickname: string | null
      name?: string | null
      avatar_url: string | null
      email?: string | null
    }
  }
  awayTeam?: {
    id: string
    user_id?: string | null
    team_name: string
    profile?: {
      id?: string | null
      nickname: string | null
      name?: string | null
      avatar_url: string | null
      email?: string | null
    }
  }
}

export interface StandingsRow {
  participant_id: string
  user_id?: string | null
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
  penalty_points: number        // pontos de punição/bônus (valor negativo = punição)
  penalty_reason: string | null // motivo exibido no tooltip
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
