import { ESTADO_LABELS, ESTADOS_PEDIDO } from '../mockData'

/** The advance chain of an order (pendiente ... entregado). `rechazado` and `cancelado` close the order outside it. */
export const CADENA: string[] = ESTADOS_PEDIDO

/** Lucide icon of each state, kebab-case (desing.md "Status chips"); the components map the name to the component. */
export type IconoEstado = 'receipt' | 'chef-hat' | 'user-check' | 'bike' | 'circle-check' | 'circle-x' | 'circle-question-mark'

/** Chip tones: one class per tone in catalog.css (`.cx-estado-<tone>`). */
export const TONOS = ['neutral', 'warning', 'indigo', 'info', 'success', 'danger'] as const
export type Tono = (typeof TONOS)[number]

export interface EstadoVisual {
  estado: string
  label: string
  icon: IconoEstado
  tone: Tono
  /** Index in CADENA, or -1 for rechazado, cancelado and anything unknown. */
  paso: number
  /** "Paso 3 de 6" while the state is on the chain, '' otherwise. */
  pasoTexto: string
  /** The order is closed: entregado, rechazado, cancelado. */
  terminal: boolean
  /** Closed without delivery: rechazado, cancelado. */
  fallido: boolean
  /** On the chain and not delivered yet. */
  enCurso: boolean
  /** The live map applies: the kitchen has it or it is on the road. */
  seguible: boolean
}

// Only canonical API states are accepted. Spaced, accented or differently cased variants are NOT normalized
// (same rule as the backend): they fall back to "unknown" instead of pretending to be a state.
const VISUAL: Record<string, { icon: IconoEstado; tone: Tono }> = {
  pendiente: { icon: 'receipt', tone: 'neutral' }, // Received
  confirmado: { icon: 'receipt', tone: 'neutral' }, // Received (the merchant accepted it)
  en_preparacion: { icon: 'chef-hat', tone: 'warning' }, // Preparing
  listo_para_recoger: { icon: 'user-check', tone: 'indigo' }, // waiting for the courier
  en_camino: { icon: 'bike', tone: 'info' }, // On the way
  entregado: { icon: 'circle-check', tone: 'success' }, // Delivered
  rechazado: { icon: 'circle-x', tone: 'danger' }, // Cancelled / failed
  cancelado: { icon: 'circle-x', tone: 'danger' },
}

const SEGUIBLES = ['en_preparacion', 'listo_para_recoger', 'en_camino']

export function estadoVisual(estado: unknown): EstadoVisual {
  const conocido = typeof estado === 'string' && Object.prototype.hasOwnProperty.call(VISUAL, estado)
  if (!conocido) {
    return {
      estado: typeof estado === 'string' ? estado : '',
      label: 'Estado desconocido',
      icon: 'circle-question-mark',
      tone: 'neutral',
      paso: -1,
      pasoTexto: '',
      terminal: false,
      fallido: false,
      enCurso: false,
      seguible: false,
    }
  }
  const e = estado as string
  const paso = CADENA.indexOf(e)
  const fallido = e === 'rechazado' || e === 'cancelado'
  return {
    estado: e,
    label: ESTADO_LABELS[e],
    ...VISUAL[e],
    paso,
    pasoTexto: paso >= 0 ? `Paso ${paso + 1} de ${CADENA.length}` : '',
    terminal: fallido || e === 'entregado',
    fallido,
    enCurso: paso >= 0 && e !== 'entregado',
    seguible: SEGUIBLES.includes(e),
  }
}

/**
 * The delivery time the merchant publishes ("25-35 min"), split for the ETA tile. It is the merchant's own range,
 * not a live estimate, so nothing else is ever computed or invented: no text, no tile.
 */
export function etaDeComercio(raw: unknown): { valor: string; unidad: string } | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  const rango = t.match(/^(\d+)\s*[-–]\s*(\d+)\s*(min\w*)?$/i)
  if (rango) return { valor: `${rango[1]}–${rango[2]}`, unidad: rango[3] || '' }
  return { valor: t, unidad: '' }
}
