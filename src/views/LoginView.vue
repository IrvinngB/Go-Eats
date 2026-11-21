<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGoEatsStore } from '../stores/useGoEatsStore'
import { rutaPorRol, safeRedirect } from '../guards'
import { DEMO_SWITCHER } from '../config'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '../components/catalog/catalog.css'
import { Check, CircleAlert, Lock, Mail, MapPin, User } from '@lucide/vue'

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
// Which controls the current error points at (aria-invalid + red border); typing or ticking clears each one.
const invalidos = ref({ email: false, password: false, consentimiento: false })
const ERROR_ID = 'login-error'
const ZONAS = ['San Francisco', 'Costa del Este', 'Bella Vista', 'Condado del Rey']

function cambiarModo(registro) {
  modoRegistro.value = registro
  error.value = ''
  invalidos.value = { email: false, password: false, consentimiento: false }
}

async function entrar() {
  error.value = ''
  invalidos.value = { email: !email.value, password: !password.value, consentimiento: false }
  if (!email.value || !password.value) {
    error.value = 'Ingresa tu correo y contraseña para continuar.'
    return
  }
  if (modoRegistro.value && !aceptaPolitica.value) {
    invalidos.value.consentimiento = true
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
  <div class="cx cx-login">
    <div class="cx-login-grid">
      <!-- Hero tile -->
      <section class="cx-tile cx-tile-hero cx-tile-indigo cx-login-hero">
        <div class="cx-login-brand">
          <span class="cx-brand-mark" aria-hidden="true">G</span>
          <span>Go Eats</span>
        </div>
        <div>
          <h1 class="cx-login-title">Delivery multicomercio para todo Panamá</h1>
          <div class="cx-login-extra">
            <p class="cx-lead cx-soft cx-login-lead">
              Un solo lugar para pedir de tus comercios locales favoritos, coordinar entregas y conciliar pagos. Una plataforma de Comercios Unidos del Istmo, S.A.
            </p>
            <ul class="cx-row cx-login-zones">
              <li v-for="z in ZONAS" :key="z" class="cx-badge">
                <MapPin :size="16" aria-hidden="true" />
                {{ z }}
              </li>
            </ul>
          </div>
        </div>
        <p class="cx-caption cx-soft">© 2025 Comercios Unidos del Istmo, S.A. · Todos los derechos reservados</p>
      </section>

      <!-- Form tile -->
      <section class="cx-login-form" aria-labelledby="login-heading">
        <div class="cx-login-form-inner">
          <div class="cx-row" role="group" aria-label="Acceso" data-test="login-tabs">
            <button
              type="button"
              class="cx-chip"
              :class="!modoRegistro ? 'cx-chip-selected' : ''"
              :aria-pressed="!modoRegistro ? 'true' : 'false'"
              @click="cambiarModo(false)"
            >
              <Check v-if="!modoRegistro" :size="16" aria-hidden="true" />
              Iniciar sesión
            </button>
            <button
              type="button"
              class="cx-chip"
              :class="modoRegistro ? 'cx-chip-selected' : ''"
              :aria-pressed="modoRegistro ? 'true' : 'false'"
              @click="cambiarModo(true)"
            >
              <Check v-if="modoRegistro" :size="16" aria-hidden="true" />
              Regístrate
            </button>
          </div>

          <div>
            <h2 id="login-heading" class="cx-h2">{{ modoRegistro ? 'Crea tu cuenta' : 'Inicia sesión' }}</h2>
            <p class="cx-small cx-soft cx-login-sub">
              {{ modoRegistro ? 'Registra tu cuenta de cliente.' : 'Ingresa con tu correo y contraseña.' }}
            </p>
          </div>

          <form class="cx-form" novalidate @submit.prevent="entrar">
            <div v-if="modoRegistro">
              <label class="cx-label" for="login-nombre">Nombre completo</label>
              <div class="cx-field">
                <User :size="20" aria-hidden="true" />
                <input id="login-nombre" v-model="nombre" class="cx-input" autocomplete="name" placeholder="Ej. María Pérez" />
              </div>
            </div>
            <div>
              <label class="cx-label" for="login-email">Correo electrónico</label>
              <div class="cx-field">
                <Mail :size="20" aria-hidden="true" />
                <input
                  id="login-email"
                  v-model="email"
                  type="email"
                  class="cx-input"
                  autocomplete="email"
                  placeholder="tucorreo@correo.com"
                  :aria-invalid="invalidos.email ? 'true' : undefined"
                  :aria-describedby="invalidos.email ? ERROR_ID : undefined"
                  @input="invalidos.email = false"
                />
              </div>
            </div>
            <div>
              <label class="cx-label" for="login-password">Contraseña</label>
              <div class="cx-field">
                <Lock :size="20" aria-hidden="true" />
                <input
                  id="login-password"
                  v-model="password"
                  type="password"
                  class="cx-input"
                  :autocomplete="modoRegistro ? 'new-password' : 'current-password'"
                  placeholder="••••••••"
                  :aria-invalid="invalidos.password ? 'true' : undefined"
                  :aria-describedby="invalidos.password ? ERROR_ID : undefined"
                  @input="invalidos.password = false"
                />
              </div>
            </div>

            <!-- Ley 81 -->
            <label v-if="modoRegistro" class="cx-check">
              <input
                v-model="aceptaPolitica"
                type="checkbox"
                class="cx-check-input"
                :aria-invalid="invalidos.consentimiento ? 'true' : undefined"
                :aria-describedby="invalidos.consentimiento ? ERROR_ID : undefined"
                @change="invalidos.consentimiento = false"
              />
              <span class="cx-check-box" aria-hidden="true"><Check v-if="aceptaPolitica" :size="16" /></span>
              <span>
                Acepto el tratamiento de mis datos personales en cumplimiento de la <strong>Ley 81 de 2019</strong> de Panamá, para gestionar pedidos y entregas. Podré revisar y revocar este consentimiento desde mi perfil.
              </span>
            </label>

            <p v-if="error" :id="ERROR_ID" class="cx-form-error" role="alert">
              <CircleAlert :size="20" aria-hidden="true" />
              <span>{{ error }}</span>
            </p>

            <button type="submit" class="cx-btn cx-btn-lg cx-btn-block" data-test="login-submit" @click.prevent="entrar">
              {{ modoRegistro ? 'Crear cuenta' : 'Entrar' }}
            </button>
          </form>
        </div>
      </section>
    </div>
  </div>
</template>
