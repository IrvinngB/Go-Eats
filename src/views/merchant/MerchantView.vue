<script setup>
import { ref, computed, watch } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import StatusBadge from '../../components/StatusBadge.vue'
import { ESTADOS_TERMINALES } from '../../mockData'

const store = useGoEatsStore()
const tab = ref('pedidos')
// Comercio vinculado a la cuenta por el servidor (GET /merchants/mine); sin respaldo por nombre ni c1.
const comercio = computed(() => store.comercioPropio)
const productos = computed(() => (comercio.value ? store.productosDe(comercio.value.id) : []))
const pedidos = computed(() => (comercio.value ? store.pedidosPorComercio(comercio.value.id) : []))

const activos = computed(() => pedidos.value.filter((p) => !ESTADOS_TERMINALES.includes(p.estado)))
const historial = computed(() => pedidos.value.filter((p) => ESTADOS_TERMINALES.includes(p.estado)))

const rechazarModal = ref(null)
const motivoRechazo = ref('')
const editarProducto = ref(null) // null | {} | producto
const formProducto = ref({ nombre: '', precio: 0, descripcion: '' })
const horario = ref({ ...(comercio.value?.horario || { abre: '', cierra: '' }) })
watch(comercio, (c) => { if (c) horario.value = { ...c.horario } })
const horarioGuardado = ref(false)

function siguiente(p) {
  const s = store.siguienteEstado(p.estado)
  if (!s) return
  store.avanzarEstadoPedido(p.id, s)
}

// El comercio puede rechazar mientras el pedido no haya salido a la calle (motivo obligatorio).
const RECHAZABLES = ['pendiente', 'confirmado', 'en_preparacion']

function asignar(p, repartidorId) {
  store.asignarRepartidor(p.id, repartidorId)
}

function confirmarRechazo() {
  if (!motivoRechazo.value.trim()) return
  store.rechazarPedido(rechazarModal.value.id, motivoRechazo.value)
  store.notificar(`Pedido ${rechazarModal.value.id} rechazado.`)
  rechazarModal.value = null
  motivoRechazo.value = ''
}

function nuevoProducto() {
  editarProducto.value = {}
  formProducto.value = { nombre: '', precio: 0, descripcion: '' }
}

function editar(p) {
  editarProducto.value = p
  formProducto.value = { nombre: p.nombre, precio: p.precio, descripcion: p.descripcion }
}

function guardarProducto() {
  if (!formProducto.value.nombre.trim()) return
  store.guardarProducto(comercio.value.id, { ...formProducto.value, precio: Number(formProducto.value.precio) }, editarProducto.value?.id || null)
  editarProducto.value = null
  store.notificar('Producto guardado.')
}

