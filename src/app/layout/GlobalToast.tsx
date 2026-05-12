import { useEffect } from 'react'
import { useAtom } from 'jotai'
import { globalToastAtom } from '../../atoms/tournamentAtoms'
import styles from '../../App.module.css'

export function GlobalToast() {
  const [toast, setToast] = useAtom(globalToastAtom)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
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
      <div className={`${styles.globalToast} ${variant}`}>{toast.message}</div>
    </div>
  )
}
