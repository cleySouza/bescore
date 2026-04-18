/**
 * mediaUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilitária centralizada para resolver URLs de mídia do Strapi com suporte a
 * Cloudinary (URLs absolutas) e uploads locais (URLs relativas).
 *
 * Funções públicas:
 *   isExternalUrl(url)          → true se a URL for absoluta (http/https)
 *   getMediaUrl(media, options) → string com a URL resolvida
 *   getMediaSrcSet(media)       → string srcset com todos os formatos disponíveis
 *
 * Compatível com:
 *   - Strapi v5 flat:    media.url / media.formats.{size}.url
 *   - Strapi v4 wrapped: media.data.attributes.url / media.data.attributes.formats
 *   - Cloudinary:        URL começa com https://res.cloudinary.com (ou qualquer https)
 *   - URLs relativas:    prefixadas com VITE_STRAPI_URL
 */

import type { StrapiMedia, StrapiMediaFlat, StrapiMediaFormats, StrapiMediaSize } from '../types/strapi'
import { env } from '../config/env'

// ─── Configuração base ──────────────────────────────────────────────────────

/**
 * Retorna a URL base do Strapi sem barra final.
 * Em dev usa o proxy Vite (/strapi) para evitar CORS.
 */
function getStrapiBaseUrl(): string {
  if (import.meta.env.DEV) return '/strapi'
  const raw = env.strapiUrl
  if (!raw) return ''
  return raw.replace(/\/$/, '')
}

// ─── Funções públicas ────────────────────────────────────────────────────────

/**
 * Retorna `true` se a URL for absoluta (começa com http:// ou https://).
 * Cloudinary, S3 e outros providers externos sempre retornam URLs absolutas.
 */
export function isExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return /^https?:\/\//i.test(url)
}

/**
 * Converte uma URL (relativa ou absoluta) em URL totalmente qualificada.
 * - URLs absolutas → retornadas sem alteração (Cloudinary, S3, etc.)
 * - URLs relativas → prefixadas com getStrapiBaseUrl()
 * - null/undefined  → retorna ''
 */
