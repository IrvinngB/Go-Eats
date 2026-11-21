import { light, type Pair, type Theme } from '../landing/tokens'

/**
 * Tokens the catalog adds on top of the landing `light` theme (desing.md section 2).
 * The `*-text` variants are deliberately darker than the design's semantic colors:
 * desing.md `success`, `warning` and `danger` on their own tints measure 4.30, 4.48 and 3.98,
 * below the 4.5 it demands for text, so text uses the darker step and the icon keeps the base color.
 */
export const extra: Theme = {
  'secondary-tint': '#E4E3F6',
  success: '#15803D',
  'success-tint': '#DDF3E4',
  'success-text': '#166534',
  warning: '#B45309',
  'warning-tint': '#FDF1D6',
  'warning-text': '#92400E',
  danger: '#DC2626',
  'danger-tint': '#FBE4E4',
  'danger-text': '#B91C1C',
}

/** Everything catalog.css declares as a hex token under `.cx`. */
export const catalogTheme: Theme = { ...light, ...extra }

/** New text/background and UI pairs used by catalog.css. Same shape as the landing pairs. */
export function catalogPairs(t: Theme = catalogTheme): Pair[] {
  const text = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg}`, fg: t[fg], bg: t[bg], min: 4.5 })
  const ui = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg} (UI)`, fg: t[fg], bg: t[bg], min: 3, ui: true })
  return [
    text('ink', 'surface-strong'),
    text('ink-soft', 'surface-strong'),
    text('ink-soft', 'border'),
    text('ink-soft', 'primary-tint'),
    text('ink-soft', 'bg'),
    text('ink', 'amber'),
    text('ink', 'amber-tint'),
    text('bg', 'ink'),
    text('success-text', 'success-tint'),
    text('warning-text', 'warning-tint'),
    text('danger-text', 'danger-tint'),
    text('warning-text', 'amber-tint'),
    text('indigo', 'secondary-tint'),
    text('indigo', 'bg'),
    text('on-indigo', 'indigo'),
    text('on-indigo-soft', 'indigo'),
    text('primary-text', 'bg'),
    text('primary-text', 'primary-tint'),
    text('on-primary', 'primary'),
    text('on-primary', 'primary-hover'),
    // Icons that sit next to a text label (status is never icon or color alone).
    ui('success', 'success-tint'),
    ui('warning', 'amber-tint'),
    ui('warning', 'bg'),
    ui('danger', 'danger-tint'),
    ui('primary-text', 'surface'),
    ui('primary-lip', 'bg'),
  ]
}
