<script setup>
import { ref, computed, watch } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import StatusBadge from '../../components/StatusBadge.vue'
import CommerceIcon from '../../components/CommerceIcon.vue'
import { ESTADOS_TERMINALES } from '../../mockData'
import { extraerCategorias, filtrarProductos, tienePromocion } from '../../utils/catalog'
import { Search, Clock, Sparkles, Plus, Trash2, Edit3, Power, ShoppingBag, Utensils, Bike } from '@lucide/vue'

const store = useGoEatsStore()
const tab = ref('pedidos')
// Comercio vinculado a la cuenta por el servidor (GET /merchants/mine); sin respaldo por nombre ni c1.
const comercio = computed(() => store.comercioPropio)
const productos = computed(() => (comercio.value ? store.productosDe(comercio.value.id) : []))
const pedidos = computed(() => (comercio.value ? store.pedidosPorComercio(comercio.value.id) : []))

const activos = computed(() => pedidos.value.filter((p) => !ESTADOS_TERMINALES.includes(p.estado)))
const historial = computed(() => pedidos.value.filter((p) => ESTADOS_TERMINALES.includes(p.estado)))

const filtroEstadoPedido = ref('todos') // 'todos' | 'pendiente' | 'cocina' | 'listo_para_recoger'
const activosFiltrados = computed(() => {
  if (filtroEstadoPedido.value === 'pendiente') return activos.value.filter((p) => p.estado === 'pendiente')
  if (filtroEstadoPedido.value === 'cocina') return activos.value.filter((p) => ['confirmado', 'en_preparacion'].includes(p.estado))
  if (filtroEstadoPedido.value === 'listo_para_recoger') return activos.value.filter((p) => p.estado === 'listo_para_recoger')
  return activos.value
})

const busquedaCatalogo = ref('')
const categoriaCatalogo = ref('')
const categoriasCatalogo = computed(() => extraerCategorias(productos.value, 'categoria'))
const productosFiltrados = computed(() =>
  filtrarProductos(productos.value, {
    busqueda: busquedaCatalogo.value,
    categoria: categoriaCatalogo.value,
  }),
)
const totalEnPromo = computed(() => productos.value.filter((p) => tienePromocion(p)).length)

const CATEGORIAS_SUGERIDAS = ['Platos fuertes', 'Sopas', 'Entradas', 'Bebidas', 'Postres', 'Combos', 'General']

const rechazarModal = ref(null)
const motivoRechazo = ref('')
const editarProducto = ref(null) // null | {} | producto
const errorProducto = ref('')
const formProducto = ref({
  nombre: '',
  categoria: 'General',
  precioRegular: 0,
  precioPromo: '',
  descripcion: '',
})
const horario = ref({ ...(comercio.value?.horario || { abre: '09:00', cierra: '21:00' }) })
watch(comercio, (c) => {
  if (c?.horario) horario.value = { ...c.horario }
})
const horarioGuardado = ref(false)

function porcentajeDescuento(p) {
  if (!tienePromocion(p) || !p.precioRegular) return 0
  return Math.round(((p.precioRegular - p.precio) / p.precioRegular) * 100)
}

function siguiente(p) {
  const s = store.siguienteEstado(p.estado)
  if (!s) return
  store.avanzarEstadoPedido(p.id, s)
}

// El comercio puede rechazar mientras el pedido no haya salido a la calle (motivo obligatorio).
const RECHAZABLES = ['pendiente', 'confirmado', 'en_preparacion']

function asignar(p, repartidorId) {
  if (!repartidorId) return
  store.asignarRepartidor(p.id, repartidorId)
}

async function confirmarRechazo() {
  if (!motivoRechazo.value.trim() || !rechazarModal.value) return
  const pedidoId = rechazarModal.value.id
  const motivo = motivoRechazo.value.trim()
  const r = await store.rechazarPedido(pedidoId, motivo)
  if (!r || r.ok !== false) {
    store.notificar(`Pedido ${pedidoId} rechazado.`)
    rechazarModal.value = null
    motivoRechazo.value = ''
  }
}

