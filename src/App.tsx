import { useEffect } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { isAuthenticatedAtom } from './atoms/sessionAtom'
import { globalToastAtom } from './atoms/tournamentAtoms'
import { SignIn } from './screen/SingIn/SignIn'
import { LoggedIn } from './screen/LoggedIn/LoggedIn'
import styles from './App.module.css'

function App() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const [toast, setToast] = useAtom(globalToastAtom)

  useEffect(() => {
    if (!toast) return

    const timeoutId = setTimeout(() => {
      setToast(null)
    }, 2600)

    return () => clearTimeout(timeoutId)
  }, [toast, setToast])

  return (
    <>
      {!isAuthenticated ? <SignIn /> : <LoggedIn />}

      {toast && (
        <div className={styles.globalToastRoot} aria-live="polite">
          <div className={`${styles.globalToast} ${styles[`globalToast${toast.type[0].toUpperCase()}${toast.type.slice(1)}`]}`}>
            {toast.message}
          </div>
        </div>
      )}
    </>
  )
}

export default App
