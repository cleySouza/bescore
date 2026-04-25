// src/main.tsx
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { registerSW } from 'virtual:pwa-register'
import { supabase } from './lib/supabaseClient'
import { logger } from './lib/logger'
import { sessionAtom } from './atoms/sessionAtom'
import {
  createShieldsMap,
  hasStrapiCatalogData,
  strapiCatalogAtom,
  strapiShieldsMapAtom,
} from './atoms/catalogAtom'
import { fetchStrapiClubCatalog } from './lib/strapiClubService'
import './styles/theme.css'
import App from './App'

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __bescoreInstallPromptEvent?: DeferredInstallPromptEvent
    __bescoreInstallPromptListenerRegistered?: boolean
  }
}

if (typeof window !== 'undefined' && !window.__bescoreInstallPromptListenerRegistered) {
  window.__bescoreInstallPromptListenerRegistered = true

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault()
    window.__bescoreInstallPromptEvent = event as DeferredInstallPromptEvent
    window.dispatchEvent(new Event('bescore-install-available'))
  })

  window.addEventListener('appinstalled', () => {
    window.__bescoreInstallPromptEvent = undefined
    window.dispatchEvent(new Event('bescore-app-installed'))
  })
}

registerSW({ immediate: true })

function AuthInitializer() {
  const setSession = useSetAtom(sessionAtom)
  const session = useAtomValue(sessionAtom)
  const [catalogCache, setCatalogCache] = useAtom(strapiCatalogAtom)
  const setStrapiShieldsMap = useSetAtom(strapiShieldsMapAtom)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const [isCatalogReady, setIsCatalogReady] = useState(
    hasStrapiCatalogData(catalogCache)
  )

  // 1. Resolve a sessão ao montar — obrigatório antes de qualquer outra coisa
  useEffect(() => {
    logger.log('Current URL:', window.location.href)
    logger.log('URL Hash:', window.location.hash)
    logger.log('URL Search:', window.location.search)

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      logger.log('Initial session:', session)
      logger.log('Session error:', error)
      setSession(session)
      setIsSessionReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('Auth state change:', event, session)
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  // 2. Se o cache já tem dados, garante que o shieldsMap está populado
  useEffect(() => {
    if (!hasStrapiCatalogData(catalogCache)) return

    setStrapiShieldsMap(createShieldsMap(catalogCache.teamData))
    setIsCatalogReady(true)
  }, [catalogCache, setStrapiShieldsMap])

  // 3. Só carrega o catálogo após sessão resolvida E com usuário autenticado
  useEffect(() => {
    if (!isSessionReady) return           // aguarda sessão
    if (!session) return                  // sem sessão, não há token para a API
    if (hasStrapiCatalogData(catalogCache)) return  // já tem cache, não refetch

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const loadCatalog = async () => {
      try {
        const catalog = await fetchStrapiClubCatalog()
        if (cancelled) return

        setCatalogCache(catalog)
        setStrapiShieldsMap(createShieldsMap(catalog.teamData))
        setIsCatalogReady(true)
      } catch (error) {
        if (cancelled) return

        logger.warn('[catalog] Falha ao carregar catálogo. Tentando novamente...', error)
        retryTimer = setTimeout(loadCatalog, 2000)
      }
    }

    loadCatalog()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [isSessionReady, session, catalogCache, setCatalogCache, setStrapiShieldsMap])

  // Bloqueia render enquanto a sessão não foi resolvida
  // Após resolver: se não há sessão, libera para mostrar <SignIn />
  //                se há sessão, aguarda o catálogo carregar
  const canRender = isSessionReady && (!session || isCatalogReady)

  if (!canRender) {
    return (
      <div className="app-loading-screen" role="status" aria-label="Carregando">
        <div className="app-loading-spinner" aria-hidden="true" />
      </div>
    )
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <AuthInitializer />
    </Provider>
  </StrictMode>,
)