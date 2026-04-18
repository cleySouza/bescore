/**
 * Strapi v4/v5 media types
 *
 * Strapi v5 retorna campos de mídia "flat" (sem wrapper data/attributes).
 * Strapi v4 retorna { data: { id, attributes: { url, formats, ... } } }.
 * Ambos os shapes são suportados pela utilitária getMediaUrl.
 */

export type StrapiMediaFormat = {
  name: string
  hash: string
  ext: string
  mime: string
  path: string | null
  width: number
  height: number
  size: number
  sizeInBytes?: number
  url: string
}

export type StrapiMediaFormats = {
  thumbnail?: StrapiMediaFormat
  small?: StrapiMediaFormat
  medium?: StrapiMediaFormat
  large?: StrapiMediaFormat
  [key: string]: StrapiMediaFormat | undefined
}

/** Shape flat (Strapi v5 / populate direto) */
export interface StrapiMediaFlat {
  id?: number | string
  documentId?: string
  name?: string
  mime?: string
  alternativeText?: string | null
  caption?: string | null
  width?: number | null
  height?: number | null
  formats?: StrapiMediaFormats | null
  url: string
  previewUrl?: string | null
  provider?: string
  provider_metadata?: unknown
}

/** Shape wrapped (Strapi v4 relation populate) */
export interface StrapiMediaWrapped {
  data?: {
    id?: number | string
    documentId?: string
    attributes?: Omit<StrapiMediaFlat, 'id' | 'documentId'>
    url?: string
    formats?: StrapiMediaFormats | null
  } | null
}

/**
 * Tipo union que representa qualquer shape de mídia que o Strapi pode retornar.
 * Use este tipo nos campos de mídia das suas entidades.
 */
export type StrapiMedia = StrapiMediaFlat | StrapiMediaWrapped | null | undefined

/** Tamanhos suportados em ordem de preferência decrescente */
export type StrapiMediaSize = 'large' | 'medium' | 'small' | 'thumbnail'
