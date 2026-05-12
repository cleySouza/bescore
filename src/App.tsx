import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { isAuthenticatedAtom, userAtom } from './atoms/sessionAtom'
import { canUserAccessApp } from './lib/rolloutAccess'
import { AppRouter } from './app/router/AppRouter'
import { GlobalToast } from './app/layout/GlobalToast'
import { Maintenance404 } from './screen/Maintenance404/Maintenance404'
import styles from './App.module.css'

function App() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const user = useAtomValue(userAtom)
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

  const blockRouter = isAuthenticated && (isCheckingAccess || !hasAccess)

  return (
    <div className={styles.appContainer}>
      {blockRouter ? (
        isCheckingAccess ? (
          <div className="app-loading-screen" role="status" aria-label="Validando acesso">
            <div className="app-loading-spinner" aria-hidden="true" />
          </div>
        ) : (
          <Maintenance404 />
        )
      ) : (
        <AppRouter />
      )}

      <GlobalToast />
    </div>
  )
}

export default App
