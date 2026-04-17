import { useEffect } from 'react'
import type { ReactNode } from 'react'
import styles from './Drawer.module.css'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  ariaLabel: string
  title?: string
  children: ReactNode
  panelClassName?: string
}

export function Drawer({
  isOpen,
  onClose,
  ariaLabel,
  title,
  children,
  panelClassName,
}: DrawerProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const panelClasses = panelClassName
    ? `${styles.panel} ${panelClassName}`
    : styles.panel

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <aside
        className={panelClasses}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className={styles.mobileHandle} aria-hidden="true" />

        <header className={styles.header}>
          {title ? <h3 className={styles.title}>{title}</h3> : <span />}
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar drawer"
          >
            x
          </button>
        </header>

        {children}
      </aside>
    </div>
  )
}