async function toggleApertura() {
  if (!comercio.value) return
  const nuevoEstado = !comercio.value.activo
  const r = await store.cambiarAperturaComercio(comercio.value.id, nuevoEstado)
  if (r?.ok) {
    store.notificar(nuevoEstado ? 'Tienda marcada como abierta.' : 'Tienda marcada como cerrada.')
  }
}

function nuevoProducto() {
  errorProducto.value = ''
  editarProducto.value = {}
  formProducto.value = {
    nombre: '',
    categoria: 'General',
    precioRegular: 0,
    precioPromo: '',
    descripcion: '',
  }
}

function editar(p) {
  errorProducto.value = ''
  editarProducto.value = p
  const reg = typeof p.precioRegular === 'number' && p.precioRegular > 0 ? p.precioRegular : p.precio
  const tienePromo = tienePromocion(p)
  formProducto.value = {
    nombre: p.nombre,
    categoria: p.categoria || 'General',
    precioRegular: reg,
    precioPromo: tienePromo ? String(p.precio) : '',
    descripcion: p.descripcion || '',
  }
}

async function guardarProducto() {
  errorProducto.value = ''
  const nombre = formProducto.value.nombre.trim()
  if (nombre.length < 2) {
    errorProducto.value = 'Ingresa un nombre válido (mínimo 2 caracteres).'
    return
  }
  const precioReg = Number(formProducto.value.precioRegular)
  if (!Number.isFinite(precioReg) || precioReg <= 0) {
    errorProducto.value = 'El precio regular debe ser mayor que B/ 0.00.'
    return
  }
  const rawPromo = String(formProducto.value.precioPromo ?? '').trim()
  let precioPromo = null
  if (rawPromo !== '') {
    const pNum = Number(rawPromo)
    if (!Number.isFinite(pNum) || pNum <= 0 || pNum >= precioReg) {
      errorProducto.value = 'El precio promocional debe ser mayor que 0 y menor al precio regular.'
      return
    }
    precioPromo = pNum
  }

  const categoria = (formProducto.value.categoria || '').trim() || 'General'
  const precioEfectivo = precioPromo !== null ? precioPromo : precioReg
  const r = await store.guardarProducto(
    comercio.value.id,
    {
      nombre,
      categoria,
      precio: precioEfectivo,
      precioRegular: precioReg,
      precioPromo,
      descripcion: formProducto.value.descripcion.trim(),
    },
    editarProducto.value?.id || null,
  )
  if (r?.ok) {
    editarProducto.value = null
    store.notificar('Producto guardado.')
  }
}

async function borrarProducto(p) {
  if (!comercio.value) return
  const r = await store.eliminarProducto(comercio.value.id, p.id)
  if (r?.ok) {
    store.notificar(`Producto "${p.nombre}" eliminado.`)
  }
}

