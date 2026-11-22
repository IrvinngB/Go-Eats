<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import { useRouter } from 'vue-router'
import CommerceIcon from '../../components/CommerceIcon.vue'
import CoverageMap from '../../components/CoverageMap.vue'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '../../components/catalog/catalog.css'
import { MapPin, LayoutGrid, Map, Search, SearchX, Clock, Bike, Sparkles, Star, Check, ChevronDown, CircleCheck, Lock, Hourglass, ChevronLeft, ChevronRight } from '@lucide/vue'
import { extraerCategorias, filtrarYOrdenarComercios, formatRating, tienePromocion } from '../../utils/catalog'
import { textoVerMas } from '../../utils/pagination'
import { usePaginacion } from '../../composables/usePaginacion'
import { layoutGrid, cellClass } from '../../utils/grid'

const store = useGoEatsStore()
const router = useRouter()
const vistaActiva = ref('grid') // 'grid' | 'mapa'
const busqueda = ref('')
const categoriaSeleccionada = ref('')
const orden = ref('relevancia') // 'relevancia' | 'rating' | 'nombre'

const categoriasZona = computed(() => extraerCategorias(store.comerciosPorZona, 'tipo'))
const comerciosFiltrados = computed(() =>
  filtrarYOrdenarComercios(store.comerciosPorZona, {
    busqueda: busqueda.value,
    categoria: categoriaSeleccionada.value,
    orden: orden.value,
  }),
)

// "Ver más": 12 merchants at a time; search, category, sort or zone changes go back to the first page.
const {
  visibles: comerciosVisibles,
  restantes: comerciosRestantes,
  verMas,
} = usePaginacion(comerciosFiltrados, [busqueda, categoriaSeleccionada, orden, () => store.zonaSeleccionada])
// The grid lays out only the visible subset, so every desktop row is full at any page.
const celdas = computed(() => layoutGrid(comerciosVisibles.value.length).map(cellClass))

// Keyboard users continue from the first newly revealed merchant instead of tabbing back up the list.
async function verMasComercios() {
  const antes = comerciosVisibles.value.length
  verMas()
  await nextTick()
  const nuevas = [...document.querySelectorAll('[data-test="merchant-card"]')].slice(antes)
  const foco = nuevas.find((el) => !el.disabled) ?? document.querySelector('[data-test="merchants-more"]')
  foco?.focus({ preventScroll: false })
}
// Cover tones cycle through the pale brand tints (tone, never border or shadow).
const TONOS_PORTADA = ['', 'cx-cover-b', 'cx-cover-c']

function tonoPortada(idx) {
  return TONOS_PORTADA[idx % TONOS_PORTADA.length]
}

function estadoComercio(c) {
  if (c.activo) return { clase: 'cx-badge-open', texto: 'Abierto', icono: CircleCheck }
  if (c.estadoAfiliacion === 'en_revision') return { clase: 'cx-badge-review', texto: 'En revisión', icono: Hourglass }
  return { clase: 'cx-badge-closed', texto: 'Cerrado', icono: Lock }
}

const comerciosAbiertos = computed(() => store.comerciosPorZona.filter((c) => c.activo).length)

function comercioTienePromos(comercioId) {
  const prods = store.productosDe(comercioId) || []
  return prods.some((p) => tienePromocion(p))
}

function limpiarFiltros() {
  busqueda.value = ''
  categoriaSeleccionada.value = ''
  orden.value = 'relevancia'
}

function seleccionarZona(slug) {
  store.seleccionarZona(slug)
  categoriaSeleccionada.value = ''
}

// Zone chip row: keep the selected chip in view and offer chevrons while the row overflows.
const zonaScroller = ref(null)
const zonaDesborda = ref(false)
const zonaPuedeAtras = ref(false)
const zonaPuedeAdelante = ref(false)
let zonaObserver = null

function comportamientoScroll(instantaneo = false) {
  const reducido = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return instantaneo || reducido ? 'auto' : 'smooth'
}

