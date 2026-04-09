/**
 * Color System Usage Guide
 * 
 * This guide explains how to use the color system in the BeScore application
 */

/**
 * OPTION 1: Using TypeScript colors object (for inline styles or dynamic colors)
 * 
 * import { colors, be, success, red } from '@/styles'
 * 
 * // Using the full object
 * const style = {
 *   backgroundColor: colors.be,
 *   color: colors.white,
 *   borderColor: colors.gray200
 * }
 * 
 * // Importing specific colors
 * const buttonStyle = {
 *   background: be,
 *   color: white,
 *   '--hover-color': success
 * }
 */

/**
 * OPTION 2: Using CSS Variables (for CSS Modules and regular CSS)
 * 
 * .button {
 *   background: var(--color-be);
 *   color: var(--color-white);
 *   border: 1px solid var(--color-gray-200);
 *   padding: 12px 24px;
 *   border-radius: 6px;
 *   cursor: pointer;
 *   transition: all 0.3s ease;
 * }
 * 
 * .button:hover {
 *   background: var(--color-be-100);
 * }
 * 
 * .buttonSuccess {
 *   background: var(--color-success);
 * }
 * 
 * .buttonError {
 *   background: var(--color-red);
 * }
 * 
 * .textPrimary {
 *   color: var(--color-dark);
 * }
 * 
 * .textSecondary {
 *   color: var(--color-gray-300);
 * }
 * 
 * .badgeClassified {
 *   background: var(--color-classified);
 * }
 */

/**
 * OPTION 3: Using color utilities
 * 
 * import { addAlpha, lighten, darken, getContrastColor } from '@/styles'
 * 
 * // Add transparency to a color
 * const transparentPurple = addAlpha('#A200FF', 0.5) // rgba(162, 0, 255, 0.5)
 * 
 * // Lighten or darken a color
 * const lighterPurple = lighten('#A200FF', 0.2)
 * const darkerPurple = darken('#A200FF', 0.2)
 * 
 * // Get contrast color for text
 * const textColor = getContrastColor('#A200FF') // '#FFFFFF'
 */

/**
 * COLOR REFERENCE
 * 
 * Primary Brand:
 * - be: #A200FF (Main purple brand color)
 * - be100: #7700BC (Darker purple for hover/active states)
 * 
 * Status Colors:
 * - success: #00B900 (Green for success messages)
 * - red: #EE3124 (Red for errors)
 * - blue: #00B6F1 (Blue for info)
 * - orange: #F89731 (Orange for warnings)
 * - red100: #FF9797 (Light red)
 * 
 * Neutral:
 * - gray100: #F0F0F0 (Lightest gray, backgrounds)
 * - gray200: #D9D9D9 (Light gray, borders)
 * - gray300: #777777 (Dark gray, text secondary)
 * - dark: #000000 (Pure black)
 * - dark100: #393939 (Light black)
 * - dark200: #333333 (Dark gray)
 * - white: #FFFFFF (Pure white)
 * 
 * Accent:
 * - gold100: #FBBC05 (Google brand color)
 * - mid: #FFC758 (Yellow/gold)
 * - classified: rgba(255, 199, 88, 0.4) (Mid with 40% opacity)
 */

/**
 * RECOMMENDED USAGE PATTERNS
 * 
 * 1. Use CSS Variables in CSS Modules for styling
 *    - Faster (no JS overhead)
 *    - Better for large applications
 *    - Easier to maintain
 * 
 * 2. Use TypeScript colors object in component logic
 *    - Dynamic colors based on component state
 *    - Inline styles when necessary
 *    - Type-safe color references
 * 
 * 3. Use color utilities for advanced scenarios
 *    - Creating hover/active states
 *    - Adding transparency
 *    - Dynamic theme switching
 */

export {}
