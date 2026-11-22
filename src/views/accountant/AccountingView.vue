<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import StatusBadge from '../../components/StatusBadge.vue'
import {
  CircleDollarSign,
  Percent,
  Clock,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  Building2,
} from '@lucide/vue'

const store = useGoEatsStore()

onMounted(() => {
  store.cargarResumenFinanciero?.()
})

const filtroEstado = ref('todos')
const filtroMetodo = ref('todos')
const busqueda = ref('')
const comprobante = ref(null)

const metodos = [
  { id: 'todos', label: 'Todos los métodos' },
  { id: 'electronico', label: 'Pago electrónico' },
  { id: 'contr_entrega', label: 'Contra entrega' },
]

const filtradas = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return store.transacciones.filter((t) => {
    if (filtroEstado.value !== 'todos' && t.estado !== filtroEstado.value) return false
    if (filtroMetodo.value !== 'todos' && t.metodo !== filtroMetodo.value) return false
    if (!q) return true
    return `${t.id} ${t.pedidoId} ${t.cliente} ${t.comercio} ${t.referencia || ''}`.toLowerCase().includes(q)
  })
})

const resumen = computed(() => {
  const aprobadas = store.transacciones.filter((t) => t.estado === 'aprobado')
  const pendientesList = store.transacciones.filter((t) => t.estado === 'pendiente')
  const volumen = aprobadas.reduce((a, t) => a + Number(t.monto || 0), 0)
  const comisiones = aprobadas.reduce((a, t) => a + Number(t.comision || 0), 0)
  const netoComercios = aprobadas.reduce((a, t) => a + Number(t.total || 0), 0)
  const montoPendiente = pendientesList.reduce((a, t) => a + Number(t.monto || 0), 0)
  return {
    volumen,
    comisiones,
    netoComercios,
    pendientes: pendientesList.length,
    montoPendiente,
  }
})

function metodoLabel(m) {
  return m === 'electronico' ? 'Electrónico' : 'Contra entrega'
}

