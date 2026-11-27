// Typed errors for store writes: maps axios/network failures to a kind plus a Spanish message.
export type WriteErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'server'
  | 'unknown'

export interface WriteError {
  kind: WriteErrorKind
  status: number // 0 when there was no HTTP response
  message: string // Spanish, safe to show to the user
  code?: string // machine-readable API detail, e.g. consent_required, no_linked_entity
  detail?: string // raw API detail text (string details only)
}

const MESSAGES: Record<WriteErrorKind, string> = {
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo.',
  forbidden: 'No tienes permiso para realizar esta acción.',
  not_found: 'No se encontró lo solicitado. Puede que ya no exista.',
  validation: 'Los datos no son válidos o la acción no está permitida.',
  conflict: 'La acción choca con el estado actual. Actualiza e inténtalo de nuevo.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.',
  server: 'El servidor tuvo un problema. Inténtalo más tarde.',
  unknown: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
}

const CODE_MESSAGES: Record<string, string> = {
  consent_required: 'Debes aceptar el tratamiento de tus datos para continuar.',
  no_linked_entity: 'Tu cuenta no tiene un comercio o repartidor vinculado.',
}

const CODE_SHAPE = /^[a-z][a-z0-9_]*$/

function kindFor(status: number): WriteErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  if (status === 400 || status === 422) return 'validation'
  if (status >= 500) return 'server'
  return 'unknown'
}

export function toWriteError(err: unknown): WriteError {
  const e = err as { isAxiosError?: boolean; code?: string; request?: unknown; response?: { status?: number; data?: { detail?: unknown } } } | null
  const status = e?.response?.status
  if (typeof status !== 'number') {
    const transport = !!e && typeof e === 'object' && (e.isAxiosError === true || e.request !== undefined)
    return { kind: transport ? 'network' : 'unknown', status: 0, message: MESSAGES[transport ? 'network' : 'unknown'] }
  }
  const kind = kindFor(status)
  const raw = e?.response?.data?.detail
  const detail = typeof raw === 'string' && raw.trim() ? raw : undefined
  const code = detail && CODE_SHAPE.test(detail) ? detail : undefined
  let message = MESSAGES[kind]
  if (code && CODE_MESSAGES[code]) message = CODE_MESSAGES[code]
  else if (kind === 'validation' && detail) message = `${MESSAGES.validation.replace(/\.$/, '')}: ${detail}`
  return { kind, status, message, ...(code ? { code } : {}), ...(detail ? { detail } : {}) }
}