async function guardarHorario() {
  if (!comercio.value) return
  const r = await store.guardarHorarioComercio(comercio.value.id, {
    abre: horario.value.abre,
    cierra: horario.value.cierra,
    abierto: comercio.value.activo,
  })
  if (r?.ok) {
    horarioGuardado.value = true
    setTimeout(() => (horarioGuardado.value = false), 2500)
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6">
    <div v-if="!comercio" class="card p-10 text-center" data-test="sin-comercio">
      <h1 class="text-lg font-bold text-ink">Cuenta sin comercio asignado</h1>
      <p class="mt-2 text-sm text-slatebody">Tu cuenta aún no está vinculada a un comercio. Contacta al administrador de Go Eats.</p>
    </div>

    <template v-else>
      <!-- Header estilo Delivery Manager (Uber Eats / PedidosYa Partner) -->
      <div class="card overflow-hidden p-0">
        <div class="relative bg-emerald-500/15 border-b border-line/60 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <span class="grid place-items-center w-16 h-16 rounded-3xl bg-white text-brand shadow-sm border border-line">
              <CommerceIcon :name="comercio.icono || 'Store'" class="w-8 h-8" />
            </span>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-white/90 border border-line px-2.5 py-0.5 text-[11px] font-bold text-brand-dark">
                  Panel de comercio · {{ comercio.tipo }}
                </span>
                <span v-if="comercio.rating" class="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                  ★ {{ comercio.rating }}
                </span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-extrabold text-ink mt-1">{{ comercio.nombre }}</h1>
              <p v-if="comercio.descripcion" class="text-xs text-slatebody mt-0.5 max-w-xl">{{ comercio.descripcion }}</p>
            </div>
          </div>

          <!-- Control rápido de apertura / cierre manual (RF-13) -->
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2.5 rounded-2xl bg-white border border-line px-4 py-2.5 shadow-sm">
              <span class="w-2.5 h-2.5 rounded-full" :class="comercio.activo ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'" />
              <div class="text-xs">
                <p class="font-bold text-ink" data-test="store-open-label">{{ comercio.activo ? 'Tienda abierta' : 'Tienda cerrada' }}</p>
                <p class="text-slatebody">{{ horario.abre }} a {{ horario.cierra }}</p>
              </div>
              <button
                type="button"
                data-test="toggle-store-open"
                class="ml-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors"
                :class="comercio.activo ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'"
                @click="toggleApertura"
              >
                <Power class="w-3.5 h-3.5" />
                {{ comercio.activo ? 'Cerrar tienda' : 'Abrir tienda' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Resumen operativo rápido (KPIs del local) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line bg-white">
          <div class="px-5 py-3.5 flex items-center gap-3">
            <span class="grid place-items-center w-10 h-10 rounded-2xl bg-brand-light text-brand">
              <ShoppingBag class="w-5 h-5" />
            </span>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">Pedidos activos</p>
              <p class="text-lg font-extrabold text-ink">{{ activos.length }}</p>
            </div>
          </div>
          <div class="px-5 py-3.5 flex items-center gap-3">
            <span class="grid place-items-center w-10 h-10 rounded-2xl bg-sky-50 text-sky-600">
              <Bike class="w-5 h-5" />
            </span>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">Listos p/ repartidor</p>
              <p class="text-lg font-extrabold text-ink">{{ activos.filter((p) => p.estado === 'listo_para_recoger').length }}</p>
            </div>
          </div>
          <div class="px-5 py-3.5 flex items-center gap-3">
            <span class="grid place-items-center w-10 h-10 rounded-2xl bg-canvas text-ink">
              <Utensils class="w-5 h-5" />
            </span>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">Platos en menú</p>
              <p class="text-lg font-extrabold text-ink">{{ productos.length }}</p>
            </div>
          </div>
          <div class="px-5 py-3.5 flex items-center gap-3">
            <span class="grid place-items-center w-10 h-10 rounded-2xl bg-amber-50 text-amber-600">
              <Sparkles class="w-5 h-5" />
            </span>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">En promoción</p>
              <p class="text-lg font-extrabold text-ink">{{ totalEnPromo }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs estilo píldora -->
      <div class="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
        <button
          v-for="t in [['pedidos', `Pedidos (${activos.length})`], ['catalogo', `Catálogo (${productos.length})`], ['ajustes', 'Horarios y apertura']]"
          :key="t[0]"
          type="button"
          :data-test="`tab-${t[0]}`"
          class="rounded-full px-4 py-2 text-sm font-bold transition-all"
          :class="tab === t[0] ? 'bg-brand text-white shadow-sm' : 'bg-white border border-line text-slatebody hover:text-ink'"
          @click="tab = t[0]"
        >
          {{ t[1] }}
        </button>
      </div>

      <!-- TAB 1: PEDIDOS (RF-01, RF-16) -->
      <section v-if="tab === 'pedidos'" class="mt-6 space-y-6">
        <div>
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 class="text-sm font-extrabold uppercase tracking-wide text-slatebody">Activos ({{ activos.length }})</h2>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="f in [['todos', 'Todos'], ['pendiente', 'Nuevos'], ['cocina', 'En cocina'], ['listo_para_recoger', 'Listos']]"
                :key="f[0]"
                type="button"
                class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
                :class="filtroEstadoPedido === f[0] ? 'bg-ink text-white border-ink' : 'bg-white text-slatebody border-line hover:text-ink'"
                @click="filtroEstadoPedido = f[0]"
              >
                {{ f[1] }}
              </button>
            </div>
          </div>

          <div v-if="activosFiltrados.length > 0" class="grid gap-4 lg:grid-cols-2">
            <div v-for="p in activosFiltrados" :key="p.id" class="card p-5 flex flex-col justify-between">
              <div>
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-extrabold text-base text-ink font-mono">{{ p.id }}</h3>
                      <StatusBadge :estado="p.estado" />
                    </div>
                    <p class="text-xs text-slatebody mt-1">{{ p.clienteNombre }} · {{ p.fecha }}</p>
                    <p v-if="p.direccion" class="text-xs text-slatebody mt-0.5">Entrega: {{ p.direccion }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-extrabold text-ink">B/ {{ p.total.toFixed(2) }}</p>
                    <span class="text-[11px] text-slatebody">{{ p.metodoPago === 'contr_entrega' ? 'Contra entrega' : 'Pago electrónico' }}</span>
                  </div>
                </div>

                <ul class="mt-3 rounded-xl bg-canvas p-3 text-xs text-ink space-y-1 border border-line/60">
                  <li v-for="(it, i) in p.items" :key="i" class="flex items-start justify-between gap-2">
                    <span><strong>{{ it.cantidad }}×</strong> {{ it.nombre }}</span>
                    <em v-if="it.observacion" class="not-italic font-medium text-amber-700">— {{ it.observacion }}</em>
                  </li>
                </ul>
                <p v-if="p.observaciones" class="mt-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 font-medium">
                  Nota: {{ p.observaciones }}
                </p>
              </div>

              <!-- Acciones según estado -->
              <div class="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-2">
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
                  <div v-else class="w-full text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 font-semibold flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Asignado a {{ store.repartidorPorId(p.repartidorId)?.nombre }}
                  </div>
                </template>
                <template v-else-if="p.estado === 'en_camino'">
                  <p class="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 font-semibold w-full">
                    En camino con {{ store.repartidorPorId(p.repartidorId)?.nombre || 'repartidor' }}.
                  </p>
                </template>
                <button
                  v-if="RECHAZABLES.includes(p.estado)"
                  class="btn-danger-ghost !py-2 text-xs"
                  @click="rechazarModal = p; motivoRechazo = ''"
                >Rechazar</button>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-slatebody bg-canvas border border-line rounded-2xl p-8 text-center">
            No hay pedidos activos en este momento.
          </p>
        </div>

        <div>
          <h2 class="text-sm font-extrabold uppercase tracking-wide text-slatebody mb-3">Historial ({{ historial.length }})</h2>
          <div class="card overflow-x-auto">
            <table class="w-full">
              <thead class="bg-canvas border-b border-line">
                <tr><th class="th">Pedido</th><th class="th">Cliente</th><th class="th">Total</th><th class="th">Estado</th></tr>
              </thead>
              <tbody class="divide-y divide-line">
                <tr v-for="p in historial" :key="p.id" class="hover:bg-canvas/50 transition-colors">
                  <td class="td font-bold font-mono text-ink">{{ p.id }}</td>
                  <td class="td">{{ p.clienteNombre }}</td>
                  <td class="td font-semibold">B/ {{ p.total.toFixed(2) }}</td>
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

      <!-- TAB 2: CATÁLOGO (RF-13: Productos, categorías, precios, promociones y disponibilidad) -->
      <section v-if="tab === 'catalogo'" class="mt-6 space-y-5">
        <!-- Barra de búsqueda, categorías y botón Nuevo producto -->
        <div class="card p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="relative flex-1 min-w-[220px] max-w-md">
              <label for="merchant-catalog-search" class="sr-only">Buscar producto en tu catálogo</label>
              <Search class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slatebody" />
              <input
                id="merchant-catalog-search"
                v-model="busquedaCatalogo"
                data-test="merchant-catalog-search"
                type="search"
                class="w-full rounded-full border border-line bg-canvas pl-10 pr-4 py-2 text-sm text-ink placeholder:text-slatebody/70 focus:border-brand focus:bg-white focus:outline-none"
                placeholder="Buscar plato, bebida o categoría…"
              />
            </div>
            <button type="button" data-test="new-product-btn" class="btn-primary !py-2.5 text-sm" @click="nuevoProducto">
              <Plus class="w-4 h-4" />
              Nuevo producto
            </button>
          </div>

          <div v-if="categoriasCatalogo.length > 0" class="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-test="merchant-category-chip"
              class="rounded-full border px-3.5 py-1 text-xs font-bold transition-colors"
              :class="categoriaCatalogo === '' ? 'bg-ink text-white border-ink' : 'bg-canvas text-ink border-line hover:border-brand/50'"
              @click="categoriaCatalogo = ''"
            >Todos ({{ productos.length }})</button>
            <button
              v-for="cat in categoriasCatalogo"
              :key="cat"
              type="button"
              data-test="merchant-category-chip"
              class="rounded-full border px-3.5 py-1 text-xs font-bold transition-colors"
              :class="categoriaCatalogo === cat ? 'bg-ink text-white border-ink' : 'bg-canvas text-ink border-line hover:border-brand/50'"
              @click="categoriaCatalogo = cat"
            >{{ cat }}</button>
          </div>
        </div>

        <!-- Grilla de productos estilo gestor de menú -->
        <div v-if="productosFiltrados.length > 0" class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="p in productosFiltrados"
            :key="p.id"
            data-test="merchant-product-card"
            class="card p-5 flex flex-col justify-between gap-4 transition-all hover:border-brand/40"
            :class="{ 'opacity-60': !p.disponible }"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex flex-wrap items-center gap-1.5 mb-1">
                  <span data-test="merchant-product-category" class="rounded-full bg-canvas border border-line px-2.5 py-0.5 text-[11px] font-bold text-slatebody">
                    {{ p.categoria || 'General' }}
                  </span>
                  <span
                    v-if="tienePromocion(p)"
                    data-test="merchant-product-promo"
                    class="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800"
                  >
                    Promo -{{ porcentajeDescuento(p) }}%
                  </span>
                  <span
                    v-if="!p.disponible"
                    class="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600"
                  >
                    Agotado
                  </span>
                </div>
                <h3 class="text-base font-extrabold text-ink">{{ p.nombre }}</h3>
                <p class="text-xs text-slatebody mt-1 line-clamp-2">{{ p.descripcion }}</p>
              </div>

              <!-- Switch de disponibilidad -->
              <div class="flex flex-col items-end gap-1">
                <button
                  type="button"
                  data-test="toggle-product-available"
                  :aria-label="`Cambiar disponibilidad de ${p.nombre}`"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="p.disponible ? 'bg-brand' : 'bg-gray-300'"
                  @click="store.actualizarEstadoProducto(comercio.id, p.id, !p.disponible)"
                >
                  <span
                    class="inline-block transform rounded-full bg-white shadow transition-transform duration-200"
                    :class="p.disponible ? 'translate-x-6' : 'translate-x-1'"
                    style="height:18px;width:18px"
                  />
                </button>
                <span class="text-[10px] font-semibold text-slatebody">{{ p.disponible ? 'Disponible' : 'Oculto' }}</span>
              </div>
            </div>

            <div class="pt-3 border-t border-line flex items-center justify-between gap-2">
              <div class="flex items-baseline gap-2">
                <span class="text-base font-extrabold text-ink" data-test="merchant-product-price">B/ {{ p.precio.toFixed(2) }}</span>
                <span v-if="tienePromocion(p)" class="text-xs text-slatebody line-through" data-test="merchant-product-regular">
                  B/ {{ p.precioRegular.toFixed(2) }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-test="edit-product-btn"
                  class="inline-flex items-center gap-1 rounded-xl border border-line bg-canvas px-3 py-1.5 text-xs font-bold text-ink hover:border-brand"
                  @click="editar(p)"
                >
                  <Edit3 class="w-3.5 h-3.5 text-brand" />
                  Editar
                </button>
                <button
                  type="button"
                  data-test="delete-product-btn"
                  class="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                  @click="borrarProducto(p)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else data-test="merchant-catalog-empty" class="card p-8 text-center text-sm text-slatebody">
          No hay productos que coincidan con tu filtro.
        </div>

        <!-- Modal crear/editar producto (RF-13 completo: categoría y precio promocional) -->
        <transition name="modal">
          <div v-if="editarProducto" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="editarProducto = null">
            <div class="modal-panel card p-6 w-full max-w-md" @click.stop>
              <h3 class="text-lg font-extrabold text-ink">{{ editarProducto.id ? 'Editar producto' : 'Nuevo producto' }}</h3>
              <div class="mt-4 space-y-3.5">
                <div>
                  <label for="prod-nombre" class="label">Nombre del plato o producto</label>
                  <input id="prod-nombre" v-model="formProducto.nombre" data-test="product-name-input" class="input" placeholder="Ej. Sancocho de gallina" />
                </div>

                <div>
                  <label for="prod-categoria" class="label">Categoría</label>
                  <input
                    id="prod-categoria"
                    v-model="formProducto.categoria"
                    data-test="product-category-input"
                    list="categorias-sugeridas"
                    class="input"
                    placeholder="Ej. Platos fuertes, Bebidas, Postres…"
                  />
                  <datalist id="categorias-sugeridas">
                    <option v-for="c in CATEGORIAS_SUGERIDAS" :key="c" :value="c" />
                  </datalist>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="prod-precio" class="label">Precio regular (B/)</label>
                    <input
                      id="prod-precio"
                      v-model.number="formProducto.precioRegular"
                      data-test="product-price-input"
                      type="number"
                      step="0.05"
                      min="0"
                      class="input"
                    />
                  </div>
                  <div>
                    <label for="prod-promo" class="label">Precio promo (opcional)</label>
                    <input
                      id="prod-promo"
                      v-model="formProducto.precioPromo"
                      data-test="product-promo-input"
                      type="number"
                      step="0.05"
                      min="0"
                      class="input"
                      placeholder="Sin promo"
                    />
                  </div>
                </div>

                <div>
                  <label for="prod-desc" class="label">Descripción</label>
                  <textarea
                    id="prod-desc"
                    v-model="formProducto.descripcion"
                    data-test="product-description-input"
                    rows="2"
                    class="input"
                    placeholder="Ingredientes, porción o detalle breve"
                  />
                </div>

                <p v-if="errorProducto" data-test="product-form-error" role="alert" class="text-xs font-semibold text-red-600">
                  {{ errorProducto }}
                </p>
              </div>
              <div class="mt-5 grid grid-cols-2 gap-3">
                <button type="button" class="btn-secondary" @click="editarProducto = null">Cancelar</button>
                <button type="button" data-test="save-product-btn" class="btn-primary" @click="guardarProducto">Guardar</button>
              </div>
            </div>
          </div>
        </transition>
      </section>

      <!-- TAB 3: HORARIOS Y APERTURA (RF-13) -->
      <section v-if="tab === 'ajustes'" class="mt-6 max-w-lg">
        <div class="card p-6 space-y-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-extrabold text-ink flex items-center gap-2">
                <Clock class="w-5 h-5 text-brand" />
                Horario y estado del local
              </h2>
              <p class="text-xs text-slatebody mt-1">
                Configura tu horario de atención y controla si tu comercio acepta pedidos en este momento.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="sched-open" class="label">Apertura</label>
              <input id="sched-open" v-model="horario.abre" data-test="schedule-open-input" type="time" class="input" />
            </div>
            <div>
              <label for="sched-close" class="label">Cierre</label>
              <input id="sched-close" v-model="horario.cierra" data-test="schedule-close-input" type="time" class="input" />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2">
            <button type="button" data-test="save-schedule-btn" class="btn-primary" @click="guardarHorario">Guardar horario</button>
            <p v-if="horarioGuardado" data-test="schedule-saved-msg" class="text-sm font-semibold text-emerald-600">Horario actualizado.</p>
          </div>
        </div>
      </section>

      <!-- Modal rechazar con motivo obligatorio (RF-16) -->
      <transition name="modal">
        <div v-if="rechazarModal" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="rechazarModal = null">
          <div class="modal-panel card p-6 w-full max-w-md" @click.stop>
            <h3 class="font-extrabold text-lg text-ink">Rechazar pedido {{ rechazarModal.id }}</h3>
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
