import { computed, ref, shallowRef } from 'vue'

/** Chromium's non-standard install event (not in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

const hasWindow = typeof window !== 'undefined'

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports a Mac UA; only touch support tells it apart from a real Mac.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

function detectStandalone(): boolean {
  if (!hasWindow) return false
  const mq = window.matchMedia?.('(display-mode: standalone)')
  return Boolean(mq?.matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// Module-level singleton: registered on import. App.vue imports PwaStatus statically, so this
// loads before the lazy landing route and the event is never missed.
const deferred = shallowRef<BeforeInstallPromptEvent | null>(null)
const installed = ref(detectStandalone())
const isIos = ref(detectIos())
const canInstall = computed(() => deferred.value !== null && !installed.value)

if (hasWindow) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred.value = e as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferred.value = null
  })
}

/** prompt() works once per event, so the deferred event is cleared whatever the user chose. */
async function install(): Promise<InstallOutcome> {
  const event = deferred.value
  if (!event) return 'unavailable'
  deferred.value = null
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome
}

export function useInstallPrompt() {
  return { canInstall, installed, isIos, install }
}
