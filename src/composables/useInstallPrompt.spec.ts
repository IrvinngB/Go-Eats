import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Outcome = 'accepted' | 'dismissed'

function fireInstallEvent(outcome: Outcome = 'accepted') {
  const prompt = vi.fn(() => Promise.resolve())
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: typeof prompt
    userChoice: Promise<{ outcome: Outcome }>
  }
  e.prompt = prompt
  e.userChoice = Promise.resolve({ outcome })
  window.dispatchEvent(e)
  return { e, prompt }
}

function setUserAgent(ua: string, maxTouchPoints = 0) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  // jsdom has no maxTouchPoints, so spyOn cannot be used here.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
}

function setStandalone(matches: boolean) {
  window.matchMedia = vi.fn((q: string) => ({
    matches: matches && q === '(display-mode: standalone)',
    media: q,
  })) as unknown as typeof window.matchMedia
}

async function load() {
  vi.resetModules()
  return (await import('./useInstallPrompt')).useInstallPrompt()
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
const MAC_IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36'

describe('useInstallPrompt', () => {
  beforeEach(() => {
    // @ts-expect-error jsdom has no matchMedia; each test opts in
    delete window.matchMedia
  })
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
  })

  it('starts with nothing to install and no iOS or standalone state', async () => {
    const s = await load()
    expect(s.canInstall.value).toBe(false)
    expect(s.installed.value).toBe(false)
    expect(s.isIos.value).toBe(false)
  })

  it('catches beforeinstallprompt fired BEFORE any consumer exists, and prevents the mini-infobar', async () => {
    vi.resetModules()
    const mod = await import('./useInstallPrompt') // import registers the listener
    const { e } = fireInstallEvent()
    expect(e.defaultPrevented).toBe(true)
    const s = mod.useInstallPrompt() // consumer appears later (lazy landing)
    expect(s.canInstall.value).toBe(true)
  })

  it('is a singleton: two consumers share the same state', async () => {
    vi.resetModules()
    const mod = await import('./useInstallPrompt')
    const a = mod.useInstallPrompt()
    const b = mod.useInstallPrompt()
    fireInstallEvent()
    expect(a.canInstall.value).toBe(true)
    expect(b.canInstall.value).toBe(true)
    expect(a.canInstall).toBe(b.canInstall)
  })

  it('install() calls prompt() once and clears the deferred event after accepted', async () => {
    const s = await load()
    const { prompt } = fireInstallEvent('accepted')
    expect(await s.install()).toBe('accepted')
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(s.canInstall.value).toBe(false)
    expect(await s.install()).toBe('unavailable')
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('install() also clears the event when the user dismisses the browser dialog', async () => {
    const s = await load()
    const { prompt } = fireInstallEvent('dismissed')
    expect(await s.install()).toBe('dismissed')
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(s.canInstall.value).toBe(false)
    expect(s.installed.value).toBe(false)
  })

  it('install() with no event is a no-op that reports unavailable', async () => {
    const s = await load()
    expect(await s.install()).toBe('unavailable')
  })

  it('a new beforeinstallprompt after a dismissal makes it installable again', async () => {
    const s = await load()
    fireInstallEvent('dismissed')
    await s.install()
    fireInstallEvent()
    expect(s.canInstall.value).toBe(true)
  })

  it('appinstalled marks installed and drops the deferred event', async () => {
    const s = await load()
    fireInstallEvent()
    window.dispatchEvent(new Event('appinstalled'))
    expect(s.installed.value).toBe(true)
    expect(s.canInstall.value).toBe(false)
  })

  it('detects iPhone by user agent', async () => {
    setUserAgent(IPHONE)
    const s = await load()
    expect(s.isIos.value).toBe(true)
  })

  it('detects iPadOS (Mac UA with touch points) as iOS but a real Mac as not iOS', async () => {
    setUserAgent(MAC_IPAD, 5)
    expect((await load()).isIos.value).toBe(true)
    setUserAgent(MAC_IPAD, 0)
    expect((await load()).isIos.value).toBe(false)
  })

  it('does not treat Android as iOS', async () => {
    setUserAgent(ANDROID, 5)
    expect((await load()).isIos.value).toBe(false)
  })

  it('detects standalone through matchMedia display-mode', async () => {
    setStandalone(true)
    expect((await load()).installed.value).toBe(true)
  })

  it('detects standalone through navigator.standalone (iOS)', async () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    expect((await load()).installed.value).toBe(true)
  })

  it('stays not installed when matchMedia says browser tab', async () => {
    setStandalone(false)
    expect((await load()).installed.value).toBe(false)
  })

  it('canInstall is false when already installed even if the event fires', async () => {
    setStandalone(true)
    const s = await load()
    fireInstallEvent()
    expect(s.canInstall.value).toBe(false)
  })
})
