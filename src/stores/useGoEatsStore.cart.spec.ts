import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './useGoEatsStore'

function withCart() {
  const store = useGoEatsStore()
  store.agregarAlCarrito('c9', { id: 'p1', nombre: 'Plato', precio: 5 }, 2, '')
  store.agregarAlCarrito('c9', { id: 'p2', nombre: 'Bebida', precio: 2 }, 1, '')
  return store
}

beforeEach(() => setActivePinia(createPinia()))

// The cart drawer calls actualizarItemCarrito(idx, { cantidad | observacion }) for its steppers and note fields.
describe('actualizarItemCarrito', () => {
  it('sets the quantity and keeps the subtotal in sync', () => {
    const store = withCart()
    store.actualizarItemCarrito(0, { cantidad: 3 })
    expect(store.carrito[0].cantidad).toBe(3)
    expect(store.carritoSubtotal).toBe(17)
    expect(store.carritoTotalItems).toBe(4)
  })

  it('removes the line when the quantity reaches zero and frees the cart when it empties', () => {
    const store = withCart()
    store.actualizarItemCarrito(1, { cantidad: 0 })
    expect(store.carrito.map((i: { id: string }) => i.id)).toEqual(['p1'])
    expect(store.carritoComercioId).toBe('c9')
    store.actualizarItemCarrito(0, { cantidad: 0 })
    expect(store.carrito).toEqual([])
    expect(store.carritoComercioId).toBeNull()
  })

  it('stores the line note without touching the quantity', () => {
    const store = withCart()
    store.actualizarItemCarrito(0, { observacion: 'sin cebolla' })
    expect(store.carrito[0]).toMatchObject({ cantidad: 2, observacion: 'sin cebolla' })
  })

  it('ignores an index that does not exist', () => {
    const store = withCart()
    store.actualizarItemCarrito(7, { cantidad: 9 })
    expect(store.carritoTotalItems).toBe(3)
  })
})
