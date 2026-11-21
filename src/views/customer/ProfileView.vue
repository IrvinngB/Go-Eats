<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'

// Lazy: Leaflet and its CSS stay out of the initial bundle and only load when Perfil is opened.
const AddressPickerMap = defineAsyncComponent(() => import('../../components/AddressPickerMap.vue'))

const store = useGoEatsStore()

// The consent flag is not part of the editable form: it is read and written through its own endpoint.
const form = ref({ nombre: store.usuario.nombre, email: store.usuario.email, telefono: store.usuario.telefono })
const consentimiento = computed(() => store.usuario.consentimientoLey81)
const consentCargaFallida = ref(false)
const guardandoConsent = ref(false)
const tipoARCO = ref('Acceso')
const detalleARCO = ref('')
const enviado = ref(false)

// Default delivery address: saved on its own (the personal-data form above never sends these keys).
const DIRECCION_MIN = 4
const DIRECCION_MAX = 300
const direccion = ref(store.usuario.direccion ?? '')
const punto = ref(store.usuario.lat != null && store.usuario.lng != null ? { lat: store.usuario.lat, lng: store.usuario.lng } : null)
const guardandoDireccion = ref(false)
const errorDireccion = ref('')

const ESTADO_ARCO = { pendiente: 'Pendiente', respondida: 'Respondida' }

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
  store.guardarPerfil({ ...form.value })
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
  guardandoConsent.value = true
  const r = await store.cambiarConsentimiento(input.checked)
  guardandoConsent.value = false
  // The native checkbox already flipped: on failure the store rolled back, so mirror it in the DOM.
  if (!r.ok) input.checked = consentimiento.value === true
}

