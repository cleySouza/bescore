import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { canUserAccessApp, invalidateRolloutAccessCache } from '../lib/rolloutAccess'

export function useAccessControl(user: User | null) {
  const [hasAccess, setHasAccess] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessRevision, setAccessRevision] = useState(0)
  const userRef = useRef<User | null>(null)
  userRef.current = user

  // Listener `online` com ref para não depender da referência do objeto `user`
  // (evita loop de refresh_token a cada TOKEN_REFRESHED).
  useEffect(() => {
    const onOnline = () => {
      const u = userRef.current
      if (!u) return
      invalidateRolloutAccessCache(u)
      setAccessRevision((r) => r + 1)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const userId = user?.id
  const userEmail = user?.email ?? ''

  useEffect(() => {
    if (!userId) {
      setHasAccess(true)
      setLoading(false)
      return
    }

    const currentUser = userRef.current
    if (!currentUser) {
      setHasAccess(true)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    canUserAccessApp(currentUser)
      .then((allowed) => {
        if (!cancelled) setHasAccess(allowed)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setHasAccess(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, userEmail, accessRevision])

  return { hasAccess, loading, error }
}
