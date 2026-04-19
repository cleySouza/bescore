import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Drawer } from '../Drawer/Drawer'
import logoName from '../../assets/logo_name.svg'
import { env } from '../../config/env'
import styles from './Header.module.css'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface HeaderProps {
  user: User | null
  onLogout: () => void
}

export const Header = ({ user, onLogout }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const userName = useMemo(() => {
    const metadataName = user?.user_metadata?.name
    if (typeof metadataName === 'string' && metadataName.trim()) {
      return metadataName
    }
    return user?.email ?? 'Usuario'
  }, [user?.email, user?.user_metadata?.name])

  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : ''
  const appVersion = env.appVersion
  const canInstallApp = Boolean(installPrompt) && !isInstalled

  useEffect(() => {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)')
    const isStandalone =
      standaloneMedia.matches ||
      // `navigator.standalone` existe no Safari iOS quando app já foi adicionado.
      (typeof window.navigator !== 'undefined' &&
        'standalone' in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))

    setIsInstalled(isStandalone)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!installPrompt) return

    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice

    if (outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

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
          <span className={styles.userNameLabel}>{userName}</span>
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

        {canInstallApp && (
          <button
            type="button"
            onClick={handleInstallApp}
            className={styles.installBtn}
          >
            Instalar app
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className={styles.logoutBtn}
        >
          Sair
        </button>
        <p className={styles.versionText}>v{appVersion}</p>
      </Drawer>
    </>
  )
};
