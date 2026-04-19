import styles from './Maintenance404.module.css'
import logoName from '../../assets/logo.svg'

export function Maintenance404() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src={logoName} alt="BeScore" className={styles.logo} />
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
