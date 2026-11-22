import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

vi.mock('../services/api', () => ({
  default: { get: vi.fn().mockRejectedValue(new Error('offline')), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

const Stub = defineComponent({ render: () => h('div') })

// The flag is read once at import time (build-time constant), so each case loads fresh modules.
async function mountTopBar(flag: string | undefined, session?: { rol: string; nombre: string; email: string }) {
  vi.resetModules()
  if (flag === undefined) vi.stubEnv('VITE_ENABLE_DEMO_SWITCHER', '')
  else vi.stubEnv('VITE_ENABLE_DEMO_SWITCHER', flag)
  const { default: TopBar } = await import('./TopBar.vue')
  // @ts-expect-error the store is plain JS without declarations
  const { useGoEatsStore } = await import('../stores/useGoEatsStore')
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  if (session) {
    store.autenticado = true
    store.rol = session.rol
    store.usuario = { nombre: session.nombre, email: session.email, telefono: '', consentimientoLey81: null }
  } else {
    store.cerrarSesion()
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: Stub },
      { path: '/tiendas', component: Stub },
      { path: '/panel-comercio', component: Stub },
    ],
  })
  await router.push('/tiendas')
  await router.isReady()
  const wrapper = mount(TopBar, { global: { plugins: [pinia, router] } })
  if (flag === 'true') await import('../demoAccounts') // warm the lazy chunk so the component's own import() settles in a tick
  await flushPromises() // demo accounts are lazy-loaded (dynamic import) in flag-on builds
  return { wrapper, router, store }
}

const merchant = { rol: 'merchant', nombre: 'Héctor Endara', email: 'hector.endara@ejemplo.pa' }

describe('TopBar', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllEnvs())

  describe('anonymous', () => {
    it('shows "Iniciar sesión" and never the mock Carlos Andrade / Cliente user', async () => {
      const { wrapper } = await mountTopBar(undefined)
      expect(wrapper.text()).toContain('Iniciar sesión')
      expect(wrapper.text()).not.toContain('Carlos Andrade')
      expect(wrapper.text()).not.toContain('Cliente')
      expect(wrapper.text()).not.toContain('Invitado')
    })

    it('the button goes to /login and there is no account menu', async () => {
      const { wrapper, router } = await mountTopBar(undefined)
      const btn = wrapper.findAll('button').find((b) => b.text() === 'Iniciar sesión')!
      await btn.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('login')
      expect(wrapper.text()).not.toContain('Cerrar sesión')
    })

    it('shows no customer nav links to an anonymous visitor on public stores', async () => {
      const { wrapper } = await mountTopBar(undefined)
      expect(wrapper.text()).not.toContain('Mis pedidos')
    })
  })

  describe('authenticated', () => {
    it('shows the SERVER role and name, not the hardcoded customer', async () => {
      const { wrapper } = await mountTopBar(undefined, merchant)
      expect(wrapper.text()).toContain('Héctor Endara')
      expect(wrapper.text()).toContain('Comercio')
      expect(wrapper.text()).not.toContain('Mis pedidos')
      expect(wrapper.text()).not.toContain('Iniciar sesión')
    })

    it('shows customer links only for a customer', async () => {
      const { wrapper } = await mountTopBar(undefined, { rol: 'customer', nombre: 'Carlos Andrade', email: 'carlos@ejemplo.pa' })
      expect(wrapper.text()).toContain('Mis pedidos')
      expect(wrapper.text()).toContain('Cliente')
    })
  })

  describe('demo switcher flag', () => {
    async function openMenu(wrapper: ReturnType<typeof mount>) {
      await wrapper.find('[data-test="account-trigger"]').trigger('click')
    }

    it('is hidden when the flag is off (unset)', async () => {
      const { wrapper } = await mountTopBar(undefined, merchant)
      await openMenu(wrapper)
      expect(wrapper.text()).toContain('Cerrar sesión')
      expect(wrapper.text()).not.toContain('Cambiar de Cuenta')
      expect(wrapper.text()).not.toContain('admin@goeats.pa')
    })

    it.each(['false', 'TRUE', '1', 'yes'])('is hidden for the flag value %j (only the exact string "true" enables it)', async (value) => {
      const { wrapper } = await mountTopBar(value, merchant)
      await openMenu(wrapper)
      expect(wrapper.text()).not.toContain('Cambiar de Cuenta')
    })

    it('is shown with the 6 demo accounts when the flag is "true"', async () => {
      const { wrapper } = await mountTopBar('true', merchant)
      await openMenu(wrapper)
      expect(wrapper.text()).toContain('Cambiar de Cuenta')
      expect(wrapper.text()).toContain('admin@goeats.pa')
      expect(wrapper.text()).toContain('contabilidad@goeats.pa')
      expect(wrapper.findAll('button').filter((b) => b.text().includes('@')).length).toBe(6)
    })

    it('picking a demo account uses the normal login and goes to the SERVER role home, not the listed role', async () => {
      const { wrapper, router, store } = await mountTopBar('true', merchant)
      // the list says María is a courier, but the server answers customer: the server wins
      const spy = vi.spyOn(store, 'cambiarACuentaDemo').mockImplementation(async () => {
        store.rol = 'customer'
        return { ok: true }
      })
      await openMenu(wrapper)
      await wrapper.findAll('button').find((b) => b.text().includes('maria.cedeno@ejemplo.pa'))!.trigger('click')
      await flushPromises()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(router.currentRoute.value.fullPath).toBe('/tiendas')
    })

    it('a failed demo login does not navigate', async () => {
      const { wrapper, router, store } = await mountTopBar('true', merchant)
      vi.spyOn(store, 'cambiarACuentaDemo').mockResolvedValue({ ok: false, mensaje: 'x' })
      await router.push('/panel-comercio')
      await openMenu(wrapper)
      await wrapper.findAll('button').find((b) => b.text().includes('admin@goeats.pa'))!.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/panel-comercio')
    })
  })

  describe('restyle contract (Friendly Bento shell)', () => {
    const customer = { rol: 'customer', nombre: 'Carlos Andrade', email: 'carlos@ejemplo.pa' }

    it('the bar sits in the light .cx scope and is a banner landmark', async () => {
      const { wrapper } = await mountTopBar(undefined)
      expect(wrapper.element.tagName).toBe('HEADER')
      expect(wrapper.classes()).toEqual(expect.arrayContaining(['cx', 'cx-topbar']))
    })

    it('anonymous: the way in is a secondary (not a second primary) pill button', async () => {
      const { wrapper } = await mountTopBar(undefined)
      const btn = wrapper.findAll('button').find((b) => b.text() === 'Iniciar sesión')!
      expect(btn.classes()).toEqual(expect.arrayContaining(['cx-btn', 'cx-btn-secondary']))
    })

    it('the account trigger names the user, exposes aria-expanded and toggles it', async () => {
      const { wrapper } = await mountTopBar(undefined, merchant)
      const trigger = wrapper.find('[data-test="account-trigger"]')
      expect(trigger.attributes('aria-label')).toBe('Cuenta de Héctor Endara')
      expect(trigger.attributes('aria-expanded')).toBe('false')
      await trigger.trigger('click')
      expect(trigger.attributes('aria-expanded')).toBe('true')
      expect(wrapper.find('[data-test="account-menu"]').exists()).toBe(true)
      await trigger.trigger('click')
      expect(trigger.attributes('aria-expanded')).toBe('false')
      expect(wrapper.find('[data-test="account-menu"]').exists()).toBe(false)
    })

    it('Escape closes the account menu', async () => {
      const { wrapper } = await mountTopBar(undefined, merchant)
      await wrapper.find('[data-test="account-trigger"]').trigger('click')
      await wrapper.find('[data-test="account-menu"]').trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('[data-test="account-menu"]').exists()).toBe(false)
    })

    it('marks the current customer destination with aria-current="page"', async () => {
      const { wrapper } = await mountTopBar(undefined, customer)
      const items = wrapper.findAll('nav button')
      expect(items.map((b) => b.text())).toEqual(['Explorar', 'Mis pedidos', 'Perfil'])
      expect(items.map((b) => b.attributes('aria-current'))).toEqual(['page', undefined, undefined])
    })

    it('a customer also gets the destinations inside the account menu (the nav is hidden under 768px)', async () => {
      const { wrapper, router } = await mountTopBar(undefined, customer)
      await wrapper.find('[data-test="account-trigger"]').trigger('click')
      const links = wrapper.findAll('[data-test="menu-nav"] button')
      expect(links.map((b) => b.text())).toEqual(['Explorar', 'Mis pedidos', 'Perfil'])
      await links[1].trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/pedidos')
      expect(wrapper.find('[data-test="account-menu"]').exists()).toBe(false)
    })

    it('other roles get no customer destinations in the menu', async () => {
      const { wrapper } = await mountTopBar(undefined, merchant)
      await wrapper.find('[data-test="account-trigger"]').trigger('click')
      expect(wrapper.find('[data-test="menu-nav"]').exists()).toBe(false)
    })

    it('logout still signs out and goes to /login', async () => {
      const { wrapper, router, store } = await mountTopBar(undefined, merchant)
      await wrapper.find('[data-test="account-trigger"]').trigger('click')
      await wrapper.findAll('button').find((b) => b.text() === 'Cerrar sesión')!.trigger('click')
      await flushPromises()
      expect(store.autenticado).toBe(false)
      expect(router.currentRoute.value.name).toBe('login')
    })
  })
})
