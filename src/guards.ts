import type { Router, RouteLocationRaw } from 'vue-router'
import { setSessionExpiredHandler } from './services/api'

export type Role = 'customer' | 'merchant' | 'courier' | 'accountant' | 'admin'

/** Home route of each role (also the fallback for any rejected navigation). */
export const rutaPorRol: Record<Role, string> = {
  customer: '/tiendas',
  merchant: '/panel-comercio',
  courier: '/panel-repartidor',
  accountant: '/panel-contabilidad',
  admin: '/panel-admin',
}

/** Public for everyone, keyed by route NAME (the access table lives here, never in the exported `routes`). */
const PUBLIC = new Set(['landing', 'login', 'stores', 'store-detail'])

/** Route names each authenticated role may open (landing and login are handled apart). */
const ACCESO: Record<Role, ReadonlySet<string>> = {
  customer: new Set(['stores', 'store-detail', 'orders', 'profile']),
  merchant: new Set(['merchant']),
  courier: new Set(['courier']),
  accountant: new Set(['accountant']),
  admin: new Set(['admin']),
}

const esRol = (rol: unknown): rol is Role => typeof rol === 'string' && Object.prototype.hasOwnProperty.call(rutaPorRol, rol)

const homeDe = (rol: unknown): string => (esRol(rol) ? rutaPorRol[rol] : rutaPorRol.customer)

// Whitespace/control characters (browsers strip tabs/newlines inside URLs) and backslashes (treated as '/').
// eslint-disable-next-line no-control-regex
const PELIGROSO = /[\u0000- \u007f\\]/

function esRutaInterna(raw: string): boolean {
  if (!raw.startsWith('/') || raw.startsWith('//') || PELIGROSO.test(raw)) return false
  let decodificado: string
  try {
    decodificado = decodeURIComponent(raw)
  } catch {
    return false
  }
  return decodificado.startsWith('/') && !decodificado.startsWith('//') && !PELIGROSO.test(decodificado)
}

/**
 * Validates a `?redirect` value. Returns the path when it is an internal path whose route name is allowed
 * for the SERVER role (never login or an unknown route); otherwise null (caller uses the role home).
 */
export function safeRedirect(router: Router, raw: unknown, rol: unknown): string | null {
  const valor = Array.isArray(raw) ? raw[0] : raw
  if (typeof valor !== 'string' || !esRol(rol) || !esRutaInterna(valor)) return null
  const resuelta = router.resolve(valor)
  const nombre = resuelta.name
  if (typeof nombre !== 'string' || !ACCESO[rol].has(nombre)) return null
  return resuelta.fullPath
}

export interface SessionSource {
  autenticado: boolean
  rol: string
}

/**
 * Installs the route guards. `store` is read at navigation time (SERVER role). The first navigation waits
 * for `ready` (the session restore) before deciding; a rejected restore means anonymous.
 */
export function installGuards(router: Router, store: SessionSource, ready: Promise<unknown> = Promise.resolve()): void {
  const restaurada = ready.then(
    () => undefined,
    () => undefined,
  )
  router.beforeEach(async (to): Promise<boolean | RouteLocationRaw> => {
    await restaurada
    const nombre = to.name
    if (typeof nombre !== 'string') return true

    if (!store.autenticado) {
      if (PUBLIC.has(nombre)) return true
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    const home = homeDe(store.rol)
    if (nombre === 'login') return home
    if (nombre === 'landing') return true
    const permitidas = esRol(store.rol) ? ACCESO[store.rol] : ACCESO.customer
    return permitidas.has(nombre) ? true : home
  })
}

interface ExpirySession extends SessionSource {
  cerrarSesion: (mensaje?: string) => void
}

/**
 * A refresh failure on a previously authenticated session clears the session and sends the user to
 * /login?redirect=<where they were>. Anonymous visitors (public sync) never trigger it.
 */
export function installSessionExpiry(router: Router, store: ExpirySession): void {
  setSessionExpiredHandler(() => {
    if (!store.autenticado) return
    const actual = router.currentRoute.value
    store.cerrarSesion('Tu sesión expiró. Inicia sesión de nuevo.')
    if (actual.name === 'login') return
    void router.push({ name: 'login', query: { redirect: actual.fullPath } })
  })
}
