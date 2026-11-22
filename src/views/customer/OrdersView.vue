<script setup>
import { ref, computed } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import { useDialogo } from '../../composables/useDialogo'
import { estadoVisual } from '../../utils/orderStatus'
import { layoutGrid, cellClass } from '../../utils/grid'
import { formatRating } from '../../utils/catalog'
import OrderActive from '../../components/orders/OrderActive.vue'
import OrderHead from '../../components/orders/OrderHead.vue'
import OrderItems from '../../components/orders/OrderItems.vue'
import OrderTimeline from '../../components/orders/OrderTimeline.vue'
import RatingStars from '../../components/orders/RatingStars.vue'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '../../components/catalog/catalog.css'
import { CircleX, PackageCheck, Receipt, Star, X } from '@lucide/vue'

const store = useGoEatsStore()

const misPedidos = computed(() => store.pedidosComoCliente)

// Closed orders (entregado, rechazado, cancelado) go to the history; the rest are in progress.
const enCurso = computed(() => misPedidos.value.filter((p) => estadoVisual(p.estado).enCurso))
const anteriores = computed(() => misPedidos.value.filter((p) => !estadoVisual(p.estado).enCurso))
const celdas = computed(() => layoutGrid(anteriores.value.length).map(cellClass))

// Delivery time published by the merchant; an unknown merchant simply has no ETA tile.
function tiempoComercio(p) {
  return store.comercios.find((c) => c.id === p.comercioId)?.tiempoEntrega || null
}

// One primary button per view: the map action of the first trackable order, else "Calificar" of the first unrated delivery.
const primarioMapa = computed(() => enCurso.value.find((p) => estadoVisual(p.estado).seguible)?.id ?? null)
const primarioCalificar = computed(() => {
  if (primarioMapa.value) return null
  return anteriores.value.find((p) => p.estado === 'entregado' && !p.calificacion)?.id ?? null
})

const pedidoEnMapa = ref(null) // id of the order whose tracking map is open

function toggleMapa(pedidoId) {
  pedidoEnMapa.value = pedidoEnMapa.value === pedidoId ? null : pedidoId
}

// ---------- Rating dialog ----------
const modalCalificar = ref(null)
const estrellas = ref(5)
const estrellasRepartidor = ref(5)
const comentarioCalificacion = ref('')
const enviando = ref(false)
const panelCalificar = ref(null)
const tituloCalificar = ref(null)

function abrirCalificar(p) {
  modalCalificar.value = p
  estrellas.value = p.calificacionComercio || p.calificacion || 5
  estrellasRepartidor.value = p.calificacionRepartidor || 5
  comentarioCalificacion.value = p.comentarioCalificacion || ''
}

function cerrarCalificar() {
  if (enviando.value) return
  modalCalificar.value = null
}

// Focus moves into the dialog, stays inside it, Escape closes it and focus returns to the "Calificar" button.
useDialogo(() => !!modalCalificar.value, panelCalificar, {
  cerrar: cerrarCalificar,
  puedeCerrar: () => !enviando.value,
  enfoqueInicial: () => tituloCalificar.value,
  alVolver: ['[data-test="rate-open"]'],
})

async function enviarCalificacion() {
  if (enviando.value) return // a second click while the write is in flight does nothing
  enviando.value = true
  try {
    const r = await store.calificarPedido(
      modalCalificar.value.id,
      estrellas.value,
      estrellasRepartidor.value,
      comentarioCalificacion.value,
    )
    if (!r.ok) return // the dialog stays open; the store already rolled back and showed the error
    store.notificar('¡Gracias por calificar tu pedido!')
    modalCalificar.value = null
  } finally {
    enviando.value = false
  }
}

const estrellasLlenas = (valor) => Array.from({ length: 5 }, (_, i) => i < valor)
</script>

