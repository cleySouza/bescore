import styles from './ToggleSwitch.module.css'

interface ToggleSwitchProps {
  label: string
  isActive: boolean
  onClick: () => void
  disabled?: boolean
}

export const ToggleSwitch = ({ label, isActive, onClick, disabled = false }: ToggleSwitchProps) => (
  <button
    type="button"
    className={`${styles.toggleBtn} ${isActive ? styles.active : ''}`}
    onClick={onClick}
    disabled={disabled}
    aria-pressed={isActive}
  >
    <div className={styles.toggleCircle} />
    <span>{label}</span>
  </button>
)
