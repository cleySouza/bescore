/**
 * Color Theme
 * Centralized color definitions for the application
 * Can be extended with dark mode variants in the future
 */

export const colors = {
  // Grayscale
  gray100: '#F0F0F0',
  gray200: '#D9D9D9',
  gray300: '#777777',

  // Gold/Yellow
  gold100: '#FBBC05',
  mid: '#FFC758',

  // Dark/Black
  dark: '#000000',
  dark100: '#393939',
  dark200: '#333333',

  // White
  white: '#FFFFFF',

  // Primary Brand Color (Purple)
  be: '#A200FF',
  be100: '#7700BC',

  // Status/Semantic Colors
  success: '#00B900',
  red: '#EE3124',
  blue: '#00B6F1',
  orange: '#F89731',
  red100: '#FF9797',

  // Special
  classified: 'rgba(255, 199, 88, 0.4)', // FFC758 with 40% opacity
} as const

export type ColorKey = keyof typeof colors

/**
 * Export individual colors for easier usage
 */
export const {
  gray100,
  gray200,
  gray300,
  gold100,
  mid,
  dark,
  dark100,
  dark200,
  white,
  be,
  be100,
  success,
  red,
  blue,
  orange,
  red100,
  classified,
} = colors

/**
 * Light theme (default)
 */
export const lightTheme = {
  ...colors,
} as const

/**
 * Dark theme (for future implementation)
 */
export const darkTheme = {
  ...colors,
  // Can override colors here for dark mode
} as const

/**
 * Helper function to get current theme
 * Can be extended to support theme switching
 */
export const getTheme = (isDark: boolean = false) => {
  return isDark ? darkTheme : lightTheme
}
