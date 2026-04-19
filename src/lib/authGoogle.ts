import { supabase } from './supabaseClient'

const APP_CACHE_PREFIX = 'bescore.'

function clearPersistedAppCache(): void {
  const clearByPrefix = (storage: Storage) => {
    const keysToRemove: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(APP_CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key))
  }

  clearByPrefix(window.localStorage)
  clearByPrefix(window.sessionStorage)
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  })
  
  if (error) {
    console.error('Error signing in with Google:', error.message)
    throw error
  }
  
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error.message)
    throw error
  }

  clearPersistedAppCache()
}