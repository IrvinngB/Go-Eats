<script setup>
import { ref } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'

const store = useGoEatsStore()

const form = ref({ ...store.usuario })
const tipoARCO = ref('Acceso')
const detalleARCO = ref('')
const enviado = ref(false)

const tiposARCO = [
  { id: 'Acceso', desc: 'Conocer qué datos tuyos tenemos registrados.' },
  { id: 'Rectificación', desc: 'Corregir o actualizar tus datos personales.' },
  { id: 'Cancelación', desc: 'Solicitar la eliminación de tu cuenta y datos.' },
  { id: 'Oposición', desc: 'Rechazar el uso de tus datos para fines específicos.' },
]

function guardarPerfil() {
  store.guardarPerfil({ ...form.value })
}

function enviarARCO() {
  if (!detalleARCO.value.trim()) {
    store.notificar('Describe tu solicitud para continuar.')
    return
  }
  store.enviarSolicitudARCO(tipoARCO.value, detalleARCO.value)
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
            <input v-model="form.consentimientoLey81" type="checkbox" class="mt-0.5 w-4 h-4 accent-[#00B19D]" @change="guardarPerfil" />
            <span class="text-sm text-slatebody leading-relaxed">
              <strong class="text-ink">Consentimiento informado.</strong> Autorizo a Comercios Unidos del Istmo, S.A. a tratar mis datos personales (nombre, contacto, direcciones y historial de pedidos) con la finalidad de gestionar pedidos, entregas y atención al cliente. Puedo revocar este consentimiento en cualquier momento.
            </span>
          </label>
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
          class="text-left rounded-lg border p-3 transition-all"
          :class="tipoARCO === t.id ? 'border-brand bg-brand-light ring-1 ring-brand' : 'border-line hover:border-brand/40'"
          @click="tipoARCO = t.id"
        >
          <span class="block text-sm font-semibold text-ink">{{ t.id }}</span>
          <span class="block text-xs text-slatebody mt-0.5">{{ t.desc }}</span>
        </button>
      </div>

      <textarea v-model="detalleARCO" rows="3" class="input mt-4" placeholder="Describe tu solicitud con detalle..." />
      <button class="btn-primary mt-3" @click="enviarARCO">Enviar solicitud</button>
      <p v-if="enviado" class="text-sm text-emerald-600 mt-3">Tu solicitud fue enviada. Puedes hacer seguimiento desde aquí.</p>

      <!-- Historial -->
      <div v-if="store.solicitudesARCO.filter((s) => s.usuario === store.usuario.nombre).length" class="mt-6 pt-5 border-t border-line">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Mis solicitudes</h3>
        <ul class="space-y-2">
          <li v-for="s in store.solicitudesARCO.filter((x) => x.usuario === store.usuario.nombre)" :key="s.id" class="flex items-start justify-between gap-3 text-sm rounded-lg bg-canvas p-3">
            <div>
              <span class="font-medium text-ink">{{ s.tipo }}</span>
              <span class="block text-xs text-slatebody mt-0.5">{{ s.detalle }}</span>
            </div>
            <span class="text-[11px] font-semibold shrink-0" :class="s.estado === 'respondida' ? 'text-emerald-600' : 'text-amber-600'">
              {{ s.estado === 'respondida' ? 'Respondida' : 'Pendiente' }}
            </span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
