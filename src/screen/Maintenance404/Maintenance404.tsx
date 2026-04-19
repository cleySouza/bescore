import styles from './Maintenance404.module.css'
import logoName from '../../assets/logo_name.svg'

export function Maintenance404() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src={logoName} alt="BeScore" className={styles.logo} />
        <span className={styles.code}>404</span>
        <h1 className={styles.title}>Em manutencao</h1>
        <p className={styles.message}>
          Estamos ajustando a plataforma para melhorar sua experiencia.
        </p>
        <p className={styles.subMessage}>
          Tente novamente em instantes.
        </p>
      </div>
    </div>
  )
}
