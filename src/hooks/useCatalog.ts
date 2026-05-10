import { useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { strapiCatalogAtom, strapiShieldsMapAtom, createShieldsMap } from '../atoms/catalogAtom'
import { fetchStrapiClubCatalog } from '../lib/strapiClubService'

export function useCatalog() {
  const [catalog, setCatalog] = useAtom(strapiCatalogAtom)
  const setShieldsMap = useSetAtom(strapiShieldsMapAtom)

  // Hidrata escudos a partir do que já está em memória/storage (inclui offline).
  useEffect(() => {
    if (!catalog) return
    setShieldsMap(createShieldsMap(catalog.teamData))
  }, [catalog, setShieldsMap])

  // Stale-while-revalidate: só busca se cache ausente ou com mais de 1h.
  // Evita bater no Strapi desnecessariamente quando o cache ainda é recente.
  useEffect(() => {
    let cancelled = false
    const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora

    const revalidate = async (currentCatalog: typeof catalog) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return

      const isStale =
        !currentCatalog ||
        !currentCatalog.fetchedAt ||
        Date.now() - currentCatalog.fetchedAt > CACHE_TTL_MS

      if (!isStale) return

      try {
        const data = await fetchStrapiClubCatalog()
        if (cancelled) return
        setCatalog({ ...data, fetchedAt: Date.now() })
        setShieldsMap(createShieldsMap(data.teamData))
      } catch (error) {
        console.warn('Failed to load catalog:', error)
      }
    }

    void revalidate(catalog)

    const onOnline = () => void revalidate(catalog)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
    }
    return () => {
      cancelled = true
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
      }
    }
  }, [catalog, setCatalog, setShieldsMap])

  return catalog
}
