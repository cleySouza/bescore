/**
 * Color Utilities
 * Helper functions for working with colors
 */

/**
 * Convert hex color to RGB
 * @example hexToRgb('#A200FF') -> 'rgb(162, 0, 255)'
 */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex

  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)

  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Add opacity/alpha to a hex color
 * @example addAlpha('#A200FF', 0.5) -> 'rgba(162, 0, 255, 0.5)'
 */
export function addAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex).match(/\d+/g)
  if (!rgb || rgb.length < 3) return hex

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.min(1, Math.max(0, alpha))})`
}

/**
 * Lighten a hex color
 * @example lighten('#A200FF', 0.2) -> lighter version
 */
export function lighten(hex: string, amount: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex

  let r = parseInt(result[1], 16)
  let g = parseInt(result[2], 16)
  let b = parseInt(result[3], 16)

  r = Math.min(255, r + Math.round(255 * amount))
  g = Math.min(255, g + Math.round(255 * amount))
  b = Math.min(255, b + Math.round(255 * amount))

  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/**
 * Darken a hex color
 * @example darken('#A200FF', 0.2) -> darker version
 */
export function darken(hex: string, amount: number): string {
  return lighten(hex, -amount)
}

/**
 * Get contrast color (black or white) for a given hex color
 * Useful for determining text color on background
 */
export function getContrastColor(hex: string): '#000000' | '#FFFFFF' {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '#000000'

  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}
