import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

// The lazy map is replaced by a stub that emits a chosen pin: Leaflet itself is covered by
// AddressPickerMap.spec.ts and e2e/checkout-address.spec.ts.
vi.mock('../../components/AddressPickerMap.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true, // lets defineAsyncComponent unwrap `default` from the mocked module
    default: defineComponent({
      props: { modelValue: { type: Object, default: null }, disabled: Boolean },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () =>
          h('div', { 'data-test': 'picker-stub' }, [
            h('span', { 'data-test': 'picker-pin' }, props.modelValue ? `${props.modelValue.lat},${props.modelValue.lng}` : 'none'),
            h('button', { type: 'button', 'data-test': 'pick-inside', onClick: () => emit('update:modelValue', { lat: 9.0, lng: -79.5 }) }, 'inside'),
            h('button', { type: 'button', 'data-test': 'pick-outside', onClick: () => emit('update:modelValue', { lat: 9.35, lng: -79.9 }) }, 'outside'),
            h('button', { type: 'button', 'data-test': 'pick-none', onClick: () => emit('update:modelValue', null) }, 'none'),
          ])
      },
    }),
  }
})

import StoreDetailView from './StoreDetailView.vue'
import api from '../../services/api'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

async function setup(promo = false, autenticado = true, usuario: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = autenticado
  store.rol = 'customer'
  Object.assign(store.usuario, usuario)
  store.comercios = [{ id: 'c9', nombre: 'Comercio', tipo: 'Restaurante', zona: 'san-francisco', rating: 4, tiempoEntrega: '20', abierto: true, descripcion: '', icono: 'Store', estadoAfiliacion: 'activo' }]
  store.catalogo = {
    c9: [{ id: 'p1', nombre: 'Plato', precio: promo ? 4 : 5, precioRegular: 5, descripcion: '', categoria: 'x', disponible: true }],
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/login', name: 'login', component: StoreDetailView }, { path: '/tiendas/:id', component: StoreDetailView }, { path: '/tiendas', component: StoreDetailView }, { path: '/pedidos', component: StoreDetailView }, { path: '/perfil', name: 'profile', component: StoreDetailView }] })
  await router.push('/tiendas/c9')
  await router.isReady()
  const w = mount(StoreDetailView, { global: { plugins: [pinia, router] } })
  return { w, store, router }
}

async function openCheckout(w: Awaited<ReturnType<typeof setup>>['w']) {
  await w.find('button.btn-primary').trigger('click') // add the product
  await w.findAll('button').find((b) => b.text() === 'Continuar')!.trigger('click')
}

describe('StoreDetailView checkout', () => {
  it('labels the electronic option "Pago electrónico (simulado)" without naming a provider', async () => {
    const { w } = await setup()
    await openCheckout(w)
    const label = w.findAll('label').find((l) => l.find('input[value="electronico"]').exists())!
    expect(label.text()).toContain('Pago electrónico (simulado)')
    expect(label.text()).toContain('sin datos reales de tarjeta')
    expect(w.text()).not.toMatch(/yappy|paguelo/i)
  })

  it('shows the effective promo price and the regular one struck through', async () => {
    const { w } = await setup(true)
    expect(w.find('[data-test="precio-efectivo"]').text()).toBe('B/ 4.00')
    expect(w.find('[data-test="precio-regular"]').text()).toBe('B/ 5.00')
  })

  it('shows a single price when there is no promo', async () => {
    const { w } = await setup(false)
    expect(w.find('[data-test="precio-efectivo"]').text()).toBe('B/ 5.00')
    expect(w.find('[data-test="precio-regular"]').exists()).toBe(false)
  })
})

describe('StoreDetailView payment flow', () => {
  const pedido = (extra = {}) => ({ id: 'PED-7', total: 12, estado: 'pendiente', pagoEstado: 'pagado', referenciaPasarela: 'YPY-ABC', ...extra })

  async function toCheckout(w: Awaited<ReturnType<typeof setup>>['w'], metodo: string) {
    await openCheckout(w)
    await w.find('input.input').setValue('Calle 45')
    await w.find(`input[value="${metodo}"]`).setValue(true)
    await w.findAll('button').find((b) => b.text() === 'Realizar pedido')!.trigger('click')
    await flushPromises()
  }

  it('electronic opens a modal with a single "Pagar (simulado)" action and no outcome buttons', async () => {
    const { w, store } = await setup()
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await toCheckout(w, 'electronico')
    const labels = w.findAll('.modal-panel button').map((b) => b.text())
    expect(labels).toEqual(['Pagar (simulado)'])
    expect(w.text()).not.toMatch(/Simular (rechazo|aprobación)/)
    expect(crear).not.toHaveBeenCalled() // nothing is created until the user pays
  })

  it('paying calls crearPedido once with the electronic method and shows the server reference', async () => {
    const { w, store } = await setup()
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await toCheckout(w, 'electronico')
    await w.find('.modal-panel button').trigger('click')
    await flushPromises()
    expect(crear).toHaveBeenCalledTimes(1)
    expect(crear).toHaveBeenCalledWith({ direccion: 'Calle 45', lat: null, lng: null, metodoPago: 'electronico', observaciones: '' })
    expect(w.find('.modal-panel').text()).toContain('Pago aprobado')
    expect(w.find('.modal-panel').text()).toContain('YPY-ABC')
  })

  it('shows the rejection when the server reports a failed payment', async () => {
    const { w, store } = await setup()
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido({ pagoEstado: 'fallido', estado: 'cancelado' }))
    await toCheckout(w, 'electronico')
    await w.find('.modal-panel button').trigger('click')
    await flushPromises()
    expect(w.find('.modal-panel').text()).toContain('Pago rechazado')
  })

  it('cash on delivery goes through the same call without a payment modal', async () => {
    const { w, store } = await setup()
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido({ pagoEstado: 'pendiente', referenciaPasarela: 'COD-1' }))
    await toCheckout(w, 'contr_entrega')
    expect(crear).toHaveBeenCalledWith({ direccion: 'Calle 45', lat: null, lng: null, metodoPago: 'contr_entrega', observaciones: '' })
    expect(w.find('.modal-panel').exists()).toBe(false)
  })

  it('anonymous checkout redirects to login with the store as target and keeps the cart', async () => {
    const { w, store, router } = await setup(false, false)
    const crear = vi.spyOn(store, 'crearPedido')
    await toCheckout(w, 'contr_entrega')
    expect(crear).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/tiendas/c9')
    expect(store.carrito).toHaveLength(1)
  })
})

