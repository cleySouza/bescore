import type { User } from '@supabase/supabase-js'
import logoName from '../../assets/logo_name.svg'
import styles from './Header.module.css'

interface HeaderProps {
  user: User | null
  onLogout: () => void
}

export const Header = ({ user, onLogout }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <img src={logoName} alt="BeScore" className={styles.logo} />
      <div className={styles.userInfo}>
        <img src={user?.user_metadata?.avatar_url} alt="Avatar" className={styles.avatar} />
        <span className={styles.userName}>{user?.user_metadata?.name}</span>
        <button onClick={onLogout} className={styles.logoutBtn}>
          Sair
        </button>
      </div>
    </header>
  )
};
