import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
const tokenStorage = vi.hoisted(() => ({ setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() }))
vi.mock('../services/api', () => ({
  default: { get, post, patch: vi.fn(), put, delete: vi.fn() },
  tokenStorage,
}))

// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './useGoEatsStore'

beforeEach(() => {
  setActivePinia(createPinia())
  for (const m of [get, post, put]) m.mockReset()
  tokenStorage.getAccessToken.mockReturnValue('tok')
})

function order(id: string, clienteId: number | undefined, clienteNombre: string) {
  return { id, clienteId, clienteNombre, estado: 'pendiente', items: [] }
}

describe('the customer is identified by id, not by name', () => {
  it('restaurarSesion keeps the user id', async () => {
    get.mockResolvedValue({ data: { id: 7, full_name: 'Ana', email: 'a@t.pa', phone: '600', role: 'customer' } })
    const store = useGoEatsStore()
    await store.restaurarSesion()
    expect(store.usuario.id).toBe(7)
  })

  it('a renamed customer keeps seeing the orders placed under the old name', () => {
    const store = useGoEatsStore()
    store.usuario = { ...store.usuario, id: 7, nombre: 'Ana Nueva', email: 'a@t.pa' }
    store.pedidos = [order('PED-1', 7, 'Ana Vieja'), order('PED-2', 7, 'Ana Nueva')]
    expect(store.pedidosComoCliente.map((p: { id: string }) => p.id)).toEqual(['PED-1', 'PED-2'])
  })

  it('another customer with the same name is not shown', () => {
    const store = useGoEatsStore()
    store.usuario = { ...store.usuario, id: 7, nombre: 'Ana Pérez' }
    store.pedidos = [order('PED-1', 7, 'Ana Pérez'), order('PED-2', 8, 'Ana Pérez')]
    expect(store.pedidosComoCliente.map((p: { id: string }) => p.id)).toEqual(['PED-1'])
  })

  it('orders without a customer id (local demo data) still match by name', () => {
    const store = useGoEatsStore()
    store.usuario = { ...store.usuario, id: null, nombre: 'Carlos Andrade' }
    store.pedidos = [order('ORD-1', undefined, 'Carlos Andrade'), order('ORD-2', undefined, 'Otra Persona')]
    expect(store.pedidosComoCliente.map((p: { id: string }) => p.id)).toEqual(['ORD-1'])
  })

  it('saving the profile keeps the user id and the orders stay visible', async () => {
    put.mockResolvedValue({ data: { id: 7, full_name: 'Ana Nueva', email: 'a@t.pa', phone: '600', role: 'customer' } })
    const store = useGoEatsStore()
    store.autenticado = true
    store.usuario = { ...store.usuario, id: 7, nombre: 'Ana Vieja', email: 'a@t.pa', telefono: '600' }
    store.pedidos = [order('PED-1', 7, 'Ana Vieja')]
    await store.guardarPerfil({ nombre: 'Ana Nueva', telefono: '600' })
    expect(store.usuario.id).toBe(7)
    expect(store.usuario.nombre).toBe('Ana Nueva')
    expect(store.pedidosComoCliente.map((p: { id: string }) => p.id)).toEqual(['PED-1'])
  })

  it('sincronizarConBackend maps the customer_id of an API order', async () => {
    const apiOrder = {
      code: 'PED-9', merchant_code: 'c1', merchant_name: 'X', customer_id: 7, customer_name: 'Ana', customer_phone: '1',
      zone_slug: 'san-francisco', delivery_address: 'Calle 1', status: 'pendiente', items: [], subtotal: 1, delivery_fee: 1, total: 2,
      payment_method: 'contr_entrega', created_at: '2026-11-21T10:00:00',
    }
    get.mockImplementation((url: string) => Promise.resolve({ data: url.startsWith('/orders') ? [apiOrder] : [] }))
    const store = useGoEatsStore()
    store.autenticado = true
    store.rol = 'customer'
    await store.sincronizarConBackend()
    expect(store.pedidos.find((p: { id: string }) => p.id === 'PED-9')?.clienteId).toBe(7)
  })
})
