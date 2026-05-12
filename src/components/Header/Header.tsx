import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useLocation, useNavigate } from 'react-router-dom'
import { Drawer } from '../Drawer/Drawer'
import { NotificationsPanel } from '../NotificationsPanel/NotificationsPanel'
import logoName from '../../assets/logo_name.svg'
import { env } from '../../config/env'
import { paths } from '../../app/navigation/paths'
import { safeRedirectTarget } from '../../app/router/requireAuthPaths'
import { useProposalNotifications } from '../../hooks/useProposalNotifications'
import styles from './Header.module.css'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __bescoreInstallPromptEvent?: BeforeInstallPromptEvent
  }
}

interface HeaderProps {
  user: User | null
  onLogout: () => void
}

function BellGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

type DrawerView = 'profile' | 'notifications'

export const Header = ({ user, onLogout }: HeaderProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [drawerView, setDrawerView] = useState<DrawerView>('profile')
  const { proposals, unreadCount, markNotificationsViewed } = useProposalNotifications(user?.id)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

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
  const canInstallApp = !isInstalled

  const goLogin = () => {
    const next = `${location.pathname}${location.search}`
    const target = safeRedirectTarget(next)
    const qs = target ? `?redirect=${encodeURIComponent(target)}` : ''
    navigate(`${paths.login}${qs}`)
  }

  useEffect(() => {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)')
    const syncInstallState = () => {
      const isStandalone =
        standaloneMedia.matches ||
        // `navigator.standalone` existe no Safari iOS quando app já foi adicionado.
        (typeof window.navigator !== 'undefined' &&
          'standalone' in window.navigator &&
          Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))

      setIsInstalled(isStandalone)
    }

    const syncInstallPrompt = () => {
      setInstallPrompt(window.__bescoreInstallPromptEvent ?? null)
      setShowInstallHelp(false)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      setShowInstallHelp(false)
    }

    syncInstallState()
    syncInstallPrompt()

    window.addEventListener('bescore-install-available', syncInstallPrompt)
    window.addEventListener('bescore-app-installed', onAppInstalled)

    return () => {
      window.removeEventListener('bescore-install-available', syncInstallPrompt)
      window.removeEventListener('bescore-app-installed', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (isMenuOpen && drawerView === 'notifications') {
      markNotificationsViewed()
    }
  }, [isMenuOpen, drawerView, markNotificationsViewed])

  const closeDrawer = () => {
    setIsMenuOpen(false)
    setDrawerView('profile')
  }

  const handleInstallApp = async () => {
    if (!installPrompt) {
      setShowInstallHelp(true)
      return
    }

    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice

    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setShowInstallHelp(false)
    }
  }

  const showAvatarBadge = !!user && unreadCount > 0 && !isMenuOpen

  const openProfileDrawer = () => {
    setDrawerView('profile')
    setIsMenuOpen(true)
  }

  const handleOpenProposalFromPanel = (tournamentId: string, matchId: string) => {
    navigate(paths.tournamentMatches(tournamentId), { state: { focusMatchId: matchId } })
    closeDrawer()
  }

  return (
    <>
      <header className={styles.header}>
        <img src={logoName} alt="BeScore" className={styles.logo} />
        {!user ? (
          <button type="button" className={styles.loginBtn} onClick={goLogin} aria-label="Entrar na conta">
            Entrar
          </button>
        ) : (
          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.userTrigger}
              onClick={openProfileDrawer}
              aria-label="Abrir menu do usuario"
              aria-expanded={isMenuOpen && drawerView === 'profile'}
            >
              <span className={styles.avatarWrap}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback} aria-hidden="true">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                {showAvatarBadge ? (
                  <span className={styles.avatarBadge} aria-hidden="true">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </span>
              <span className={styles.userNameLabel}>{userName}</span>
              <span className={styles.chevron} aria-hidden="true">
                v
              </span>
            </button>
          </div>
        )}
      </header>

      {user && (
        <Drawer
          isOpen={isMenuOpen}
          onClose={closeDrawer}
          ariaLabel={drawerView === 'profile' ? 'Menu do usuario' : 'Notificações'}
          title={drawerView === 'profile' ? 'Minha conta' : 'Notificações'}
          panelClassName={`${styles.profileDrawer} ${styles.profileDrawerFlex}`}
        >
          {drawerView === 'profile' ? (
            <div className={styles.profileScroll}>
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
                className={`${styles.notifMenuRow} ${unreadCount > 0 ? styles.notifMenuRowHighlight : ''}`}
                onClick={() => setDrawerView('notifications')}
              >
                <span className={styles.notifMenuRowInner}>
                  <BellGlyph className={styles.menuBellIcon} />
                  <span>Notificações</span>
                </span>
                {unreadCount > 0 ? (
                  <span className={styles.menuRowBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                ) : null}
              </button>

              {canInstallApp && (
                <>
                  <button
                    type="button"
                    onClick={handleInstallApp}
                    className={styles.installBtn}
                  >
                    Instalar app
                  </button>

                  {showInstallHelp && (
                    <p className={styles.installHelpText}>
                      Se o prompt nao abrir: no Android/Desktop use o menu do navegador e clique em
                      "Instalar app". No iPhone, abra Compartilhar e toque em "Adicionar a Tela de
                      Inicio".
                    </p>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={onLogout}
                className={styles.logoutBtn}
              >
                Sair
              </button>
              <p className={styles.versionText}>v{appVersion}</p>
            </div>
          ) : (
            <NotificationsPanel
              proposals={proposals}
              onBack={() => setDrawerView('profile')}
              onOpenProposal={handleOpenProposalFromPanel}
            />
          )}
        </Drawer>
      )}
    </>
  )
}