function actualizarScrollZonas() {
  const el = zonaScroller.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  zonaDesborda.value = max > 1
  zonaPuedeAtras.value = el.scrollLeft > 1
  zonaPuedeAdelante.value = el.scrollLeft < max - 1
}

function centrarZonaSeleccionada(instantaneo = false) {
  const el = zonaScroller.value
  const chip = el?.querySelector('[aria-pressed="true"]')
  if (!el || !chip) return
  const e = el.getBoundingClientRect()
  const c = chip.getBoundingClientRect()
  const left = el.scrollLeft + (c.left - e.left) - (e.width - c.width) / 2
  if (typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: comportamientoScroll(instantaneo) })
  else el.scrollLeft = left
}

function desplazarZonas(direccion) {
  const el = zonaScroller.value
  if (!el) return
  const left = direccion * el.clientWidth * 0.8
  if (typeof el.scrollBy === 'function') el.scrollBy({ left, behavior: comportamientoScroll() })
  else el.scrollLeft += left
}

onMounted(() => {
  centrarZonaSeleccionada(true)
  actualizarScrollZonas()
  if (typeof ResizeObserver === 'function' && zonaScroller.value) {
    zonaObserver = new ResizeObserver(actualizarScrollZonas)
    zonaObserver.observe(zonaScroller.value)
  }
})
onBeforeUnmount(() => zonaObserver?.disconnect())

watch(
  () => [store.zonaSeleccionada, store.zonas.length],
  async () => {
    await nextTick()
    centrarZonaSeleccionada()
    actualizarScrollZonas()
  },
)

function abrirTienda(c) {
  if (!c.activo || c.estadoAfiliacion !== 'activo') return
  const res = store.abrirTienda(c.id)
  if (!res.ok) {
    store.notificar(res.mensaje)
    return
  }
  router.push(`/tiendas/${c.id}`)
}

function alSeleccionarZonaDesdeMapa(slug) {
  seleccionarZona(slug)
}
</script>