function guardarHorario() {
  store.guardarHorarioComercio(comercio.value.id, horario.value)
  horarioGuardado.value = true
  setTimeout(() => (horarioGuardado.value = false), 2500)
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div v-if="!comercio" class="card p-10 text-center" data-test="sin-comercio">
      <h1 class="text-lg font-bold text-ink">Cuenta sin comercio asignado</h1>
      <p class="mt-2 text-sm text-slatebody">Tu cuenta aún no está vinculada a un comercio. Contacta al administrador de Go Eats.</p>
    </div>
    <template v-else>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">{{ comercio.nombre }}</h1>
        <p class="text-sm text-slatebody mt-0.5">Panel de comercio · {{ comercio.tipo }}</p>
      </div>
      <div class="flex items-center gap-2 rounded-full bg-canvas border border-line px-4 py-2 text-sm">
        <span class="w-2 h-2 rounded-full" :class="comercio.activo ? 'bg-emerald-500' : 'bg-red-500'" />
        <span class="font-medium text-ink">{{ comercio.activo ? 'Tienda abierta' : 'Tienda cerrada' }}</span>
        <span class="text-slatebody">· {{ horario.abre }} a {{ horario.cierra }}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mt-6 flex gap-1 border-b border-line">
      <button
        v-for="t in [['pedidos', 'Pedidos'], ['catalogo', 'Catálogo'], ['ajustes', 'Horarios']]"
        :key="t[0]"
        class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="tab === t[0] ? 'border-brand text-brand-dark' : 'border-transparent text-slatebody hover:text-ink'"
        @click="tab = t[0]"
      >
        {{ t[1] }}
      </button>
    </div>

    <!-- Pedidos -->
    <section v-if="tab === 'pedidos'" class="mt-6 space-y-6">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Activos ({{ activos.length }})</h2>
        <div class="grid gap-3 lg:grid-cols-2">
          <div v-for="p in activos" :key="p.id" class="card p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-ink">{{ p.id }}</h3>
                  <StatusBadge :estado="p.estado" />
                </div>
                <p class="text-xs text-slatebody mt-0.5">{{ p.clienteNombre }} · {{ p.fecha }}</p>
              </div>
              <p class="font-bold text-ink">B/ {{ p.total.toFixed(2) }}</p>
            </div>

            <ul class="mt-3 text-xs text-slatebody space-y-0.5">
              <li v-for="(it, i) in p.items" :key="i">{{ it.cantidad }}× {{ it.nombre }} <em v-if="it.observacion" class="not-italic text-amber-600">— {{ it.observacion }}</em></li>
            </ul>
            <p v-if="p.observaciones" class="mt-2 text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-3 py-2">Nota: {{ p.observaciones }}</p>

            <!-- Acciones según estado -->
            <div class="mt-4 pt-4 border-t border-line flex flex-wrap gap-2">
              <template v-if="p.estado === 'pendiente'">
                <button class="btn-primary !py-2 text-xs" @click="siguiente(p)">Confirmar pedido</button>
              </template>
              <template v-else-if="p.estado === 'confirmado'">
                <button class="btn-primary !py-2 text-xs" @click="siguiente(p)">Empezar preparación</button>
              </template>
              <template v-else-if="p.estado === 'en_preparacion'">
                <button class="btn-primary !py-2 text-xs" @click="siguiente(p)">Marcar listo para recoger</button>
              </template>
              <template v-else-if="p.estado === 'listo_para_recoger'">
                <div v-if="!p.repartidorId" class="w-full">
                  <label class="label">Asignar repartidor disponible</label>
                  <select class="input" @change="asignar(p, $event.target.value); $event.target.value = ''">
                    <option value="" disabled selected>Selecciona un repartidor…</option>
                    <option v-for="r in store.repartidoresDisponibles" :key="r.id" :value="r.id">
                      {{ r.nombre }} · ({{ r.rating }}/5) · {{ store.zonas.find((z) => z.id === r.zona)?.nombre }}
                    </option>
                  </select>
                  <p v-if="store.repartidoresDisponibles.length === 0" class="text-xs text-amber-600 mt-1.5">No hay repartidores disponibles ahora.</p>
                </div>
                <div v-else class="w-full text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Asignado a {{ store.repartidorPorId(p.repartidorId)?.nombre }}
                </div>
              </template>
              <template v-else-if="p.estado === 'en_camino'">
                <p class="text-xs text-blue-600 font-medium w-full">En camino con {{ store.repartidorPorId(p.repartidorId)?.nombre || 'repartidor' }}.</p>
              </template>
              <button
                v-if="RECHAZABLES.includes(p.estado)"
                class="btn-danger-ghost !py-2 text-xs"
                @click="rechazarModal = p; motivoRechazo = ''"
              >Rechazar</button>
            </div>
          </div>
        </div>
        <p v-if="activos.length === 0" class="text-sm text-slatebody bg-canvas rounded-xl p-6 text-center">No hay pedidos activos en este momento.</p>
      </div>

      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slatebody/70 mb-3">Historial</h2>
        <div class="card overflow-x-auto">
          <table class="w-full">
            <thead class="bg-canvas border-b border-line">
              <tr><th class="th">Pedido</th><th class="th">Cliente</th><th class="th">Total</th><th class="th">Estado</th></tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="p in historial" :key="p.id" class="hover:bg-canvas/50 transition-colors">
                <td class="td font-medium text-ink">{{ p.id }}</td>
                <td class="td">{{ p.clienteNombre }}</td>
                <td class="td">B/ {{ p.total.toFixed(2) }}</td>
                <td class="td">
                  <StatusBadge :estado="p.estado" />
                  <p v-if="p.motivoCancelacion && p.estado !== 'entregado'" class="mt-1 text-[11px] text-slatebody">{{ p.motivoCancelacion }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Catálogo -->
    <section v-if="tab === 'catalogo'" class="mt-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slatebody/70">Productos ({{ productos.length }})</h2>
        <button class="btn-primary !py-2 text-sm" @click="nuevoProducto">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Nuevo producto
        </button>
      </div>
      <div class="card overflow-x-auto">
        <table class="w-full">
          <thead class="bg-canvas border-b border-line">
            <tr><th class="th">Producto</th><th class="th">Descripción</th><th class="th">Precio</th><th class="th">Disponible</th><th class="th text-right">Acciones</th></tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="p in productos" :key="p.id" class="hover:bg-canvas/50 transition-colors">
              <td class="td font-medium text-ink">{{ p.nombre }}</td>
              <td class="td text-slatebody max-w-[220px] truncate">{{ p.descripcion }}</td>
              <td class="td font-medium">B/ {{ p.precio.toFixed(2) }}</td>
              <td class="td">
                <button
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="p.disponible ? 'bg-brand' : 'bg-gray-300'"
                  @click="store.actualizarEstadoProducto(comercio.id, p.id, !p.disponible)"
                >
                  <span class="inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200" :class="p.disponible ? 'translate-x-6' : 'translate-x-1'" style="height:18px;width:18px" />
                </button>
              </td>
              <td class="td text-right">
                <button class="text-xs font-medium text-brand-dark hover:underline" @click="editar(p)">Editar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal producto -->
      <transition name="modal">
        <div v-if="editarProducto" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="editarProducto = null">
          <div class="modal-panel card p-6 w-full max-w-md" @click.stop>
            <h3 class="font-semibold text-ink">{{ editarProducto.id ? 'Editar producto' : 'Nuevo producto' }}</h3>
            <div class="mt-4 space-y-4">
              <div>
                <label class="label">Nombre</label>
                <input v-model="formProducto.nombre" class="input" placeholder="Ej. Sancocho de gallina" />
              </div>
              <div>
                <label class="label">Precio (B/)</label>
                <input v-model.number="formProducto.precio" type="number" step="0.05" min="0" class="input" />
              </div>
              <div>
                <label class="label">Descripción</label>
                <textarea v-model="formProducto.descripcion" rows="2" class="input" placeholder="Ingredientes o detalle breve" />
              </div>
            </div>
            <div class="mt-5 grid grid-cols-2 gap-3">
              <button class="btn-secondary" @click="editarProducto = null">Cancelar</button>
              <button class="btn-primary" @click="guardarProducto">Guardar</button>
            </div>
          </div>
        </div>
      </transition>
    </section>

    <!-- Horarios -->
    <section v-if="tab === 'ajustes'" class="mt-6 max-w-md">
      <div class="card p-6">
        <h2 class="font-semibold text-ink">Horario del local</h2>
        <p class="text-sm text-slatebody mt-1">Fuera de este horario la tienda aparece cerrada para los clientes.</p>
        <div class="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label class="label">Apertura</label>
            <input v-model="horario.abre" type="time" class="input" />
          </div>
          <div>
            <label class="label">Cierre</label>
            <input v-model="horario.cierra" type="time" class="input" />
          </div>
        </div>
        <button class="btn-primary mt-5" @click="guardarHorario">Guardar horario</button>
        <p v-if="horarioGuardado" class="text-sm text-emerald-600 mt-3">Horario actualizado.</p>
      </div>
    </section>

    <!-- Modal rechazar con motivo -->
    <transition name="modal">
      <div v-if="rechazarModal" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="rechazarModal = null">
        <div class="modal-panel card p-6 w-full max-w-md" @click.stop>
          <h3 class="font-semibold text-ink">Rechazar pedido {{ rechazarModal.id }}</h3>
          <p class="text-sm text-slatebody mt-1">El cliente será notificado. Ingresa el motivo (obligatorio).</p>
          <textarea v-model="motivoRechazo" rows="3" class="input mt-4" placeholder="Ej. Producto agotado por el momento…" />
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button class="btn-secondary" @click="rechazarModal = null">Volver</button>
            <button class="btn-primary !bg-coral hover:!bg-red-600" :disabled="!motivoRechazo.trim()" @click="confirmarRechazo">Rechazar pedido</button>
          </div>
        </div>
      </div>
    </transition>
    </template>
  </div>
</template>
