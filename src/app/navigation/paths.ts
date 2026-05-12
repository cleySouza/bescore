/**
 * Rotas canônicas da aplicação (única fonte de verdade para URLs).
 * Equivalente a rotas nomeadas em frameworks tipo Spring — evita strings mágicas nas páginas.
 */
export const paths = {
  login: '/login',
  home: '/',
  join: '/join',
  createTournament: '/tournaments/new',
  tournamentRoot: (tournamentId: string) => `/tournaments/${tournamentId}`,
  tournamentLobby: (tournamentId: string) => `/tournaments/${tournamentId}/lobby`,
  tournamentMatches: (tournamentId: string) => `/tournaments/${tournamentId}/matches`,
} as const
