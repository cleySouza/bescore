import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useSetAtom } from 'jotai'
import { supabase } from '../lib/supabaseClient'
import { logger } from '../lib/logger'
import { sessionAtom } from '../atoms/sessionAtom'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const setJotaiSession = useSetAtom(sessionAtom)
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Resolve sessão inicial
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      logger.log('Initial session:', session)
      setJotaiSession(session ?? null)
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: error?.message ?? null
      })
    })

    // Listen para mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('Auth state change:', event, session)
      setJotaiSession(session ?? null)
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session,
        loading: false,
        error: null
      }))
    })

    return () => subscription.unsubscribe()
  }, [setJotaiSession])

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }))
    const { error } = await supabase.auth.signOut()
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
