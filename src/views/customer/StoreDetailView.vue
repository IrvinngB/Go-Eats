<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import CommerceIcon from '../../components/CommerceIcon.vue'

const store = useGoEatsStore()
const route = useRoute()
const router = useRouter()

const comercio = computed(() => store.comercioPorId(route.params.id))
const productos = computed(() => store.productosDe(route.params.id))

const carritoAbierto = ref(false)
const checkoutPaso = ref(false)
const direccion = ref('')
const observaciones = ref('')
const metodoPago = ref('contr_entrega')
const pagoSimulado = ref(false) // null | 'aprobado' | 'rechazado'
const pedidoCreado = ref(null)
const modalPago = ref(false)

const total = computed(() => store.carritoSubtotal + (checkoutPaso.value ? store.zonaActual.tarifa : 0))

function agregar(p) {
  if (!p.disponible) return
  store.agregarAlCarrito(comercio.value.id, p, 1, '')
  carritoAbierto.value = true
  checkoutPaso.value = false
}

function irACheckout() {
  checkoutPaso.value = true
  carritoAbierto.value = true
}

function confirmarPedido() {
  if (!direccion.value.trim()) {
    store.notificar('Ingresa la dirección de entrega para continuar.')
    return
  }
  const pedido = store.crearPedido({ direccion: direccion.value, metodoPago: metodoPago.value, observaciones: observaciones.value })
  if (!pedido) return
  pedidoCreado.value = pedido
  checkoutPaso.value = false
  carritoAbierto.value = false
  direccion.value = ''
  observaciones.value = ''
  if (pedido.metodoPago === 'electronico') {
    pagoSimulado.value = null
    modalPago.value = true
  } else {
    store.notificar(`Pedido ${pedido.id} enviado. Pagarás B/ ${pedido.total.toFixed(2)} contra entrega.`)
  }
}

function resolverPago(aprobar) {
  pagoSimulado.value = aprobar ? 'aprobado' : 'rechazado'
  store.simularPago(pedidoCreado.value.id, aprobar)
}

function verPedido() {
  modalPago.value = false
  router.push('/pedidos')
}
</script>

