import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, ref } from 'vue'

// useRegisterSW comes from a vite-plugin-pwa virtual module: replace it with controllable state.
const needRefresh = ref(false)
const updateServiceWorker = vi.fn()
vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: () => ({ needRefresh, updateServiceWorker }),
}))

const Blank = defineComponent({ render: () => null })

async function mountAt(path = '/tiendas') {
  // Fresh module graph each time: the install state is a module-level singleton.
  vi.resetModules()
  const { default: PwaStatus } = await import('./PwaStatus.vue')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: Blank },
      { path: '/tiendas', name: 'stores', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  return mount(PwaStatus, { global: { plugins: [router] } })
}

function fireInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn(() => Promise.resolve())
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: typeof prompt
    userChoice: Promise<{ outcome: string }>
  }
  e.prompt = prompt
  e.userChoice = Promise.resolve({ outcome: outcome })
  window.dispatchEvent(e)
  return { e, prompt }
}

const setOnline = (online: boolean) =>
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)

describe('PwaStatus (non-landing route behaviour)', () => {
  beforeEach(() => {
    needRefresh.value = false
    updateServiceWorker.mockReset()
    vi.restoreAllMocks()
  })

  it('renders nothing by default', async () => {
    const w = await mountAt()
    expect(w.text()).toBe('')
  })

  describe('install banner', () => {
    it('appears when beforeinstallprompt fires after mount, and prevents the default mini-infobar', async () => {
      const w = await mountAt()
      const { e } = fireInstallEvent()
      await flushPromises()
      expect(e.defaultPrevented).toBe(true)
      expect(w.text()).toContain('Instalar Go Eats')
      expect(w.text()).toContain('Accede rápido desde tu pantalla de inicio.')
    })

    it('Instalar calls prompt() once and then hides the banner', async () => {
      const w = await mountAt()
      const { prompt } = fireInstallEvent()
      await flushPromises()
      await w.findAll('button').find((b) => b.text() === 'Instalar')!.trigger('click')
      await flushPromises()
      expect(prompt).toHaveBeenCalledTimes(1)
      expect(w.text()).not.toContain('Instalar Go Eats')
    })

    it('hides the banner after the user dismisses the browser dialog too', async () => {
      const w = await mountAt()
      fireInstallEvent('dismissed')
      await flushPromises()
      await w.findAll('button').find((b) => b.text() === 'Instalar')!.trigger('click')
      await flushPromises()
      expect(w.text()).not.toContain('Instalar Go Eats')
    })

    it('the close button hides the banner without prompting', async () => {
      const w = await mountAt()
      const { prompt } = fireInstallEvent()
      await flushPromises()
      await w.find('button[aria-label="Cerrar"]').trigger('click')
      expect(w.text()).not.toContain('Instalar Go Eats')
      expect(prompt).not.toHaveBeenCalled()
    })
  })

  describe('offline banner', () => {
    it('shows at mount when the browser is offline', async () => {
      setOnline(false)
      const w = await mountAt()
      expect(w.text()).toContain('Sin conexión. Mostrando datos en caché.')
    })

    it('follows offline and online events', async () => {
      const w = await mountAt()
      expect(w.text()).not.toContain('Sin conexión')
      window.dispatchEvent(new Event('offline'))
      await flushPromises()
      expect(w.text()).toContain('Sin conexión. Mostrando datos en caché.')
      window.dispatchEvent(new Event('online'))
      await flushPromises()
      expect(w.text()).not.toContain('Sin conexión')
    })

    it('removes its online/offline listeners on unmount', async () => {
      const w = await mountAt()
      const remove = vi.spyOn(window, 'removeEventListener')
      w.unmount()
      const removed = remove.mock.calls.map(([type]) => type)
      expect(removed).toContain('online')
      expect(removed).toContain('offline')
    })
  })

  describe('update banner', () => {
    it('shows when a new service worker is waiting and Actualizar applies it', async () => {
      needRefresh.value = true
      const w = await mountAt()
      expect(w.text()).toContain('Nueva versión disponible')
      await w.findAll('button').find((b) => b.text() === 'Actualizar')!.trigger('click')
      expect(updateServiceWorker).toHaveBeenCalledTimes(1)
    })

    it('Cerrar clears needRefresh', async () => {
      needRefresh.value = true
      const w = await mountAt()
      await w.find('button[aria-label="Cerrar"]').trigger('click')
      expect(needRefresh.value).toBe(false)
      expect(w.text()).not.toContain('Nueva versión disponible')
    })

    it('takes precedence over the install banner when both apply', async () => {
      needRefresh.value = true
      const w = await mountAt()
      fireInstallEvent()
      await flushPromises()
      expect(w.text()).toContain('Nueva versión disponible')
      expect(w.text()).not.toContain('Instalar Go Eats')
    })
  })

  describe('on the landing route (new)', () => {
    it('hides ONLY the floating install banner', async () => {
      const w = await mountAt('/')
      fireInstallEvent()
      await flushPromises()
      expect(w.text()).not.toContain('Instalar Go Eats')
    })

    it('keeps the offline banner', async () => {
      setOnline(false)
      const w = await mountAt('/')
      expect(w.text()).toContain('Sin conexión. Mostrando datos en caché.')
    })

    it('keeps the update banner', async () => {
      needRefresh.value = true
      const w = await mountAt('/')
      expect(w.text()).toContain('Nueva versión disponible')
    })

    it('shows the install banner again after navigating away from the landing', async () => {
      const w = await mountAt('/')
      fireInstallEvent()
      await flushPromises()
      expect(w.text()).not.toContain('Instalar Go Eats')
      await w.vm.$router.push('/tiendas')
      await flushPromises()
      expect(w.text()).toContain('Instalar Go Eats')
    })
  })
})
