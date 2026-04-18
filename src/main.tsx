import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, useSetAtom } from 'jotai'
import { supabase } from './lib/supabaseClient'
import { logger } from './lib/logger'
import { sessionAtom } from './atoms/sessionAtom'
import { strapiShieldsMapAtom } from './atoms/catalogAtom'
import { fetchStrapiClubCatalog } from './lib/strapiClubService'
import './styles/theme.css'
import App from './App'

// Componente para inicializar a autenticação
function AuthInitializer() {
  const setSession = useSetAtom(sessionAtom)
  const setStrapiShieldsMap = useSetAtom(strapiShieldsMapAtom)

  useEffect(() => {
    // Debug: verificar URL atual
    logger.log('Current URL:', window.location.href)
    logger.log('URL Hash:', window.location.hash)
    logger.log('URL Search:', window.location.search)

    // Pegar sessão inicial
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      logger.log('Initial session:', session)
      logger.log('Session error:', error)
      setSession(session)
    })

    // Escutar mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('Auth state change:', event, session)
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  useEffect(() => {
    let cancelled = false

    fetchStrapiClubCatalog()
      .then(({ teamData }) => {
        if (cancelled) return

        const map: Record<string, string> = {}
        for (const clubs of Object.values(teamData)) {
          for (const club of clubs) {
            if (club.logo) map[club.name] = club.logo
          }
        }

        if (Object.keys(map).length > 0) {
          setStrapiShieldsMap(map)
        }
      })
      .catch(() => {
        // Silencioso: o app mantém fallback por iniciais até o catálogo responder.
      })

    return () => {
      cancelled = true
    }
  }, [setStrapiShieldsMap])

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <AuthInitializer />
    </Provider>
  </StrictMode>,
)
