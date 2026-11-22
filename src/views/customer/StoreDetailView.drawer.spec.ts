import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))
vi.mock('../../components/AddressPickerMap.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { __esModule: true, default: defineComponent({ props: { modelValue: { type: Object, default: null } }, render: () => h('div', { 'data-test': 'picker-stub' }) }) }
})

import StoreDetailView from './StoreDetailView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

const PRODUCTOS = [
  { id: 'p1', nombre: 'Sancocho', precio: 5, precioRegular: 5, descripcion: '', categoria: 'Sopas', disponible: true },
  { id: 'p2', nombre: 'Chicha', precio: 2.5, precioRegular: 2.5, descripcion: '', categoria: 'Bebidas', disponible: true },
  { id: 'p3', nombre: 'Hojaldre', precio: 1.2, precioRegular: 1.2, descripcion: '', categoria: 'Pan', disponible: true },
]

async function setup(opts: { abierto?: boolean; productos?: unknown[] } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'customer'
  store.zonas = [{ id: 'san-francisco', nombre: 'San Francisco', tarifa: 2.5, distanciaKm: 3 }]
  store.zonaSeleccionada = 'san-francisco'
  store.comercios = [{ id: 'c9', nombre: 'Comercio', tipo: 'Restaurante', zona: 'san-francisco', rating: 4, tiempoEntrega: '20', activo: opts.abierto ?? true, descripcion: '', icono: 'Store', estadoAfiliacion: 'activo' }]
  store.catalogo = { c9: opts.productos ?? PRODUCTOS }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tiendas/:id', component: StoreDetailView }, { path: '/tiendas', component: StoreDetailView }, { path: '/perfil', name: 'profile', component: StoreDetailView }, { path: '/login', name: 'login', component: StoreDetailView }] })
  await router.push('/tiendas/c9')
  await router.isReady()
  const w = mount(StoreDetailView, { global: { plugins: [pinia, router] }, attachTo: document.body })
  return { w, store }
}

const add = (w: Awaited<ReturnType<typeof setup>>['w'], i = 0) => w.findAll('[data-test="add-to-cart"]')[i]
const key = (k: string, init: KeyboardEventInit = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }))

