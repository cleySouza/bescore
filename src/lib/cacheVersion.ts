const CACHE_VERSION_KEY = 'bescore.cacheVersion'
const APP_CACHE_PREFIX = 'bescore.'

/**
 * Limpa todo o cache do localStorage com prefixo "bescore." quando a versão
 * da app muda. Evita tela branca causada por dados num formato incompatível
 * com uma nova versão do código.
 */
export function clearCacheOnVersionChange(currentVersion: string): void {
  if (typeof window === 'undefined') return

  const storedVersion = localStorage.getItem(CACHE_VERSION_KEY)

  if (storedVersion === currentVersion) return

  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(APP_CACHE_PREFIX) && key !== CACHE_VERSION_KEY) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))

  localStorage.setItem(CACHE_VERSION_KEY, currentVersion)
}
