<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { Check, CircleAlert, CircleCheck, CircleQuestionMark, Clock, FileText, Info, Inbox, MapPin, ShieldCheck, UserRound } from '@lucide/vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '../../components/catalog/catalog.css'

// Lazy: Leaflet and its CSS stay out of the initial bundle and only load when Perfil is opened.
const AddressPickerMap = defineAsyncComponent(() => import('../../components/AddressPickerMap.vue'))

const store = useGoEatsStore()

// The consent flag is not part of the editable form: it is read and written through its own endpoint.
// The email is shown read-only: PUT /users/me only accepts name, phone and address.
const form = ref({ nombre: store.usuario.nombre, telefono: store.usuario.telefono })
const NOMBRE_MIN = 2
const errorNombre = ref('')
const consentimiento = computed(() => store.usuario.consentimientoLey81)
const consentCargaFallida = ref(false)
const guardandoConsent = ref(false)
const tipoARCO = ref('Acceso')
const detalleARCO = ref('')
const enviado = ref(false)
const errorARCO = ref('')

// Default delivery address: saved on its own (the personal-data form above never sends these keys).
const DIRECCION_MIN = 4
const DIRECCION_MAX = 300
const direccion = ref(store.usuario.direccion ?? '')
const punto = ref(store.usuario.lat != null && store.usuario.lng != null ? { lat: store.usuario.lat, lng: store.usuario.lng } : null)
const guardandoDireccion = ref(false)
const errorDireccion = ref('')

// Status chips: icon + text + tone (never color alone). An unknown state keeps its own text on a neutral chip.
const ESTADO_ARCO = {
  pendiente: { label: 'Pendiente', tone: 'warning', icon: Clock },
  respondida: { label: 'Respondida', tone: 'success', icon: CircleCheck },
}
const estadoARCO = (estado) => ESTADO_ARCO[estado] ?? { label: estado, tone: 'neutral', icon: CircleQuestionMark }

// Text beside the switch, so the state never depends on color or on the knob position alone.
const estadoConsent = computed(() => {
  if (consentimiento.value === true) return 'Activo'
  if (consentimiento.value === false) return 'Revocado'
  return consentCargaFallida.value ? 'Sin cargar' : 'Cargando…'
})

const tiposARCO = [
  { id: 'Acceso', desc: 'Conocer qué datos tuyos tenemos registrados.' },
  { id: 'Rectificación', desc: 'Corregir o actualizar tus datos personales.' },
  { id: 'Cancelación', desc: 'Solicitar la eliminación de tu cuenta y datos.' },
  { id: 'Oposición', desc: 'Rechazar el uso de tus datos para fines específicos.' },
]

onMounted(async () => {
  const [consent] = await Promise.all([store.cargarConsentimiento(), store.cargarMisSolicitudesARCO()])
  consentCargaFallida.value = !consent.ok
})

function guardarPerfil() {
  errorNombre.value = ''
  const nombre = form.value.nombre.trim()
  if (nombre.length < NOMBRE_MIN) {
    errorNombre.value = `Escribe tu nombre completo (mínimo ${NOMBRE_MIN} caracteres).`
    return
  }
  store.guardarPerfil({ nombre, telefono: form.value.telefono })
}

async function guardarDireccion() {
  const texto = direccion.value.trim()
  errorDireccion.value = ''
  if (texto && texto.length < DIRECCION_MIN) {
    errorDireccion.value = `La dirección debe tener al menos ${DIRECCION_MIN} caracteres.`
    return
  }
  if (texto.length > DIRECCION_MAX) {
    errorDireccion.value = `La dirección no puede superar ${DIRECCION_MAX} caracteres.`
    return
  }
  guardandoDireccion.value = true
  const r = await store.guardarPerfil({
    nombre: store.usuario.nombre,
    telefono: store.usuario.telefono,
    direccion: texto,
    lat: punto.value?.lat ?? null,
    lng: punto.value?.lng ?? null,
  })
  guardandoDireccion.value = false
  // On failure the store rolled back and toasted; what the user typed stays in the form.
  if (!r.ok) errorDireccion.value = r.error?.message ?? ''
}

