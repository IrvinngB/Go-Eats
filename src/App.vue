
<script setup>
import { useGoEatsStore } from './stores/useGoEatsStore'
import TopBar from './components/TopBar.vue'
import PwaStatus from './components/PwaStatus.vue'
import { useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'
import { CircleAlert, CircleCheck, Info, X } from '@lucide/vue'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import './components/catalog/catalog.css'

const store = useGoEatsStore()
const route = useRoute()
const esLogin = computed(() => route.path === '/login')
const esLanding = computed(() => route.name === 'landing')

// The toast keeps the store's timing (auto-dismiss); only errors get a manual dismiss on top of it.
const ICONOS_TOAST = { info: Info, success: CircleCheck, error: CircleAlert }
const tipoToast = computed(() => store.notificacion?.tipo || 'info')

onMounted(() => {
  store.sincronizarConBackend()
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <PwaStatus />
    <TopBar v-if="!esLogin && !esLanding" />
    <component :is="esLanding ? 'div' : 'main'" class="flex-1">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </component>

    <!-- Global notification toast: a persistent polite live region; errors use role="alert" -->
    <div class="cx cx-shell cx-toast-region" aria-live="polite">
      <transition name="modal">
        <div
          v-if="store.notificacion"
          :key="store.notificacion.id"
          class="cx-toast"
          :class="`cx-toast-${tipoToast}`"
          :data-tipo="tipoToast"
          :role="tipoToast === 'error' ? 'alert' : 'status'"
        >
          <span class="cx-toast-icon">
            <component :is="ICONOS_TOAST[tipoToast] || Info" :size="20" aria-hidden="true" />
          </span>
          <span>{{ store.notificacion.texto }}</span>
          <button
            v-if="tipoToast === 'error'"
            type="button"
            class="cx-icon-btn cx-toast-close"
            aria-label="Cerrar notificación"
            @click="store.notificacion = null"
          >
            <X :size="20" aria-hidden="true" />
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>
