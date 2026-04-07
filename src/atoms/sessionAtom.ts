import { atom } from 'jotai'
import type { Session, User } from '@supabase/supabase-js'

// Atom principal da sessão
export const sessionAtom = atom<Session | null>(null)

// Atom derivado para o usuário
export const userAtom = atom<User | null>((get) => {
  const session = get(sessionAtom)
  return session?.user ?? null
})

// Atom derivado para status de autenticação
export const isAuthenticatedAtom = atom<boolean>((get) => {
  const session = get(sessionAtom)
  return !!session
})
