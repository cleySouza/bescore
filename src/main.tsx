import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'jotai'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './providers/AuthProvider'
import { AppRouter } from './router/AppRouter'
import './styles/theme.css'

// PWA registration
registerSW({ immediate: true })

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
    <Provider>
      <AuthProvider>
        <div className="app-wrapper">
          <AppRouter />
        </div>
      </AuthProvider>
    </Provider>
  </StrictMode>
)
