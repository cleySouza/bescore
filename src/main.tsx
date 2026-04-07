import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, useSetAtom } from 'jotai'
import { supabase } from './lib/supabaseClient'
import { sessionAtom } from './atoms/sessionAtom'
import App from './App.tsx'

function AuthInitializer() {
  const setSession = useSetAtom(sessionAtom)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <AuthInitializer />
    </Provider>
  </StrictMode>,
)
