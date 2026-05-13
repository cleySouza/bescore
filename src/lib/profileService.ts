import type { User } from '@supabase/supabase-js'
import type { Tables } from '../types/supabase'
import { supabase } from './supabaseClient'

export type ProfileRow = Tables<'profiles'>

const AVATAR_BUCKET = 'avatars'

export const PROFILE_NICKNAME_MAX = 48

/** Perfil em torneios/listas: nickname opcional substitui `name` (nome OAuth guardado no BD). */
export function profileDisplayName(
  profile: { nickname?: string | null; name?: string | null; email?: string | null } | null | undefined
): string {
  const nick = profile?.nickname?.trim()
  if (nick) return nick
  const nm = profile?.name?.trim()
  if (nm) return nm
  const em = profile?.email?.trim()
  if (em) {
    const at = em.split('@')[0]
    if (at) return at
  }
  return 'Jogador'
}

/** Cabeçalho / menu: mesmo critério de torneios; fallback ao OAuth em sessão se o perfil ainda não tiver `name`. */
export function displayName(user: User | null, profile: ProfileRow | null): string {
  const nick = profile?.nickname?.trim()
  if (nick) return nick
  const stored = profile?.name?.trim()
  if (stored) return stored
  const meta = user?.user_metadata?.name
  if (typeof meta === 'string' && meta.trim()) return meta.trim()
  return user?.email ?? 'Usuario'
}

/** Avatar: URL em `profiles.avatar_url` substitui a foto do Google quando definida. */
export function displayAvatarUrl(user: User | null, profile: ProfileRow | null): string {
  const custom = profile?.avatar_url?.trim()
  if (custom) return custom
  const g = user?.user_metadata?.avatar_url
  return typeof g === 'string' ? g : ''
}

function googleDisplayName(user: User): string | null {
  const meta = user.user_metadata?.name
  if (typeof meta === 'string' && meta.trim()) return meta.trim()
  return null
}

/** Mantém `name` e `email` alinhados ao OAuth em cada carregamento (nickname e avatar ficam com o utilizador). */
export async function syncProfileGoogleBasics(user: User): Promise<void> {
  const patch = {
    name: googleDisplayName(user),
    email: user.email ?? undefined,
  }
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) console.warn('syncProfileGoogleBasics:', error.message)
}

export async function ensureUserProfile(user: User): Promise<void> {
  const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (data) return

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email ?? '',
    name: googleDisplayName(user),
    nickname: null,
    avatar_url: null,
  })

  if (error?.code === '23505') return
  if (error) throw new Error(`Não foi possível criar o perfil: ${error.message}`)
}

export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function updateMyProfile(
  userId: string,
  patch: { nickname?: string | null; avatar_url?: string | null }
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw new Error(error.message)
}

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return 'Use uma imagem JPEG, PNG, WebP ou GIF.'
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Imagem demasiado grande (máx. 5 MB).'
  }
  return null
}

export async function uploadMyAvatar(userId: string, file: File): Promise<string> {
  const err = validateAvatarFile(file)
  if (err) throw new Error(err)

  const extFromMime =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
          ? 'gif'
          : 'jpg'
  const path = `${userId}/${Date.now()}.${extFromMime}`

  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) throw new Error(upErr.message)

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
