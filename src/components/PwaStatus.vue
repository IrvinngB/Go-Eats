<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { Download, RefreshCw, WifiOff, X } from '@lucide/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()

const installPrompt = ref(null)
const showInstallBanner = ref(false)
const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false)

function handleBeforeInstall(e) {
  e.preventDefault()
  installPrompt.value = e
  showInstallBanner.value = true
}

function handleOnline() {
  isOffline.value = false
}

function handleOffline() {
  isOffline.value = true
}

async function installApp() {
  if (!installPrompt.value) return
  await installPrompt.value.prompt()
  await installPrompt.value.userChoice
  installPrompt.value = null
  showInstallBanner.value = false
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstall)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <!-- Offline indicator -->
  <div
    v-if="isOffline"
    class="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium px-4 py-2 flex items-center justify-center gap-2"
  >
    <WifiOff class="w-3.5 h-3.5 shrink-0" />
    <span>Sin conexión. Mostrando datos en caché.</span>
  </div>

  <!-- New SW version available -->
  <div
    v-if="needRefresh"
    class="fixed bottom-5 right-5 z-50 card p-4 shadow-lg border-brand/30 flex items-center gap-3 max-w-sm"
  >
    <RefreshCw class="w-5 h-5 text-brand shrink-0" />
    <div class="flex-1 text-xs">
      <p class="font-semibold text-ink">Nueva versión disponible</p>
      <p class="text-slatebody">Actualiza para aplicar las mejoras.</p>
    </div>
    <button class="btn-primary !py-1.5 !px-3 text-xs" @click="updateServiceWorker()">
      Actualizar
    </button>
    <button
      class="text-slatebody hover:text-ink p-1"
      aria-label="Cerrar"
      @click="needRefresh = false"
    >
      <X class="w-4 h-4" />
    </button>
  </div>

  <!-- Install PWA prompt -->
  <div
    v-else-if="showInstallBanner"
    class="fixed bottom-5 right-5 z-50 card p-4 shadow-lg border-brand/30 flex items-center gap-3 max-w-sm"
  >
    <Download class="w-5 h-5 text-brand shrink-0" />
    <div class="flex-1 text-xs">
      <p class="font-semibold text-ink">Instalar Go Eats</p>
      <p class="text-slatebody">Accede rápido desde tu pantalla de inicio.</p>
    </div>
    <button class="btn-primary !py-1.5 !px-3 text-xs" @click="installApp">
      Instalar
    </button>
    <button
      class="text-slatebody hover:text-ink p-1"
      aria-label="Cerrar"
      @click="showInstallBanner = false"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>
