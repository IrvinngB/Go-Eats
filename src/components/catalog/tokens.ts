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

/** Pairs the customer shell adds (top bar, account menu, toast, banners, login form). */
export function shellPairs(t: Theme = catalogTheme): Pair[] {
  const text = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg}`, fg: t[fg], bg: t[bg], min: 4.5 })
  const ui = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg} (UI)`, fg: t[fg], bg: t[bg], min: 3, ui: true })
  return [
    text('ink', 'bg'),
    text('ink', 'surface'),
    text('ink-soft', 'surface'),
    text('ink-faint', 'surface'),
    text('danger-text', 'bg'),
    ui('danger', 'bg'),
    ui('danger', 'surface'),
    ui('primary-text', 'bg'),
  ]
}

/** Pairs the checkout adds (cart sheet, form states, payment options, gateway result, summary). */
export function checkoutPairs(t: Theme = catalogTheme): Pair[] {
  const text = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg}`, fg: t[fg], bg: t[bg], min: 4.5 })
  const ui = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg} (UI)`, fg: t[fg], bg: t[bg], min: 3, ui: true })
  return [
    // Secondary button hover keeps ink: primary-text on surface-strong is 4.49 (< 4.5).
    text('ink', 'surface-strong'),
    text('ink', 'primary-tint'), // selected payment option, reference code tile
    text('ink', 'danger-tint'), // consent alert body
    text('ink-soft', 'surface'), // summary labels, helper text on tiles
    text('danger-text', 'bg'), // field error message
    text('danger-text', 'surface'), // field error on a tile
    text('success-text', 'success-tint'), // approved result icon
    text('danger-text', 'danger-tint'), // declined result icon
    text('ink-soft', 'surface-strong'), // chips, disabled button
    ui('danger', 'bg'), // 2px invalid border on a white sheet
    ui('primary-text', 'primary-tint'), // selected option border and dot
    ui('primary-text', 'surface'), // section icons
    ui('ink-faint', 'bg'), // unselected radio dot and checkbox border
    ui('indigo', 'bg'), // destination pin
  ]
}

/**
 * Pairs the order screens add (status chips, timeline, progress, ETA, courier, rating, banners).
 * Chip texts use the darker `*-text` tokens on the design's own tints: desing.md `success`, `warning` and `danger`
 * on their tints measure 4.30, 4.48 and 3.98 (< 4.5), so the icon keeps the base color and only the text darkens.
 */
export function ordersPairs(t: Theme = catalogTheme): Pair[] {
  const text = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg}`, fg: t[fg], bg: t[bg], min: 4.5 })
  const ui = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg} (UI)`, fg: t[fg], bg: t[bg], min: 3, ui: true })
  return [
    // Tiles: ETA, status, courier, order head, details
    text('ink', 'surface'),
    text('ink', 'bg'),
    text('ink-soft', 'surface'),
    text('ink-soft', 'bg'),
    text('ink-soft', 'surface-strong'),
    // Timeline: pending steps use ink-faint on the white active tile and on the surface tile
    text('ink-faint', 'bg'),
    text('ink-faint', 'surface'),
    text('on-primary', 'primary'), // number/check on a done circle
    text('ink', 'primary-tint'), // current step number
    ui('primary-text', 'primary-tint'), // current step ring
    ui('ink-faint', 'surface-strong'), // pending circle edge and pending progress dots
    ui('primary-text', 'bg'), // done progress beads (white ring) and the hollow/ringed ones
    text('primary-text', 'surface'), // "Ver detalle del pedido" summary on the history tile
    text('ink-soft', 'surface-strong'),
    // Payment line next to the total
    text('success-text', 'bg'),
    text('danger-text', 'bg'),
    text('success-text', 'surface'),
    text('danger-text', 'surface'),
    // Banners and delivered tile
    text('ink', 'danger-tint'),
    text('danger-text', 'danger-tint'),
    ui('danger', 'danger-tint'),
    text('success-text', 'success-tint'),
    ui('success-text', 'success-tint'),
    // Courier: call button and rating star (outlined in warning, with the number beside it)
    ui('primary-text', 'primary-tint'),
    ui('warning', 'surface'),
    ui('warning', 'bg'),
    // Rating radios: selected and hollow star outlines on the white dialog
    ui('ink-faint', 'bg'),
  ]
}

/**
 * Pairs the profile adds (white inputs on a surface tile, switch, ARCO options and history, alerts).
 * The switch is never color alone: the state is also written next to it, and the checked track uses a dark knob.
 */
export function profilePairs(t: Theme = catalogTheme): Pair[] {
  const text = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg}`, fg: t[fg], bg: t[bg], min: 4.5 })
  const ui = (fg: string, bg: string): Pair => ({ label: `${fg} on ${bg} (UI)`, fg: t[fg], bg: t[bg], min: 3, ui: true })
  return [
    text('ink', 'surface'), // tile titles, switch label
    text('ink-soft', 'surface'), // helper text, legal text
    text('ink-soft', 'bg'), // history detail on its white tile, ARCO option subtitle
    text('ink', 'bg'),
    text('ink-faint', 'bg'), // placeholders (examples, never labels)
    text('ink-soft', 'surface-strong'), // read-only email field
    text('danger-text', 'surface'), // field error on a tile
    text('ink', 'warning-tint'), // revoked consent alert body
    text('ink', 'success-tint'), // request sent alert body
    text('ink', 'danger-tint'), // consent load error body
    text('ink', 'primary'), // switch knob on the checked track
    text('bg', 'ink'), // tick on the dark knob
    text('primary-text', 'surface'), // state word beside the switch when on
    ui('primary-text', 'surface'), // checked track edge, tile icons
    ui('ink-faint', 'bg'), // unchecked track edge and knob on the white track
    ui('ink-faint', 'surface'), // unchecked track edge on the tile
    ui('warning', 'warning-tint'), // alert icon + side bar
    ui('success', 'success-tint'),
    ui('danger', 'danger-tint'),
    ui('danger', 'surface'), // invalid field border on a white input over the tile
  ]
}
