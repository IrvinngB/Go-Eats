import { describe, it, expect } from 'vitest'
import { toWriteError } from './errors'

function http(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } })
}

describe('toWriteError', () => {
  it('maps a missing response (backend down) to network with status 0', () => {
    const e = toWriteError(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK', request: {} }))
    expect(e).toMatchObject({ kind: 'network', status: 0 })
    expect(e.message).toBe('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  })

  it('maps a timeout to network', () => {
    const e = toWriteError(Object.assign(new Error('timeout of 10000ms exceeded'), { isAxiosError: true, code: 'ECONNABORTED' }))
    expect(e.kind).toBe('network')
  })

  it.each([
    [401, 'unauthorized', 'Tu sesión expiró. Inicia sesión de nuevo.'],
    [403, 'forbidden', 'No tienes permiso para realizar esta acción.'],
    [404, 'not_found', 'No se encontró lo solicitado. Puede que ya no exista.'],
    [409, 'conflict', 'La acción choca con el estado actual. Actualiza e inténtalo de nuevo.'],
    [500, 'server', 'El servidor tuvo un problema. Inténtalo más tarde.'],
    [503, 'server', 'El servidor tuvo un problema. Inténtalo más tarde.'],
    [418, 'unknown', 'Ocurrió un error inesperado. Inténtalo de nuevo.'],
  ])('maps HTTP %i to %s with its Spanish message', (status, kind, message) => {
    const e = toWriteError(http(status as number))
    expect(e).toMatchObject({ kind, status, message })
  })

  it('maps 400 and 422 to validation; a string detail is appended', () => {
    const e400 = toWriteError(http(400, { detail: 'Merchant is not accepting orders' }))
    expect(e400).toMatchObject({ kind: 'validation', status: 400, detail: 'Merchant is not accepting orders' })
    expect(e400.message).toBe('Los datos no son válidos o la acción no está permitida: Merchant is not accepting orders')
    const e422 = toWriteError(http(422, { detail: [{ loc: ['body', 'quantity'], msg: 'bad' }] }))
    expect(e422.kind).toBe('validation')
    expect(e422.message).toBe('Los datos no son válidos o la acción no está permitida.')
  })

  it('exposes the API code for machine-readable details and a specific message', () => {
    const consent = toWriteError(http(403, { detail: 'consent_required' }))
    expect(consent).toMatchObject({ kind: 'forbidden', code: 'consent_required' })
    expect(consent.message).toBe('Debes aceptar el tratamiento de tus datos para continuar.')
    const linked = toWriteError(http(404, { detail: 'no_linked_entity' }))
    expect(linked).toMatchObject({ kind: 'not_found', code: 'no_linked_entity' })
    expect(linked.message).toBe('Tu cuenta no tiene un comercio o repartidor vinculado.')
  })

  it('maps a non-axios throw to unknown', () => {
    expect(toWriteError(new Error('boom'))).toMatchObject({ kind: 'unknown', status: 0 })
    expect(toWriteError('weird')).toMatchObject({ kind: 'unknown', status: 0 })
  })
})
