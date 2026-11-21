<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGoEatsStore } from '../stores/useGoEatsStore'
import { rutaPorRol, safeRedirect } from '../guards'
import { DEMO_SWITCHER } from '../config'

const store = useGoEatsStore()
const router = useRouter()
const route = useRoute()

const modoRegistro = ref(false)
const aceptaPolitica = ref(false)
const email = ref('')
const password = ref('')
// Demo prefill only in flag-on builds; the dynamic import keeps the credentials out of the flag-off bundle.
if (DEMO_SWITCHER) {
  import('../demoAccounts').then(({ DEMO_LOGIN }) => {
    if (!email.value && !password.value) {
      email.value = DEMO_LOGIN.email
      password.value = DEMO_LOGIN.password
    }
  })
}
const nombre = ref('')
const error = ref('')

async function entrar() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = 'Ingresa tu correo y contraseña para continuar.'
    return
  }
  if (modoRegistro.value && !aceptaPolitica.value) {
    error.value = 'Debes aceptar la política de protección de datos personales (Ley 81) para continuar.'
    return
  }
  const resultado = await store.autenticarUsuario({
    email: email.value,
    password: password.value,
    nombre: nombre.value,
    modoRegistro: modoRegistro.value,
    aceptaPolitica: aceptaPolitica.value,
  })
  if (!resultado.ok) {
    error.value = resultado.mensaje
    return
  }
  // Navigate by the role the SERVER returned, never a client-side choice. `?redirect` is honored only
  // when it is an internal path that role may open; anything else goes to the role home.
  router.push(safeRedirect(router, route.query.redirect, store.rol) ?? rutaPorRol[store.rol] ?? '/tiendas')
}
</script>

<template>
  <div class="min-h-screen bg-canvas flex flex-col lg:flex-row">
    <!-- Panel visual -->
    <div class="lg:w-1/2 bg-brand relative overflow-hidden flex flex-col justify-between p-8 lg:p-14 text-white">
      <div class="flex items-center gap-3">
        <span class="grid place-items-center w-11 h-11 rounded-xl bg-white text-brand text-2xl font-bold">G</span>
        <span class="text-2xl font-bold">Go Eats</span>
      </div>
      <div class="my-10 lg:my-0">
        <h1 class="text-3xl lg:text-5xl font-bold leading-tight text-white">Delivery multicomercio para todo Panamá</h1>
        <p class="mt-4 text-white/85 max-w-md leading-relaxed">
          Un solo lugar para pedir de tus comercios locales favoritos, coordinar entregas y conciliar pagos. Una plataforma de Comercios Unidos del Istmo, S.A.
        </p>
        <div class="mt-8 flex gap-3 flex-wrap">
          <span class="rounded-full bg-white/15 px-4 py-1.5 text-sm">San Francisco</span>
          <span class="rounded-full bg-white/15 px-4 py-1.5 text-sm">Costa del Este</span>
          <span class="rounded-full bg-white/15 px-4 py-1.5 text-sm">Bella Vista</span>
          <span class="rounded-full bg-white/15 px-4 py-1.5 text-sm">Condado del Rey</span>
        </div>
      </div>
      <p class="text-xs text-white/60">© 2025 Comercios Unidos del Istmo, S.A. · Todos los derechos reservados</p>
    </div>

    <!-- Formulario -->
    <div class="lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-md">
        <h2 class="text-2xl font-bold text-ink">{{ modoRegistro ? 'Crea tu cuenta' : 'Inicia sesión' }}</h2>
        <p class="text-sm text-slatebody mt-1">{{ modoRegistro ? 'Registra tu cuenta de cliente.' : 'Ingresa con tu correo y contraseña.' }}</p>

        <div class="mt-6 space-y-4">
          <div v-if="modoRegistro">
            <label class="label">Nombre completo</label>
            <input v-model="nombre" class="input" placeholder="Ej. María Pérez" />
          </div>
          <div>
            <label class="label">Correo electrónico</label>
            <input v-model="email" type="email" class="input" placeholder="tucorreo@correo.com" />
          </div>
          <div>
            <label class="label">Contraseña</label>
            <input v-model="password" type="password" class="input" placeholder="••••••••" />
          </div>

          <!-- Ley 81 -->
          <label v-if="modoRegistro" class="flex items-start gap-2.5 rounded-lg bg-blue-50/60 border border-blue-100 p-3.5 cursor-pointer">
            <input v-model="aceptaPolitica" type="checkbox" class="mt-0.5 w-4 h-4 accent-[#00B19D]" />
            <span class="text-xs text-slatebody leading-relaxed">
              Acepto el tratamiento de mis datos personales en cumplimiento de la <strong class="text-ink">Ley 81 de 2019</strong> de Panamá, para gestionar pedidos y entregas. Podré revisar y revocar este consentimiento desde mi perfil.
            </span>
          </label>

          <p v-if="error" class="text-sm text-coral bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ error }}</p>

          <button class="btn-primary w-full !py-3" @click="entrar">
            {{ modoRegistro ? 'Crear cuenta' : 'Entrar' }}
          </button>
          <p class="text-center text-sm text-slatebody">
            {{ modoRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?' }}
            <button class="text-brand-dark font-semibold" @click="modoRegistro = !modoRegistro">
              {{ modoRegistro ? 'Inicia sesión' : 'Regístrate' }}
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
