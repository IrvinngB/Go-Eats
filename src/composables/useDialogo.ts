import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface OpcionesDialogo {
  /** Escape and the scrim go through here. */
  cerrar: () => void
  /** Return false to ignore Escape (e.g. while a payment is processing). */
  puedeCerrar?: () => boolean
  /** Element focused when the dialog opens; defaults to the first focusable inside the panel. */
  enfoqueInicial?: () => HTMLElement | null | undefined
  /** CSS selectors tried in order when the element that opened the dialog is gone from the DOM. */
  alVolver?: string[]
}

let abiertos = 0

function bloquearPagina(bloquear: boolean) {
  if (typeof document === 'undefined') return
  abiertos = Math.max(0, abiertos + (bloquear ? 1 : -1))
  document.body.classList.toggle('cx-dialog-open', abiertos > 0)
}

export function enfocables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => !el.closest('[hidden], [inert]') && el.getAttribute('aria-hidden') !== 'true')
}

/**
 * Modal behavior shared by the cart sheet and the payment modal: moves focus in on open, keeps Tab inside the
 * panel, closes on Escape, locks the page scroll and gives focus back to whatever opened it.
 */
export function useDialogo(abierto: () => boolean, panel: Ref<HTMLElement | null>, opciones: OpcionesDialogo) {
  let origen: HTMLElement | null = null
  let activo = false

  function alTeclear(e: KeyboardEvent) {
    const el = panel.value
    if (!el) return
    if (e.key === 'Escape') {
      if (opciones.puedeCerrar && !opciones.puedeCerrar()) return
      e.preventDefault()
      opciones.cerrar()
      return
    }
    if (e.key !== 'Tab') return
    const lista = enfocables(el)
    if (lista.length === 0) {
      e.preventDefault()
      el.focus()
      return
    }
    const primero = lista[0]
    const ultimo = lista[lista.length - 1]
    const idx = lista.indexOf(document.activeElement as HTMLElement)
    // Focus on the panel/heading itself (or outside it) is not in the list: Tab enters at the first stop, Shift+Tab at the last.
    if (e.shiftKey && (idx <= 0)) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && (idx === -1 || idx === lista.length - 1)) {
      e.preventDefault()
      primero.focus()
    }
  }

  function abrir() {
    if (activo) return
    activo = true
    origen = document.activeElement instanceof HTMLElement ? document.activeElement : null
    bloquearPagina(true)
    document.addEventListener('keydown', alTeclear)
    nextTick(() => {
      const el = panel.value
      if (!el) return
      const inicial = opciones.enfoqueInicial?.() ?? enfocables(el)[0] ?? el
      inicial.focus()
    })
  }

  function cerrarDialogo() {
    if (!activo) return
    activo = false
    document.removeEventListener('keydown', alTeclear)
    bloquearPagina(false)
    const volver = origen
    origen = null
    nextTick(() => {
      if (volver?.isConnected) return volver.focus()
      for (const sel of opciones.alVolver ?? []) {
        const el = document.querySelector<HTMLElement>(sel)
        if (el) return el.focus()
      }
    })
  }

  watch(abierto, (v) => (v ? abrir() : cerrarDialogo()), { immediate: true, flush: 'pre' })
  onBeforeUnmount(cerrarDialogo)
}