<template>
  <div v-if="comercio" class="mx-auto max-w-6xl px-4 py-8 pb-32">
    <button class="text-sm text-slatebody hover:text-ink flex items-center gap-1.5 mb-5" @click="router.push('/tiendas')">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Volver a comercios
    </button>

    <!-- Encabezado -->
    <div class="card p-6 flex flex-wrap items-center gap-5">
      <span class="grid place-items-center w-16 h-16 rounded-2xl bg-brand-light text-brand">
        <CommerceIcon :name="comercio.icono" class="w-8 h-8" />
      </span>
      <div class="flex-1 min-w-[200px]">
        <h1 class="text-2xl font-bold">{{ comercio.nombre }}</h1>
        <p class="text-sm text-slatebody">{{ comercio.tipo }} · {{ store.zonaActual.nombre }}</p>
        <p class="text-sm text-slatebody mt-1">{{ comercio.descripcion }}</p>
      </div>
      <div class="flex gap-6 text-center">
        <div>
          <p class="text-lg font-bold text-ink">{{ comercio.rating }}</p>
          <p class="text-[11px] text-slatebody">Calificación</p>
        </div>
        <div>
          <p class="text-lg font-bold text-ink">{{ comercio.tiempoEntrega }}</p>
          <p class="text-[11px] text-slatebody">Entrega</p>
        </div>
        <div>
          <p class="text-lg font-bold text-ink">B/ {{ store.zonaActual.tarifa.toFixed(2) }}</p>
          <p class="text-[11px] text-slatebody">Envío</p>
        </div>
      </div>
    </div>

    <!-- Productos -->
    <h2 class="mt-8 mb-4 text-lg font-semibold">Menú</h2>
    <div class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="p in productos" :key="p.id"
        class="card p-4 flex items-start gap-4"
        :class="{ 'opacity-55': !p.disponible }"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <h3 class="font-medium text-ink text-sm">{{ p.nombre }}</h3>
            <span v-if="!p.disponible" class="text-[10px] font-semibold uppercase text-red-500 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">Agotado</span>
          </div>
          <p class="text-xs text-slatebody mt-0.5">{{ p.descripcion }}</p>
          <p class="mt-2 flex items-baseline gap-2">
            <span class="text-sm font-bold text-brand-dark" data-test="precio-efectivo">B/ {{ p.precio.toFixed(2) }}</span>
            <span v-if="p.precioRegular > p.precio" class="text-xs text-slatebody line-through" data-test="precio-regular">B/ {{ p.precioRegular.toFixed(2) }}</span>
          </p>
        </div>
        <button class="btn-primary !px-3 !py-2" :disabled="!p.disponible" @click="agregar(p)">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </button>
      </div>
    </div>

    <!-- Botón flotante del carrito -->
    <button
      v-if="store.carritoTotalItems > 0 && !carritoAbierto"
      class="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-brand text-white rounded-full shadow-lg px-6 py-3.5 flex items-center gap-3 text-sm font-semibold hover:bg-brand-dark transition-colors"
      @click="carritoAbierto = true"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
      Ver pedido · {{ store.carritoTotalItems }} item(s) · B/ {{ store.carritoSubtotal.toFixed(2) }}
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
                    @change="store.carrito[idx].observacion = $event.target.value"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <button class="w-7 h-7 rounded-lg border border-line text-slatebody hover:bg-canvas" @click="store.actualizarCantidad(idx, -1)">−</button>
                  <span class="w-6 text-center text-sm font-semibold text-ink">{{ item.cantidad }}</span>
                  <button class="w-7 h-7 rounded-lg border border-line text-slatebody hover:bg-canvas" @click="store.actualizarCantidad(idx, 1)">+</button>
                </div>
              </div>
              <button class="text-xs text-coral mt-4 hover:underline" @click="store.vaciarCarrito()">Vaciar carrito</button>
            </div>

            <!-- Checkout -->
            <div v-else class="space-y-4">
              <div>
                <label class="label">Dirección de entrega</label>
                <input v-model="direccion" class="input" placeholder="Ej. Calle 45, Ed. Nogal, Apto 2B" />
              </div>
              <div>
                <label class="label">Observaciones para el repartidor</label>
                <textarea v-model="observaciones" rows="2" class="input" placeholder="Ej. dejar en recepción" />
              </div>
              <div>
                <label class="label">Método de pago</label>
                <div class="grid gap-2">
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
            <button v-if="!checkoutPaso" class="btn-primary w-full !py-3" @click="irACheckout">Continuar</button>
            <button v-else class="btn-primary w-full !py-3" @click="confirmarPedido">Realizar pedido</button>
          </footer>
          <footer v-else class="p-8 text-center text-sm text-slatebody">
            Tu carrito está vacío. Agrega productos del menú.
          </footer>
        </aside>
      </div>
    </transition>

    <!-- Modal de pago simulado -->
    <transition name="modal">
      <div v-if="modalPago" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="pagoSimulado ? modalPago = false : null">
        <div class="modal-panel card p-6 w-full max-w-sm" @click.stop>
          <template v-if="!pagoSimulado">
            <h3 class="text-lg font-semibold text-ink">Pasarela de pago simulada</h3>
            <p class="text-sm text-slatebody mt-1">Pedido {{ pedidoCreado.id }} · Total <strong>B/ {{ pedidoCreado.total.toFixed(2) }}</strong></p>
            <p class="text-xs text-slatebody mt-3 bg-canvas rounded-lg p-3">Por cumplimiento PCI-DSS, esta demo no solicita datos reales de tarjeta. Usa los botones para simular el resultado del cobro.</p>
            <div class="mt-5 grid grid-cols-2 gap-3">
              <button class="btn-danger-ghost" @click="resolverPago(false)">Simular rechazo</button>
              <button class="btn-primary" @click="resolverPago(true)">Simular aprobación</button>
            </div>
          </template>
          <template v-else>
            <div class="text-center py-4">
              <div class="mx-auto grid place-items-center w-14 h-14 rounded-full" :class="pagoSimulado === 'aprobado' ? 'bg-emerald-50' : 'bg-red-50'">
                <svg v-if="pagoSimulado === 'aprobado'" class="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                <svg v-else class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </div>
              <h3 class="mt-4 text-lg font-semibold text-ink">{{ pagoSimulado === 'aprobado' ? 'Pago aprobado' : 'Pago rechazado' }}</h3>
              <p class="text-sm text-slatebody mt-1">
                {{ pagoSimulado === 'aprobado' ? 'El comercio ya recibió la confirmación de tu pedido.' : 'El pedido fue cancelado. Puedes intentarlo de nuevo con pago contra entrega.' }}
              </p>
              <button class="btn-primary w-full mt-5" @click="verPedido">Ver mis pedidos</button>
            </div>
          </template>
        </div>
      </div>
    </transition>
  </div>
</template>
