<script setup>
import { ref, computed } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import StatusBadge from '../../components/StatusBadge.vue'
import CoverageMap from '../../components/CoverageMap.vue'
import { ESTADOS_TERMINALES } from '../../mockData'
import { Bike, Star, Inbox, Banknote, CheckCircle2, Map, Phone, MapPin, Package, Navigation } from '@lucide/vue'

const store = useGoEatsStore()

// Repartidor vinculado a la cuenta por el servidor (GET /delivery/couriers/me); sin respaldo por nombre ni r2.
const yo = computed(() => store.repartidorPropio)

const courierId = computed(() => yo.value?.id || null)

const entregas = computed(() => (courierId.value ? store.pedidosAsignadosA(courierId.value) : []))
const historial = computed(() =>
  courierId.value
    ? store.pedidos.filter((p) => p.repartidorId === courierId.value && ESTADOS_TERMINALES.includes(p.estado))
    : [],
)

const enRutaCount = computed(() => entregas.value.filter((p) => p.estado === 'en_camino').length)
const porRecogerCount = computed(() => entregas.value.filter((p) => p.estado === 'listo_para_recoger').length)
const entregadosCount = computed(() => historial.value.filter((p) => p.estado === 'entregado').length)

// RF-02: Estado operativo tri-estado (en línea / ocupado / desconectado)
const estadoOperativo = computed(() => {
  if (!yo.value?.disponible) return { id: 'desconectado', label: 'Desconectado', sub: 'No disponible' }
  if (enRutaCount.value > 0) return { id: 'ocupado', label: 'Ocupado', sub: 'Disponible · En entrega' }
  return { id: 'en_linea', label: 'En línea', sub: 'Disponible' }
})

const reportarModal = ref(null)
const motivo = ref('')
const mapaPedidoId = ref(null)

function nombreZona(slug) {
  return store.zonas.find((z) => z.id === slug)?.nombre || slug || 'Ciudad de Panamá'
}

function tieneCoordenadas(p) {
  return typeof p.lat === 'number' && typeof p.lng === 'number'
}

function toggleMapa(id) {
  mapaPedidoId.value = mapaPedidoId.value === id ? null : id
}

async function toggle() {
  if (!courierId.value) return
  const r = await store.toggleRepartidorDisponible(courierId.value)
  if (r?.ok) {
    store.notificar(yo.value?.disponible ? 'Ahora estás en línea para recibir pedidos.' : 'Pasaste a estado desconectado.')
  }
}

async function enCamino(p) {
  const r = await store.avanzarEstadoPedido(p.id, 'en_camino')
  if (r.ok) store.notificar(`Pedido ${p.id} marcado en camino.`)
}

async function entregar(p) {
  const r = await store.avanzarEstadoPedido(p.id, 'entregado')
  if (r.ok) store.notificar(`Entrega de ${p.id} completada. ¡Buen trabajo!`)
}

