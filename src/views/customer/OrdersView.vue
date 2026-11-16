<script setup>
import { ref, computed } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import { ESTADOS_PEDIDO } from '../../mockData'
import StatusBadge from '../../components/StatusBadge.vue'

const store = useGoEatsStore()

const misPedidos = computed(() => store.pedidosComoCliente)

const pasos = ESTADOS_PEDIDO

function indiceEstado(p) {
  return pasos.indexOf(p.estado)
}

const modalCalificar = ref(null)
const estrellas = ref(5)
const hoverEstrella = ref(0)

function abrirCalificar(p) {
  modalCalificar.value = p
  estrellas.value = p.calificacion || 5
}

function enviarCalificacion() {
  store.calificarPedido(modalCalificar.value.id, estrellas.value)
  store.notificar('¡Gracias por calificar tu pedido!')
  modalCalificar.value = null
}

function progresoEstado(estado) {
  return Math.round((100 / pasos.length) * (pasos.indexOf(estado) + 1))
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <h1 class="text-2xl font-bold">Mis pedidos</h1>
    <p class="text-sm text-slatebody mt-1">Sigue el estado de tus entregas en tiempo real.</p>

    <div v-if="misPedidos.length === 0" class="card p-10 mt-6 text-center">
      <p class="text-slatebody">Aún no tienes pedidos. Explora comercios y haz tu primer pedido.</p>
      <router-link to="/tiendas" class="btn-primary mt-4 inline-flex">Explorar comercios</router-link>
    </div>

    <div v-else class="mt-6 space-y-4">
      <div v-for="p in misPedidos" :key="p.id" class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-ink">{{ p.id }}</h3>
              <StatusBadge :estado="p.estado" />
            </div>
            <p class="text-sm text-slatebody mt-0.5">{{ p.comercioNombre }} · {{ p.fecha }}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-ink">B/ {{ p.total.toFixed(2) }}</p>
            <p class="text-[11px] text-slatebody">{{ p.metodoPago === 'contr_entrega' ? 'Contra entrega' : 'Pago electrónico' }}</p>
          </div>
        </div>

        <!-- Línea de tiempo -->
        <div v-if="p.estado !== 'cancelado'" class="mt-6">
          <div class="relative">
            <div class="absolute left-0 right-0 top-2.5 h-0.5 bg-line rounded" />
            <div class="absolute left-0 top-2.5 h-0.5 bg-brand rounded transition-all duration-500" :style="{ width: progresoEstado(p.estado) + '%' }" />
            <div class="relative flex justify-between">
              <div v-for="(paso, i) in pasos" :key="paso" class="flex flex-col items-center flex-1">
                <span
                  class="w-6 h-6 rounded-full border-2 grid place-items-center text-[10px] font-bold transition-colors duration-300"
                  :class="i <= indiceEstado(p) ? 'bg-brand border-brand text-white' : 'bg-white border-line text-slatebody/50'"
                >
                  <svg v-if="i < indiceEstado(p)" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span class="mt-1.5 text-[9px] sm:text-[10px] text-center leading-tight max-w-[60px]" :class="i <= indiceEstado(p) ? 'text-ink font-medium' : 'text-slatebody/60'">
                  {{ paso.charAt(0).toUpperCase() + paso.slice(1) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p v-else class="mt-4 text-sm text-coral bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          Cancelado: {{ p.motivoCancelacion || 'Sin motivo registrado.' }}
        </p>

        <!-- Repartidor asignado -->
        <div v-if="p.repartidorId && p.estado === 'en camino'" class="mt-5 flex items-center gap-3 rounded-lg bg-canvas p-3">
          <span class="grid place-items-center w-10 h-10 rounded-full bg-brand-light text-lg">🛵</span>
          <div class="flex-1">
            <p class="text-sm font-semibold text-ink">{{ store.repartidorPorId(p.repartidorId)?.nombre }}</p>
            <p class="text-xs text-slatebody">Tu repartidor · {{ store.repartidorPorId(p.repartidorId)?.telefono }}</p>
          </div>
          <span class="text-xs text-slatebody">⭐ {{ store.repartidorPorId(p.repartidorId)?.rating }}</span>
        </div>

        <!-- Detalle de items -->
        <details class="mt-4 group">
          <summary class="text-xs font-medium text-brand-dark cursor-pointer select-none">Ver detalle del pedido</summary>
          <ul class="mt-2 space-y-1">
            <li v-for="(it, i) in p.items" :key="i" class="text-xs text-slatebody flex justify-between">
              <span>{{ it.cantidad }}× {{ it.nombre }} <em v-if="it.observacion" class="not-italic text-slatebody/70">— {{ it.observacion }}</em></span>
              <span>B/ {{ (it.cantidad * it.precio).toFixed(2) }}</span>
            </li>
          </ul>
          <p class="text-[11px] text-slatebody mt-2">Dir.: {{ p.direccion }}</p>
        </details>

        <!-- Calificación -->
        <div v-if="p.estado === 'entregado'" class="mt-4 pt-4 border-t border-line flex items-center justify-between">
          <div v-if="p.calificacion" class="flex items-center gap-1 text-amber-500">
            <svg v-for="n in p.calificacion" :key="n" class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.1 3.4a1 1 0 00.95.7h3.6c.97 0 1.37 1.24.59 1.81l-2.9 2.1a1 1 0 00-.36 1.12l1.1 3.4c.3.92-.75 1.69-1.54 1.12l-2.9-2.1a1 1 0 00-1.18 0l-2.9 2.1c-.79.57-1.84-.2-1.54-1.12l1.1-3.4a1 1 0 00-.36-1.12L2.8 8.84c-.78-.57-.38-1.81.59-1.81h3.6a1 1 0 00.95-.7l1.1-3.4z"/></svg>
            <span class="text-xs text-slatebody ml-1.5">Gracias por tu calificación</span>
          </div>
          <button v-else class="btn-secondary !py-1.5 !px-3 text-xs" @click="abrirCalificar(p)">
            Calificar pedido
          </button>
        </div>
      </div>
    </div>

    <!-- Modal calificar -->
    <transition name="modal">
      <div v-if="modalCalificar" class="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" @click="modalCalificar = null">
        <div class="modal-panel card p-6 w-full max-w-sm" @click.stop>
          <h3 class="text-lg font-semibold text-ink text-center">¿Cómo fue tu pedido?</h3>
          <p class="text-sm text-slatebody text-center mt-1">{{ modalCalificar.comercioNombre }} · {{ modalCalificar.id }}</p>
          <div class="flex justify-center gap-2 mt-6" @mouseleave="hoverEstrella = 0">
            <button
              v-for="n in 5" :key="n"
              class="transition-transform duration-100 hover:scale-110"
              @mouseenter="hoverEstrella = n"
              @click="estrellas = n"
            >
              <svg class="w-9 h-9 transition-colors" :class="(hoverEstrella || estrellas) >= n ? 'text-amber-400 fill-current' : 'text-line fill-current'" viewBox="0 0 20 20"><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.1 3.4a1 1 0 00.95.7h3.6c.97 0 1.37 1.24.59 1.81l-2.9 2.1a1 1 0 00-.36 1.12l1.1 3.4c.3.92-.75 1.69-1.54 1.12l-2.9-2.1a1 1 0 00-1.18 0l-2.9 2.1c-.79.57-1.84-.2-1.54-1.12l1.1-3.4a1 1 0 00-.36-1.12L2.8 8.84c-.78-.57-.38-1.81.59-1.81h3.6a1 1 0 00.95-.7l1.1-3.4z"/></svg>
            </button>
          </div>
          <div class="mt-6 grid grid-cols-2 gap-3">
            <button class="btn-secondary" @click="modalCalificar = null">Cancelar</button>
            <button class="btn-primary" @click="enviarCalificacion">Enviar</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
