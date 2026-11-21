<script setup>
import { ref, computed } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import StatusBadge from '../../components/StatusBadge.vue'
import CoverageMap from '../../components/CoverageMap.vue'
import { Bike, Star, Inbox, Banknote, CheckCircle2, Map } from '@lucide/vue'

const store = useGoEatsStore()

// Repartidor vinculado a la cuenta por el servidor (GET /delivery/couriers/me); sin respaldo por nombre ni r2.
const yo = computed(() => store.repartidorPropio)

const courierId = computed(() => yo.value?.id || null)

const entregas = computed(() => (courierId.value ? store.pedidosAsignadosA(courierId.value) : []))
const historial = computed(() => (courierId.value ? store.pedidos.filter((p) => p.repartidorId === courierId.value && ['entregado', 'cancelado'].includes(p.estado)) : []))

const reportarModal = ref(null)
const motivo = ref('')
const mapaPedidoId = ref(null)

function toggleMapa(id) {
  mapaPedidoId.value = mapaPedidoId.value === id ? null : id
}

function toggle() {
  store.toggleRepartidorDisponible(courierId.value)
}

function enCamino(p) {
  store.avanzarEstadoPedido(p.id, 'en camino')
  store.notificar(`Pedido ${p.id} marcado en camino.`)
}

function entregar(p) {
  store.avanzarEstadoPedido(p.id, 'entregado')
  store.notificar(`Entrega de ${p.id} completada. ¡Buen trabajo!`)
}