async function cambiarConsentimiento(event) {
  const input = event.target
  // A disabled input drops keyboard focus, so the switch stays enabled while saving: a second flip is just undone.
  if (guardandoConsent.value) {
    input.checked = consentimiento.value === true
    return
  }
  guardandoConsent.value = true
  const r = await store.cambiarConsentimiento(input.checked)
  guardandoConsent.value = false
  // The native checkbox already flipped: on failure the store rolled back, so mirror it in the DOM.
  if (!r.ok) input.checked = consentimiento.value === true
}

async function enviarARCO() {
  errorARCO.value = ''
  if (detalleARCO.value.trim().length < 5) {
    errorARCO.value = 'Describe tu solicitud con al menos 5 caracteres para continuar.'
    store.notificar(errorARCO.value)
    return
  }
  const r = await store.enviarSolicitudARCO(tipoARCO.value, detalleARCO.value)
  if (!r.ok) return // the typed error was already toasted; the text stays in the form
  detalleARCO.value = ''
  enviado.value = true
  setTimeout(() => (enviado.value = false), 3500)
}
</script>

<template>
  <div class="cx" data-test="profile-root">
    <div class="cx-page cx-stack" style="gap: 24px">
      <header class="cx-stack" style="gap: 4px">
        <h1 class="cx-h1">Mi perfil</h1>
        <p class="cx-lead">Administra tus datos, tu dirección y tu privacidad.</p>
      </header>

      <div class="cx-profile">
        <div class="cx-profile-col">
          <!-- Datos personales -->
          <section class="cx-profile-tile" data-test="personal-section" aria-labelledby="perfil-datos-title">
            <h2 id="perfil-datos-title" class="cx-section-title"><UserRound :size="20" aria-hidden="true" />Datos personales</h2>
            <div class="cx-stack" style="gap: 16px">
              <div>
                <label for="perfil-nombre" class="cx-label">Nombre completo</label>
                <input
                  id="perfil-nombre"
                  v-model="form.nombre"
                  data-test="name-input"
                  class="cx-input cx-input-plain"
                  type="text"
                  autocomplete="name"
                  maxlength="150"
                  :aria-invalid="errorNombre ? 'true' : undefined"
                  :aria-describedby="errorNombre ? 'perfil-nombre-error' : undefined"
                  @input="errorNombre = ''"
                />
                <p v-if="errorNombre" id="perfil-nombre-error" data-test="name-error" role="alert" class="cx-field-error">
                  <CircleAlert :size="16" aria-hidden="true" /><span>{{ errorNombre }}</span>
                </p>
              </div>
              <div>
                <label for="perfil-telefono" class="cx-label">Teléfono</label>
                <input
                  id="perfil-telefono"
                  v-model="form.telefono"
                  data-test="phone-input"
                  class="cx-input cx-input-plain"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  maxlength="40"
                  placeholder="Ejemplo: 6123 4567"
                />
              </div>
              <div>
                <label for="perfil-email" class="cx-label">Correo electrónico</label>
                <input
                  id="perfil-email"
                  data-test="email-input"
                  class="cx-input cx-input-plain"
                  type="email"
                  autocomplete="email"
                  readonly
                  aria-describedby="perfil-email-help"
                  :value="store.usuario.email"
                />
                <p id="perfil-email-help" class="cx-help" style="margin-top: 6px">Es el correo con el que entras a Go Eats y no se puede cambiar desde aquí.</p>
              </div>
            </div>
            <div class="cx-profile-actions">
              <button type="button" data-test="profile-save" class="cx-btn" @click="guardarPerfil">Guardar cambios</button>
            </div>
          </section>

          <!-- Dirección de entrega predeterminada -->
          <section class="cx-profile-tile" data-test="address-section" aria-labelledby="perfil-direccion-title">
            <div class="cx-stack" style="gap: 4px">
              <h2 id="perfil-direccion-title" class="cx-section-title"><MapPin :size="20" aria-hidden="true" />Dirección de entrega predeterminada</h2>
              <p class="cx-help">Se usará para llenar tus próximos pedidos. Puedes cambiarla en cada pedido.</p>
            </div>
            <div>
              <label for="perfil-direccion" class="cx-label">Dirección</label>
              <input
                id="perfil-direccion"
                v-model="direccion"
                data-test="address-input"
                class="cx-input cx-input-plain"
                type="text"
                maxlength="400"
                autocomplete="street-address"
                placeholder="Ejemplo: Calle 50, Edificio Torre Azul, apto. 4B"
                :disabled="guardandoDireccion"
                :aria-invalid="errorDireccion ? 'true' : undefined"
                :aria-describedby="errorDireccion ? 'perfil-direccion-error' : undefined"
              />
              <p v-if="errorDireccion" id="perfil-direccion-error" data-test="address-error" role="alert" class="cx-field-error">
                <CircleAlert :size="16" aria-hidden="true" /><span>{{ errorDireccion }}</span>
              </p>
            </div>
            <AddressPickerMap v-model="punto" :disabled="guardandoDireccion" />
            <div class="cx-profile-actions">
              <button type="button" data-test="address-save" class="cx-btn cx-btn-secondary" :disabled="guardandoDireccion" @click="guardarDireccion">Guardar dirección</button>
            </div>
          </section>
        </div>

        <div class="cx-profile-col">
          <!-- Ley 81 -->
          <section class="cx-profile-tile" data-test="consent-section" aria-labelledby="perfil-consent-title">
            <div class="cx-stack" style="gap: 4px">
              <h2 id="perfil-consent-title" class="cx-section-title"><ShieldCheck :size="20" aria-hidden="true" />Protección de datos — Ley 81 de 2019</h2>
              <p class="cx-help">En Go Eats tratamos tus datos personales conforme a la Ley 81 de Protección de Datos Personales de la República de Panamá.</p>
            </div>
            <label class="cx-switch-row">
              <input
                data-test="consent-toggle"
                type="checkbox"
                role="switch"
                class="cx-switch-input"
                aria-labelledby="perfil-consent-label"
                aria-describedby="perfil-consent-desc"
                :checked="consentimiento === true"
                :disabled="consentimiento === null"
                :aria-busy="guardandoConsent ? 'true' : undefined"
                @change="cambiarConsentimiento"
              />
              <span class="cx-switch-text">
                <span id="perfil-consent-label" class="cx-switch-title">Consentimiento informado</span>
                <span id="perfil-consent-desc" class="cx-switch-desc">Autorizo a Comercios Unidos del Istmo, S.A. a tratar mis datos personales (nombre, contacto, direcciones y historial de pedidos) con la finalidad de gestionar pedidos, entregas y atención al cliente. Puedo revocar este consentimiento en cualquier momento.</span>
              </span>
              <span class="cx-switch-side">
                <span class="cx-switch-track" aria-hidden="true"><span class="cx-switch-knob"><Check :size="16" :stroke-width="3" /></span></span>
                <span data-test="consent-state" class="cx-switch-state" aria-hidden="true">{{ estadoConsent }}</span>
              </span>
            </label>
            <div v-if="consentCargaFallida" data-test="consent-load-error" class="cx-alert cx-alert-danger" role="alert">
              <CircleAlert :size="20" aria-hidden="true" />
              <p class="cx-small">No pudimos cargar el estado de tu consentimiento. Recarga la página para intentarlo de nuevo.</p>
            </div>
            <div v-if="consentimiento === false" data-test="consent-revoked" class="cx-alert" role="status">
              <Info :size="20" aria-hidden="true" />
              <p class="cx-small">Revocaste tu consentimiento. No podrás hacer nuevos pedidos ni pagos mientras esté revocado, pero tu cuenta, tus pedidos anteriores y tus datos se conservan. Vuelve a activar el consentimiento para hacer pedidos de nuevo.</p>
            </div>
          </section>

          <!-- Solicitudes ARCO -->
          <section class="cx-profile-tile" data-test="arco-section" aria-labelledby="perfil-arco-title">
            <div class="cx-stack" style="gap: 4px">
              <h2 id="perfil-arco-title" class="cx-section-title"><FileText :size="20" aria-hidden="true" />Solicitudes ARCO</h2>
              <p class="cx-help">Ejerce tus derechos de Acceso, Rectificación, Cancelación y Oposición.</p>
            </div>

            <fieldset class="cx-section" role="radiogroup" aria-labelledby="perfil-arco-tipo">
              <legend id="perfil-arco-tipo" class="cx-label" style="padding: 0">Tipo de solicitud</legend>
              <div class="cx-arco-types">
                <label v-for="t in tiposARCO" :key="t.id" class="cx-option" :class="{ 'cx-option-selected': tipoARCO === t.id }">
                  <input v-model="tipoARCO" type="radio" name="perfil-arco-tipo" class="cx-option-input" data-test="arco-type" :data-type="t.id" :value="t.id" />
                  <span class="cx-option-dot" aria-hidden="true"><Check v-if="tipoARCO === t.id" :size="14" :stroke-width="3" /></span>
                  <span class="cx-option-text">
                    <span class="cx-option-title">{{ t.id }}</span>
                    <span class="cx-option-sub">{{ t.desc }}</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div>
              <label for="perfil-arco-detalle" class="cx-label">Cuéntanos qué necesitas</label>
              <textarea
                id="perfil-arco-detalle"
                v-model="detalleARCO"
                data-test="arco-detail"
                rows="3"
                maxlength="1000"
                class="cx-input cx-input-plain cx-textarea"
                placeholder="Ejemplo: quiero saber qué datos personales tienen guardados sobre mí."
                :aria-invalid="errorARCO ? 'true' : undefined"
                :aria-describedby="errorARCO ? 'perfil-arco-error' : undefined"
                @input="errorARCO = ''"
              />
              <p v-if="errorARCO" id="perfil-arco-error" data-test="arco-error" class="cx-field-error">
                <CircleAlert :size="16" aria-hidden="true" /><span>{{ errorARCO }}</span>
              </p>
            </div>

            <div class="cx-profile-actions">
              <button type="button" data-test="arco-submit" class="cx-btn cx-btn-secondary" @click="enviarARCO">Enviar solicitud</button>
            </div>
            <div data-test="arco-sent-region" role="status" aria-live="polite">
              <div v-if="enviado" data-test="arco-sent" class="cx-alert cx-alert-success">
                <CircleCheck :size="20" aria-hidden="true" />
                <p class="cx-small">Tu solicitud fue enviada. Puedes hacer seguimiento desde aquí.</p>
              </div>
            </div>

            <!-- Historial (solo las solicitudes propias, la más reciente primero) -->
            <div class="cx-stack" style="gap: 12px">
              <h3 class="cx-h3">Mis solicitudes</h3>
              <ul v-if="store.misSolicitudesARCO.length" class="cx-arco-history">
                <li v-for="s in store.misSolicitudesARCO" :key="s.id" data-test="arco-item" class="cx-arco-item">
                  <div class="cx-row cx-row-between">
                    <span class="cx-arco-type">{{ s.tipo }}</span>
                    <span class="cx-estado" :class="`cx-estado-${estadoARCO(s.estado).tone}`">
                      <component :is="estadoARCO(s.estado).icon" :size="16" aria-hidden="true" />
                      {{ estadoARCO(s.estado).label }}
                    </span>
                  </div>
                  <p class="cx-small cx-soft">{{ s.detalle }}</p>
                  <div v-if="s.respuesta" data-test="arco-reply" class="cx-arco-reply">
                    <span class="cx-overline">Respuesta de Go Eats</span>
                    <p class="cx-small">{{ s.respuesta }}</p>
                  </div>
                  <p class="cx-caption cx-soft">{{ s.fecha }}</p>
                </li>
              </ul>
              <div v-else data-test="arco-empty" class="cx-arco-empty">
                <span class="cx-arco-empty-icon"><Inbox :size="20" aria-hidden="true" /></span>
                <p class="cx-small">Aún no has enviado solicitudes. Cuando envíes una, la verás aquí con su estado y la respuesta.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
