<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGoEatsStore } from '../stores/useGoEatsStore'

const store = useGoEatsStore()
const router = useRouter()
const route = useRoute()

const roles = [
  { id: 'customer', nombre: 'Cliente', icono: '🛍️' },
  { id: 'merchant', nombre: 'Comercio', icono: '🏪' },
  { id: 'courier', nombre: 'Repartidor', icono: '🛵' },
  { id: 'accountant', nombre: 'Contabilidad', icono: '📊' },
  { id: 'admin', nombre: 'Admin', icono: '🛡️' },
]

const rutaPorRol = {
  customer: '/tiendas',
  merchant: '/panel-comercio',
  courier: '/panel-repartidor',
  accountant: '/panel-contabilidad',
  admin: '/panel-admin',
}

function cambiarRol(id) {
  store.setRol(id)
  router.push(rutaPorRol[id])
}

const menuAbierto = ref(false)
const esRolCliente = computed(() => store.rol === 'customer')

const linksCliente = [
  { to: '/tiendas', label: 'Explorar' },
  { to: '/pedidos', label: 'Mis pedidos' },
  { to: '/perfil', label: 'Perfil' },
]
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
    <div class="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">
      <!-- Logo -->
      <button class="flex items-center gap-2 shrink-0" @click="cambiarRol(store.rol)">
        <span class="grid place-items-center w-8 h-8 rounded-lg bg-brand text-white text-base font-bold">G</span>
        <span class="text-lg font-bold text-ink hidden sm:block">Go Eats</span>
      </button>

      <!-- Cliente nav links -->
      <nav v-if="esRolCliente" class="hidden md:flex items-center gap-1 ml-4">
        <button
          v-for="l in linksCliente" :key="l.to"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="route.path.startsWith(l.to) ? 'bg-brand-light text-brand-dark' : 'text-slatebody hover:bg-canvas'"
          @click="router.push(l.to)"
        >
          {{ l.label }}
        </button>
      </nav>

      <div class="flex-1" />

      <!-- Role switcher -->
      <div class="relative">
        <button
          class="flex items-center gap-2 rounded-full border border-line bg-white pl-1 pr-2.5 py-1 hover:border-brand/50 transition-colors"
          @click="menuAbierto = !menuAbierto"
        >
          <span class="grid place-items-center w-7 h-7 rounded-full bg-brand-light text-brand-dark text-sm">
            {{ roles.find((r) => r.id === store.rol)?.icono }}
          </span>
          <span class="text-sm font-medium text-ink hidden sm:block">{{ roles.find((r) => r.id === store.rol)?.nombre }}</span>
          <svg class="w-3.5 h-3.5 text-slatebody" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>

        <div v-if="menuAbierto" class="fixed inset-0 z-10" @click="menuAbierto = false" />
        <div v-if="menuAbierto" class="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-line shadow-lg z-20 py-1.5 overflow-hidden">
          <p class="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slatebody/60">Ver como</p>
          <button
            v-for="r in roles" :key="r.id"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
            :class="store.rol === r.id ? 'bg-brand-light text-brand-dark font-semibold' : 'text-ink hover:bg-canvas'"
            @click="cambiarRol(r.id); menuAbierto = false"
          >
            <span class="text-base">{{ r.icono }}</span> {{ r.nombre }}
            <svg v-if="store.rol === r.id" class="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>

      <!-- Logout -->
      <button class="shrink-0 grid place-items-center w-9 h-9 rounded-lg text-slatebody hover:bg-canvas transition-colors" title="Cerrar sesión" @click="router.push('/login')">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m4 4H5a2 2 0 01-2-2V6a2 2 0 012-2h6" /></svg>
      </button>
    </div>
  </header>
</template>
