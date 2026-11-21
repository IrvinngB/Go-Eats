<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGoEatsStore, CUENTAS_DEMO } from '../stores/useGoEatsStore'
import { rutaPorRol } from '../guards'
import { DEMO_SWITCHER } from '../config'
import {
  ShoppingBag,
  Store,
  Bike,
  BarChart3,
  ShieldCheck,
  User,
  LogOut,
  ChevronDown,
  Check,
} from '@lucide/vue'

const store = useGoEatsStore()
const router = useRouter()
const route = useRoute()

const rolesIconos = {
  customer: ShoppingBag,
  merchant: Store,
  courier: Bike,
  accountant: BarChart3,
  admin: ShieldCheck,
}

const rolesNombres = {
  customer: 'Cliente',
  merchant: 'Comercio',
  courier: 'Repartidor',
  accountant: 'Contabilidad',
  admin: 'Administrador',
}

const menuAbierto = ref(false)
const cambiandoCuenta = ref(false)
// The role is the SERVER role of the restored/logged-in session; anonymous has none.
const esRolCliente = computed(() => store.autenticado && store.rol === 'customer')
const homeActual = computed(() => (store.autenticado ? rutaPorRol[store.rol] : null) || '/tiendas')

const inicialesUsuario = computed(() => {
  const n = store.usuario?.nombre || 'Go Eats'
  return n
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
})

const rolLabel = computed(() => rolesNombres[store.rol] || store.rol)

const linksAnonimo = [{ to: '/tiendas', label: 'Explorar' }]
const linksCliente = [
  { to: '/tiendas', label: 'Explorar' },
  { to: '/pedidos', label: 'Mis pedidos' },
  { to: '/perfil', label: 'Perfil' },
]

async function seleccionarCuenta(cuenta) {
  cambiandoCuenta.value = true
  menuAbierto.value = false
  try {
    const res = await store.cambiarACuentaDemo(cuenta)
    // Navigate by the role the SERVER returned (store.rol), never the one listed in the demo accounts.
    if (res?.ok) router.push(rutaPorRol[store.rol] || '/tiendas')
  } finally {
    cambiandoCuenta.value = false
  }
}

function salir() {
  menuAbierto.value = false
  store.cerrarSesion()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
    <div class="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">
      <!-- Logo -->
      <button class="flex items-center gap-2 shrink-0" @click="router.push(homeActual)">
        <span class="grid place-items-center w-8 h-8 rounded-lg bg-brand text-white text-base font-bold shadow-sm">G</span>
        <span class="text-lg font-bold text-ink hidden sm:block">Go Eats</span>
      </button>

      <!-- Customer nav links (anonymous visitors only see the public store list) -->
      <nav v-if="esRolCliente || !store.autenticado" class="hidden md:flex items-center gap-1 ml-4">
        <button
          v-for="l in (esRolCliente ? linksCliente : linksAnonimo)" :key="l.to"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="route.path.startsWith(l.to) ? 'bg-brand-light text-brand-dark' : 'text-slatebody hover:bg-canvas'"
          @click="router.push(l.to)"
        >
          {{ l.label }}
        </button>
      </nav>

      <div class="flex-1" />

      <!-- Anonymous: no user, just the way in -->
      <button v-if="!store.autenticado" class="btn-primary !py-2 !px-4" @click="router.push('/login')">
        Iniciar sesión
      </button>

      <!-- Session menu (real server session) -->
      <div v-else class="relative">
        <button
          class="flex items-center gap-2.5 rounded-full border border-line bg-white pl-1.5 pr-3 py-1 hover:border-brand/50 shadow-sm transition-all"
          :disabled="cambiandoCuenta"
          @click="menuAbierto = !menuAbierto"
        >
          <span class="grid place-items-center w-8 h-8 rounded-full bg-brand text-white text-xs font-bold tracking-wider">
            {{ inicialesUsuario }}
          </span>
          <div class="hidden sm:block text-left leading-tight">
            <p class="text-xs font-semibold text-ink line-clamp-1 max-w-[130px]">{{ store.usuario?.nombre || 'Usuario' }}</p>
            <p class="text-[10px] text-slatebody font-medium flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              {{ rolLabel }}
            </p>
          </div>
          <ChevronDown class="w-3.5 h-3.5 text-slatebody" />
        </button>

        <!-- Backdrop -->
        <div v-if="menuAbierto" class="fixed inset-0 z-10" @click="menuAbierto = false" />

        <!-- Popover -->
        <div
          v-if="menuAbierto"
          class="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-line shadow-xl z-20 py-2 overflow-hidden animate-in fade-in"
        >
          <!-- Current User Info -->
          <div class="px-4 py-2.5 border-b border-line bg-slate-50/70">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slatebody/70">Sesión Activa</p>
            <p class="text-sm font-bold text-ink mt-0.5">{{ store.usuario?.nombre }}</p>
            <p class="text-xs text-slatebody truncate">{{ store.usuario?.email }}</p>
            <span class="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-brand-light text-brand-dark text-[11px] font-semibold">
              <component :is="rolesIconos[store.rol] || User" class="w-3 h-3" />
              Rol: {{ rolLabel }}
            </span>
          </div>

          <!-- Demo switcher: only in builds with VITE_ENABLE_DEMO_SWITCHER=true (real logins, server role) -->
          <div v-if="DEMO_SWITCHER" class="py-1">
            <p class="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-slatebody/70">
              Cambiar de Cuenta (Autenticación Real)
            </p>
            <button
              v-for="c in CUENTAS_DEMO"
              :key="c.email"
              class="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-canvas"
              :class="store.usuario?.email === c.email ? 'bg-brand-light/60 font-medium' : ''"
              @click="seleccionarCuenta(c)"
            >
              <span class="grid place-items-center w-7 h-7 rounded-full bg-slate-100 text-ink text-xs font-bold border border-line shrink-0">
                {{ c.avatar }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-ink truncate">{{ c.name }}</p>
                <p class="text-[10px] text-slatebody truncate">{{ c.email }}</p>
              </div>
              <Check v-if="store.usuario?.email === c.email" class="w-4 h-4 text-brand shrink-0" />
            </button>
          </div>

          <!-- Logout and Login options -->
          <div class="border-t border-line pt-1 mt-1">
            <button
              class="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-coral hover:bg-coral/5 transition-colors"
              @click="salir"
            >
              <LogOut class="w-4 h-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
