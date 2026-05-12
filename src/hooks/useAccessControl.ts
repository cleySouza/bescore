import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { canUserAccessApp } from '../lib/rolloutAccess'

const ROLLOUT_VALIDATED_USER_KEY = 'bescore.rolloutValidatedUserId'

export function useAccessControl(user: User | null) {
  const [hasAccess, setHasAccess] = useState(true)
  const [loading, setLoading] = useState(() => user !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setHasAccess(true)
      setLoading(false)
      return
    }

    try {
      if (typeof sessionStorage !== 'undefined') {
        const cached = sessionStorage.getItem(ROLLOUT_VALIDATED_USER_KEY)
        if (cached === user.id) {
          setHasAccess(true)
          setLoading(false)
          setError(null)
          return
        }
      }
    } catch {
      /* ignore */
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    canUserAccessApp(user)
      .then((allowed) => {
        if (cancelled) return
        setHasAccess(allowed)
        if (allowed) {
          try {
            sessionStorage.setItem(ROLLOUT_VALIDATED_USER_KEY, user.id)
          } catch {
            /* ignore */
          }
        } else {
          try {
            sessionStorage.removeItem(ROLLOUT_VALIDATED_USER_KEY)
          } catch {
            /* ignore */
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setHasAccess(false)
        try {
          sessionStorage.removeItem(ROLLOUT_VALIDATED_USER_KEY)
        } catch {
          /* ignore */
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
  }, [user])

  return { hasAccess, loading, error }
}