function reportar() {
  if (!motivo.value.trim()) return
  store.avanzarEstadoPedido(reportarModal.value.id, 'cancelado', { motivoCancelacion: motivo.value })
  store.notificar(`Pedido ${reportarModal.value.id} reportado como cancelado.`)
  reportarModal.value = null
  motivo.value = ''
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-6 pb-16">
    <div v-if="!yo" class="card p-10 text-center" data-test="sin-repartidor">
      <h1 class="text-lg font-bold text-ink">Cuenta sin repartidor asignado</h1>
      <p class="mt-2 text-sm text-slatebody">Tu cuenta aún no está vinculada a un repartidor. Contacta al administrador de Go Eats.</p>
    </div>
    <template v-else>
    <!-- Cabecera con disponibilidad -->
    <div class="card p-5 flex items-center gap-4">
      <span class="grid place-items-center w-12 h-12 rounded-full bg-brand-light text-brand">
        <Bike class="w-6 h-6" />
      </span>
      <div class="flex-1">
        <h1 class="font-bold text-ink">{{ yo.nombre }}</h1>
        <p class="text-xs text-slatebody flex items-center gap-1">
          {{ store.zonas.find((z) => z.id === yo.zona)?.nombre || 'Ciudad de Panamá' }} ·
          <Star class="w-3.5 h-3.5 text-amber-500 fill-amber-500 inline" />
          {{ yo.rating || 4.8 }}
        </p>
      </div>
      <div class="text-right">
        <button
          class="relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200"
          :class="yo.disponible ? 'bg-brand' : 'bg-gray-300'"
          @click="toggle"
        >
          <span class="inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200" :class="yo.disponible ? 'translate-x-7' : 'translate-x-1'" />
        </button>
        <p class="text-[11px] font-semibold mt-1" :class="yo.disponible ? 'text-brand-dark' : 'text-slatebody'">
          {{ yo.disponible ? 'Disponible' : 'No disponible' }}
        </p>
      </div>
    </div>

    <p v-if="!yo.disponible" class="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      Estás no disponible. No recibirás nuevas asignaciones hasta que actives tu disponibilidad.
    </p>

    <!-- Entregas asignadas -->
    <h2 class="mt-7 mb-3 text-sm font-semibold uppercase tracking-wide text-slatebody/70">Entregas asignadas ({{ entregas.length }})</h2>

    <div v-if="entregas.length === 0" class="card p-10 text-center">
      <Inbox class="w-10 h-10 mx-auto text-slatebody/40" />
      <p class="text-sm text-slatebody mt-2">No tienes entregas asignadas ahora.</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="p in entregas" :key="p.id" class="card p-5">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-ink">{{ p.id }}</h3>
          <StatusBadge :estado="p.estado" />
        </div>

        <!-- Ruta -->
        <div class="mt-4 space-y-3">
          <div class="flex gap-3">
            <div class="flex flex-col items-center pt-1">
              <span class="w-2.5 h-2.5 rounded-full bg-brand" />
              <span class="w-px h-8 bg-line my-0.5" />
              <span class="w-2.5 h-2.5 rounded-full border-2 border-coral" />
            </div>
            <div class="flex-1 space-y-3 text-sm">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wide text-slatebody/60">Recoger en</p>
                <p class="font-medium text-ink">{{ p.comercioNombre }}</p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wide text-slatebody/60">Entregar a</p>
                <p class="font-medium text-ink">{{ p.clienteNombre }} · {{ p.clienteTelefono }}</p>
                <p class="text-slatebody text-xs mt-0.5">{{ p.direccion }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Botón Ver Ruta en Mapa -->
        <div class="mt-4">
          <button
            class="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold border border-line bg-canvas hover:bg-slate-100 text-ink transition-colors"
            @click="toggleMapa(p.id)"
          >
            <Map class="w-3.5 h-3.5 text-brand" />
            <span>{{ mapaPedidoId === p.id ? 'Ocultar mapa de ruta' : 'Ver ruta de entrega en mapa' }}</span>
          </button>
          <div v-if="mapaPedidoId === p.id" class="mt-3">
            <CoverageMap
              modo="tracking"
              :pedido="p"
              altura="260px"
            />
          </div>
        </div>

        <p v-if="p.observaciones" class="mt-3 text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-3 py-2">Nota: {{ p.observaciones }}</p>
        <div class="mt-3 flex items-center justify-between text-xs text-slatebody">
          <span class="flex items-center gap-1.5">
            <Banknote v-if="p.metodoPago === 'contr_entrega'" class="w-4 h-4 text-emerald-600 shrink-0" />
            <CheckCircle2 v-else class="w-4 h-4 text-emerald-600 shrink-0" />
            {{ p.metodoPago === 'contr_entrega' ? 'Cobrar B/ ' + p.total.toFixed(2) + ' contra entrega' : 'Pagado en línea' }}
          </span>
          <span class="font-semibold text-ink">B/ {{ p.total.toFixed(2) }}</span>
        </div>

        <!-- Acciones rápidas -->
        <div class="mt-4 pt-4 border-t border-line grid gap-2" :class="p.estado === 'en camino' ? 'grid-cols-2' : 'grid-cols-1'">
          <button v-if="p.estado === 'listo para recoger'" class="btn-primary w-full !py-2.5 text-sm" @click="enCamino(p)">
            Marcar en camino
          </button>
          <button v-if="p.estado === 'en camino'" class="btn-primary w-full !py-2.5 text-sm" @click="entregar(p)">
            Marcar entregado
          </button>
          <button v-if="p.estado === 'listo para recoger' || p.estado === 'en camino'" class="btn-danger-ghost !py-2.5 text-sm" @click="reportarModal = p; motivo = ''">
            Reportar problema
          </button>
        </div>
      </div>
    </div>

    <!-- Historial -->
    <template v-if="historial.length">
      <h2 class="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slatebody/70">Entregas completadas</h2>
      <div class="card divide-y divide-line">
        <div v-for="p in historial" :key="p.id" class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium text-ink">{{ p.id }} · {{ p.comercioNombre }}</p>
            <p class="text-xs text-slatebody">{{ p.fecha }}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold text-ink">B/ {{ p.total.toFixed(2) }}</p>
            <StatusBadge :estado="p.estado" />
          </div>
        </div>
      </div>
    </template>

    <!-- Modal reportar problema -->
    <transition name="modal">
      <div v-if="reportarModal" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="reportarModal = null">
        <div class="modal-panel card p-6 w-full max-w-sm" @click.stop>
          <h3 class="font-semibold text-ink">Reportar problema — {{ reportarModal.id }}</h3>
          <p class="text-sm text-slatebody mt-1">Explica el motivo de la cancelación (obligatorio).</p>
          <textarea v-model="motivo" rows="3" class="input mt-4" placeholder="Ej. Cliente no responde en el punto de entrega…" />
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button class="btn-secondary" @click="reportarModal = null">Volver</button>
            <button class="btn-primary !bg-coral hover:!bg-red-600" :disabled="!motivo.trim()" @click="reportar">Reportar</button>
          </div>
        </div>
      </div>
    </transition>
    </template>
  </div>
</template>
