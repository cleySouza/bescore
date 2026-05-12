import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'jotai'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './providers/AuthProvider'
import { AppRouter } from './app/router/AppRouter'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { clearCacheOnVersionChange } from './lib/cacheVersion'
import './styles/theme.css'

// Limpa cache do localStorage quando a versão da app muda.
clearCacheOnVersionChange(__APP_VERSION__)

// PWA registration — onNeedRefresh força reload imediato quando SW novo está pronto.
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
})

// Install prompt handling
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider>
        <AuthProvider>
          <div className="app-wrapper">
            <AppRouter />
          </div>
        </AuthProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
)