<template>
  <div class="cx" data-test="orders-root">
    <div class="cx-page cx-stack" style="gap: 24px">
      <header class="cx-stack" style="gap: 4px">
        <h1 class="cx-h1">Mis pedidos</h1>
        <p class="cx-lead">Sigue el estado de tus entregas y revisa tus pedidos anteriores.</p>
      </header>

      <!-- Empty state -->
      <section v-if="misPedidos.length === 0" class="cx-tile cx-tile-hero cx-empty" data-test="orders-empty" aria-labelledby="orders-empty-title">
        <span class="cx-empty-icon"><Receipt :size="32" aria-hidden="true" /></span>
        <h2 id="orders-empty-title" class="cx-h3">Aún no tienes pedidos</h2>
        <p>Cuando hagas tu primer pedido podrás seguirlo aquí.</p>
        <router-link to="/tiendas" class="cx-btn cx-btn-lg">Explorar comercios</router-link>
      </section>

      <!-- In progress: the first one is the active tile (the only one with depth) -->
      <section v-if="enCurso.length" class="cx-stack" aria-labelledby="orders-active-title">
        <h2 id="orders-active-title" class="cx-h2">En curso</h2>
        <OrderActive
          v-for="(p, i) in enCurso"
          :key="p.id"
          :pedido="p"
          :repartidor="store.repartidorPorId(p.repartidorId)"
          :tiempo-comercio="tiempoComercio(p)"
          :destacado="i === 0"
          :primaria="p.id === primarioMapa"
          :mapa-abierto="pedidoEnMapa === p.id"
          @toggle-mapa="toggleMapa(p.id)"
        />
      </section>

      <!-- History -->
      <section v-if="anteriores.length" class="cx-stack" aria-labelledby="orders-past-title">
        <h2 id="orders-past-title" class="cx-h2">Anteriores</h2>
        <div class="cx-cards">
          <article
            v-for="(p, i) in anteriores"
            :key="p.id"
            class="cx-order cx-order-past"
            :class="celdas[i]"
            data-test="order-card"
            :data-estado="p.estado"
          >
            <OrderHead :pedido="p" chip />

            <!-- Rejected or cancelled: no steps, the reason in a persistent alert -->
            <div v-if="estadoVisual(p.estado).fallido" data-test="estado-terminal" class="cx-alert cx-alert-danger" role="status">
              <CircleX :size="20" aria-hidden="true" />
              <p><strong>{{ estadoVisual(p.estado).label }}:</strong> {{ p.motivoCancelacion || 'Sin motivo registrado.' }}</p>
            </div>

            <!-- Delivered: a tinted icon tile, a title and one action -->
            <div v-else-if="p.estado === 'entregado'" class="cx-delivered" data-test="delivered-tile">
              <span class="cx-delivered-icon"><PackageCheck :size="28" aria-hidden="true" /></span>
              <div class="cx-delivered-text">
                <h4 class="cx-h3">Pedido entregado</h4>
                <template v-if="p.calificacion">
                  <p class="cx-small cx-soft">Gracias por tu calificación.</p>
                  <div class="cx-rated" data-test="rating-readonly">
                    <p class="cx-rate-line">
                      <span class="cx-caption cx-soft">Comercio</span>
                      <span class="cx-stars-ro" role="img" :aria-label="`Comercio: ${p.calificacionComercio || p.calificacion} de 5 estrellas`">
                        <Star v-for="(lleno, n) in estrellasLlenas(p.calificacionComercio || p.calificacion)" :key="n" :size="16" :data-lleno="lleno ? 'true' : 'false'" aria-hidden="true" />
                      </span>
                      <span class="cx-rate-num">{{ formatRating(p.calificacionComercio || p.calificacion) }}</span>
                    </p>
                    <p v-if="p.calificacionRepartidor" class="cx-rate-line">
                      <span class="cx-caption cx-soft">Repartidor</span>
                      <span class="cx-stars-ro" role="img" :aria-label="`Repartidor: ${p.calificacionRepartidor} de 5 estrellas`">
                        <Star v-for="(lleno, n) in estrellasLlenas(p.calificacionRepartidor)" :key="n" :size="16" :data-lleno="lleno ? 'true' : 'false'" aria-hidden="true" />
                      </span>
                      <span class="cx-rate-num">{{ formatRating(p.calificacionRepartidor) }}</span>
                    </p>
                  </div>
                </template>
                <p v-else class="cx-small cx-soft">Cuéntanos cómo estuvo tu pedido de {{ p.comercioNombre }}.</p>
              </div>
              <button
                v-if="!p.calificacion"
                type="button"
                class="cx-btn"
                :class="p.id === primarioCalificar ? '' : 'cx-btn-secondary'"
                data-test="rate-open"
                @click="abrirCalificar(p)"
              >
                Calificar
              </button>
            </div>

            <OrderItems :pedido="p">
              <OrderTimeline :estado="p.estado" :fecha="p.fecha" />
            </OrderItems>
          </article>
        </div>
      </section>
    </div>

    <!-- Rating dialog: bottom sheet on phones, 480px modal from 640px -->
    <transition name="cx-sheet">
      <div v-if="modalCalificar" class="cx cx-overlay cx-overlay-center" data-test="rate-overlay" @click="cerrarCalificar">
        <section
          ref="panelCalificar"
          class="cx-sheet cx-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rate-title"
          tabindex="-1"
          data-test="rate-dialog"
          @click.stop
        >
          <header class="cx-sheet-head">
            <h2 id="rate-title" ref="tituloCalificar" tabindex="-1" class="cx-h2">¿Cómo fue tu pedido?</h2>
            <button type="button" class="cx-icon-btn" data-test="rate-close" aria-label="Cerrar" @click="cerrarCalificar">
              <X :size="20" aria-hidden="true" />
            </button>
          </header>

          <div class="cx-sheet-body">
            <p class="cx-small cx-soft">{{ modalCalificar.comercioNombre }} · <span class="cx-mono">{{ modalCalificar.id }}</span></p>

            <div class="cx-rate-group">
              <p class="cx-label" aria-hidden="true">Servicio del comercio</p>
              <RatingStars v-model="estrellas" label="Servicio del comercio" />
            </div>

            <div class="cx-rate-group">
              <p class="cx-label" aria-hidden="true">Atención del repartidor</p>
              <RatingStars v-model="estrellasRepartidor" label="Atención del repartidor" />
            </div>

            <div>
              <label for="rate-comment" class="cx-label">Comentario (opcional)</label>
              <textarea
                id="rate-comment"
                v-model="comentarioCalificacion"
                rows="2"
                class="cx-input cx-input-plain cx-textarea"
                placeholder="Ej. llegó caliente y a tiempo"
              />
            </div>

            <div class="cx-actions">
              <button type="button" class="cx-btn cx-btn-secondary" data-test="rate-cancel" @click="cerrarCalificar">Cancelar</button>
              <button type="button" class="cx-btn" data-test="rate-submit" :aria-disabled="enviando ? 'true' : undefined" @click="enviarCalificacion">
                {{ enviando ? 'Enviando…' : 'Enviar' }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </transition>
  </div>
</template>
