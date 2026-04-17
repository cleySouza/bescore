import { useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Drawer } from '../Drawer/Drawer'
import logoName from '../../assets/logo_name.svg'
import styles from './Header.module.css'

interface HeaderProps {
  user: User | null
  onLogout: () => void
}

export const Header = ({ user, onLogout }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const userName = useMemo(() => {
    const metadataName = user?.user_metadata?.name
    if (typeof metadataName === 'string' && metadataName.trim()) {
      return metadataName
    }
    return user?.email ?? 'Usuario'
  }, [user?.email, user?.user_metadata?.name])

  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : ''

  return (
    <>
      <header className={styles.header}>
        <img src={logoName} alt="BeScore" className={styles.logo} />
        <button
          type="button"
          className={styles.userTrigger}
          onClick={() => setIsMenuOpen(true)}
          aria-label="Abrir menu do usuario"
          aria-expanded={isMenuOpen}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback} aria-hidden="true">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className={styles.chevron} aria-hidden="true">
            v
          </span>
        </button>
      </header>

      <Drawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        ariaLabel="Menu do usuario"
        title="Minha conta"
        panelClassName={styles.profileDrawer}
      >
        <div className={styles.userCard}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar do usuario" className={styles.avatarLarge} />
          ) : (
            <div className={styles.avatarLargeFallback} aria-hidden="true">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <p className={styles.userNameFull}>{userName}</p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className={styles.logoutBtn}
        >
          Sair
        </button>
      </Drawer>
    </>
  )
};
