<script setup>
import { ref, computed } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import StatusBadge from '../../components/StatusBadge.vue'

const store = useGoEatsStore()

const filtroEstado = ref('todos')
const filtroMetodo = ref('todos')
const comprobante = ref(null)

const metodos = [
  { id: 'todos', label: 'Todos los métodos' },
  { id: 'electronico', label: 'Pago electrónico' },
  { id: 'contr_entrega', label: 'Contra entrega' },
]

const filtradas = computed(() =>
  store.transacciones.filter(
    (t) =>
      (filtroEstado.value === 'todos' || t.estado === filtroEstado.value) &&
      (filtroMetodo.value === 'todos' || t.metodo === filtroMetodo.value)
  )
)

const resumen = computed(() => {
  const aprobadas = store.transacciones.filter((t) => t.estado === 'aprobado')
  return {
    volumen: aprobadas.reduce((a, t) => a + t.monto, 0),
    comisiones: aprobadas.reduce((a, t) => a + t.comision, 0),
    pendientes: store.transacciones.filter((t) => t.estado === 'pendiente').length,
  }
})

function metodoLabel(m) {
  return m === 'electronico' ? 'Electrónico' : 'Contra entrega'
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div>
      <h1 class="text-2xl font-bold">Contabilidad</h1>
      <p class="text-sm text-slatebody mt-0.5">Registro de transacciones y comprobantes digitales.</p>
    </div>

    <!-- Resumen -->
    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <div class="card p-5">
        <p class="text-xs text-slatebody">Volumen aprobado hoy</p>
        <p class="text-2xl font-bold text-ink mt-1">B/ {{ resumen.volumen.toFixed(2) }}</p>
      </div>
      <div class="card p-5">
        <p class="text-xs text-slatebody">Comisiones de plataforma (12%)</p>
        <p class="text-2xl font-bold text-brand-dark mt-1">B/ {{ resumen.comisiones.toFixed(2) }}</p>
      </div>
      <div class="card p-5">
        <p class="text-xs text-slatebody">Transacciones pendientes</p>
        <p class="text-2xl font-bold text-amber-500 mt-1">{{ resumen.pendientes }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="mt-8 flex flex-wrap items-center gap-3">
      <div class="flex gap-1 rounded-lg bg-canvas border border-line p-1">
        <button
          v-for="e in ['todos', 'pendiente', 'aprobado', 'rechazado']" :key="e"
          class="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors"
          :class="filtroEstado === e ? 'bg-white text-ink shadow-sm' : 'text-slatebody hover:text-ink'"
          @click="filtroEstado = e"
        >{{ e }}</button>
      </div>
      <select v-model="filtroMetodo" class="input !w-auto !py-2 text-xs">
        <option v-for="m in metodos" :key="m.id" :value="m.id">{{ m.label }}</option>
      </select>
    </div>

    <!-- Tabla -->
    <div class="mt-4 card overflow-x-auto">
      <table class="w-full min-w-[760px]">
        <thead class="bg-canvas border-b border-line">
          <tr>
            <th class="th">ID / Ref.</th>
            <th class="th">Pedido</th>
            <th class="th">Cliente / Comercio</th>
            <th class="th">Método</th>
            <th class="th">Monto</th>
            <th class="th">Comisión</th>
            <th class="th">Neto</th>
            <th class="th">Estado</th>
            <th class="th text-right">Comprobante</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="t in filtradas" :key="t.id" class="hover:bg-canvas/50 transition-colors">
            <td class="td">
              <p class="font-medium text-ink">{{ t.id }}</p>
              <p class="text-[11px] text-slatebody">{{ t.fecha }}</p>
            </td>
            <td class="td text-slatebody">{{ t.pedidoId }}</td>
            <td class="td">
              <p class="text-ink">{{ t.cliente }}</p>
              <p class="text-[11px] text-slatebody">{{ t.comercio }}</p>
            </td>
            <td class="td text-slatebody">{{ metodoLabel(t.metodo) }}<template v-if="t.metodo === 'electronico' && t.referencia !== '—'"><br /><span class="text-[11px]">{{ t.referencia }}</span></template></td>
            <td class="td font-medium text-ink">B/ {{ t.monto.toFixed(2) }}</td>
            <td class="td text-slatebody">B/ {{ t.comision.toFixed(2) }}</td>
            <td class="td font-medium">B/ {{ t.total.toFixed(2) }}</td>
            <td class="td"><StatusBadge :estado="t.estado" /></td>
            <td class="td text-right">
              <button
                v-if="t.estado === 'aprobado'"
                class="text-xs font-medium text-brand-dark hover:underline inline-flex items-center gap-1"
                @click="comprobante = t"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a2 2 0 011.4.6l5.4 5.4a2 2 0 01.6 1.4V19a2 2 0 01-2 2z"/></svg>
                Ver
              </button>
              <span v-else class="text-xs text-slatebody/40">—</span>
            </td>
          </tr>
          <tr v-if="filtradas.length === 0">
            <td colspan="9" class="td text-center text-slatebody py-8">No hay transacciones con estos filtros.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal comprobante -->
    <transition name="modal">
      <div v-if="comprobante" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="comprobante = null">
        <div class="modal-panel bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" @click.stop>
          <div class="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-white">
            <h3 class="font-semibold text-ink">Comprobante digital</h3>
            <button class="p-1.5 rounded-lg hover:bg-canvas" @click="comprobante = null">
              <svg class="w-5 h-5 text-slatebody" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-6 text-sm">
            <div class="text-center pb-4 border-b border-dashed border-line">
              <p class="font-bold text-ink text-base">Go Eats</p>
              <p class="text-xs text-slatebody">Comercios Unidos del Istmo, S.A.</p>
              <p class="text-xs text-slatebody">RUC 155612345-2-2021 · Panamá, Panamá</p>
            </div>
            <div class="py-4 space-y-1.5 text-xs">
              <div class="flex justify-between"><span class="text-slatebody">Comprobante Nº</span><span class="font-medium text-ink">{{ comprobante.id }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Pedido</span><span class="font-medium text-ink">{{ comprobante.pedidoId }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Fecha</span><span class="font-medium text-ink">{{ comprobante.fecha }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Cliente</span><span class="font-medium text-ink">{{ comprobante.cliente }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Comercio</span><span class="font-medium text-ink">{{ comprobante.comercio }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Método de pago</span><span class="font-medium text-ink">{{ metodoLabel(comprobante.metodo) }}</span></div>
              <div class="flex justify-between"><span class="text-slatebody">Referencia pasarela</span><span class="font-medium text-ink">{{ comprobante.referencia }}</span></div>
            </div>
            <div class="py-4 border-t border-dashed border-line space-y-1.5">
              <div class="flex justify-between text-xs"><span class="text-slatebody">Monto bruto</span><span>B/ {{ comprobante.monto.toFixed(2) }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-slatebody">Comisión plataforma</span><span>− B/ {{ comprobante.comision.toFixed(2) }}</span></div>
              <div class="flex justify-between font-bold text-ink text-base pt-2 border-t border-line"><span>Neto al comercio</span><span>B/ {{ comprobante.total.toFixed(2) }}</span></div>
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
