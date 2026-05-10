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

  // Stale-while-revalidate: tenta atualizar em background quando há rede; ao voltar online, refetch.
  useEffect(() => {
    let cancelled = false

    const revalidate = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      try {
        const data = await fetchStrapiClubCatalog()
        if (cancelled) return
        setCatalog({ ...data, fetchedAt: Date.now() })
        setShieldsMap(createShieldsMap(data.teamData))
      } catch (error) {
        console.warn('Failed to load catalog:', error)
      }
    }

    void revalidate()

    const onOnline = () => void revalidate()
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
    }
    return () => {
      cancelled = true
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
      }
    }
  }, [setCatalog, setShieldsMap])

  return catalog
}
