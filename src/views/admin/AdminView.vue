<script setup>
import { ref, computed } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import { kpis, actividadReciente } from '../../mockData'
import StatusBadge from '../../components/StatusBadge.vue'
import {
  Package,
  CircleDollarSign,
  Clock,
  Store,
  CreditCard,
  Key,
  FileText,
  Bike,
} from '@lucide/vue'

const store = useGoEatsStore()
const tab = ref('afiliaciones')

const tarjetas = [
  { label: 'Pedidos del día', valor: kpis.pedidosDia, icono: Package, color: 'bg-brand-light text-brand-dark' },
  { label: 'Ingresos totales', valor: `B/ ${kpis.ingresosTotales.toFixed(2)}`, icono: CircleDollarSign, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'Tiempo prom. de entrega', valor: kpis.tiempoPromedioEntrega, icono: Clock, color: 'bg-blue-50 text-blue-600' },
  { label: 'Comercios activos', valor: kpis.comerciosActivos, icono: Store, color: 'bg-amber-50 text-amber-600' },
]

const pendientes = computed(() => store.afiliaciones.filter((a) => a.estado === 'en_revision'))
const resueltas = computed(() => store.afiliaciones.filter((a) => a.estado !== 'en_revision'))
const arcoPendientes = computed(() => store.solicitudesARCO.filter((s) => s.estado === 'pendiente'))

const responderModal = ref(null)
const respuestaARCO = ref('')

function resolver(a, aprobar) {
  store.resolverAfiliacion(a.id, aprobar)
  store.notificar(aprobar ? `${a.nombre} fue aprobado.` : `Afiliación de ${a.nombre} rechazada.`)
}

function abrirResponder(s) {
  responderModal.value = s
  respuestaARCO.value = ''
}

function enviarRespuesta() {
  if (!respuestaARCO.value.trim()) return
  store.responderARCO(responderModal.value.id, respuestaARCO.value)
  store.notificar(`Respuesta enviada a ${responderModal.value.usuario}.`)
  responderModal.value = null
}

