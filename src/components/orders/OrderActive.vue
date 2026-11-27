<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bike, Map as MapIcon, Phone, Star, XCircle } from '@lucide/vue'
import CoverageMap from '../CoverageMap.vue'
import OrderHead from './OrderHead.vue'
import OrderItems from './OrderItems.vue'
import OrderProgress from './OrderProgress.vue'
import OrderTimeline from './OrderTimeline.vue'
import StatusChip from './StatusChip.vue'
import { estadoVisual, etaDeComercio } from '../../utils/orderStatus'
import { formatRating } from '../../utils/catalog'
import type { PedidoVista } from './types'

interface Repartidor {
  nombre?: string
  telefono?: string | null
  rating?: number | string | null
}

const props = defineProps<{
  pedido: PedidoVista
  repartidor?: Repartidor | null
  /** `delivery_time` of the merchant, as published; nothing is shown when the data has none. */
  tiempoComercio?: string | null
  /** The one order in progress that carries the active-tile shadow. */
  destacado?: boolean
  /** Its map action is the single primary button of the page. */
  primaria?: boolean
  mapaAbierto?: boolean
}>()

const emit = defineEmits<{ (e: 'toggle-mapa'): void; (e: 'cancelar'): void }>()

// The customer may withdraw an order only before the merchant acts and before paying.
const cancelable = computed(() => props.pedido.estado === 'pendiente' && props.pedido.pagoEstado !== 'pagado')
const confirmandoCancelacion = ref(false)
function pedirCancelacion() {
  if (!confirmandoCancelacion.value) {
    confirmandoCancelacion.value = true // first tap only arms it: no accidental cancellations
    return
  }
  confirmandoCancelacion.value = false
  emit('cancelar')
}

const visual = computed(() => estadoVisual(props.pedido.estado))
const eta = computed(() => (visual.value.enCurso ? etaDeComercio(props.tiempoComercio) : null))

// Courier: only what the data has. No invented phone, rating, vehicle or plate.
const mostrarRepartidor = computed(() => !!props.pedido.repartidorId && props.pedido.estado === 'en_camino')
const nombre = computed(() => props.repartidor?.nombre || props.pedido.repartidorNombre || '')
const telefono = computed(() => String(props.repartidor?.telefono ?? '').trim())
const rating = computed(() => formatRating(props.repartidor?.rating, ''))
</script>

<template>
  <article
    class="cx-order"
    :class="destacado ? 'cx-active' : 'cx-order-plain'"
    data-test="order-card"
    :data-estado="pedido.estado"
  >
    <OrderHead :pedido="pedido" />

    <div class="cx-track" :class="{ 'cx-track-solo': !visual.seguible }">
      <div v-if="visual.seguible" class="cx-track-main">
        <!-- Map tile -->
        <section class="cx-track-map" data-test="map-tile" aria-label="Seguimiento en mapa">
          <div v-if="mapaAbierto" class="cx-trackmap">
            <CoverageMap modo="tracking" :pedido="pedido" altura="320px" />
          </div>
          <div v-else class="cx-map-cta">
            <span class="cx-icon-disc"><MapIcon :size="28" aria-hidden="true" /></span>
            <p class="cx-small cx-soft">Mira el recorrido de tu pedido en el mapa.</p>
          </div>
          <div class="cx-map-actions">
            <button
              type="button"
              class="cx-btn"
              :class="primaria && !mapaAbierto ? '' : 'cx-btn-secondary'"
              data-test="map-toggle"
              :aria-expanded="mapaAbierto ? 'true' : 'false'"
              @click="emit('toggle-mapa')"
            >
              <MapIcon :size="20" aria-hidden="true" />
              <span>{{ mapaAbierto ? 'Ocultar mapa' : 'Ver recorrido en el mapa' }}</span>
            </button>
          </div>
        </section>

        <!-- Courier tile -->
        <section v-if="mostrarRepartidor" class="cx-track-tile cx-courier" data-test="courier-tile" aria-label="Repartidor">
          <span class="cx-courier-avatar"><Bike :size="24" aria-hidden="true" /></span>
          <div class="cx-courier-info">
            <h4 class="cx-h3">{{ nombre || 'Tu repartidor' }}</h4>
            <p class="cx-caption cx-soft">Tu repartidor en camino</p>
            <p class="cx-caption cx-rating">
              <template v-if="rating">
                <Star :size="16" aria-hidden="true" />
                <span data-test="courier-rating">{{ rating }}</span>
              </template>
              <span v-else class="cx-soft">Sin calificaciones</span>
            </p>
          </div>
          <a
            v-if="telefono"
            class="cx-round-btn"
            data-test="courier-call"
            :href="`tel:${telefono}`"
            :aria-label="nombre ? `Llamar a ${nombre}` : 'Llamar a tu repartidor'"
          >
            <Phone :size="20" aria-hidden="true" />
          </a>
        </section>
      </div>

      <div class="cx-track-side">
        <!-- ETA tile: the merchant's own delivery range, nothing computed -->
        <section v-if="eta" class="cx-track-tile cx-track-eta" data-test="eta-tile" aria-label="Tiempo de entrega">
          <p class="cx-overline">Llegada</p>
          <p class="cx-eta" :class="{ 'cx-eta-text': !eta.unidad }">{{ eta.valor }}</p>
          <p v-if="eta.unidad" class="cx-eta-unit">{{ eta.unidad }}</p>
          <p class="cx-caption cx-soft">Tiempo estimado del comercio</p>
        </section>

        <!-- Status tile: the live region announces state changes -->
        <section class="cx-track-tile cx-track-status" :class="{ 'cx-track-wide': !eta }" data-test="status-tile" aria-label="Estado del pedido">
          <p class="cx-overline">Estado</p>
          <div class="cx-live" aria-live="polite" aria-atomic="true">
            <StatusChip :estado="pedido.estado" />
          </div>
          <OrderProgress :estado="pedido.estado" />
          <button
            v-if="cancelable"
            type="button"
            class="cx-btn cx-btn-secondary"
            data-test="order-cancel"
            @click="pedirCancelacion"
          >
            <XCircle :size="20" aria-hidden="true" />
            <span>{{ confirmandoCancelacion ? 'Confirmar cancelación' : 'Cancelar pedido' }}</span>
          </button>
        </section>

        <!-- Timeline tile -->
        <section class="cx-track-tile cx-track-timeline" aria-label="Seguimiento del pedido">
          <OrderTimeline :estado="pedido.estado" :fecha="pedido.fecha" />
        </section>
      </div>
    </div>

    <OrderItems :pedido="pedido" />
  </article>
</template>
