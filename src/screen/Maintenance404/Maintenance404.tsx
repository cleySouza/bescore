import styles from './Maintenance404.module.css'

export function Maintenance404() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <span className={styles.code}>404</span>
        <h1 className={styles.title}>Em manutencao</h1>
        <p className={styles.message}>
          Esta versao ainda nao esta liberada para seu usuario.
        </p>
        <p className={styles.subMessage}>
          Entre em contato com o administrador para solicitar acesso.
        </p>
      </div>
    </div>
  )
}
