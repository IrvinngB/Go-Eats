<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGoEatsStore } from '../stores/useGoEatsStore'
import { rutaPorRol } from '../guards'
import { DEMO_SWITCHER } from '../config'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import './catalog/catalog.css'
import {
  Receipt,
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
// Demo accounts are loaded lazily and only in flag-on builds (keeps them out of the production bundle).
const CUENTAS_DEMO = ref([])
if (DEMO_SWITCHER) {
  import('../demoAccounts').then((m) => {
    CUENTAS_DEMO.value = m.CUENTAS_DEMO
  })
}
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

const linksAnonimo = [{ to: '/tiendas', label: 'Explorar', icono: Store }]
const linksCliente = [
  { to: '/tiendas', label: 'Explorar', icono: Store },
  { to: '/pedidos', label: 'Mis pedidos', icono: Receipt },
  { to: '/perfil', label: 'Perfil', icono: User },
]
const linksActuales = computed(() => (esRolCliente.value ? linksCliente : linksAnonimo))
const esActivo = (to) => route.path.startsWith(to)

const trigger = ref(null)
function cerrarMenu({ devolverFoco = false } = {}) {
  menuAbierto.value = false
  if (devolverFoco) nextTick(() => trigger.value?.focus())
}

function irA(to) {
  menuAbierto.value = false
  router.push(to)
}

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
  <header class="cx cx-shell cx-topbar">
    <div class="cx-topbar-inner">
      <!-- Logo -->
      <button type="button" class="cx-brand" aria-label="Go Eats, ir al inicio" @click="router.push(homeActual)">
        <span class="cx-brand-mark" aria-hidden="true">G</span>
        <span class="cx-brand-name" aria-hidden="true">Go Eats</span>
      </button>

      <!-- Customer nav links (anonymous visitors only see the public store list) -->
      <nav v-if="esRolCliente || !store.autenticado" class="cx-nav" aria-label="Principal">
        <button
          v-for="l in linksActuales"
          :key="l.to"
          type="button"
          class="cx-nav-item"
          :aria-current="esActivo(l.to) ? 'page' : undefined"
          @click="router.push(l.to)"
        >
          {{ l.label }}
        </button>
      </nav>

      <div class="cx-topbar-spacer" />

      <!-- Anonymous: no user, just the way in (secondary: the view keeps its single primary) -->
      <button v-if="!store.autenticado" type="button" class="cx-btn cx-btn-secondary" @click="router.push('/login')">
        Iniciar sesión
      </button>

      <!-- Session menu (real server session) -->
      <div v-else class="cx-account-wrap" @keydown.esc="cerrarMenu({ devolverFoco: true })">
        <button
          ref="trigger"
          type="button"
          class="cx-account"
          data-test="account-trigger"
          aria-haspopup="true"
          :aria-expanded="menuAbierto ? 'true' : 'false'"
          :aria-label="`Cuenta de ${store.usuario?.nombre || 'Usuario'}`"
          :disabled="cambiandoCuenta"
          @click="menuAbierto = !menuAbierto"
        >
          <span class="cx-avatar" aria-hidden="true">{{ inicialesUsuario }}</span>
          <span class="cx-account-text" aria-hidden="true">
            <span class="cx-account-name">{{ store.usuario?.nombre || 'Usuario' }}</span>
            <span class="cx-account-role">{{ rolLabel }}</span>
          </span>
          <ChevronDown :size="16" aria-hidden="true" />
        </button>

        <!-- Click-away layer (transparent: the menu is a popover, not a modal) -->
        <div v-if="menuAbierto" class="cx-menu-scrim" aria-hidden="true" @click="cerrarMenu()" />

        <!-- Popover -->
        <div v-if="menuAbierto" class="cx-menu" data-test="account-menu" role="group" aria-label="Menú de cuenta">
          <!-- Current User Info -->
          <div class="cx-menu-head">
            <p class="cx-overline">Sesión activa</p>
            <p class="cx-menu-name">{{ store.usuario?.nombre }}</p>
            <p class="cx-menu-email">{{ store.usuario?.email }}</p>
            <span class="cx-badge cx-badge-info">
              <component :is="rolesIconos[store.rol] || User" :size="16" aria-hidden="true" />
              Rol: {{ rolLabel }}
            </span>
          </div>

          <!-- The nav above is hidden under 768px: the customer destinations live here on phones -->
          <div v-if="esRolCliente" class="cx-menu-group cx-menu-nav" data-test="menu-nav">
            <button
              v-for="l in linksCliente"
              :key="l.to"
              type="button"
              class="cx-menu-item"
              :class="esActivo(l.to) ? 'cx-menu-item-active' : ''"
              :aria-current="esActivo(l.to) ? 'page' : undefined"
              @click="irA(l.to)"
            >
              <component :is="l.icono" :size="20" aria-hidden="true" />
              <span class="cx-menu-item-main"><span class="cx-menu-item-title">{{ l.label }}</span></span>
            </button>
          </div>

          <!-- Demo switcher: only in builds with VITE_ENABLE_DEMO_SWITCHER=true (real logins, server role) -->
          <div v-if="DEMO_SWITCHER">
            <p class="cx-overline cx-menu-label">Cambiar de Cuenta (Autenticación Real)</p>
            <div class="cx-menu-group">
              <button
                v-for="c in CUENTAS_DEMO"
                :key="c.email"
                type="button"
                class="cx-menu-item"
                :class="store.usuario?.email === c.email ? 'cx-menu-item-active' : ''"
                @click="seleccionarCuenta(c)"
              >
                <span class="cx-avatar cx-avatar-sm" aria-hidden="true">{{ c.avatar }}</span>
                <span class="cx-menu-item-main">
                  <span class="cx-menu-item-title">{{ c.name }}</span>
                  <span class="cx-menu-item-sub">{{ c.email }}</span>
                </span>
                <Check v-if="store.usuario?.email === c.email" :size="20" aria-hidden="true" />
              </button>
            </div>
          </div>

          <!-- Logout -->
          <div class="cx-menu-divider" role="separator" />
          <button type="button" class="cx-menu-item cx-menu-item-danger" @click="salir">
            <LogOut :size="20" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
