/** Source of truth for landing colors. landing.css must mirror these hex values. */
export type Theme = Record<string, string>

export const light: Theme = {
  bg: '#FFFFFF',
  surface: '#F2F7F7',
  'surface-strong': '#E3EEEE',
  ink: '#0B2B33',
  'ink-soft': '#44585E',
  'ink-faint': '#5E7277',
  border: '#D5E0E0',
  primary: '#00B19D',
  'primary-hover': '#00A491',
  'primary-lip': '#008F7D',
  'primary-text': '#00796B',
  'primary-tint': '#D6F5F0',
  'on-primary': '#0B2B33',
  indigo: '#2E2A7A',
  'on-indigo': '#FFFFFF',
  'on-indigo-soft': '#C9C7F0',
  'amber-tint': '#FFF1D6',
  // Decorative only (hero circle); text on it must use ink.
  amber: '#FFB62E',
}

export const dark: Theme = {
  bg: '#0A171B',
  surface: '#12262B',
  'surface-strong': '#1B343A',
  ink: '#F0F7F7',
  'ink-soft': '#B3C7CB',
  'ink-faint': '#8AA2A7',
  border: '#264047',
  primary: '#2DE0C8',
  'primary-hover': '#5BEAD6',
  'primary-lip': '#14A895',
  'primary-text': '#2DE0C8',
  'primary-tint': '#10383B',
  'on-primary': '#062A2F',
}

export interface Pair {
  label: string
  fg: string
  bg: string
  /** Minimum WCAG ratio: 4.5 for text, 3 for UI/large. */
  min: number
  ui?: boolean
}

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export function pairsFor(t: Theme): Pair[] {
  const text = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg}`, fg: t[fg], bg: t[bg], min: 4.5 })
  return [
    text('ink', 'bg'),
    text('ink', 'surface'),
    text('ink', 'primary-tint'),
    text('ink-soft', 'bg'),
    text('ink-soft', 'surface'),
    text('ink-faint', 'bg'),
    text('ink-faint', 'surface'),
    text('on-primary', 'primary'),
    text('on-primary', 'primary-hover'),
    text('primary-text', 'bg'),
    text('primary-text', 'surface'),
    text('primary-text', 'primary-tint'),
    // Primary fill alone is 2.7:1 on white; the button edge is carried by the lip + dark label.
    { label: 'primary-lip on bg (UI)', fg: t['primary-lip'], bg: t.bg, min: 3, ui: true },
  ]
}

/** Band pairs introduced by the redesign. Light only: `dark` has no band tokens (deferred to add-theme-mode). */
export function bandPairsFor(t: Theme): Pair[] {
  const text = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg}`, fg: t[fg], bg: t[bg], min: 4.5 })
  return [
    text('ink', 'amber-tint'),
    text('ink-soft', 'amber-tint'),
    text('ink-soft', 'primary-tint'),
    text('primary-text', 'amber-tint'),
    text('on-indigo', 'indigo'),
    text('on-indigo-soft', 'indigo'),
    { label: 'primary vs indigo (UI)', fg: t.primary, bg: t.indigo, min: 3, ui: true },
    { label: 'primary-lip on primary-tint (UI)', fg: t['primary-lip'], bg: t['primary-tint'], min: 3, ui: true },
  ]
}