const tipoIcono = { pedido: Package, pago: CreditCard, acceso: Key, comercio: Store, arco: FileText }
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div>
      <h1 class="text-2xl font-bold">Panel administrativo</h1>
      <p class="text-sm text-slatebody mt-0.5">Supervisión general de la plataforma Go Eats.</p>
    </div>

    <!-- KPIs -->
    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="k in tarjetas" :key="k.label" class="card p-5 flex items-center gap-4">
        <span class="grid place-items-center w-11 h-11 rounded-xl" :class="k.color">
          <component :is="k.icono" class="w-5 h-5" />
        </span>
        <div>
          <p class="text-xs text-slatebody">{{ k.label }}</p>
          <p class="text-xl font-bold text-ink">{{ k.valor }}</p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mt-8 flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
      <button
        v-for="t in [['afiliaciones', 'Afiliaciones'], ['arco', `ARCO (${arcoPendientes.length})`], ['auditoria', 'Auditoría']]"
        :key="t[0]"
        class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
        :class="tab === t[0] ? 'border-brand text-brand-dark' : 'border-transparent text-slatebody hover:text-ink'"
        @click="tab = t[0]"
      >
        {{ t[1] }}
      </button>
    </div>

    <!-- Afiliaciones -->
    <section v-if="tab === 'afiliaciones'" class="mt-6 space-y-8">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Pendientes de aprobación ({{ pendientes.length }})</h2>
        <div v-if="pendientes.length" class="grid gap-3 lg:grid-cols-2">
          <div v-for="a in pendientes" :key="a.id" class="card p-5 flex items-start gap-4">
            <span class="grid place-items-center w-11 h-11 rounded-xl bg-canvas text-brand shrink-0">
              <component :is="a.tipo === 'comercio' ? Store : Bike" class="w-5 h-5" />
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-semibold text-ink">{{ a.nombre }}</h3>
                <StatusBadge :estado="a.estado" />
              </div>
              <p class="text-xs text-slatebody mt-0.5">{{ a.detalle }}</p>
              <p class="text-xs text-slatebody mt-1">{{ a.contacto }}</p>
              <div class="mt-3 flex gap-2">
                <button class="btn-primary !py-1.5 !px-3 text-xs" @click="resolver(a, true)">Aprobar</button>
                <button class="btn-danger-ghost !py-1.5 !px-3 text-xs" @click="resolver(a, false)">Rechazar</button>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-slatebody bg-canvas rounded-xl p-6 text-center">No hay afiliaciones pendientes.</p>
      </div>

      <!-- Suspender comercios -->
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Comercios de la plataforma</h2>
        <div class="card overflow-x-auto">
          <table class="w-full min-w-[600px]">
            <thead class="bg-canvas border-b border-line">
              <tr><th class="th">Comercio</th><th class="th">Zona</th><th class="th">Estado</th><th class="th text-right">Acción</th></tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="c in store.comercios" :key="c.id" class="hover:bg-canvas/50 transition-colors">
                <td class="td font-medium text-ink">{{ c.nombre }}</td>
                <td class="td text-slatebody">{{ store.zonas.find((z) => z.id === c.zona)?.nombre }}</td>
                <td class="td"><StatusBadge :estado="c.estadoAfiliacion" /></td>
                <td class="td text-right">
                  <button
                    v-if="c.estadoAfiliacion === 'activo'"
                    class="text-xs font-medium text-coral hover:underline"
                    @click="store.cambiarEstadoComercio(c.id, true)"
                  >Suspender</button>
                  <button
                    v-else
                    class="text-xs font-medium text-emerald-600 hover:underline"
                    @click="store.cambiarEstadoComercio(c.id, false)"
                  >Reactivar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="resueltas.length">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Afiliaciones resueltas</h2>
        <div class="card divide-y divide-line">
          <div v-for="a in resueltas" :key="a.id" class="flex items-center justify-between px-4 py-3">
            <div>
              <p class="text-sm font-medium text-ink">{{ a.nombre }} <span class="text-xs text-slatebody font-normal">({{ a.tipo }})</span></p>
              <p class="text-xs text-slatebody">{{ a.detalle }}</p>
            </div>
            <StatusBadge :estado="a.estado" />
          </div>
        </div>
      </div>
    </section>

    <!-- ARCO -->
    <section v-if="tab === 'arco'" class="mt-6 space-y-3">
      <div v-for="s in store.solicitudesARCO" :key="s.id" class="card p-5 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-[220px] flex-1">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-ink text-sm">{{ s.usuario }}</h3>
            <span class="rounded-full bg-canvas border border-line px-2 py-0.5 text-[11px] font-medium text-slatebody">{{ s.tipo }}</span>
            <StatusBadge :estado="s.estado === 'respondida' ? 'aprobado' : 'pendiente'" />
          </div>
          <p class="text-sm text-slatebody mt-1.5">{{ s.detalle }}</p>
          <p class="text-[11px] text-slatebody/70 mt-1">{{ s.fecha }}</p>
          <p v-if="s.respuesta" class="mt-2 text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-3 py-2">Respuesta: {{ s.respuesta }}</p>
        </div>
        <button v-if="s.estado === 'pendiente'" class="btn-primary !py-2 text-xs" @click="abrirResponder(s)">Responder</button>
      </div>

      <transition name="modal">
        <div v-if="responderModal" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="responderModal = null">
          <div class="modal-panel card p-6 w-full max-w-md" @click.stop>
            <h3 class="font-semibold text-ink">Responder solicitud ARCO</h3>
            <p class="text-sm text-slatebody mt-1">{{ responderModal.usuario }} · {{ responderModal.tipo }}</p>
            <textarea v-model="respuestaARCO" rows="4" class="input mt-4" placeholder="Escribe la respuesta oficial para el usuario…" />
            <div class="mt-5 grid grid-cols-2 gap-3">
              <button class="btn-secondary" @click="responderModal = null">Cancelar</button>
              <button class="btn-primary" :disabled="!respuestaARCO.trim()" @click="enviarRespuesta">Enviar respuesta</button>
            </div>
          </div>
        </div>
      </transition>
    </section>

    <!-- Auditoría -->
    <section v-if="tab === 'auditoria'" class="mt-6">
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[600px]">
          <thead class="bg-canvas border-b border-line">
            <tr><th class="th">Fecha</th><th class="th">Actor</th><th class="th">Evento</th><th class="th">Tipo</th></tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="e in store.eventos" :key="e.id" class="hover:bg-canvas/50 transition-colors">
              <td class="td text-slatebody whitespace-nowrap">{{ e.fecha }}</td>
              <td class="td font-medium text-ink">{{ e.actor }}</td>
              <td class="td text-slatebody">{{ e.accion }}</td>
              <td class="td">
                <span class="inline-flex items-center text-slatebody" :title="e.tipo">
                  <component :is="tipoIcono[e.tipo]" v-if="tipoIcono[e.tipo]" class="w-4 h-4" />
                  <span v-else>•</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-slatebody/60 mt-3">Registro de solo lectura. Los eventos más recientes aparecen primero.</p>
    </section>

    <!-- Actividad reciente -->
    <section class="mt-10">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Actividad reciente</h2>
      <div class="card divide-y divide-line">
        <div v-for="a in actividadReciente" :key="a.id" class="flex items-center gap-3 px-4 py-3">
          <span class="text-xs text-slatebody/70 w-20 shrink-0">{{ a.hora }}</span>
          <span class="text-sm text-ink">{{ a.texto }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
