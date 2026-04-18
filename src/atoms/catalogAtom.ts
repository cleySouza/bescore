import { atomWithStorage } from 'jotai/utils'

/**
 * Cache global dos escudos vindos do Strapi (nome do time -> URL da imagem).
 * Persiste no storage para reduzir requisições após refresh/login.
 */
export const strapiShieldsMapAtom = atomWithStorage<Record<string, string>>(
  'bescore.strapiShieldsMap',
  {}
)
