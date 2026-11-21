<script setup>
import { ref, computed, defineAsyncComponent, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import CommerceIcon from '../../components/CommerceIcon.vue'
import PaymentGatewayModal from '../../components/PaymentGatewayModal.vue'
import { puntoEnCobertura } from '../../utils/geo'
import { extraerCategorias, filtrarProductos, tienePromocion } from '../../utils/catalog'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '../../components/catalog/catalog.css'
import { Search, SearchX, Bike, Utensils, Sparkles, Star, ArrowLeft, Plus, Lock, Ban, CircleCheck, ShoppingBag, Check } from '@lucide/vue'

// Leaflet only loads when the user chooses to change the address for this order.
const AddressPickerMap = defineAsyncComponent(() => import('../../components/AddressPickerMap.vue'))

const store = useGoEatsStore()
const route = useRoute()
const router = useRouter()

const comercio = computed(() => store.comercioPorId(route.params.id))
const productos = computed(() => store.productosDe(route.params.id))
const comercioAbierto = computed(() => Boolean(comercio.value && (comercio.value.activo ?? comercio.value.abierto ?? true)))
const busquedaProducto = ref('')
const categoriaProducto = ref('')
const categoriasMenu = computed(() => extraerCategorias(productos.value, 'categoria'))
const productosFiltrados = computed(() =>
  filtrarProductos(productos.value, {
    busqueda: busquedaProducto.value,
    categoria: categoriaProducto.value,
  }),
)

const carritoAbierto = ref(false)
const checkoutPaso = ref(false)
const direccion = ref('')
const punto = ref(null) // { lat, lng } | null: the pin of THIS order
const editandoDireccion = ref(false) // true once the user chose "Cambiar para este pedido"
const guardarComoDefault = ref(false)
const refDireccion = ref(null)
const refCambiar = ref(null)
const observaciones = ref('')
const metodoPago = ref('contr_entrega')
const pedidoCreado = ref(null)
const totalAPagar = ref(0)
const modalPago = ref(false)

const direccionGuardada = computed(() => (store.usuario.direccion ?? '').trim())
const puntoGuardado = computed(() => (store.usuario.lat != null && store.usuario.lng != null ? { lat: store.usuario.lat, lng: store.usuario.lng } : null))
// With a saved default the checkout shows it read-only; without one the fields start empty and editable.
const mostrandoGuardada = computed(() => direccionGuardada.value !== '' && !editandoDireccion.value)
const fueraDeCobertura = computed(() => punto.value !== null && !puntoEnCobertura(punto.value.lat, punto.value.lng))

const total = computed(() => store.carritoSubtotal + (checkoutPaso.value ? store.zonaActual.tarifa : 0))

function porcentajeDescuento(p) {
  if (!tienePromocion(p) || !p.precioRegular) return 0
  return Math.round(((p.precioRegular - p.precio) / p.precioRegular) * 100)
}

function limpiarFiltrosMenu() {
  busquedaProducto.value = ''
  categoriaProducto.value = ''
}

const hayFiltrosMenu = computed(() => busquedaProducto.value.trim() !== '' || categoriaProducto.value !== '')

function agregar(p) {
  if (!p.disponible || !comercioAbierto.value) return
  store.agregarAlCarrito(comercio.value.id, p, 1, '')
  carritoAbierto.value = true
  checkoutPaso.value = false
}

function prellenarDesdePerfil() {
  direccion.value = direccionGuardada.value
  punto.value = puntoGuardado.value ? { ...puntoGuardado.value } : null
}

function irACheckout() {
  // Reopening the drawer keeps whatever the user is editing for this order; otherwise start from the profile default.
  if (!editandoDireccion.value) prellenarDesdePerfil()
  checkoutPaso.value = true
  carritoAbierto.value = true
}

function limpiarFormulario() {
  checkoutPaso.value = false
  carritoAbierto.value = false
  direccion.value = ''
  punto.value = null
  editandoDireccion.value = false
  guardarComoDefault.value = false
  observaciones.value = ''
}

async function cambiarDireccion() {
  editandoDireccion.value = true
  await nextTick()
  refDireccion.value?.focus()
}

async function usarGuardada() {
  editandoDireccion.value = false
  guardarComoDefault.value = false
  prellenarDesdePerfil()
  await nextTick()
  refCambiar.value?.focus()
}

function datosPedido() {
  return {
    direccion: direccion.value,
    lat: punto.value?.lat ?? null,
    lng: punto.value?.lng ?? null,
    metodoPago: metodoPago.value,
    observaciones: observaciones.value,
  }
}

// Only when the user ticked the box while editing. Called after the order flow succeeded; never throws.
function direccionAGuardar(datos) {
  if (!editandoDireccion.value || !guardarComoDefault.value) return null
  return { direccion: datos.direccion, lat: datos.lat, lng: datos.lng }
}

// A failure here never undoes the order: the typed error is surfaced next to the order confirmation.
async function guardarComoPredeterminada(nuevaDireccion, mensajePedido) {
  let r
  try {
    r = await store.guardarPerfil(nuevaDireccion)
  } catch {
    r = { ok: false, error: null }
  }
  if (r.ok) {
    if (mensajePedido) store.notificar(`${mensajePedido} Guardamos esta dirección como tu predeterminada.`)
    return
  }
  const motivo = r.error?.message ? ` ${r.error.message}` : ''
  store.notificar(`${mensajePedido ?? ''} No se pudo guardar tu dirección predeterminada.${motivo}`.trim(), 'error')
}

async function confirmarPedido() {
  if (!direccion.value.trim()) {
    store.notificar('Ingresa la dirección de entrega para continuar.')
    return
  }
  if (!store.autenticado) {
    // Anonymous visitors keep their cart and come back to this store after signing in.
    router.push({ name: 'login', query: { redirect: `/tiendas/${comercio.value.id}` } })
    return
  }
  if (metodoPago.value === 'electronico') {
    // Nothing is created until the user pays: the modal's single action does both calls.
    totalAPagar.value = total.value
    pedidoCreado.value = null
    carritoAbierto.value = false
    modalPago.value = true
    return
  }
  const datos = datosPedido()
  const nuevaDireccion = direccionAGuardar(datos)
  const pedido = await store.crearPedido(datos)
  if (!pedido) return
  limpiarFormulario()
  const mensaje = `Pedido ${pedido.id} enviado. Pagarás B/ ${pedido.total.toFixed(2)} contra entrega.`
  store.notificar(mensaje)
  if (nuevaDireccion && pedido.estado !== 'cancelado') await guardarComoPredeterminada(nuevaDireccion, mensaje)
}

async function procesarPagoPasarela({ simulateFailure = false } = {}) {
  const datos = { ...datosPedido(), simularFalloPago: Boolean(simulateFailure) }
  const nuevaDireccion = direccionAGuardar(datos)
  const pedido = await store.crearPedido(datos)
  if (!pedido) return null
  pedidoCreado.value = pedido
  limpiarFormulario()
  if (nuevaDireccion && pedido.estado !== 'cancelado') await guardarComoPredeterminada(nuevaDireccion, null)
  return pedido
}

function irAPerfil() {
  modalPago.value = false
  carritoAbierto.value = false
  router.push({ name: 'profile' })
}

function cerrarModal() {
  modalPago.value = false
}

function verPedido() {
  modalPago.value = false
  router.push('/pedidos')
}
</script>

<template>
  <div v-if="comercio" class="cx" data-test="catalog-root">
    <div class="cx-page">
      <button type="button" class="cx-btn cx-btn-ghost" style="margin-left: -16px" @click="router.push('/tiendas')">
        <ArrowLeft :size="20" aria-hidden="true" />
        Volver a comercios
      </button>

      <!-- Bento header: one hero tile (the store) + one supporting tile (delivery) -->
      <section class="cx-bento" style="margin-top: 8px" aria-label="Información del comercio">
        <div class="cx-tile cx-tile-hero cx-tile-brand cx-span-8 cx-stack" style="gap: 16px">
          <div class="cx-row" style="gap: 16px; flex-wrap: nowrap; align-items: flex-start">
            <span class="cx-icon-disc"><CommerceIcon :name="comercio.icono" class="w-7 h-7" /></span>
            <div class="cx-stack" style="gap: 8px">
              <div class="cx-row">
                <span
                  data-test="store-status"
                  class="cx-badge"
                  :class="comercioAbierto ? 'cx-badge-open' : 'cx-badge-closed'"
                >
                  <component :is="comercioAbierto ? CircleCheck : Lock" :size="16" aria-hidden="true" />
                  {{ comercioAbierto ? 'Abierto ahora' : 'Cerrado' }}
                </span>
                <span class="cx-small cx-soft" style="font-weight: 600">{{ comercio.tipo }} · {{ store.zonaActual.nombre }}</span>
              </div>
              <h1 class="cx-h1">{{ comercio.nombre }}</h1>
            </div>
          </div>
          <p v-if="comercio.descripcion" class="cx-lead" style="max-width: 40rem">{{ comercio.descripcion }}</p>
        </div>

        <div class="cx-tile cx-tile-indigo cx-span-4 cx-stack" style="gap: 12px; justify-content: space-between" data-test="store-summary">
          <p class="cx-overline">Entrega estimada</p>
          <p class="cx-eta" style="font-size: 2rem">{{ comercio.tiempoEntrega }}</p>
          <div class="cx-row">
            <span class="cx-badge cx-badge-promo">
              <Star :size="16" aria-hidden="true" />
              {{ comercio.rating }} calificación
            </span>
            <span class="cx-badge cx-badge-info">
              <Bike :size="16" aria-hidden="true" />
              Envío B/ {{ store.zonaActual.tarifa.toFixed(2) }}
            </span>
          </div>
        </div>
      </section>

      <!-- Aviso de comercio cerrado -->
      <div
        v-if="!comercioAbierto"
        data-test="closed-merchant-notice"
        role="status"
        class="cx-alert"
        style="margin-top: 16px"
      >
        <Lock :size="20" aria-hidden="true" />
        <p>Este comercio se encuentra cerrado en este momento. Puedes explorar su menú, pero no es posible agregar productos al carrito.</p>
      </div>

      <!-- Barra sticky de búsqueda y categorías del menú -->
      <div class="cx-sticky cx-stack" style="margin-top: 16px">
        <div class="cx-field" style="max-width: 32rem; flex: none; width: 100%">
          <label for="products-search" class="cx-sr-only">Buscar en el menú</label>
          <Search :size="20" aria-hidden="true" />
          <input
            id="products-search"
            v-model="busquedaProducto"
            data-test="products-search"
            type="search"
            class="cx-input"
            placeholder="Busca un plato o una bebida"
          />
        </div>

        <div v-if="categoriasMenu.length > 0" role="group" aria-label="Filtrar el menú por categoría" class="cx-scroll-x">
          <button
            type="button"
            data-test="products-category"
            class="cx-chip"
            :class="{ 'cx-chip-selected': categoriaProducto === '' }"
            :aria-pressed="categoriaProducto === ''"
            @click="categoriaProducto = ''"
          >
            <Check v-if="categoriaProducto === ''" :size="16" aria-hidden="true" />Todos
          </button>
          <button
            v-for="cat in categoriasMenu"
            :key="cat"
            type="button"
            data-test="products-category"
            class="cx-chip"
            :class="{ 'cx-chip-selected': categoriaProducto === cat }"
            :aria-pressed="categoriaProducto === cat"
            @click="categoriaProducto = cat"
          >
            <Check v-if="categoriaProducto === cat" :size="16" aria-hidden="true" />{{ cat }}
          </button>
        </div>
      </div>

      <div class="cx-row cx-row-between" style="margin: 16px 0 12px">
        <h2 class="cx-h2">Menú</h2>
        <p class="cx-small cx-soft" role="status">
          {{ productosFiltrados.length }} {{ productosFiltrados.length === 1 ? 'producto' : 'productos' }}
        </p>
      </div>

      <div v-if="productosFiltrados.length > 0" class="cx-cards">
        <div
          v-for="p in productosFiltrados" :key="p.id"
          data-test="product-card"
          class="cx-tile cx-tile-compact cx-product"
          :data-unavailable="!p.disponible || !comercioAbierto ? 'true' : undefined"
        >
          <div class="cx-product-main">
            <div class="cx-stack" style="gap: 6px; min-width: 0">
              <div v-if="p.categoria || tienePromocion(p) || !p.disponible" class="cx-row" style="gap: 4px">
                <span v-if="p.categoria" class="cx-badge">{{ p.categoria }}</span>
                <span v-if="tienePromocion(p)" data-test="promo-badge" class="cx-badge cx-badge-promo">
                  <Sparkles :size="16" aria-hidden="true" />Promo
                </span>
                <span v-if="porcentajeDescuento(p) > 0" data-test="descuento" class="cx-badge cx-badge-accent">-{{ porcentajeDescuento(p) }}%</span>
                <span v-if="!p.disponible" class="cx-badge cx-badge-closed">
                  <Ban :size="16" aria-hidden="true" />Agotado
                </span>
              </div>
              <h3 class="cx-h3" style="font-size: 1.0625rem">{{ p.nombre }}</h3>
              <p v-if="p.descripcion" class="cx-small cx-soft cx-clamp-2">{{ p.descripcion }}</p>
            </div>
            <span class="cx-thumb" :class="{ 'cx-thumb-promo': tienePromocion(p) }" aria-hidden="true">
              <Sparkles v-if="tienePromocion(p)" :size="32" />
              <Utensils v-else :size="32" />
            </span>
          </div>

          <div class="cx-product-foot">
            <p class="cx-row" style="gap: 8px; align-items: baseline">
              <span class="cx-price" data-test="precio-efectivo">B/ {{ p.precio.toFixed(2) }}</span>
              <del v-if="p.precioRegular > p.precio" class="cx-price-old" data-test="precio-regular">B/ {{ p.precioRegular.toFixed(2) }}</del>
            </p>
            <button
              type="button"
              data-test="add-to-cart"
              class="cx-btn cx-btn-secondary"
              :disabled="!p.disponible || !comercioAbierto"
              :aria-disabled="!p.disponible || !comercioAbierto ? 'true' : undefined"
              :aria-label="p.disponible && comercioAbierto ? `Agregar ${p.nombre}` : undefined"
              @click="agregar(p)"
            >
              <Lock v-if="!comercioAbierto" :size="20" aria-hidden="true" />
              <Ban v-else-if="!p.disponible" :size="20" aria-hidden="true" />
              <Plus v-else :size="20" aria-hidden="true" />
              {{ !comercioAbierto ? 'Cerrado' : !p.disponible ? 'Agotado' : 'Agregar' }}
            </button>
          </div>
        </div>
      </div>
      <div v-else data-test="products-empty" class="cx-tile cx-empty">
        <span class="cx-empty-icon"><SearchX :size="32" aria-hidden="true" /></span>
        <h3 class="cx-h3">No hay productos que coincidan</h3>
        <p>Prueba con otro nombre o cambia la categoría.</p>
        <button type="button" data-test="products-clear-filters" class="cx-btn" @click="limpiarFiltrosMenu">Limpiar filtros</button>
      </div>
    </div>

    <!-- Botón flotante del carrito: the one primary action of the view -->
    <button
      v-if="store.carritoTotalItems > 0 && !carritoAbierto"
      type="button"
      class="cx-btn cx-btn-lg cx-fab"
      @click="carritoAbierto = true"
    >
      <ShoppingBag :size="20" aria-hidden="true" />
      <span style="font-variant-numeric: tabular-nums">Ver pedido · {{ store.carritoTotalItems }} item(s) · B/ {{ store.carritoSubtotal.toFixed(2) }}</span>
    </button>

    <!-- Carrito lateral -->
    <transition name="modal">
      <div v-if="carritoAbierto" class="fixed inset-0 z-50 bg-ink/40" @click="carritoAbierto = false">
        <aside class="modal-panel absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col" @click.stop>
          <header class="flex items-center justify-between px-5 py-4 border-b border-line">
            <h3 class="font-semibold text-ink">{{ checkoutPaso ? 'Finalizar pedido' : 'Tu carrito' }}</h3>
            <button class="p-1.5 rounded-lg hover:bg-canvas" @click="carritoAbierto = false">
              <svg class="w-5 h-5 text-slatebody" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </header>

          <div class="flex-1 overflow-y-auto p-5">
            <!-- Items -->
            <div v-if="!checkoutPaso">
              <div v-for="(item, idx) in store.carrito" :key="idx" class="flex items-start gap-3 py-3 border-b border-line/60 last:border-0">
                <div class="flex-1">
                  <p class="text-sm font-medium text-ink">{{ item.nombre }}</p>
                  <p class="text-xs text-slatebody mt-0.5">B/ {{ item.precio.toFixed(2) }} c/u</p>
                  <input
                    class="input mt-2 !py-1.5 !text-xs"
                    placeholder="Observación (ej. sin cebolla)"
                    :value="item.observacion"
                    @input="store.actualizarItemCarrito(idx, { observacion: $event.target.value })"
                  />
                </div>
                <div class="flex items-center gap-1.5">
                  <button class="w-7 h-7 rounded-lg border border-line grid place-items-center text-sm hover:bg-canvas" @click="store.actualizarItemCarrito(idx, { cantidad: item.cantidad - 1 })">−</button>
                  <span class="w-6 text-center text-sm font-medium">{{ item.cantidad }}</span>
                  <button class="w-7 h-7 rounded-lg border border-line grid place-items-center text-sm hover:bg-canvas" @click="store.actualizarItemCarrito(idx, { cantidad: item.cantidad + 1 })">+</button>
                </div>
              </div>
            </div>

            <!-- Paso checkout -->
            <div v-else class="space-y-4">
              <div v-if="store.consentimientoRequerido" data-test="consent-required" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p>Debes aceptar el tratamiento de tus datos para continuar. Tu pedido no se creó y tu carrito se conserva.</p>
                <button type="button" class="mt-2 font-semibold underline underline-offset-2" @click="irAPerfil">Ir a mi perfil para aceptar</button>
              </div>
              <div data-test="direccion-entrega">
                <template v-if="mostrandoGuardada">
                  <p class="label">Dirección de entrega</p>
                  <div class="rounded-lg border border-line p-3" data-test="direccion-guardada">
                    <p class="text-sm text-ink">{{ direccion }}</p>
                    <p v-if="punto" class="text-xs text-slatebody mt-1">Con ubicación en el mapa</p>
                  </div>
                  <p v-if="fueraDeCobertura" data-test="coverage-warning" role="status" class="mt-2 text-sm rounded-lg border border-sky-200 bg-sky-50 text-sky-800 p-3">
                    Esta ubicación está fuera de las zonas de cobertura. Aun así puedes hacer el pedido.
                  </p>
                  <button ref="refCambiar" type="button" data-test="cambiar-direccion" class="mt-2 text-sm font-semibold text-brand-dark underline underline-offset-2" @click="cambiarDireccion">Cambiar para este pedido</button>
                </template>
                <template v-else>
                  <label for="checkout-direccion" class="label">Dirección de entrega</label>
                  <input id="checkout-direccion" ref="refDireccion" v-model="direccion" class="input" autocomplete="street-address" placeholder="Ej. Calle 45, Ed. Nogal, Apto 2B" />
                  <div class="mt-3">
                    <AddressPickerMap v-model="punto" />
                  </div>
                  <label class="mt-3 flex items-center gap-2 text-sm text-ink cursor-pointer">
                    <input v-model="guardarComoDefault" type="checkbox" data-test="guardar-default" class="accent-[#00B19D]" />Guardar como mi dirección
                  </label>
                  <button v-if="direccionGuardada" type="button" data-test="usar-guardada" class="mt-2 text-sm font-semibold text-brand-dark underline underline-offset-2" @click="usarGuardada">Usar mi dirección guardada</button>
                </template>
              </div>
              <div>
                <label class="label">Observaciones para el repartidor</label>
                <textarea v-model="observaciones" rows="2" class="input" placeholder="Ej. dejar en recepción" />
              </div>
              <div>
                <label class="label">Método de pago</label>
                <div class="space-y-2">
                  <label class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer" :class="metodoPago === 'contr_entrega' ? 'border-brand bg-brand-light' : 'border-line'" >
                    <input v-model="metodoPago" type="radio" value="contr_entrega" class="accent-[#00B19D]" />
                    <span>
                      <span class="block text-sm font-medium text-ink">Pago contra entrega</span>
                      <span class="block text-xs text-slatebody">Pagas en efectivo al recibir</span>
                    </span>
                  </label>
                  <label class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer" :class="metodoPago === 'electronico' ? 'border-brand bg-brand-light' : 'border-line'">
                    <input v-model="metodoPago" type="radio" value="electronico" class="accent-[#00B19D]" />
                    <span>
                      <span class="block text-sm font-medium text-ink">Pago electrónico (simulado)</span>
                      <span class="block text-xs text-slatebody">Pasarela simulada (sin datos reales de tarjeta)</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Resumen + acción -->
          <footer v-if="store.carritoTotalItems > 0" class="border-t border-line p-5 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-slatebody">Subtotal</span><span class="font-medium text-ink">B/ {{ store.carritoSubtotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-slatebody">Envío ({{ store.zonaActual.nombre }})</span><span class="font-medium text-ink">B/ {{ store.zonaActual.tarifa.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-base font-bold text-ink pt-1">
              <span>Total</span><span>B/ {{ total.toFixed(2) }}</span>
            </div>
            <button v-if="!checkoutPaso" class="cx-btn cx-btn-lg" style="width: 100%" @click="irACheckout">Continuar</button>
            <button v-else class="cx-btn cx-btn-lg" style="width: 100%" @click="confirmarPedido">Realizar pedido</button>
          </footer>
          <footer v-else class="p-8 text-center text-sm text-slatebody">
            Tu carrito está vacío. Agrega productos del menú.
          </footer>
        </aside>
      </div>
    </transition>

    <!-- Modal de pago simulado -->
    <PaymentGatewayModal
      :open="modalPago"
      :total="totalAPagar"
      :consent-required="store.consentimientoRequerido"
      :on-process="procesarPagoPasarela"
      @close="cerrarModal"
      @view-orders="verPedido"
      @go-profile="irAPerfil"
    />
  </div>
</template>
