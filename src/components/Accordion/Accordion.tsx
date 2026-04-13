import type { ReactNode } from 'react'
import styles from './Accordion.module.css'

interface AccordionProps {
  isOpen: boolean
  onToggle: () => void
  header: ReactNode
  children?: ReactNode
  className?: string
  headerClassName?: string
  headerOpenClassName?: string
  contentClassName?: string
  chevronClassName?: string
  chevronOpenClassName?: string
}

const join = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

function Accordion({
  isOpen,
  onToggle,
  header,
  children,
  className,
  headerClassName,
  headerOpenClassName,
  contentClassName,
  chevronClassName,
  chevronOpenClassName,
}: AccordionProps) {
  return (
    <div className={join(styles.container, className)}>
      <button
        type="button"
        className={join(
          styles.trigger,
          headerClassName,
          isOpen && styles.triggerOpen,
          isOpen && headerOpenClassName,
        )}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        {header}
        <span
          className={join(
            styles.chevron,
            chevronClassName,
            isOpen && styles.chevronOpen,
            isOpen && chevronOpenClassName,
          )}
          aria-hidden
        >
          ›
        </span>
      </button>

      {isOpen && <div className={join(styles.content, contentClassName)}>{children}</div>}
    </div>
  )
}

export default Accordion
