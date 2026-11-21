<script setup>
import { ref, computed, defineAsyncComponent, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import CommerceIcon from '../../components/CommerceIcon.vue'
import PaymentGatewayModal from '../../components/PaymentGatewayModal.vue'
import { puntoEnCobertura } from '../../utils/geo'
import { extraerCategorias, filtrarProductos, formatRating, tienePromocion } from '../../utils/catalog'
import { resumenPedido } from '../../utils/checkout'
import { textoVerMas } from '../../utils/pagination'
import { useDialogo } from '../../composables/useDialogo'
import { usePaginacion } from '../../composables/usePaginacion'
import { layoutGrid, cellClass } from '../../utils/grid'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '../../components/catalog/catalog.css'
import { Search, SearchX, Bike, Utensils, Sparkles, Star, ArrowLeft, Plus, Minus, Trash2, Lock, Ban, CircleAlert, CircleCheck, ShoppingBag, Check, X, MapPin, Pencil, Info, Banknote, CreditCard, ReceiptText, ShieldAlert } from '@lucide/vue'

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

// "Ver más": a long menu shows the first 12 products; search or category changes go back to the first page.
const {
  visibles: productosVisibles,
  restantes: productosRestantes,
  verMas: verMasProductos,
} = usePaginacion(productosFiltrados, [busquedaProducto, categoriaProducto])
const celdasProductos = computed(() => layoutGrid(productosVisibles.value.length).map(cellClass))

const carritoAbierto = ref(false)
const checkoutPaso = ref(false)
const direccion = ref('')
const punto = ref(null) // { lat, lng } | null: the pin of THIS order
const editandoDireccion = ref(false) // true once the user chose "Cambiar para este pedido"
const guardarComoDefault = ref(false)
const refDireccion = ref(null)
const refCambiar = ref(null)
const errorDireccion = ref(false)
const panelCarrito = ref(null)
const tituloCarrito = ref(null)
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

const resumen = computed(() => resumenPedido(store.carritoSubtotal, store.zonaActual.tarifa))
const total = computed(() => resumen.value.total)

function cerrarCarrito() {
  carritoAbierto.value = false
}

// Focus moves into the sheet, stays inside it, Escape closes it and focus returns to what opened it.
useDialogo(() => carritoAbierto.value, panelCarrito, {
  cerrar: cerrarCarrito,
  enfoqueInicial: () => tituloCarrito.value,
  alVolver: ['[data-test="cart-fab"]', '[data-test="add-to-cart"]'],
})

// Switching between the cart and the checkout swaps the footer button the user just pressed: land on the new title.
watch(checkoutPaso, async () => {
  await nextTick()
  if (carritoAbierto.value) tituloCarrito.value?.focus()
})

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
  errorDireccion.value = false
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
    errorDireccion.value = true
    store.notificar('Ingresa la dirección de entrega para continuar.')
    await nextTick()
    refDireccion.value?.focus()
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
              {{ formatRating(comercio.rating) }} calificación
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

      <div v-if="productosFiltrados.length > 0" class="cx-cards" data-test="product-grid">
        <div
          v-for="(p, idx) in productosVisibles" :key="p.id"
          data-test="product-card"
          class="cx-tile cx-tile-compact cx-product"
          :class="celdasProductos[idx]"
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
      <div v-if="productosFiltrados.length > 0 && productosRestantes > 0" class="cx-more">
        <button type="button" data-test="products-more" class="cx-btn cx-btn-secondary" @click="verMasProductos">
          {{ textoVerMas(productosRestantes, 'productos') }}
        </button>
        <span class="cx-sr-only" role="status" aria-live="polite">{{ productosRestantes }} productos más por mostrar</span>
      </div>
      <div v-else-if="productosFiltrados.length === 0" data-test="products-empty" class="cx-tile cx-empty">
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
      data-test="cart-fab"
      @click="carritoAbierto = true"
    >
      <ShoppingBag :size="20" aria-hidden="true" />
      <span style="font-variant-numeric: tabular-nums">Ver pedido · {{ store.carritoTotalItems }} item(s) · B/ {{ store.carritoSubtotal.toFixed(2) }}</span>
    </button>

    <!-- Carrito lateral: bottom sheet on phones, side panel from 768px -->
    <transition name="cx-sheet">
      <div v-if="carritoAbierto" class="cx cx-overlay cx-overlay-side" data-test="cart-overlay" @click="cerrarCarrito">
        <aside
          ref="panelCarrito"
          class="cx-sheet cx-sheet-side"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-title"
          tabindex="-1"
          data-test="cart-drawer"
          @click.stop
        >
          <header class="cx-sheet-head">
            <h2 id="cart-title" ref="tituloCarrito" tabindex="-1" class="cx-h2">{{ checkoutPaso ? 'Finalizar pedido' : 'Tu carrito' }}</h2>
            <button type="button" class="cx-icon-btn" data-test="cart-close" aria-label="Cerrar carrito" @click="cerrarCarrito">
              <X :size="20" aria-hidden="true" />
            </button>
          </header>

          <div class="cx-sheet-body">
            <!-- Items -->
            <template v-if="!checkoutPaso">
              <ul v-if="store.carrito.length > 0" class="cx-lines" data-test="cart-lines">
                <li v-for="(item, idx) in store.carrito" :key="`${item.id}-${idx}`" class="cx-line" data-test="cart-line">
                  <div class="cx-stack" style="gap: 2px; min-width: 0">
                    <h3 class="cx-h3 cx-line-name">{{ item.nombre }}</h3>
                    <p class="cx-small cx-soft">B/ {{ item.precio.toFixed(2) }} c/u</p>
                  </div>
                  <span class="cx-line-total" data-test="line-total">B/ {{ (item.precio * item.cantidad).toFixed(2) }}</span>
                  <div class="cx-line-controls">
                    <div class="cx-field">
                      <label :for="`item-note-${idx}`" class="cx-sr-only">Observación para {{ item.nombre }}</label>
                      <Pencil :size="20" aria-hidden="true" />
                      <input
                        :id="`item-note-${idx}`"
                        class="cx-input"
                        data-test="item-note"
                        placeholder="Nota (ej. sin cebolla)"
                        :value="item.observacion"
                        @input="store.actualizarItemCarrito(idx, { observacion: $event.target.value })"
                      />
                    </div>
                    <div class="cx-qty" role="group" :aria-label="`Cantidad de ${item.nombre}`">
                      <button
                        type="button"
                        data-test="qty-minus"
                        :aria-label="item.cantidad === 1 ? `Quitar ${item.nombre} del carrito` : `Quitar una unidad de ${item.nombre}`"
                        @click="store.actualizarItemCarrito(idx, { cantidad: item.cantidad - 1 })"
                      >
                        <Trash2 v-if="item.cantidad === 1" :size="20" aria-hidden="true" />
                        <Minus v-else :size="20" aria-hidden="true" />
                      </button>
                      <output data-test="qty-value" aria-live="polite">{{ item.cantidad }}</output>
                      <button
                        type="button"
                        data-test="qty-plus"
                        :aria-label="`Agregar una unidad de ${item.nombre}`"
                        @click="store.actualizarItemCarrito(idx, { cantidad: item.cantidad + 1 })"
                      >
                        <Plus :size="20" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              </ul>
              <div v-else class="cx-empty" data-test="cart-empty" style="padding: 32px 0">
                <span class="cx-empty-icon"><ShoppingBag :size="32" aria-hidden="true" /></span>
                <h3 class="cx-h3">Tu carrito está vacío</h3>
                <p>Agrega productos del menú.</p>
                <button type="button" class="cx-btn" @click="cerrarCarrito">Ver el menú</button>
              </div>
            </template>

            <!-- Paso checkout -->
            <template v-else>
              <button type="button" class="cx-btn cx-btn-ghost" style="align-self: flex-start; margin-left: -16px" data-test="volver-carrito" @click="checkoutPaso = false">
                <ArrowLeft :size="20" aria-hidden="true" />
                Editar el carrito
              </button>

              <div v-if="store.consentimientoRequerido" data-test="consent-required" class="cx-alert cx-alert-danger" role="alert">
                <ShieldAlert :size="20" aria-hidden="true" />
                <div class="cx-alert-body">
                  <p>Debes aceptar el tratamiento de tus datos para continuar. Tu pedido no se creó y tu carrito se conserva.</p>
                  <button type="button" class="cx-btn cx-btn-secondary" @click="irAPerfil">Ir a mi perfil para aceptar</button>
                </div>
              </div>

              <section class="cx-section" data-test="direccion-entrega" aria-labelledby="direccion-title">
                <h3 id="direccion-title" class="cx-h3 cx-section-title"><MapPin :size="20" aria-hidden="true" />Dirección de entrega</h3>
                <template v-if="mostrandoGuardada">
                  <div class="cx-address" data-test="direccion-guardada">
                    <p style="font-weight: 600">{{ direccion }}</p>
                    <p v-if="punto" class="cx-address-meta"><MapPin :size="16" aria-hidden="true" />Con ubicación en el mapa</p>
                  </div>
                  <div v-if="fueraDeCobertura" data-test="coverage-warning" role="status" class="cx-alert">
                    <Info :size="20" aria-hidden="true" />
                    <p>Esta ubicación está fuera de las zonas de cobertura. Aun así puedes hacer el pedido.</p>
                  </div>
                  <button ref="refCambiar" type="button" data-test="cambiar-direccion" class="cx-btn cx-btn-secondary" style="align-self: flex-start" @click="cambiarDireccion">
                    <Pencil :size="20" aria-hidden="true" />Cambiar para este pedido
                  </button>
                </template>
                <template v-else>
                  <div>
                    <label for="checkout-direccion" class="cx-sr-only">Dirección de entrega</label>
                    <div class="cx-field">
                      <MapPin :size="20" aria-hidden="true" />
                      <input
                        id="checkout-direccion"
                        ref="refDireccion"
                        v-model="direccion"
                        class="cx-input"
                        autocomplete="street-address"
                        placeholder="Ej. Calle 45, Ed. Nogal, Apto 2B"
                        :aria-invalid="errorDireccion ? 'true' : undefined"
                        :aria-describedby="errorDireccion ? 'checkout-direccion-error' : undefined"
                        @input="errorDireccion = false"
                      />
                    </div>
                    <p v-if="errorDireccion" id="checkout-direccion-error" class="cx-field-error" data-test="direccion-error">
                      <CircleAlert :size="16" aria-hidden="true" />
                      <span>Ingresa la dirección de entrega para continuar.</span>
                    </p>
                  </div>
                  <AddressPickerMap v-model="punto" />
                  <label class="cx-check">
                    <input v-model="guardarComoDefault" type="checkbox" data-test="guardar-default" class="cx-check-input" />
                    <span class="cx-check-box" aria-hidden="true"><Check v-if="guardarComoDefault" :size="16" /></span>
                    <span>Guardar como mi dirección</span>
                  </label>
                  <button v-if="direccionGuardada" type="button" data-test="usar-guardada" class="cx-btn cx-btn-ghost" style="align-self: flex-start; margin-left: -16px" @click="usarGuardada">
                    Usar mi dirección guardada
                  </button>
                </template>
              </section>

              <section class="cx-section">
                <label for="checkout-observaciones" class="cx-section-title">
                  <Pencil :size="20" aria-hidden="true" />Observaciones para el repartidor
                </label>
                <textarea id="checkout-observaciones" v-model="observaciones" rows="2" class="cx-input cx-input-plain cx-textarea" placeholder="Ej. dejar en recepción" />
              </section>

              <div class="cx-section" role="radiogroup" aria-labelledby="pago-title" data-test="metodo-pago">
                <h3 id="pago-title" class="cx-h3 cx-section-title"><CreditCard :size="20" aria-hidden="true" />Método de pago</h3>
                <label class="cx-option" :class="{ 'cx-option-selected': metodoPago === 'contr_entrega' }">
                  <input v-model="metodoPago" type="radio" name="metodo-pago" value="contr_entrega" class="cx-option-input" />
                  <span class="cx-option-dot" aria-hidden="true"><Check v-if="metodoPago === 'contr_entrega'" :size="14" /></span>
                  <span class="cx-option-text">
                    <span class="cx-option-title">Pago contra entrega</span>
                    <span class="cx-option-sub">Pagas en efectivo al recibir</span>
                  </span>
                  <Banknote :size="24" aria-hidden="true" />
                </label>
                <label class="cx-option" :class="{ 'cx-option-selected': metodoPago === 'electronico' }">
                  <input v-model="metodoPago" type="radio" name="metodo-pago" value="electronico" class="cx-option-input" />
                  <span class="cx-option-dot" aria-hidden="true"><Check v-if="metodoPago === 'electronico'" :size="14" /></span>
                  <span class="cx-option-text">
                    <span class="cx-option-title">Pago electrónico (simulado)</span>
                    <span class="cx-option-sub">Pasarela simulada (sin datos reales de tarjeta)</span>
                  </span>
                  <CreditCard :size="24" aria-hidden="true" />
                </label>
              </div>
            </template>

            <!-- Resumen -->
            <section v-if="store.carritoTotalItems > 0" class="cx-section" aria-labelledby="resumen-title">
              <h3 id="resumen-title" class="cx-h3 cx-section-title"><ReceiptText :size="20" aria-hidden="true" />Resumen del pedido</h3>
              <dl class="cx-summary" data-test="order-summary">
                <div>
                  <dt>Subtotal</dt>
                  <dd data-test="summary-subtotal">B/ {{ resumen.subtotal.toFixed(2) }}</dd>
                </div>
                <div>
                  <dt>Envío ({{ store.zonaActual.nombre }})</dt>
                  <dd data-test="summary-envio">B/ {{ resumen.envio.toFixed(2) }}</dd>
                </div>
              </dl>
            </section>
          </div>

          <!-- Barra de pago fija: total a la izquierda, la acción principal a la derecha -->
          <footer v-if="store.carritoTotalItems > 0" class="cx-sheet-bar" data-test="checkout-bar">
            <p class="cx-sheet-total">
              <span class="cx-overline">Total</span>
              <span class="cx-h3" data-test="summary-total">B/ {{ total.toFixed(2) }}</span>
            </p>
            <button v-if="!checkoutPaso" type="button" class="cx-btn cx-btn-lg" data-test="cart-continue" @click="irACheckout">Continuar</button>
            <button v-else type="button" class="cx-btn cx-btn-lg" data-test="place-order" @click="confirmarPedido">Realizar pedido</button>
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
