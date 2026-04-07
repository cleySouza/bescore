import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, useSetAtom } from 'jotai'
import { supabase } from './lib/supabaseClient'
import { sessionAtom } from './atoms/sessionAtom'
import App from './App'

// Componente para inicializar a autenticação
function AuthInitializer() {
  const setSession = useSetAtom(sessionAtom)

  useEffect(() => {
    // Debug: verificar URL atual
    console.log('Current URL:', window.location.href)
    console.log('URL Hash:', window.location.hash)
    console.log('URL Search:', window.location.search)

    // Pegar sessão inicial
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Initial session:', session)
      console.log('Session error:', error)
      setSession(session)
    })

    // Escutar mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session)
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
