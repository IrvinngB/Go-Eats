<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { Download, RefreshCw, WifiOff, X } from '@lucide/vue'
import { useInstallPrompt } from '../composables/useInstallPrompt'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import './catalog/catalog.css'

const { needRefresh, updateServiceWorker } = useRegisterSW()

// Install state is a shared singleton: the landing section reads the same event.
const { canInstall, install } = useInstallPrompt()
const route = useRoute()
const dismissed = ref(false)
const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false)

function handleOnline() {
  isOffline.value = false
}

function handleOffline() {
  isOffline.value = true
}

async function installApp() {
  await install()
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <!-- Offline indicator -->
  <div v-if="isOffline" class="cx cx-shell cx-banner" role="status" data-test="offline-banner">
    <WifiOff :size="16" aria-hidden="true" />
    <span>Sin conexión. Mostrando datos en caché.</span>
  </div>

  <!-- New SW version available -->
  <div v-if="needRefresh" class="cx cx-shell cx-float" role="status" data-test="update-banner">
    <span class="cx-float-disc"><RefreshCw :size="20" aria-hidden="true" /></span>
    <div class="cx-float-text">
      <p class="cx-float-title">Nueva versión disponible</p>
      <p class="cx-caption cx-soft">Actualiza para aplicar las mejoras.</p>
    </div>
    <div class="cx-float-actions">
      <button type="button" class="cx-btn cx-btn-secondary" @click="updateServiceWorker()">Actualizar</button>
      <button type="button" class="cx-icon-btn" aria-label="Cerrar" @click="needRefresh = false">
        <X :size="20" aria-hidden="true" />
      </button>
    </div>
  </div>

  <!-- Install PWA prompt -->
  <div
    v-else-if="canInstall && !dismissed && route.name !== 'landing'"
    class="cx cx-shell cx-float"
    role="status"
    data-test="install-banner"
  >
    <span class="cx-float-disc"><Download :size="20" aria-hidden="true" /></span>
    <div class="cx-float-text">
      <p class="cx-float-title">Instalar Go Eats</p>
      <p class="cx-caption cx-soft">Accede rápido desde tu pantalla de inicio.</p>
    </div>
    <div class="cx-float-actions">
      <button type="button" class="cx-btn cx-btn-secondary" @click="installApp">Instalar</button>
      <button type="button" class="cx-icon-btn" aria-label="Cerrar" @click="dismissed = true">
        <X :size="20" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