describe('StoreDetailView consent_required', () => {
  async function toCheckout(w: Awaited<ReturnType<typeof setup>>['w'], metodo: string) {
    await openCheckout(w)
    await w.find('input.input').setValue('Calle 45')
    await w.find(`input[value="${metodo}"]`).setValue(true)
    await w.findAll('button').find((b) => b.text() === 'Realizar pedido')!.trigger('click')
    await flushPromises()
  }

  function blocked(store: { consentimientoRequerido: boolean }) {
    return async () => {
      store.consentimientoRequerido = true
      return null
    }
  }

  it('cash: the drawer shows the specific message and a link to Perfil that navigates there', async () => {
    const { w, store, router } = await setup()
    vi.spyOn(store, 'crearPedido').mockImplementation(blocked(store))
    await toCheckout(w, 'contr_entrega')
    const box = w.find('[data-test="consent-required"]')
    expect(box.text()).toContain('Debes aceptar el tratamiento de tus datos')
    await box.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('electronic: the modal explains the consent block instead of the generic payment error', async () => {
    const { w, store, router } = await setup()
    vi.spyOn(store, 'crearPedido').mockImplementation(blocked(store))
    await toCheckout(w, 'electronico')
    await w.findAll('.modal-panel button').find((b) => b.text() === 'Pagar (simulado)')!.trigger('click')
    await flushPromises()
    const box = w.find('.modal-panel [data-test="consent-required"]')
    expect(box.text()).toContain('Debes aceptar el tratamiento de tus datos')
    expect(w.find('.modal-panel').text()).not.toContain('No pudimos procesar el pago')
    await box.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('no consent message while the flag is off', async () => {
    const { w, store } = await setup()
    vi.spyOn(store, 'crearPedido').mockResolvedValue(null)
    await toCheckout(w, 'contr_entrega')
    expect(w.find('[data-test="consent-required"]').exists()).toBe(false)
  })
})

describe('StoreDetailView checkout address', () => {
  const PERFIL = { direccion: 'Calle 50, Edificio Nogal', lat: 8.9824, lng: -79.5199 }
  const pedido = (extra = {}) => ({ id: 'PED-7', total: 12, estado: 'pendiente', pagoEstado: 'pendiente', referenciaPasarela: 'COD-1', ...extra })
  type W = Awaited<ReturnType<typeof setup>>['w']
  const boton = (w: W, texto: string) => w.findAll('button').find((b) => b.text() === texto)
  const realizar = async (w: W) => {
    await boton(w, 'Realizar pedido')!.trigger('click')
    await flushPromises()
  }
  const cambiar = async (w: W) => {
    await w.find('[data-test="cambiar-direccion"]').trigger('click')
    await flushPromises()
  }

  it('prefills the profile address text and pin and offers to change it for this order', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await openCheckout(w)
    expect(w.find('[data-test="direccion-guardada"]').text()).toContain('Calle 50, Edificio Nogal')
    expect(w.find('[data-test="cambiar-direccion"]').text()).toBe('Cambiar para este pedido')
    expect(w.find('[data-test="picker-stub"]').exists()).toBe(false) // the map is only loaded when changing
    await realizar(w)
    expect(crear).toHaveBeenCalledWith({ direccion: 'Calle 50, Edificio Nogal', lat: 8.9824, lng: -79.5199, metodoPago: 'contr_entrega', observaciones: '' })
  })

  it('starts empty, with an editable text field, when the profile has no default', async () => {
    const { w } = await setup(false, true, { direccion: '', lat: null, lng: null })
    await openCheckout(w)
    expect(w.find('[data-test="direccion-guardada"]').exists()).toBe(false)
    expect((w.find('input.input').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="cambiar-direccion"]').exists()).toBe(false)
  })

  it('a profile default without a pin prefills only the text and orders without coordinates', async () => {
    const { w, store } = await setup(false, true, { direccion: 'Calle 50', lat: null, lng: null })
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await openCheckout(w)
    await realizar(w)
    expect(crear).toHaveBeenCalledWith({ direccion: 'Calle 50', lat: null, lng: null, metodoPago: 'contr_entrega', observaciones: '' })
  })

  it('"Cambiar para este pedido" reveals the editable address and the map, prefilled, and does not touch the profile', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const guardar = vi.spyOn(store, 'guardarPerfil')
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await openCheckout(w)
    await cambiar(w)
    const input = w.find('input.input')
    expect((input.element as HTMLInputElement).value).toBe('Calle 50, Edificio Nogal')
    expect(w.find('[data-test="picker-pin"]').text()).toBe('8.9824,-79.5199')
    await input.setValue('Avenida Balboa, Torre 3')
    await w.find('[data-test="pick-inside"]').trigger('click')
    await realizar(w)
    expect(crear).toHaveBeenCalledWith({ direccion: 'Avenida Balboa, Torre 3', lat: 9.0, lng: -79.5, metodoPago: 'contr_entrega', observaciones: '' })
    expect(guardar).not.toHaveBeenCalled()
    expect(store.usuario).toMatchObject(PERFIL)
  })

  it('"Usar mi dirección guardada" restores the default text and pin', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Otra calle 99')
    await w.find('[data-test="pick-outside"]').trigger('click')
    await w.find('[data-test="usar-guardada"]').trigger('click')
    expect(w.find('[data-test="direccion-guardada"]').text()).toContain('Calle 50, Edificio Nogal')
    await realizar(w)
    expect(crear).toHaveBeenCalledWith({ direccion: 'Calle 50, Edificio Nogal', lat: 8.9824, lng: -79.5199, metodoPago: 'contr_entrega', observaciones: '' })
  })

  it('the "Guardar como mi dirección" box is off by default and only exists while editing', async () => {
    const { w } = await setup(false, true, PERFIL)
    await openCheckout(w)
    expect(w.find('[data-test="guardar-default"]').exists()).toBe(false)
    await cambiar(w)
    const box = w.find('[data-test="guardar-default"]')
    expect((box.element as HTMLInputElement).checked).toBe(false)
    const label = w.findAll('label').find((l) => l.find('[data-test="guardar-default"]').exists())!
    expect(label.text()).toBe('Guardar como mi dirección')
  })

  it('unticked: the order never updates the profile default', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const guardar = vi.spyOn(store, 'guardarPerfil')
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Avenida Balboa, Torre 3')
    await realizar(w)
    expect(guardar).not.toHaveBeenCalled()
  })

  it('ticked: after the order succeeds the chosen address and pin become the profile default', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const orden: string[] = []
    const guardar = vi.spyOn(store, 'guardarPerfil').mockImplementation(async () => {
      orden.push('perfil')
      return { ok: true }
    })
    vi.spyOn(store, 'crearPedido').mockImplementation(async () => {
      orden.push('pedido')
      return pedido()
    })
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Avenida Balboa, Torre 3')
    await w.find('[data-test="pick-inside"]').trigger('click')
    await w.find('[data-test="guardar-default"]').setValue(true)
    await realizar(w)
    expect(orden).toEqual(['pedido', 'perfil'])
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(guardar).toHaveBeenCalledWith({ direccion: 'Avenida Balboa, Torre 3', lat: 9.0, lng: -79.5 })
  })

  it('ticked and persisted through the real store: PUT /users/me carries the new default', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    vi.mocked(api.put).mockResolvedValue({ data: { full_name: 'Ana', phone: '600', address: 'Avenida Balboa, Torre 3', lat: 9.0, lng: -79.5 } })
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Avenida Balboa, Torre 3')
    await w.find('[data-test="pick-inside"]').trigger('click')
    await w.find('[data-test="guardar-default"]').setValue(true)
    await realizar(w)
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/users/me', expect.objectContaining({ address: 'Avenida Balboa, Torre 3', lat: 9.0, lng: -79.5 }))
    expect(store.usuario).toMatchObject({ direccion: 'Avenida Balboa, Torre 3', lat: 9.0, lng: -79.5 })
  })

  it('ticked but the order fails: the profile is not touched and the cart-side data stays', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const guardar = vi.spyOn(store, 'guardarPerfil')
    vi.spyOn(store, 'crearPedido').mockResolvedValue(null)
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Avenida Balboa, Torre 3')
    await w.find('[data-test="guardar-default"]').setValue(true)
    await realizar(w)
    expect(guardar).not.toHaveBeenCalled()
    expect((w.find('input.input').element as HTMLInputElement).value).toBe('Avenida Balboa, Torre 3')
  })

  it('a failure saving the default does not fail the order: it only shows the typed error', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    vi.spyOn(store, 'guardarPerfil').mockResolvedValue({ ok: false, error: { code: 'validation', message: 'La dirección es inválida.' } })
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Avenida Balboa, Torre 3')
    await w.find('[data-test="guardar-default"]').setValue(true)
    await realizar(w)
    expect(store.notificacion).toMatchObject({ tipo: 'error' })
    expect(store.notificacion.texto).toContain('Pedido PED-7 enviado')
    expect(store.notificacion.texto).toContain('La dirección es inválida.')
    expect(w.find('aside').exists()).toBe(false) // checkout closed: the order went through
  })

  it('electronic: the default is saved after the payment flow succeeds, not when the modal opens', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const guardar = vi.spyOn(store, 'guardarPerfil').mockResolvedValue({ ok: true })
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido({ pagoEstado: 'pagado', referenciaPasarela: 'YPY-1' }))
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Avenida Balboa, Torre 3')
    await w.find('[data-test="guardar-default"]').setValue(true)
    await w.find('input[value="electronico"]').setValue(true)
    await realizar(w)
    expect(guardar).not.toHaveBeenCalled()
    await w.find('.modal-panel button').trigger('click')
    await flushPromises()
    expect(guardar).toHaveBeenCalledWith({ direccion: 'Avenida Balboa, Torre 3', lat: 8.9824, lng: -79.5199 }) // the prefilled pin was kept
  })

  it('electronic with a rejected payment (cancelled order) does not save the default', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const guardar = vi.spyOn(store, 'guardarPerfil').mockResolvedValue({ ok: true })
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido({ pagoEstado: 'fallido', estado: 'cancelado' }))
    await openCheckout(w)
    await cambiar(w)
    await w.find('input.input').setValue('Avenida Balboa, Torre 3')
    await w.find('[data-test="guardar-default"]').setValue(true)
    await w.find('input[value="electronico"]').setValue(true)
    await realizar(w)
    await w.find('.modal-panel button').trigger('click')
    await flushPromises()
    expect(guardar).not.toHaveBeenCalled()
  })

  it('a pin outside coverage shows the soft warning and still lets the user order', async () => {
    const { w, store } = await setup(false, true, { direccion: 'Calle 50', lat: 9.35, lng: -79.9 })
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await openCheckout(w)
    expect(w.find('[data-test="coverage-warning"]').text()).toContain('fuera de las zonas de cobertura')
    await realizar(w)
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ lat: 9.35, lng: -79.9 }))
  })

  it('a default pin inside coverage shows no warning', async () => {
    const { w } = await setup(false, true, PERFIL)
    await openCheckout(w)
    expect(w.find('[data-test="coverage-warning"]').exists()).toBe(false)
  })

  it('address text is still required, with the same message, even with a prefilled pin', async () => {
    const { w, store } = await setup(false, true, { direccion: '', lat: 8.9824, lng: -79.5199 })
    const crear = vi.spyOn(store, 'crearPedido')
    await openCheckout(w)
    await realizar(w)
    expect(crear).not.toHaveBeenCalled()
    expect(store.notificacion.texto).toBe('Ingresa la dirección de entrega para continuar.')
  })

  it('a changed pin after a failed order attempt is sent as the new pin (retry-safety lives in the store)', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValueOnce(null).mockResolvedValue(pedido())
    await openCheckout(w)
    await realizar(w)
    await cambiar(w)
    await w.find('[data-test="pick-inside"]').trigger('click')
    await realizar(w)
    expect(crear.mock.calls.map((c: any[]) => [c[0].lat, c[0].lng])).toEqual([[8.9824, -79.5199], [9.0, -79.5]])
  })

  it('after an order the next checkout opens prefilled again and the box is off', async () => {
    const { w, store } = await setup(false, true, PERFIL)
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    vi.spyOn(store, 'guardarPerfil').mockResolvedValue({ ok: true })
    await openCheckout(w)
    await cambiar(w)
    await w.find('[data-test="guardar-default"]').setValue(true)
    await realizar(w)
    await openCheckout(w)
    expect(w.find('[data-test="direccion-guardada"]').exists()).toBe(true)
    await cambiar(w)
    expect((w.find('[data-test="guardar-default"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('the editable address field has a label bound to it', async () => {
    const { w } = await setup(false, true, PERFIL)
    await openCheckout(w)
    await cambiar(w)
    const input = w.find('input.input')
    const label = w.find(`label[for="${input.attributes('id')}"]`)
    expect(label.text()).toBe('Dirección de entrega')
  })
})
