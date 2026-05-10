import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { canUserAccessApp, invalidateRolloutAccessCache } from '../lib/rolloutAccess'

export function useAccessControl(user: User | null) {
  const [hasAccess, setHasAccess] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessRevision, setAccessRevision] = useState(0)

  useEffect(() => {
    if (!user) return

    const onOnline = () => {
      invalidateRolloutAccessCache(user)
      setAccessRevision((r) => r + 1)
    }

    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [user])

  useEffect(() => {
    if (!user) {
      setHasAccess(true)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    canUserAccessApp(user)
      .then((allowed) => {
        if (!cancelled) {
          setHasAccess(allowed)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setHasAccess(false)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user, accessRevision])

  return { hasAccess, loading, error }
}
