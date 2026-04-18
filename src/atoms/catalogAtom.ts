import { atomWithStorage } from 'jotai/utils'
import type { Continent, League, TeamDataMap } from '../lib/strapiClubService'

export interface StrapiCatalogCache {
  continents: Continent[]
  leaguesByContinent: { [continentId: string]: League[] }
  teamData: TeamDataMap
}

/**
 * Cache global dos escudos vindos do Strapi (nome do time -> URL da imagem).
 * Persiste no storage para reduzir requisições após refresh/login.
 */
export const strapiShieldsMapAtom = atomWithStorage<Record<string, string>>(
  'bescore.strapiShieldsMap',
  {}
)

/**
 * Cache completo do catálogo para evitar refetch ao abrir o modal de seleção.
 */
export const strapiCatalogAtom = atomWithStorage<StrapiCatalogCache | null>(
  'bescore.strapiCatalog',
  null
)

export function hasStrapiCatalogData(
  catalog: StrapiCatalogCache | null
): catalog is StrapiCatalogCache {
  return Boolean(
    catalog &&
    catalog.continents.length > 0 &&
    Object.keys(catalog.teamData).length > 0
  )
}

export function createShieldsMap(teamData: TeamDataMap): Record<string, string> {
  const map: Record<string, string> = {}
  for (const clubs of Object.values(teamData)) {
    for (const club of clubs) {
      if (club.logo) map[club.name] = club.logo
    }
  }
  return map
}
