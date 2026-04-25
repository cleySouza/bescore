import { useEffect, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { isAuthenticatedAtom, userAtom } from './atoms/sessionAtom'
import { globalToastAtom } from './atoms/tournamentAtoms'
import { canUserAccessApp } from './lib/rolloutAccess'
import { SignIn } from './screen/SingIn/SignIn'
import { LoggedIn } from './screen/LoggedIn/LoggedIn'
import { Maintenance404 } from './screen/Maintenance404/Maintenance404'
import styles from './App.module.css'

function App() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const user = useAtomValue(userAtom)
  const [toast, setToast] = useAtom(globalToastAtom)
  const [hasAccess, setHasAccess] = useState(true)
  const [isCheckingAccess, setIsCheckingAccess] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setHasAccess(true)
      setIsCheckingAccess(false)
      return
    }

    let cancelled = false
    setIsCheckingAccess(true)

    canUserAccessApp(user)
      .then((allowed) => {
        if (!cancelled) setHasAccess(allowed)
      })
      .catch(() => {
        if (!cancelled) setHasAccess(false)
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAccess(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    if (!toast) return

    const timeoutId = setTimeout(() => {
      setToast(null)
    }, 2600)

    return () => clearTimeout(timeoutId)
  }, [toast, setToast])

  return (
    <>
      {!isAuthenticated ? (
        <SignIn />
      ) : isCheckingAccess ? (
        <div className="app-loading-screen" role="status" aria-label="Validando acesso">
          <div className="app-loading-spinner" aria-hidden="true" />
        </div>
      ) : hasAccess ? (
        <LoggedIn />
      ) : (
        <Maintenance404 />
      )}

      {toast && (
        <div className={styles.globalToastRoot} aria-live="polite">
          <div className={`${styles.globalToast} ${styles[`globalToast${toast.type[0].toUpperCase()}${toast.type.slice(1)}`]}`}>
            {toast.message}
          </div>
        </div>
      )}

      <footer style={{
        width: '100%',
        background: '#f8f9fa',
        borderTop: '1px solid #e0e0e0',
        padding: '16px 0',
        textAlign: 'center',
        position: 'fixed',
        left: 0,
        bottom: 0,
        zIndex: 1000
      }}>
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#1a73e8',
            textDecoration: 'underline',
            fontWeight: 500,
            fontSize: 15
          }}
        >
          Política de Privacidade
        </a>
      </footer>
    </>
  )
}

export default App