async function enviarARCO() {
  if (detalleARCO.value.trim().length < 5) {
    store.notificar('Describe tu solicitud con al menos 5 caracteres para continuar.')
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
  <div class="mx-auto max-w-2xl px-4 py-8 space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Mi perfil</h1>
      <p class="text-sm text-slatebody mt-1">Administra tus datos y tu privacidad.</p>
    </div>

    <!-- Datos personales -->
    <section class="card p-6">
      <h2 class="font-semibold text-ink">Datos personales</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label">Nombre completo</label>
          <input v-model="form.nombre" class="input" />
        </div>
        <div>
          <label class="label">Teléfono</label>
          <input v-model="form.telefono" class="input" />
        </div>
        <div class="sm:col-span-2">
          <label class="label">Correo electrónico</label>
          <input v-model="form.email" type="email" class="input" />
        </div>
      </div>
      <button class="btn-primary mt-5" @click="guardarPerfil">Guardar cambios</button>
    </section>

    <!-- Dirección de entrega predeterminada -->
    <section class="card p-6" data-test="address-section">
      <h2 class="font-semibold text-ink">Dirección de entrega predeterminada</h2>
      <p class="text-sm text-slatebody mt-1">Se usará para llenar tus próximos pedidos. Puedes cambiarla en cada pedido.</p>
      <div class="mt-4">
        <label for="perfil-direccion" class="label">Dirección</label>
        <input
          id="perfil-direccion"
          v-model="direccion"
          data-test="address-input"
          class="input"
          maxlength="400"
          autocomplete="street-address"
          placeholder="Calle, edificio, referencia"
          :disabled="guardandoDireccion"
          :aria-invalid="errorDireccion ? 'true' : undefined"
          :aria-describedby="errorDireccion ? 'perfil-direccion-error' : undefined"
        />
        <p v-if="errorDireccion" id="perfil-direccion-error" data-test="address-error" role="alert" class="mt-2 text-sm text-coral">{{ errorDireccion }}</p>
      </div>
      <div class="mt-4">
        <AddressPickerMap v-model="punto" :disabled="guardandoDireccion" />
      </div>
      <button data-test="address-save" class="btn-primary mt-5" :disabled="guardandoDireccion" @click="guardarDireccion">Guardar dirección</button>
    </section>

    <!-- Ley 81 -->
    <section class="card p-6">
      <div class="flex items-start gap-3">
        <span class="grid place-items-center w-9 h-9 rounded-lg bg-brand-light text-brand-dark shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </span>
        <div class="flex-1">
          <h2 class="font-semibold text-ink">Protección de datos — Ley 81 de 2019</h2>
          <p class="text-sm text-slatebody mt-1 leading-relaxed">
            En Go Eats tratamos tus datos personales conforme a la Ley 81 de Protección de Datos Personales de la República de Panamá.
          </p>
          <label class="flex items-start gap-3 mt-4 rounded-lg border border-line p-4 cursor-pointer hover:border-brand/40 transition-colors">
            <input
              data-test="consent-toggle"
              type="checkbox"
              class="mt-0.5 w-4 h-4 accent-[#00B19D]"
              :checked="consentimiento === true"
              :disabled="consentimiento === null || guardandoConsent"
              @change="cambiarConsentimiento"
            />
            <span class="text-sm text-slatebody leading-relaxed">
              <strong class="text-ink">Consentimiento informado.</strong> Autorizo a Comercios Unidos del Istmo, S.A. a tratar mis datos personales (nombre, contacto, direcciones y historial de pedidos) con la finalidad de gestionar pedidos, entregas y atención al cliente. Puedo revocar este consentimiento en cualquier momento.
            </span>
          </label>
          <p v-if="consentCargaFallida" data-test="consent-load-error" class="mt-3 text-sm text-coral">
            No pudimos cargar el estado de tu consentimiento. Recarga la página para intentarlo de nuevo.
          </p>
          <p v-if="consentimiento === false" data-test="consent-revoked" class="mt-3 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-3 leading-relaxed">
            Revocaste tu consentimiento. No podrás hacer nuevos pedidos ni pagos mientras esté revocado, pero tu cuenta, tus pedidos anteriores y tus datos se conservan. Vuelve a marcar la casilla para hacer pedidos de nuevo.
          </p>
        </div>
      </div>
    </section>

    <!-- Solicitudes ARCO -->
    <section class="card p-6">
      <h2 class="font-semibold text-ink">Solicitudes ARCO</h2>
      <p class="text-sm text-slatebody mt-1">Ejerce tus derechos de Acceso, Rectificación, Cancelación y Oposición.</p>

      <div class="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          v-for="t in tiposARCO" :key="t.id"
          data-test="arco-type"
          :data-type="t.id"
          class="text-left rounded-lg border p-3 transition-all"
          :class="tipoARCO === t.id ? 'border-brand bg-brand-light ring-1 ring-brand' : 'border-line hover:border-brand/40'"
          @click="tipoARCO = t.id"
        >
          <span class="block text-sm font-semibold text-ink">{{ t.id }}</span>
          <span class="block text-xs text-slatebody mt-0.5">{{ t.desc }}</span>
        </button>
      </div>

      <textarea v-model="detalleARCO" rows="3" class="input mt-4" placeholder="Describe tu solicitud con detalle..." />
      <button data-test="arco-submit" class="btn-primary mt-3" @click="enviarARCO">Enviar solicitud</button>
      <p v-if="enviado" class="text-sm text-emerald-600 mt-3">Tu solicitud fue enviada. Puedes hacer seguimiento desde aquí.</p>

      <!-- Historial (solo las solicitudes propias, la más reciente primero) -->
      <div v-if="store.misSolicitudesARCO.length" class="mt-6 pt-5 border-t border-line">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Mis solicitudes</h3>
        <ul class="space-y-2">
          <li v-for="s in store.misSolicitudesARCO" :key="s.id" data-test="arco-item" class="flex items-start justify-between gap-3 text-sm rounded-lg bg-canvas p-3">
            <div>
              <span class="font-medium text-ink">{{ s.tipo }}</span>
              <span class="block text-xs text-slatebody mt-0.5">{{ s.detalle }}</span>
              <span v-if="s.respuesta" class="block text-xs text-ink mt-1">Respuesta: {{ s.respuesta }}</span>
              <span class="block text-[11px] text-slatebody/70 mt-1">{{ s.fecha }}</span>
            </div>
            <span class="text-[11px] font-semibold shrink-0" :class="s.estado === 'respondida' ? 'text-emerald-600' : 'text-amber-600'">
              {{ ESTADO_ARCO[s.estado] || s.estado }}
            </span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
