const KEY_PREFIX = 'bescore_pending_creator_team_pick:'

export function setPendingCreatorTeamPickSession(tournamentId: string): void {
  sessionStorage.setItem(KEY_PREFIX + tournamentId, '1')
}

export function clearPendingCreatorTeamPickSession(tournamentId: string): void {
  sessionStorage.removeItem(KEY_PREFIX + tournamentId)
}

export function hasPendingCreatorTeamPickSession(tournamentId: string): boolean {
  return sessionStorage.getItem(KEY_PREFIX + tournamentId) === '1'
}