<template>
  <div class="cx" data-test="catalog-root">
    <div class="cx-page cx-stack" style="gap: 24px">
      <!-- Bento header: one hero tile (zone) + one supporting tile (delivery) -->
      <section class="cx-bento" aria-label="Zona de entrega">
        <div class="cx-tile cx-tile-hero cx-tile-brand cx-span-8 cx-stack" style="gap: 20px">
          <div class="cx-row cx-row-between" style="align-items: flex-start">
            <div class="cx-row" style="gap: 16px; flex-wrap: nowrap">
              <span class="cx-icon-disc"><MapPin :size="28" aria-hidden="true" /></span>
              <div>
                <p class="cx-overline">Entregar en</p>
                <h1 class="cx-h1">{{ store.zonaActual.nombre }}</h1>
              </div>
            </div>

            <!-- View switch: list / map -->
            <div class="cx-segment" role="group" aria-label="Vista">
              <button type="button" :aria-pressed="vistaActiva === 'grid'" @click="vistaActiva = 'grid'">
                <LayoutGrid :size="20" aria-hidden="true" />
                <span>Lista</span>
              </button>
              <button type="button" :aria-pressed="vistaActiva === 'mapa'" @click="vistaActiva = 'mapa'">
                <Map :size="20" aria-hidden="true" />
                <span>Mapa</span>
              </button>
            </div>
          </div>

          <div class="cx-zone-head">
            <p class="cx-overline" aria-hidden="true">Cambiar zona</p>
            <div v-show="zonaDesborda" class="cx-scroll-btns">
              <button type="button" class="cx-scroll-btn" aria-label="Ver zonas anteriores" :disabled="!zonaPuedeAtras" @click="desplazarZonas(-1)">
                <ChevronLeft :size="20" aria-hidden="true" />
              </button>
              <button type="button" class="cx-scroll-btn" aria-label="Ver más zonas" :disabled="!zonaPuedeAdelante" @click="desplazarZonas(1)">
                <ChevronRight :size="20" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div ref="zonaScroller" data-test="zone-scroller" role="group" aria-label="Cambiar zona" class="cx-scroll-x cx-zone-scroller" @scroll.passive="actualizarScrollZonas">
            <button
              v-for="z in store.zonas" :key="z.id"
              type="button"
              class="cx-chip"
              :class="{ 'cx-chip-selected': store.zonaSeleccionada === z.id }"
              :aria-pressed="store.zonaSeleccionada === z.id"
              @click="seleccionarZona(z.id)"
            >
              <Check v-if="store.zonaSeleccionada === z.id" :size="16" aria-hidden="true" />
              {{ z.nombre }}
              <span class="cx-price-old" style="text-decoration: none; color: inherit">B/ {{ z.tarifa.toFixed(2) }}</span>
            </button>
          </div>
        </div>

        <div class="cx-tile cx-tile-indigo cx-span-4 cx-stack" style="gap: 12px; justify-content: space-between" data-test="zone-summary">
          <p class="cx-overline">Envío a tu zona</p>
          <p class="cx-eta">B/ {{ store.zonaActual.tarifa.toFixed(2) }}</p>
          <p class="cx-small cx-soft">
            {{ store.zonaActual.distanciaKm }} km del centro · {{ comerciosAbiertos }} comercios abiertos
          </p>
        </div>
      </section>

      <!-- Vista Mapa Interactivo -->
      <div v-if="vistaActiva === 'mapa'" class="cx-stack">
        <div class="cx-tile cx-map">
          <div class="cx-map-inner">
            <CoverageMap
              modo="coverage"
              :zona-seleccionada="store.zonaSeleccionada"
              :comercios="store.comercios"
              altura="500px"
              @seleccionar-comercio="abrirTienda"
              @seleccionar-zona="alSeleccionarZonaDesdeMapa"
            />
          </div>
        </div>
        <p class="cx-small cx-soft" style="text-align: center">
          Toca una zona para filtrar comercios o un pin para ver su menú y calificación.
        </p>
      </div>

      <!-- Lista de comercios -->
      <div v-show="vistaActiva === 'grid'" class="cx-stack" style="gap: 24px">
        <div class="cx-stack">
          <div class="cx-row" style="gap: 12px">
            <div class="cx-field">
              <label for="stores-search" class="cx-sr-only">Buscar comercios</label>
              <Search :size="20" aria-hidden="true" />
              <input
                id="stores-search"
                v-model="busqueda"
                data-test="stores-search"
                type="search"
                class="cx-input"
                placeholder="Busca un comercio o un plato"
              />
            </div>
            <div class="cx-field cx-field-select">
              <label for="stores-sort" class="cx-sr-only">Ordenar comercios</label>
              <select id="stores-sort" v-model="orden" data-test="stores-sort" class="cx-input cx-select">
                <option value="relevancia">Ordenar: relevancia</option>
                <option value="rating">Ordenar: mejor calificados</option>
                <option value="nombre">Ordenar: nombre (A-Z)</option>
              </select>
              <ChevronDown :size="20" aria-hidden="true" />
            </div>
          </div>

          <div v-if="categoriasZona.length > 0" role="group" aria-label="Filtrar por categoría" class="cx-row">
            <button
              type="button"
              data-test="stores-category"
              class="cx-chip"
              :class="{ 'cx-chip-selected': categoriaSeleccionada === '' }"
              :aria-pressed="categoriaSeleccionada === ''"
              @click="categoriaSeleccionada = ''"
            >
              <Check v-if="categoriaSeleccionada === ''" :size="16" aria-hidden="true" />Todos
            </button>
            <button
              v-for="cat in categoriasZona"
              :key="cat"
              type="button"
              data-test="stores-category"
              class="cx-chip"
              :class="{ 'cx-chip-selected': categoriaSeleccionada === cat }"
              :aria-pressed="categoriaSeleccionada === cat"
              @click="categoriaSeleccionada = cat"
            >
              <Check v-if="categoriaSeleccionada === cat" :size="16" aria-hidden="true" />{{ cat }}
            </button>
          </div>
        </div>

        <div class="cx-stack">
          <div class="cx-row cx-row-between">
            <h2 class="cx-h2">Comercios</h2>
            <p class="cx-small cx-soft" role="status" data-test="stores-count">
              {{ comerciosFiltrados.length }} {{ comerciosFiltrados.length === 1 ? 'comercio' : 'comercios' }}
            </p>
          </div>

          <div v-if="comerciosFiltrados.length > 0" class="cx-cards" data-test="merchant-grid">
            <button
              v-for="(c, idx) in comerciosVisibles" :key="c.id"
              type="button"
              data-test="merchant-card"
              class="cx-tile cx-tile-interactive cx-merchant"
              :class="celdas[idx]"
              :disabled="!c.activo"
              :aria-disabled="!c.activo ? 'true' : undefined"
              @click="abrirTienda(c)"
            >
              <div class="cx-cover" :class="tonoPortada(idx)">
                <div class="cx-row cx-row-between" style="align-items: flex-start">
                  <span data-test="merchant-status" class="cx-badge" :class="estadoComercio(c).clase">
                    <component :is="estadoComercio(c).icono" :size="16" aria-hidden="true" />
                    {{ estadoComercio(c).texto }}
                  </span>
                  <span v-if="comercioTienePromos(c.id)" class="cx-badge cx-badge-promo" data-test="merchant-promo">
                    <Sparkles :size="16" aria-hidden="true" />
                    Promos
                  </span>
                </div>
                <span class="cx-cover-icon"><CommerceIcon :name="c.icono" class="w-7 h-7" /></span>
              </div>

              <div class="cx-merchant-body">
                <div class="cx-row cx-row-between" style="flex-wrap: nowrap; align-items: flex-start">
                  <h3 class="cx-h3">{{ c.nombre }}</h3>
                  <span class="cx-badge cx-badge-promo" style="flex: none" data-test="merchant-rating">
                    <Star :size="16" aria-hidden="true" />
                    <span class="cx-price-old" style="text-decoration: none; color: inherit; font-weight: 700">{{ formatRating(c.rating) }}</span>
                  </span>
                </div>
                <p class="cx-small cx-link" style="font-weight: 600">{{ c.tipo }}</p>
                <p class="cx-small cx-soft cx-clamp-2">{{ c.descripcion }}</p>
                <div class="cx-meta">
                  <span><Clock :size="16" aria-hidden="true" />{{ c.tiempoEntrega }}</span>
                  <span><Bike :size="16" aria-hidden="true" />B/ {{ store.zonaActual.tarifa.toFixed(2) }}</span>
                  <span v-if="c.horario">{{ c.horario.abre }} – {{ c.horario.cierra }}</span>
                </div>
              </div>
            </button>
          </div>

          <div v-if="comerciosRestantes > 0" class="cx-more">
            <button type="button" data-test="merchants-more" class="cx-btn cx-btn-secondary" @click="verMasComercios">
              {{ textoVerMas(comerciosRestantes, 'comercios') }}
            </button>
          </div>
          <p v-if="comerciosFiltrados.length > 0" class="cx-sr-only" role="status" aria-live="polite" data-test="stores-shown">
            Mostrando {{ comerciosVisibles.length }} de {{ comerciosFiltrados.length }} comercios
          </p>

          <div v-if="comerciosFiltrados.length === 0" data-test="stores-empty" class="cx-tile cx-empty">
            <span class="cx-empty-icon"><SearchX :size="32" aria-hidden="true" /></span>
            <h3 class="cx-h3">No encontramos comercios con esos filtros</h3>
            <p>Prueba con otro plato o cambia la categoría.</p>
            <button type="button" data-test="stores-clear-filters" class="cx-btn" @click="limpiarFiltros">Limpiar filtros</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
