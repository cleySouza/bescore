import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { canUserAccessApp } from '../lib/rolloutAccess'

export function useAccessControl(user: User | null) {
  const [hasAccess, setHasAccess] = useState(true)
  // Inicia como true quando já existe utilizador para evitar flash entre auth e acesso
  const [loading, setLoading] = useState(() => user !== null)
  const [error, setError] = useState<string | null>(null)

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
  }, [user])

  return { hasAccess, loading, error }
}