async function reportar() {
  if (!motivo.value.trim()) return
  const id = reportarModal.value.id
  const r = await store.avanzarEstadoPedido(id, 'cancelado', { motivoCancelacion: motivo.value })
  if (!r.ok) return // modal stays open; the store already showed the error
  store.notificar(`Pedido ${id} reportado como cancelado.`)
  reportarModal.value = null
  motivo.value = ''
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-6 pb-16">
    <div v-if="!yo" class="card p-10 text-center" data-test="sin-repartidor">
      <h1 class="text-lg font-bold text-ink">Cuenta sin repartidor asignado</h1>
      <p class="mt-2 text-sm text-slatebody">Tu cuenta aún no está vinculada a un repartidor. Contacta al administrador de Go Eats.</p>
    </div>

    <template v-else>
      <!-- Cabecera estilo Delivery Driver Partner (RF-02: En línea / Ocupado / Desconectado) -->
      <div class="card overflow-hidden p-0">
        <div class="bg-emerald-500/15 border-b border-line/60 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <span class="grid place-items-center w-14 h-14 rounded-3xl bg-white text-brand shadow-sm border border-line">
              <Bike class="w-7 h-7" />
            </span>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  data-test="courier-operational-status"
                  class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold"
                  :class="
                    estadoOperativo.id === 'ocupado'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : estadoOperativo.id === 'en_linea'
                        ? 'bg-white text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slatebody border-line'
                  "
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    :class="
                      estadoOperativo.id === 'ocupado'
                        ? 'bg-amber-500 animate-pulse'
                        : estadoOperativo.id === 'en_linea'
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-slate-400'
                    "
                  />
                  {{ estadoOperativo.label }}
                </span>
                <span class="text-xs font-semibold text-brand-dark">
                  {{ nombreZona(yo.zona) }}
                </span>
                <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                  <Star class="w-3 h-3 text-amber-500 fill-amber-500 inline" />
                  {{ yo.rating || 4.8 }}
                </span>
              </div>
              <h1 class="text-2xl font-extrabold text-ink mt-1">{{ yo.nombre }}</h1>
              <p v-if="yo.telefono" class="text-xs text-slatebody mt-0.5">Tel. {{ yo.telefono }}</p>
            </div>
          </div>

          <!-- Switch de disponibilidad (RF-02) -->
          <div class="flex items-center gap-3 rounded-2xl bg-white border border-line px-4 py-2.5 shadow-sm">
            <div class="text-right">
              <p class="text-xs font-extrabold text-ink">{{ estadoOperativo.sub }}</p>
              <p class="text-[11px] text-slatebody">{{ yo.disponible ? 'Recibiendo pedidos' : 'Fuera de turno' }}</p>
            </div>
            <button
              type="button"
              data-test="toggle-courier-availability"
              class="relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200"
              :class="yo.disponible ? 'bg-brand' : 'bg-gray-300'"
              @click="toggle"
            >
              <span
                class="inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200"
                :class="yo.disponible ? 'translate-x-7' : 'translate-x-1'"
              />
            </button>
          </div>
        </div>

        <!-- KPIs rápidos del repartidor -->
        <div class="grid grid-cols-3 bg-white px-4 py-3 gap-3">
          <div class="rounded-2xl bg-canvas border border-line/60 px-4 py-2.5">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">Por recoger</p>
            <p class="text-lg font-extrabold text-ink">{{ porRecogerCount }}</p>
          </div>
          <div class="rounded-2xl bg-canvas border border-line/60 px-4 py-2.5">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">En camino</p>
            <p class="text-lg font-extrabold text-ink">{{ enRutaCount }}</p>
          </div>
          <div class="rounded-2xl bg-canvas border border-line/60 px-4 py-2.5">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">Completadas</p>
            <p class="text-lg font-extrabold text-ink">{{ entregadosCount }}</p>
          </div>
        </div>
      </div>

      <p v-if="!yo.disponible" class="mt-4 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        Estás desconectado (no disponible). No recibirás nuevas asignaciones hasta que actives tu disponibilidad.
      </p>

      <!-- Entregas asignadas (RF-19: datos completos de recogida, entrega, items y observaciones) -->
      <h2 class="mt-7 mb-3 text-sm font-extrabold uppercase tracking-wide text-slatebody">
        Entregas asignadas ({{ entregas.length }})
      </h2>

      <div v-if="entregas.length === 0" class="card p-10 text-center">
        <Inbox class="w-10 h-10 mx-auto text-slatebody/40" />
        <p class="text-sm font-semibold text-ink mt-2">No tienes entregas asignadas ahora.</p>
        <p class="text-xs text-slatebody mt-1">Mantente en línea para recibir pedidos listos de los comercios de tu zona.</p>
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2">
        <div v-for="p in entregas" :key="p.id" data-test="courier-order-card" class="card p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="font-extrabold text-base font-mono text-ink">{{ p.id }}</h3>
                <p class="text-[11px] text-slatebody">{{ nombreZona(p.zona) }} · {{ p.fecha }}</p>
              </div>
              <StatusBadge :estado="p.estado" />
            </div>

            <!-- Ruta de recogida y entrega (RF-19) -->
            <div class="mt-4 rounded-2xl bg-canvas border border-line/70 p-3.5 space-y-3">
              <div class="flex gap-3">
                <div class="flex flex-col items-center pt-1">
                  <span class="w-2.5 h-2.5 rounded-full bg-brand" />
                  <span class="w-px h-10 bg-line my-0.5" />
                  <span class="w-2.5 h-2.5 rounded-full border-2 border-coral" />
                </div>
                <div class="flex-1 space-y-3 text-sm">
                  <div>
                    <p class="text-[11px] font-bold uppercase tracking-wide text-slatebody">1. Recoger en comercio</p>
                    <p class="font-bold text-ink" data-test="pickup-merchant">{{ p.comercioNombre }}</p>
                  </div>
                  <div>
                    <p class="text-[11px] font-bold uppercase tracking-wide text-slatebody">2. Entregar a cliente</p>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-bold text-ink" data-test="dropoff-customer">{{ p.clienteNombre }}</p>
                      <span v-if="p.clienteTelefono" class="inline-flex items-center gap-1 rounded-full bg-white border border-line px-2 py-0.5 text-xs font-semibold text-ink">
                        <Phone class="w-3 h-3 text-brand" />
                        {{ p.clienteTelefono }}
                      </span>
                    </div>
                    <p class="text-slatebody text-xs mt-1 flex items-start gap-1" data-test="dropoff-address">
                      <MapPin class="w-3.5 h-3.5 text-coral shrink-0 mt-0.5" />
                      <span>{{ p.direccion }}</span>
                    </p>
                    <p
                      v-if="tieneCoordenadas(p)"
                      data-test="dropoff-coords"
                      class="mt-1 inline-flex items-center gap-1 rounded-full bg-white border border-line px-2 py-0.5 text-[11px] font-mono text-slatebody"
                    >
                      <Navigation class="w-3 h-3 text-brand" />
                      GPS: {{ p.lat.toFixed(4) }}, {{ p.lng.toFixed(4) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Detalle de productos del pedido (RF-19) -->
            <div v-if="Array.isArray(p.items) && p.items.length > 0" data-test="courier-order-items" class="mt-3 rounded-xl border border-line bg-white p-3">
              <p class="text-[11px] font-bold uppercase tracking-wider text-slatebody flex items-center gap-1.5 mb-1.5">
                <Package class="w-3.5 h-3.5 text-brand" />
                Detalle del paquete ({{ p.items.length }})
              </p>
              <ul class="text-xs text-ink space-y-1">
                <li v-for="(it, i) in p.items" :key="i" class="flex items-start justify-between gap-2">
                  <span><strong>{{ it.cantidad }}×</strong> {{ it.nombre }}</span>
                  <em v-if="it.observacion" class="not-italic font-medium text-amber-700">— {{ it.observacion }}</em>
                </li>
              </ul>
            </div>

            <!-- Observaciones del cliente (RF-19) -->
            <p v-if="p.observaciones" data-test="courier-order-notes" class="mt-3 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2">
              Nota: {{ p.observaciones }}
            </p>

            <!-- Botón Ver Ruta en Mapa -->
            <div class="mt-3">
              <button
                type="button"
                class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border border-line bg-canvas hover:bg-slate-100 text-ink transition-colors"
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

            <div class="mt-3 flex items-center justify-between text-xs text-slatebody">
              <span class="flex items-center gap-1.5 font-semibold" :class="p.metodoPago === 'contr_entrega' ? 'text-amber-700' : 'text-emerald-700'">
                <Banknote v-if="p.metodoPago === 'contr_entrega'" class="w-4 h-4 text-amber-600 shrink-0" />
                <CheckCircle2 v-else class="w-4 h-4 text-emerald-600 shrink-0" />
                {{ p.metodoPago === 'contr_entrega' ? 'Cobrar B/ ' + p.total.toFixed(2) + ' contra entrega' : 'Pagado en línea' }}
              </span>
              <span class="font-extrabold text-sm text-ink">B/ {{ p.total.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Acciones rápidas (RF-16) -->
          <div class="mt-4 pt-4 border-t border-line grid gap-2" :class="p.estado === 'en_camino' ? 'grid-cols-2' : 'grid-cols-1'">
            <button v-if="p.estado === 'listo_para_recoger'" class="btn-primary w-full !py-2.5 text-sm" @click="enCamino(p)">
              Marcar en camino
            </button>
            <button v-if="p.estado === 'en_camino'" class="btn-primary w-full !py-2.5 text-sm" @click="entregar(p)">
              Marcar entregado
            </button>
            <button v-if="p.estado === 'listo_para_recoger' || p.estado === 'en_camino'" class="btn-danger-ghost !py-2.5 text-sm" @click="reportarModal = p; motivo = ''">
              Reportar problema
            </button>
          </div>
        </div>
      </div>

      <!-- Historial -->
      <template v-if="historial.length">
        <h2 class="mt-8 mb-3 text-sm font-extrabold uppercase tracking-wide text-slatebody">
          Entregas completadas ({{ historial.length }})
        </h2>
        <div class="card divide-y divide-line">
          <div v-for="p in historial" :key="p.id" class="flex items-center justify-between px-5 py-3.5">
            <div>
              <p class="text-sm font-bold text-ink"><span class="font-mono">{{ p.id }}</span> · {{ p.comercioNombre }}</p>
              <p class="text-xs text-slatebody">{{ p.clienteNombre }} · {{ p.fecha }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-extrabold text-ink">B/ {{ p.total.toFixed(2) }}</p>
              <StatusBadge :estado="p.estado" />
            </div>
          </div>
        </div>
      </template>

      <!-- Modal reportar problema -->
      <transition name="modal">
        <div v-if="reportarModal" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="reportarModal = null">
          <div class="modal-panel card p-6 w-full max-w-sm" @click.stop>
            <h3 class="font-extrabold text-lg text-ink">Reportar problema — {{ reportarModal.id }}</h3>
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
