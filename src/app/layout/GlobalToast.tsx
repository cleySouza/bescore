import { useEffect } from 'react'
import { useAtom } from 'jotai'
import { globalToastAtom } from '../../atoms/tournamentAtoms'
import styles from '../../App.module.css'

const DEFAULT_DURATION_MS = 9000

export function GlobalToast() {
  const [toast, setToast] = useAtom(globalToastAtom)

  useEffect(() => {
    if (!toast) return
    if (toast.persist) return
    const ms = toast.durationMs ?? DEFAULT_DURATION_MS
    const id = window.setTimeout(() => setToast(null), ms)
    return () => window.clearTimeout(id)
  }, [toast, setToast])

  if (!toast) return null

  const variant =
    toast.type === 'success'
      ? styles.globalToastSuccess
      : toast.type === 'error'
        ? styles.globalToastError
        : toast.type === 'warning'
          ? styles.globalToastWarning
          : styles.globalToastInfo

  return (
    <div className={styles.globalToastRoot} aria-live="polite">
      <div className={`${styles.globalToast} ${variant}`} role="status">
        <p className={styles.globalToastMessage}>{toast.message}</p>
        <button
          type="button"
          className={styles.globalToastDismiss}
          onClick={() => setToast(null)}
          aria-label="Fechar notificação"
        >
          ×
        </button>
      </div>
    </div>
  )
}
