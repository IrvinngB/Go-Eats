import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

function fireInstallEvent() {
  const prompt = vi.fn(() => Promise.resolve())
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: typeof prompt
    userChoice: Promise<{ outcome: string }>
  }
  e.prompt = prompt
  e.userChoice = Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(e)
  return { prompt }
}

async function load() {
  vi.resetModules() // fresh singleton per test
  const { default: InstallSection } = await import('./InstallSection.vue')
  const copy = await import('./content')
  return { InstallSection, INSTALL_COPY: copy.INSTALL_COPY }
}

describe('InstallSection', () => {
  beforeEach(() => {
    // @ts-expect-error jsdom has no matchMedia; tests opt in
    delete window.matchMedia
  })
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
  })

  it('is the #instalar surface band labelled by its single h2', async () => {
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    const s = w.get('section')
    expect(s.attributes('id')).toBe('instalar')
    expect(s.classes()).toContain('lp-band-surface')
    expect(w.findAll('h2')).toHaveLength(1)
    expect(s.attributes('aria-labelledby')).toBe(w.get('h2').attributes('id'))
    expect(w.get('h2').text()).toBe('Lleva Go Eats en tu pantalla de inicio')
  })

  it('without a prompt shows neutral text and no button', async () => {
    const { InstallSection, INSTALL_COPY } = await load()
    const w = mount(InstallSection)
    expect(w.find('button').exists()).toBe(false)
    expect(w.get('[data-test="install-neutral"]').text()).toBe(INSTALL_COPY.neutral)
    expect(w.find('[data-test="install-ios"]').exists()).toBe(false)
  })

  it('shows a secondary install button when the prompt is available and activating it prompts once', async () => {
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    const { prompt } = fireInstallEvent()
    await flushPromises()
    const btn = w.get('button')
    expect(btn.text()).toBe('Instalar Go Eats')
    expect(btn.classes()).toEqual(expect.arrayContaining(['lp-btn', 'lp-btn-secondary']))
    expect(w.find('[data-test="install-neutral"]').exists()).toBe(false)
    await btn.trigger('click')
    await flushPromises()
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(w.find('button').exists()).toBe(false)
  })

  it('still shows the button when the event fired before the section mounted', async () => {
    vi.resetModules()
    await import('../../composables/useInstallPrompt') // PwaStatus loads this first in the app
    fireInstallEvent()
    const { default: InstallSection } = await import('./InstallSection.vue')
    const w = mount(InstallSection)
    expect(w.get('button').text()).toBe('Instalar Go Eats')
  })

  it('on iOS shows text instructions instead of a button', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    const ios = w.get('[data-test="install-ios"]')
    expect(ios.text()).toContain('Compartir')
    expect(ios.text()).toContain('Agregar a pantalla de inicio')
    expect(w.find('button').exists()).toBe(false)
    expect(w.find('[data-test="install-neutral"]').exists()).toBe(false)
  })

  it('on iOS a real prompt event still wins over the instructions', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    fireInstallEvent()
    await flushPromises()
    expect(w.find('button').exists()).toBe(true) // a real prompt wins even on iOS
  })

  it('renders nothing when the app already runs standalone', async () => {
    window.matchMedia = vi.fn((q: string) => ({ matches: q === '(display-mode: standalone)', media: q })) as unknown as typeof window.matchMedia
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    expect(w.find('section').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
  })

  it('disappears when appinstalled fires while the page is open', async () => {
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    fireInstallEvent()
    window.dispatchEvent(new Event('appinstalled'))
    await flushPromises()
    expect(w.find('section').exists()).toBe(false)
  })

  it('keeps the phone visual decorative and out of the accessibility tree', async () => {
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    const visual = w.get('[data-test="install-visual"]')
    expect(visual.attributes('aria-hidden')).toBe('true')
    expect(visual.text()).toBe('Go Eats')
  })

  it('claims only PWA facts: no stores, ratings, downloads, numbers or prices', async () => {
    const { InstallSection, INSTALL_COPY } = await load()
    const w = mount(InstallSection)
    const all = [...Object.values(INSTALL_COPY), w.text()].join(' | ')
    expect(all).not.toMatch(/app ?store|google play|play store|tienda de apps|tiendas de aplicaciones|descarg|calificaci|valoraci|estrellas?|★|rese[ñn]|\d|[$€%]|gratis|oficial/i)
    expect(INSTALL_COPY.lead).toContain('navegador')
  })

  it('has no store badge images or links', async () => {
    const { InstallSection } = await load()
    const w = mount(InstallSection)
    expect(w.findAll('img, a')).toHaveLength(0)
  })
})
