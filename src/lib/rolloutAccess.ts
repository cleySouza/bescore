import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

const APP_ROLLOUT_FLAG_KEY = 'app_rollout_gate'
const ACCESS_CACHE_TTL_MS = 30_000

type CachedAccess = {
  value: boolean
  expiresAt: number
}

const accessCache = new Map<string, CachedAccess>()

function isMissingTableError(error: { message?: string } | null | undefined, table: string): boolean {
  if (!error?.message) return false
  return error.message.includes(`Could not find the table 'public.${table}' in the schema cache`)
}

function getCacheKey(user: User): string {
  return `${user.id}:${user.email?.toLowerCase() ?? ''}`
}

function getCachedAccess(user: User): boolean | null {
  const key = getCacheKey(user)
  const cached = accessCache.get(key)
  if (!cached) return null

  if (Date.now() > cached.expiresAt) {
    accessCache.delete(key)
    return null
  }

  return cached.value
}

function setCachedAccess(user: User, value: boolean): void {
  const key = getCacheKey(user)
  accessCache.set(key, {
    value,
    expiresAt: Date.now() + ACCESS_CACHE_TTL_MS,
  })
}

export async function canUserAccessApp(user: User | null): Promise<boolean> {
  if (!user) return false

  const cached = getCachedAccess(user)
  if (cached !== null) return cached

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: flag, error: flagError } = await (supabase as any)
    .from('feature_flags')
    .select('enabled, default_allow')
    .eq('key', APP_ROLLOUT_FLAG_KEY)
    .maybeSingle()

  // Fallback permissivo se o schema de feature flags ainda não existe.
  if (flagError && isMissingTableError(flagError, 'feature_flags')) {
    setCachedAccess(user, true)
    return true
  }

  if (flagError) {
    throw new Error(`Falha ao consultar feature flag de rollout: ${flagError.message}`)
  }

  const isEnabled = Boolean(flag?.enabled)
  const defaultAllow = typeof flag?.default_allow === 'boolean' ? flag.default_allow : false

  // Flag desligada = app liberado para todos.
  if (!isEnabled) {
    setCachedAccess(user, true)
    return true
  }

  const userEmail = user.email?.toLowerCase() ?? ''
  const orFilters = [`user_id.eq.${user.id}`]
  if (userEmail) {
    orFilters.push(`email.eq.${userEmail}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rules, error: rulesError } = await (supabase as any)
    .from('feature_flag_access')
    .select('allow')
    .eq('flag_key', APP_ROLLOUT_FLAG_KEY)
    .or(orFilters.join(','))

  if (rulesError && isMissingTableError(rulesError, 'feature_flag_access')) {
    setCachedAccess(user, defaultAllow)
    return defaultAllow
  }

  if (rulesError) {
    throw new Error(`Falha ao consultar regras de rollout: ${rulesError.message}`)
  }

  const matchedRules = Array.isArray(rules) ? rules : []

  // Prioridade: bloqueio explícito > liberação explícita > default flag.
  if (matchedRules.some((rule) => rule.allow === false)) {
    setCachedAccess(user, false)
    return false
  }

  if (matchedRules.some((rule) => rule.allow === true)) {
    setCachedAccess(user, true)
    return true
  }

  setCachedAccess(user, defaultAllow)
  return defaultAllow
}

