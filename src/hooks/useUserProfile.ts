import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ensureUserProfile,
  fetchMyProfile,
  syncProfileGoogleBasics,
  type ProfileRow,
} from '../lib/profileService'

export function useUserProfile(user: User | null) {
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }
    try {
      await ensureUserProfile(user)
      await syncProfileGoogleBasics(user)
      const row = await fetchMyProfile(user.id)
      setProfile(row)
    } catch (e) {
      console.error('useUserProfile:', e)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { profile, refreshProfile: refresh }
}
