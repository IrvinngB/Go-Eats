
<script setup>
import { useGoEatsStore } from './stores/useGoEatsStore'
import TopBar from './components/TopBar.vue'
import PwaStatus from './components/PwaStatus.vue'
import { useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'

const store = useGoEatsStore()
const route = useRoute()
const esLogin = computed(() => route.path === '/login')

onMounted(() => {
  store.sincronizarConBackend()
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <PwaStatus />
    <TopBar v-if="!esLogin" />
    <main class="flex-1">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Global notification toast -->
    <transition name="modal">
      <div
        v-if="store.notificacion"
        class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-ink text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg max-w-[90vw] text-center"
      >
        {{ store.notificacion.texto }}
      </div>
    </transition>
  </div>
</template>