export function resolveUrl(url: string | null | undefined, baseUrl?: string): string {
  if (!url) return ''
  if (isExternalUrl(url)) return url
  const base = baseUrl ?? getStrapiBaseUrl()
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

// ─── Normalização interna ────────────────────────────────────────────────────

/**
 * Extrai o objeto flat de mídia de qualquer shape do Strapi (v4 ou v5).
 * Retorna `null` se não for possível extrair.
 */
function extractFlat(media: StrapiMedia): StrapiMediaFlat | null {
  if (!media) return null

  // Shape flat (Strapi v5 ou populate direto): tem `url` na raiz
  if ('url' in media && typeof (media as StrapiMediaFlat).url === 'string') {
    return media as StrapiMediaFlat
  }

  // Shape wrapped (Strapi v4): { data: { attributes: { url } } }
  const wrapped = media as { data?: { attributes?: { url?: string; formats?: StrapiMediaFormats }; url?: string; formats?: StrapiMediaFormats } | null }
  const dataNode = wrapped?.data
  if (!dataNode) return null

  // Strapi v4 com attributes
  if (dataNode.attributes && typeof dataNode.attributes.url === 'string') {
    return dataNode.attributes as StrapiMediaFlat
  }

  // Strapi v4 flat dentro de data (raro mas possível)
  if (typeof dataNode.url === 'string') {
    return dataNode as StrapiMediaFlat
  }

  return null
}

/**
 * Dado um objeto `formats`, retorna a URL do tamanho preferido com fallback.
 * Ordem de fallback: preferência explícita → large → medium → small → thumbnail
 */
function pickFormatUrl(
  formats: StrapiMediaFormats | null | undefined,
  prefer?: StrapiMediaSize
): string | null {
  if (!formats) return null

  const order: StrapiMediaSize[] = prefer
    ? [prefer, 'large', 'medium', 'small', 'thumbnail']
    : ['large', 'medium', 'small', 'thumbnail']

  // Deduplica mantendo ordem
  const seen = new Set<string>()
  for (const size of order) {
    if (seen.has(size)) continue
    seen.add(size)
    const url = formats[size]?.url
    if (url) return url
  }

  return null
}

// ─── Opções públicas ─────────────────────────────────────────────────────────

export interface GetMediaUrlOptions {
  /**
   * Tamanho preferido.
   * Se não existir, faz fallback pelos tamanhos menores e por fim o original.
   */
  size?: StrapiMediaSize
  /**
   * URL base para prefixar URLs relativas.
   * Se omitido, usa VITE_STRAPI_URL (ou /strapi em dev).
   */
  baseUrl?: string
  /**
   * URL de placeholder retornada quando a mídia for nula/inválida.
   * @default ''
   */
  fallback?: string
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Resolve a URL de uma mídia do Strapi.
 *
 * @param media  - Objeto de mídia em qualquer formato retornado pelo Strapi.
 * @param options - Opções de resolução (tamanho, baseUrl, fallback).
 * @returns URL resolvida como string. Nunca lança erro.
 *
 * @example
 * // URL do original
 * getMediaUrl(club.logo)
 *
 * // URL preferindo thumbnail
 * getMediaUrl(club.logo, { size: 'thumbnail' })
 *
 * // Com placeholder customizado
 * getMediaUrl(club.logo, { fallback: '/assets/no-image.png' })
 */
export function getMediaUrl(media: StrapiMedia, options: GetMediaUrlOptions = {}): string {
  const { size, baseUrl, fallback = '' } = options

  try {
    const flat = extractFlat(media)
    if (!flat) return fallback

    // Tenta formato específico primeiro, depois original
    const formatUrl = size ? pickFormatUrl(flat.formats, size) : null
    const originalUrl = flat.url ?? ''
    const originalIsSvg = /\.svg(?:$|\?)/i.test(originalUrl) || flat.mime === 'image/svg+xml'
    const mixedProviderFormat = Boolean(
      formatUrl &&
      originalUrl &&
      !isExternalUrl(formatUrl) &&
      isExternalUrl(originalUrl)
    )

    // SVGs and mixed-provider metadata are safer through the original file URL.
    const rawUrl = originalIsSvg || mixedProviderFormat
      ? originalUrl
      : (formatUrl ?? originalUrl)

    if (!rawUrl) return fallback
    return resolveUrl(rawUrl, baseUrl) || fallback
  } catch {
    return fallback
  }
}

/**
 * Gera a string `srcset` com todos os formatos disponíveis na mídia.
 * Útil para `<img srcset="...">` responsivo.
 *
 * @param media   - Objeto de mídia do Strapi.
 * @param baseUrl - URL base para URLs relativas.
 * @returns String no formato `"url1 156w, url2 500w, ..."` ou `''` se vazio.
 *
 * @example
 * <img src={getMediaUrl(media)} srcSet={getMediaSrcSet(media)} />
 */
export function getMediaSrcSet(media: StrapiMedia, baseUrl?: string): string {
  try {
    const flat = extractFlat(media)
    if (!flat?.formats) return ''

    const entries: string[] = []

    for (const [, fmt] of Object.entries(flat.formats)) {
      if (!fmt?.url || !fmt.width) continue
      const resolved = resolveUrl(fmt.url, baseUrl)
      if (resolved) entries.push(`${resolved} ${fmt.width}w`)
    }

    // Inclui o original se tiver width
    if (flat.url && flat.width) {
      const resolved = resolveUrl(flat.url, baseUrl)
      if (resolved) entries.push(`${resolved} ${flat.width}w`)
    }

    return entries.join(', ')
  } catch {
    return ''
  }
}

/**
 * Converte um array de mídias e retorna a URL da primeira válida.
 * Útil para campos de mídia que podem ser array (galeria).
 *
 * @param mediaArray - Array de objetos de mídia do Strapi.
 * @param options    - Opções de resolução.
 * @returns URL resolvida como string ou fallback.
 */
export function getFirstMediaUrl(
  mediaArray: StrapiMedia[] | null | undefined,
  options: GetMediaUrlOptions = {}
): string {
  if (!Array.isArray(mediaArray) || mediaArray.length === 0) return options.fallback ?? ''
  for (const item of mediaArray) {
    const url = getMediaUrl(item, options)
    if (url) return url
  }
  return options.fallback ?? ''
}