afterEach(() => {
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('cart drawer (sheet) behavior', () => {
  it('opens as a labelled modal dialog with its own .cx scope and a close button', async () => {
    const { w } = await setup()
    await add(w).trigger('click')
    const drawer = w.find('[data-test="cart-drawer"]')
    expect(drawer.attributes('role')).toBe('dialog')
    expect(drawer.attributes('aria-modal')).toBe('true')
    expect(w.find('#cart-title').text()).toBe('Tu carrito')
    expect(drawer.attributes('aria-labelledby')).toBe('cart-title')
    expect(w.find('[data-test="cart-overlay"]').classes()).toContain('cx') // tokens resolve for the overlay
    expect(w.find('h2#cart-title').element.closest('.cx')).not.toBeNull()
    expect(w.find('[data-test="cart-close"]').attributes('aria-label')).toBe('Cerrar carrito')
    w.unmount()
  })

  it('moves focus to the title on open, locks the page scroll and gives both back on close', async () => {
    const { w } = await setup()
    const opener = add(w).element as HTMLButtonElement
    opener.focus()
    await add(w).trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(w.find('#cart-title').element)
    expect(document.body.classList.contains('cx-dialog-open')).toBe(true)
    await w.find('[data-test="cart-close"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="cart-drawer"]').exists()).toBe(false)
    expect(document.body.classList.contains('cx-dialog-open')).toBe(false)
    expect(document.activeElement).toBe(opener)
    w.unmount()
  })

  it('Escape closes it and focus returns to the control that opened it', async () => {
    const { w } = await setup()
    const opener = add(w, 1).element as HTMLButtonElement
    opener.focus()
    await add(w, 1).trigger('click')
    await flushPromises()
    key('Escape')
    await flushPromises()
    expect(w.find('[data-test="cart-drawer"]').exists()).toBe(false)
    expect(document.activeElement).toBe(opener)
    w.unmount()
  })

  it('opened from the floating cart button, focus comes back to that button after Escape', async () => {
    const { w } = await setup()
    await add(w).trigger('click')
    key('Escape')
    await flushPromises()
    const fab = w.find('[data-test="cart-fab"]')
    ;(fab.element as HTMLButtonElement).focus()
    await fab.trigger('click')
    await flushPromises()
    expect(w.find('[data-test="cart-fab"]').exists()).toBe(false) // hidden while the sheet is open
    key('Escape')
    await flushPromises()
    expect(document.activeElement).toBe(w.find('[data-test="cart-fab"]').element)
    w.unmount()
  })

  it('clicking the scrim closes it, clicking inside does not', async () => {
    const { w } = await setup()
    await add(w).trigger('click')
    await w.find('[data-test="cart-drawer"]').trigger('click')
    expect(w.find('[data-test="cart-drawer"]').exists()).toBe(true)
    await w.find('[data-test="cart-overlay"]').trigger('click')
    expect(w.find('[data-test="cart-drawer"]').exists()).toBe(false)
    w.unmount()
  })

  it('Tab wraps from the last control to the first and Shift+Tab from the first (or the title) to the last', async () => {
    const { w } = await setup()
    await add(w).trigger('click')
    await flushPromises()
    const panel = w.find('[data-test="cart-drawer"]').element as HTMLElement
    const stops = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
    const first = stops[0]
    const last = stops[stops.length - 1]
    expect(first).toBe(w.find('[data-test="cart-close"]').element)
    expect(last).toBe(w.find('[data-test="cart-continue"]').element)

    last.focus()
    key('Tab')
    expect(document.activeElement).toBe(first)
    key('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(last)
    ;(w.find('#cart-title').element as HTMLElement).focus()
    key('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(last)
    ;(w.find('#cart-title').element as HTMLElement).focus()
    key('Tab')
    expect(document.activeElement).toBe(first)
    w.unmount()
  })
})

describe('cart lines and summary', () => {
  it('quantity steppers change the quantity, the line total and the summary math', async () => {
    const { w, store } = await setup()
    await add(w, 0).trigger('click') // Sancocho 5.00
    await add(w, 1).trigger('click') // Chicha 2.50
    const plus = w.findAll('[data-test="qty-plus"]')
    await plus[0].trigger('click')
    await plus[0].trigger('click') // Sancocho x3
    expect(store.carrito.map((i: { cantidad: number }) => i.cantidad)).toEqual([3, 1])
    expect(w.findAll('[data-test="line-total"]').map((e) => e.text())).toEqual(['B/ 15.00', 'B/ 2.50'])
    expect(w.find('[data-test="summary-subtotal"]').text()).toBe('B/ 17.50')
    expect(w.find('[data-test="summary-envio"]').text()).toBe('B/ 2.50')
    expect(w.find('[data-test="summary-total"]').text()).toBe('B/ 20.00')
    expect(w.findAll('[data-test="qty-value"]').map((e) => e.text())).toEqual(['3', '1'])
    w.unmount()
  })

  it('steppers are named for their product and the minus on a single unit says it removes the line', async () => {
    const { w } = await setup()
    await add(w, 0).trigger('click')
    expect(w.find('[data-test="qty-plus"]').attributes('aria-label')).toBe('Agregar una unidad de Sancocho')
    expect(w.find('[data-test="qty-minus"]').attributes('aria-label')).toBe('Quitar Sancocho del carrito')
    await w.find('[data-test="qty-plus"]').trigger('click')
    expect(w.find('[data-test="qty-minus"]').attributes('aria-label')).toBe('Quitar una unidad de Sancocho')
    w.unmount()
  })

  it('removing the last unit of the last line shows the empty cart with one primary action', async () => {
    const { w, store } = await setup()
    await add(w, 0).trigger('click')
    await w.find('[data-test="qty-minus"]').trigger('click')
    expect(store.carrito).toEqual([])
    const empty = w.find('[data-test="cart-empty"]')
    expect(empty.text()).toContain('Tu carrito está vacío')
    expect(empty.find('svg').exists()).toBe(true)
    expect(w.find('[data-test="checkout-bar"]').exists()).toBe(false)
    expect(empty.findAll('button')).toHaveLength(1)
    w.unmount()
  })

  it('line notes are saved on the cart line', async () => {
    const { w, store } = await setup()
    await add(w, 0).trigger('click')
    await w.find('[data-test="item-note"]').setValue('sin cebolla')
    expect(store.carrito[0].observacion).toBe('sin cebolla')
    w.unmount()
  })

  it('the sticky bar carries the total on the left and exactly one primary button', async () => {
    const { w } = await setup()
    await add(w, 0).trigger('click')
    const bar = w.find('[data-test="checkout-bar"]')
    expect(bar.find('.cx-sheet-total').text()).toContain('B/ 7.50')
    expect(bar.findAll('button')).toHaveLength(1)
    expect(bar.find('button').classes()).toEqual(expect.arrayContaining(['cx-btn', 'cx-btn-lg']))
    w.unmount()
  })

  it('checkout shows the same total, an order summary and one primary button (the rest are secondary or ghost)', async () => {
    const { w } = await setup()
    await add(w, 0).trigger('click')
    await w.find('[data-test="cart-continue"]').trigger('click')
    await flushPromises()
    expect(w.find('#cart-title').text()).toBe('Finalizar pedido')
    expect(document.activeElement).toBe(w.find('#cart-title').element)
    expect(w.find('[data-test="summary-total"]').text()).toBe('B/ 7.50')
    const primarios = w.findAll('[data-test="cart-drawer"] .cx-btn').filter((b) => !/cx-btn-(secondary|ghost)/.test(b.classes().join(' ')))
    expect(primarios.map((b) => b.text())).toEqual(['Realizar pedido'])
    await w.find('[data-test="volver-carrito"]').trigger('click')
    expect(w.find('#cart-title').text()).toBe('Tu carrito')
    w.unmount()
  })
})

describe('checkout form states', () => {
  it('an empty address shows the inline error (icon + text + aria-invalid/describedby) and focuses the field', async () => {
    const { w, store } = await setup()
    store.usuario.direccion = ''
    await add(w, 0).trigger('click')
    await w.find('[data-test="cart-continue"]').trigger('click')
    await w.find('[data-test="place-order"]').trigger('click')
    await flushPromises()
    const input = w.find('#checkout-direccion')
    expect(input.attributes('aria-invalid')).toBe('true')
    const err = w.find('[data-test="direccion-error"]')
    expect(input.attributes('aria-describedby')).toBe(err.attributes('id'))
    expect(err.text()).toBe('Ingresa la dirección de entrega para continuar.')
    expect(err.find('svg').exists()).toBe(true)
    expect(document.activeElement).toBe(input.element)
    await input.setValue('Calle 1')
    expect(w.find('[data-test="direccion-error"]').exists()).toBe(false)
    expect(w.find('#checkout-direccion').attributes('aria-invalid')).toBeUndefined()
    w.unmount()
  })

  it('payment options are a labelled radio group; the chosen tile is marked', async () => {
    const { w } = await setup()
    await add(w, 0).trigger('click')
    await w.find('[data-test="cart-continue"]').trigger('click')
    const group = w.find('[role="radiogroup"]')
    expect(group.attributes('aria-labelledby')).toBe('pago-title')
    expect(w.find('#pago-title').text()).toBe('Método de pago')
    const tiles = group.findAll('label.cx-option')
    expect(tiles.map((t) => t.classes().includes('cx-option-selected'))).toEqual([true, false])
    await w.find('input[value="electronico"]').setValue(true)
    expect(tiles.map((t) => t.classes().includes('cx-option-selected'))).toEqual([false, true])
    w.unmount()
  })

  it('the consent block is a persistent danger alert with a secondary action to the profile', async () => {
    const { w, store } = await setup()
    store.consentimientoRequerido = true
    await add(w, 0).trigger('click')
    await w.find('[data-test="cart-continue"]').trigger('click')
    const box = w.find('[data-test="consent-required"]')
    expect(box.attributes('role')).toBe('alert')
    expect(box.classes()).toEqual(expect.arrayContaining(['cx-alert', 'cx-alert-danger']))
    expect(box.find('svg').exists()).toBe(true)
    expect(box.find('button').classes()).toContain('cx-btn-secondary')
    expect(box.find('button').text()).toBe('Ir a mi perfil para aceptar')
    w.unmount()
  })
})

describe('closed merchant', () => {
  it('shows the notice with an icon, disables every add button and never opens the cart', async () => {
    const { w, store } = await setup({ abierto: false })
    expect(w.find('[data-test="closed-merchant-notice"] svg').exists()).toBe(true)
    for (const b of w.findAll('[data-test="add-to-cart"]')) {
      expect((b.element as HTMLButtonElement).disabled).toBe(true)
      expect(b.attributes('aria-disabled')).toBe('true')
      expect(b.text()).toBe('Cerrado')
      await b.trigger('click')
    }
    expect(store.carrito).toHaveLength(0)
    expect(w.find('[data-test="cart-drawer"]').exists()).toBe(false)
    expect(w.find('[data-test="cart-fab"]').exists()).toBe(false)
    w.unmount()
  })
})

describe('menu "Ver más" pagination', () => {
  const muchos = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, nombre: `Plato ${String(i).padStart(2, '0')}`, precio: 3, precioRegular: 3, descripcion: '', categoria: i % 2 ? 'Par' : 'Impar', disponible: true }))

  it('a store with more than 12 products shows 12, then 24, then all, and filters reset the page', async () => {
    const { w } = await setup({ productos: muchos })
    const n = () => w.findAll('[data-test="product-card"]').length
    expect(n()).toBe(12)
    expect(w.find('[data-test="products-more"]').text()).toBe('Ver más productos (18 restantes)')
    await w.find('[data-test="products-more"]').trigger('click')
    expect(n()).toBe(24)
    await w.find('[data-test="products-more"]').trigger('click')
    expect(n()).toBe(30)
    expect(w.find('[data-test="products-more"]').exists()).toBe(false)

    await w.findAll('[data-test="products-category"]')[1].trigger('click') // Impar: 15 products
    expect(n()).toBe(12)
    expect(w.find('[data-test="products-more"]').text()).toBe('Ver más productos (3 restantes)')
    w.unmount()
  })

  it('12 products or fewer show no button', async () => {
    const { w } = await setup()
    expect(w.find('[data-test="products-more"]').exists()).toBe(false)
    w.unmount()
  })

  it('prints the store rating with one decimal', async () => {
    const { w } = await setup()
    expect(w.find('[data-test="store-summary"]').text()).toContain('4.0 calificación')
    w.unmount()
  })
})