async function conciliar(t, nuevoEstado) {
  const r = await store.conciliarTransaccion(t.id, nuevoEstado)
  if (r?.ok) {
    store.notificar(
      nuevoEstado === 'aprobado'
        ? `Transacción ${t.id} conciliada como aprobada.`
        : `Transacción ${t.id} marcada como rechazada.`,
    )
    store.cargarResumenFinanciero?.()
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6 pb-16">
    <!-- Cabecera ejecutiva de Contabilidad y Finanzas (RF-11 / RF-12) -->
    <div class="card overflow-hidden p-0">
      <div class="bg-emerald-500/15 border-b border-line/60 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <span class="grid place-items-center w-14 h-14 rounded-3xl bg-white text-brand shadow-sm border border-line">
            <CircleDollarSign class="w-7 h-7" />
          </span>
          <div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-white border border-line px-2.5 py-0.5 text-[11px] font-bold text-brand-dark">
                Finanzas y Liquidaciones · Comercios Unidos del Istmo, S.A.
              </span>
              <span class="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                {{ resumen.pendientes }} por conciliar
              </span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-ink mt-1">Contabilidad</h1>
            <p class="text-xs text-slatebody mt-0.5">
              Conciliación de transacciones financieras, cálculo de comisiones (12%) y emisión de comprobantes digitales PDF.
            </p>
          </div>
        </div>
      </div>

      <!-- KPIs financieros (RF-11) -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-5 bg-white" data-test="accounting-kpis">
        <div class="rounded-2xl border border-line bg-canvas/60 p-4 flex items-center gap-3.5">
          <span class="grid place-items-center w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
            <CircleDollarSign class="w-5 h-5" />
          </span>
          <div>
            <p class="text-xs font-semibold text-slatebody">Volumen aprobado</p>
            <p class="text-xl font-extrabold text-ink" data-test="kpi-approved-volume">B/ {{ resumen.volumen.toFixed(2) }}</p>
          </div>
        </div>

        <div class="rounded-2xl border border-line bg-canvas/60 p-4 flex items-center gap-3.5">
          <span class="grid place-items-center w-11 h-11 rounded-2xl bg-brand-light text-brand-dark shrink-0">
            <Percent class="w-5 h-5" />
          </span>
          <div>
            <p class="text-xs font-semibold text-slatebody">Comisiones (12%)</p>
            <p class="text-xl font-extrabold text-brand-dark" data-test="kpi-commissions">B/ {{ resumen.comisiones.toFixed(2) }}</p>
          </div>
        </div>

        <div class="rounded-2xl border border-line bg-canvas/60 p-4 flex items-center gap-3.5">
          <span class="grid place-items-center w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 shrink-0">
            <Building2 class="w-5 h-5" />
          </span>
          <div>
            <p class="text-xs font-semibold text-slatebody">Neto a comercios</p>
            <p class="text-xl font-extrabold text-ink" data-test="kpi-net-merchants">B/ {{ resumen.netoComercios.toFixed(2) }}</p>
          </div>
        </div>

        <div class="rounded-2xl border border-line bg-canvas/60 p-4 flex items-center gap-3.5">
          <span class="grid place-items-center w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 shrink-0">
            <Clock class="w-5 h-5" />
          </span>
          <div>
            <p class="text-xs font-semibold text-slatebody">Pendientes ({{ resumen.pendientes }})</p>
            <p class="text-xl font-extrabold text-amber-600" data-test="kpi-pending-count">B/ {{ resumen.montoPendiente.toFixed(2) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Buscador y filtros de transacciones (RF-11) -->
    <div class="mt-6 card p-4 flex flex-wrap items-center justify-between gap-3">
      <div class="relative flex-1 min-w-[240px] max-w-md">
        <label for="accounting-search" class="sr-only">Buscar transacción</label>
        <Search class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slatebody" />
        <input
          id="accounting-search"
          v-model="busqueda"
          data-test="accounting-search"
          type="search"
          class="w-full rounded-full border border-line bg-canvas pl-10 pr-4 py-2 text-sm text-ink placeholder:text-slatebody/70 focus:border-brand focus:bg-white focus:outline-none"
          placeholder="Buscar por ID (TX-…), pedido, cliente o comercio…"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="flex gap-1 rounded-full bg-canvas border border-line p-1">
          <button
            v-for="e in ['todos', 'pendiente', 'aprobado', 'rechazado']" :key="e"
            type="button"
            data-test="accounting-status-chip"
            class="px-3.5 py-1 rounded-full text-xs font-bold capitalize transition-colors"
            :class="filtroEstado === e ? 'bg-ink text-white shadow-sm' : 'text-slatebody hover:text-ink'"
            @click="filtroEstado = e"
          >{{ e }}</button>
        </div>
        <select v-model="filtroMetodo" data-test="accounting-method-select" class="rounded-full border border-line bg-canvas px-4 py-2 text-xs font-bold text-ink focus:border-brand focus:outline-none">
          <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
      </div>
    </div>

    <!-- Tabla de transacciones y conciliación (RF-11 / RF-12) -->
    <div class="mt-4 card overflow-x-auto" data-test="accounting-table">
      <table class="w-full min-w-[820px]">
        <thead class="bg-canvas border-b border-line">
          <tr>
            <th class="th">ID / Fecha</th>
            <th class="th">Pedido</th>
            <th class="th">Cliente / Comercio</th>
            <th class="th">Método / Ref.</th>
            <th class="th">Bruto</th>
            <th class="th">Comisión (12%)</th>
            <th class="th">Neto</th>
            <th class="th">Estado</th>
            <th class="th text-right">Conciliación / Comprobante</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="t in filtradas" :key="t.id" data-test="accounting-row" class="hover:bg-canvas/50 transition-colors">
            <td class="td">
              <p class="font-bold font-mono text-ink">{{ t.id }}</p>
              <p class="text-[11px] text-slatebody">{{ t.fecha }}</p>
            </td>
            <td class="td font-mono font-semibold text-ink">{{ t.pedidoId }}</td>
            <td class="td">
              <p class="font-semibold text-ink">{{ t.cliente }}</p>
              <p class="text-xs text-slatebody">{{ t.comercio }}</p>
            </td>
            <td class="td text-xs text-slatebody">
              <span class="font-semibold text-ink">{{ metodoLabel(t.metodo) }}</span>
              <template v-if="t.referencia && t.referencia !== '—'">
                <br /><span class="font-mono text-[11px]">{{ t.referencia }}</span>
              </template>
            </td>
            <td class="td font-bold text-ink">B/ {{ t.monto.toFixed(2) }}</td>
            <td class="td text-brand-dark font-semibold">B/ {{ t.comision.toFixed(2) }}</td>
            <td class="td font-extrabold text-ink">B/ {{ t.total.toFixed(2) }}</td>
            <td class="td"><StatusBadge :estado="t.estado" /></td>
            <td class="td text-right">
              <!-- Acciones de conciliación cuando está pendiente (RF-11) -->
              <div v-if="t.estado === 'pendiente'" class="inline-flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  data-test="reconcile-approve-btn"
                  class="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  @click="conciliar(t, 'aprobado')"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  Conciliar
                </button>
                <button
                  type="button"
                  data-test="reconcile-reject-btn"
                  class="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
                  @click="conciliar(t, 'rechazado')"
                >
                  <XCircle class="w-3.5 h-3.5" />
                  Fallido
                </button>
              </div>

              <!-- Acciones de comprobante cuando está aprobado (RF-12) -->
              <div v-else-if="t.estado === 'aprobado'" class="inline-flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  data-test="view-receipt-btn"
                  class="inline-flex items-center gap-1 rounded-xl border border-line bg-canvas px-2.5 py-1 text-xs font-bold text-ink hover:border-brand"
                  @click="comprobante = t"
                >
                  <FileText class="w-3.5 h-3.5 text-brand" />
                  Ver
                </button>
                <button
                  type="button"
                  data-test="download-pdf-btn"
                  class="inline-flex items-center gap-1 rounded-xl border border-brand/30 bg-brand-light px-2.5 py-1 text-xs font-bold text-brand-dark hover:bg-brand hover:text-white transition-colors"
                  @click="store.descargarComprobantePDF(t)"
                >
                  <Download class="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
              <span v-else class="text-xs text-slatebody/40">Sin comprobante</span>
            </td>
          </tr>
          <tr v-if="filtradas.length === 0">
            <td colspan="9" class="td text-center text-slatebody py-8">No hay transacciones con estos filtros.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal comprobante digital (RF-12) -->
    <transition name="modal">
      <div v-if="comprobante" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="comprobante = null">
        <div class="modal-panel bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" @click.stop>
          <div class="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-white">
            <h3 class="font-extrabold text-ink">Comprobante digital</h3>
            <button class="p-1.5 rounded-lg hover:bg-canvas" @click="comprobante = null">
              <svg class="w-5 h-5 text-slatebody" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-6 text-sm">
            <div class="text-center pb-4 border-b border-dashed border-line">
              <p class="font-extrabold text-ink text-base">Go Eats</p>
              <p class="text-xs text-slatebody">Comercios Unidos del Istmo, S.A.</p>
              <p class="text-xs text-slatebody">RUC 155612345-2-2021 · Panamá, Panamá</p>
            </div>
            <div class="py-4 space-y-1.5 text-xs">
              <div class="flex justify-between"><span class="text-slatebody">Comprobante Nº</span><span class="font-mono font-bold text-ink">{{ comprobante.id }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Pedido</span><span class="font-mono font-bold text-ink">{{ comprobante.pedidoId }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Fecha</span><span class="font-medium text-ink">{{ comprobante.fecha }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Cliente</span><span class="font-medium text-ink">{{ comprobante.cliente }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Comercio</span><span class="font-medium text-ink">{{ comprobante.comercio }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Método de pago</span><span class="font-medium text-ink">{{ metodoLabel(comprobante.metodo) }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Referencia pasarela</span><span class="font-mono font-medium text-ink">{{ comprobante.referencia }}</span></div>
            </div>
            <div class="py-4 border-t border-dashed border-line space-y-1.5">
              <div class="flex justify-between text-xs"><span class="text-slatebody">Monto bruto</span><span>B/ {{ comprobante.monto.toFixed(2) }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-slatebody">Comisión plataforma (12%)</span><span>− B/ {{ comprobante.comision.toFixed(2) }}</span></div>
              <div class="flex justify-between font-extrabold text-ink text-base pt-2 border-t border-line"><span>Neto al comercio</span><span>B/ {{ comprobante.total.toFixed(2) }}</span></div>
            </div>
            <p class="text-[10px] text-slatebody/60 text-center pt-3 border-t border-line">Documento generado electrónicamente. Este comprobante es una simulación para fines de demostración.</p>
            <button class="btn-primary w-full mt-5" @click="store.descargarComprobantePDF(comprobante)">
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
