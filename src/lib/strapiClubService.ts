export interface Club {
  id: string
  name: string
  shortName?: string
  logo: string
  color: string
}

export interface League {
  id: string
  name: string
  logo: string
  color: string
  label: string
  isNational?: boolean
}

export interface Continent {
  id: string
  name: string
  logo: string
}

export interface TeamDataMap {
  [leagueId: string]: Club[]
}

interface StrapiEntity {
  id?: number | string
  documentId?: string
  attributes?: Record<string, unknown>
  [key: string]: unknown
}

function getStrapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/$/, '')
}

function getStrapiApiUrl() {
  const base = getStrapiBaseUrl()
  if (!base) {
    throw new Error('VITE_STRAPI_URL não configurado no .env.local')
  }
  return base.endsWith('/api') ? base : `${base}/api`
}

function getHeaders() {
  const token = import.meta.env.VITE_STRAPI_API_TOKEN
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// Strapi v4 usa `entity.attributes`, Strapi v5 é flat (sem attributes)
function asAttributes(entity: StrapiEntity): Record<string, unknown> {
  return (entity.attributes as Record<string, unknown>) ?? entity
}

function asAbsoluteUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${getStrapiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

// Strapi 5: campo media retorna { url, formats, ... } diretamente (flat)
// Strapi 4: campo media retorna { data: { attributes: { url } } }
// O schema usa "shield" para o escudo do clube (não "logo")
function pickLogoUrl(source: Record<string, unknown>): string {
  const media = (source.shield ?? source.logo) as
    | { url?: string; data?: { attributes?: { url?: string }; url?: string } }
    | undefined

  return asAbsoluteUrl(
    media?.url ??
    media?.data?.url ??
    media?.data?.attributes?.url ??
    (source.shield_url as string | undefined) ??
    (source.logoUrl as string | undefined) ??
    (source.logo_url as string | undefined) ??
    ''
  )
}

function extractContinentId(data: Record<string, unknown>): string {
  const relation = data.continent as
    | { id?: number | string; documentId?: string; name?: string }
    | undefined
  return String(relation?.documentId ?? relation?.id ?? 'uncategorized')
}

function extractContinentName(data: Record<string, unknown>): string {
  const relation = data.continent as { name?: string } | undefined
  return String(relation?.name ?? 'Outros')
}

function normalizeLeague(entity: StrapiEntity): League & { continentId: string; continentName: string } {
  const data = asAttributes(entity)
  const id = String(entity.documentId ?? entity.id ?? data.slug ?? data.name ?? crypto.randomUUID())
  const name = String(data.name ?? data.title ?? 'Liga')
  const label = String(data.label ?? data.displayName ?? name)
  const color = String(data.color ?? '#5c2df5')
  const logo = pickLogoUrl(data)
  const isNational = Boolean(data.is_national_team ?? data.isNational ?? false)
  const continentId = extractContinentId(data)
  const continentName = extractContinentName(data)

  return { id, name, label, color, logo, isNational, continentId, continentName }
}

function extractLeagueId(source: Record<string, unknown>): string {
  const relation = source.league as
    | {
        id?: number | string
        documentId?: string
        data?: { id?: number | string; documentId?: string; attributes?: { slug?: string; name?: string } }
      }
    | undefined

  // Strapi 5: documentId primeiro, depois fallbacks
  return String(
    relation?.documentId ??
    relation?.id ??
    relation?.data?.documentId ??
    relation?.data?.id ??
    relation?.data?.attributes?.slug ??
    relation?.data?.attributes?.name ??
    source.leagueId ??
    source.league_id ??
    'ungrouped'
  )
}

function normalizeClub(entity: StrapiEntity): Club & { leagueId: string } {
  const data = asAttributes(entity)
  const id = String(entity.documentId ?? entity.id ?? data.slug ?? data.name ?? crypto.randomUUID())
  const name = String(data.name ?? data.title ?? 'Clube')
  const shortName = String(data.ShortName ?? data.shortName ?? data.short_name ?? '')
  const color = String(data.color ?? '#1f2024')
  // shield é o campo de mídia no schema do Strapi CMS
  const logo = pickLogoUrl(data)
  const leagueId = extractLeagueId(data)

  return { id, name, shortName, color, logo, leagueId }
}

async function fetchCollection(collection: string, populate: string) {
  const headers = getHeaders()
  const apiUrl = getStrapiApiUrl()
  const populateFields = populate.split(',').map((f) => f.trim()).filter(Boolean)

  const results: StrapiEntity[] = []
  let page = 1
  let pageCount = 1

  do {
    const params = new URLSearchParams({ 'pagination[page]': String(page), 'pagination[pageSize]': '100', 'sort': 'name:asc' })
    populateFields.forEach((f, i) => params.set(`populate[${i}]`, f))
    const url = `${apiUrl}/${collection}?${params.toString()}`

    const response = await fetch(url, { headers })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Strapi ${response.status} em /${collection}: ${text.slice(0, 200)}`)
    }

    const payload = await response.json()
    if (Array.isArray(payload?.data)) results.push(...(payload.data as StrapiEntity[]))
    pageCount = payload?.meta?.pagination?.pageCount ?? 1
    page++
  } while (page <= pageCount)

  return results
}

export async function fetchStrapiClubCatalog(): Promise<{
  continents: Continent[]
  leaguesByContinent: { [continentId: string]: League[] }
  teamData: TeamDataMap
}> {
  const [continentsRaw, leaguesRaw, clubsRaw] = await Promise.all([
    fetchCollection('continents', 'logo'),
    fetchCollection('leagues', 'logo,continent'),
    fetchCollection('clubs', 'shield,league'),
  ])

  const leagues = leaguesRaw.map(normalizeLeague)
  const normalizedClubs = clubsRaw.map(normalizeClub)

  // Continentes direto da API (com logo)
  const continents: Continent[] = continentsRaw.map((e) => {
    const data = asAttributes(e)
    return {
      id: String(e.documentId ?? e.id),
      name: String(data.name ?? 'Continente'),
      logo: pickLogoUrl(data),
    }
  })

  // Agrupa clubes por liga
  const teamData = normalizedClubs.reduce<TeamDataMap>((acc, club) => {
    if (!acc[club.leagueId]) acc[club.leagueId] = []
    acc[club.leagueId].push({
      id: club.id,
      name: club.name,
      shortName: club.shortName,
      logo: club.logo,
      color: club.color,
    })
    return acc
  }, {})

  // Agrupa ligas por continente
  const leaguesByContinent: { [continentId: string]: League[] } = {}
  for (const league of leagues) {
    if (!leaguesByContinent[league.continentId]) leaguesByContinent[league.continentId] = []
    leaguesByContinent[league.continentId].push({
      id: league.id,
      name: league.name,
      label: league.label,
      color: league.color,
      logo: league.logo,
      isNational: league.isNational,
    })
  }

  // Seleções (isNational) sempre por último em cada continente
  for (const key of Object.keys(leaguesByContinent)) {
    leaguesByContinent[key].sort((a, b) => {
      if (a.isNational === b.isNational) return 0
      return a.isNational ? 1 : -1
    })
  }

  return { continents, leaguesByContinent, teamData }
}
