import { paths } from '../navigation/paths'

/** Destinos relativos permitidos em ?redirect= após login. */
export function safeRedirectTarget(raw: string | null): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null

  const pathOnly = (trimmed.split('?')[0] ?? '').trim()
  if (!pathOnly || pathOnly === paths.login) return null

  if (pathOnly === paths.home) return trimmed
  if (pathOnly === paths.join) return trimmed
  if (pathOnly === paths.createTournament) return trimmed
  if (pathOnly.startsWith('/tournaments/')) return trimmed

  return null
}
