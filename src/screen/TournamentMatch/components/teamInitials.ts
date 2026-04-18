export function getTeamInitials(name: string | null | undefined) {
  if (!name) return 'TM'
  return name
    .split(/\s+/)
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
