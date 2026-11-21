<script setup>
import { ref, computed } from 'vue'
import { useGoEatsStore } from '../../stores/useGoEatsStore'
import { useRouter } from 'vue-router'
import CommerceIcon from '../../components/CommerceIcon.vue'
import CoverageMap from '../../components/CoverageMap.vue'
import { MapPin, LayoutGrid, Map, Search, Clock, Bike, Sparkles } from '@lucide/vue'
import { extraerCategorias, filtrarYOrdenarComercios, tienePromocion } from '../../utils/catalog'

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

const PALETAS_BANNER = [
  'bg-emerald-500/15 text-emerald-700 border-emerald-500/20',
  'bg-amber-500/15 text-amber-700 border-amber-500/20',
  'bg-sky-500/15 text-sky-700 border-sky-500/20',
  'bg-rose-500/15 text-rose-700 border-rose-500/20',
]

function estiloBanner(idx) {
  return PALETAS_BANNER[idx % PALETAS_BANNER.length]
}

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
  <div class="mx-auto max-w-6xl px-4 py-6">
    <!-- Barra superior estilo Uber Eats / PedidosYa: Dirección/Zona + Buscador + Vista -->
    <div class="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="grid h-11 w-11 place-items-center rounded-2xl bg-brand-light text-brand">
            <MapPin class="h-5 w-5" />
          </span>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slatebody">Entregar en</p>
            <h1 class="text-xl font-extrabold text-ink sm:text-2xl">
              {{ store.zonaActual.nombre }}
              <span class="text-sm font-medium text-slatebody">· Explora comercios cerca de ti</span>
            </h1>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="hidden sm:flex items-center gap-3 rounded-2xl bg-canvas px-3.5 py-2 text-xs text-slatebody border border-line">
            <span class="flex items-center gap-1 font-semibold text-ink">
              <Bike class="h-3.5 w-3.5 text-brand" />
              Envío B/ {{ store.zonaActual.tarifa.toFixed(2) }}
            </span>
            <span>·</span>
            <span>{{ store.zonaActual.distanciaKm }} km</span>
            <span>·</span>
            <span>{{ store.comerciosPorZona.filter((c) => c.activo).length }} abiertos</span>
          </div>

          <!-- Switch de Vista Lista / Mapa -->
          <div class="inline-flex items-center rounded-2xl border border-line bg-canvas p-1">
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              :class="vistaActiva === 'grid' ? 'bg-brand text-white shadow-sm' : 'text-slatebody hover:text-ink'"
              @click="vistaActiva = 'grid'"
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              :class="vistaActiva === 'mapa' ? 'bg-brand text-white shadow-sm' : 'text-slatebody hover:text-ink'"
              @click="vistaActiva = 'mapa'"
            >
              <Map class="w-3.5 h-3.5" />
              <span>Mapa en Vivo</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Selector de zona horizontal tipo píldoras -->
      <div class="mt-4 -mx-2 px-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          v-for="z in store.zonas" :key="z.id"
          class="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150"
          :class="store.zonaSeleccionada === z.id ? 'bg-ink text-white border-ink shadow-sm' : 'bg-canvas text-ink border-line hover:border-brand/50'"
          @click="seleccionarZona(z.id)"
        >
          {{ z.nombre }}
          <span class="ml-1 opacity-75">B/ {{ z.tarifa.toFixed(2) }}</span>
        </button>
      </div>

      <!-- Buscador grande estilo app de delivery + Selector de orden -->
      <div v-show="vistaActiva === 'grid'" class="mt-4 flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-[240px]">
          <label for="stores-search" class="sr-only">Buscar comercios</label>
          <Search class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slatebody" />
          <input
            id="stores-search"
            v-model="busqueda"
            data-test="stores-search"
            type="search"
            class="w-full rounded-full border border-line bg-canvas pl-11 pr-4 py-2.5 text-sm text-ink placeholder:text-slatebody/75 focus:border-brand focus:bg-white focus:outline-none transition-colors"
            placeholder="¿Qué se te antoja hoy? Busca restaurantes o comidas…"
          />
        </div>
        <div>
          <label for="stores-sort" class="sr-only">Ordenar comercios</label>
          <select
            id="stores-sort"
            v-model="orden"
            data-test="stores-sort"
            class="rounded-full border border-line bg-canvas px-4 py-2.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
          >
            <option value="relevancia">Ordenar: Relevancia</option>
            <option value="rating">Ordenar: Mejor calificados ★</option>
            <option value="nombre">Ordenar: Nombre (A-Z)</option>
          </select>
        </div>
      </div>

      <!-- Chips de categorías estilo carrusel Uber Eats -->
      <div v-if="categoriasZona.length > 0" v-show="vistaActiva === 'grid'" class="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          data-test="stores-category"
          class="rounded-full border px-4 py-1.5 text-xs font-bold transition-all"
          :class="categoriaSeleccionada === '' ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-ink border-line hover:bg-canvas'"
          @click="categoriaSeleccionada = ''"
        >Todos</button>
        <button
          v-for="cat in categoriasZona"
          :key="cat"
          type="button"
          data-test="stores-category"
          class="rounded-full border px-4 py-1.5 text-xs font-bold transition-all"
          :class="categoriaSeleccionada === cat ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-ink border-line hover:bg-canvas'"
          @click="categoriaSeleccionada = cat"
        >{{ cat }}</button>
      </div>
    </div>

    <!-- Vista Mapa Interactivo -->
    <div v-if="vistaActiva === 'mapa'" class="mt-6 space-y-4">
      <CoverageMap
        modo="coverage"
        :zona-seleccionada="store.zonaSeleccionada"
        :comercios="store.comercios"
        altura="500px"
        @seleccionar-comercio="abrirTienda"
        @seleccionar-zona="alSeleccionarZonaDesdeMapa"
      />
      <p class="text-xs text-slatebody text-center">
        Haz clic en los polígonos de zona para filtrar comercios o en los pines para ver su menú y calificación.
      </p>
    </div>

    <!-- Grid de comercios estilo PedidosYa / Uber Eats -->
    <div v-show="vistaActiva === 'grid'" class="mt-6">
      <div v-if="comerciosFiltrados.length > 0" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="(c, idx) in comerciosFiltrados" :key="c.id"
          data-test="merchant-card"
          class="group card overflow-hidden p-0 text-left transition-all duration-200 hover:shadow-lg hover:border-brand/50 hover:-translate-y-0.5 disabled:opacity-65 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          :disabled="!c.activo"
          @click="abrirTienda(c)"
        >
          <!-- Portada visual del comercio -->
          <div class="relative h-32 w-full border-b border-line/60 px-4 py-3 flex flex-col justify-between" :class="estiloBanner(idx)">
            <div class="flex items-center justify-between gap-2 z-10">
              <span
                data-test="merchant-status"
                class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-sm"
                :class="c.activo ? 'bg-white text-emerald-700 border-emerald-200' : c.estadoAfiliacion === 'en_revision' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'"
              >
                {{ c.activo ? 'Abierto' : c.estadoAfiliacion === 'en_revision' ? 'En revisión' : 'Cerrado' }}
              </span>

              <span
                v-if="comercioTienePromos(c.id)"
                class="inline-flex items-center gap-1 rounded-full bg-amber-400 text-ink px-2.5 py-0.5 text-[11px] font-extrabold shadow-sm"
              >
                <Sparkles class="h-3 w-3" />
                Promos
              </span>
            </div>

            <!-- Ícono central grande tipo cover -->
            <div class="pointer-events-none absolute inset-0 grid place-items-center opacity-25 group-hover:scale-105 transition-transform">
              <CommerceIcon :name="c.icono" class="w-20 h-20" />
            </div>

            <div class="flex items-end justify-between z-10">
              <span class="grid place-items-center w-11 h-11 rounded-2xl bg-white text-brand shadow-sm border border-line/60">
                <CommerceIcon :name="c.icono" class="w-5 h-5" />
              </span>
              <span class="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-ink shadow-sm border border-line/60">
                <Clock class="h-3.5 w-3.5 text-brand" />
                {{ c.tiempoEntrega }}
              </span>
            </div>
          </div>

          <!-- Cuerpo de la tarjeta -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-base font-extrabold text-ink group-hover:text-brand-dark transition-colors">{{ c.nombre }}</h3>
              <span class="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-xs font-bold text-amber-700">
                ★ {{ c.rating }}
              </span>
            </div>

            <p class="text-xs font-semibold text-brand-dark mt-0.5">{{ c.tipo }}</p>
            <p class="text-xs text-slatebody mt-1.5 line-clamp-2">{{ c.descripcion }}</p>

            <div class="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-xs text-slatebody">
              <span class="inline-flex items-center gap-1 font-medium text-ink">
                <Bike class="h-3.5 w-3.5 text-brand" />
                Envío B/ {{ store.zonaActual.tarifa.toFixed(2) }}
              </span>
              <span v-if="c.horario" class="text-[11px]">
                {{ c.horario.abre }} – {{ c.horario.cierra }}
              </span>
            </div>
          </div>
        </button>
      </div>
      <div v-else data-test="stores-empty" class="card p-10 text-center">
        <p class="text-base font-bold text-ink">No encontramos comercios con esos filtros.</p>
        <p class="text-xs text-slatebody mt-1">Prueba buscando otro plato o cambiando la categoría seleccionada.</p>
        <button type="button" data-test="stores-clear-filters" class="btn-secondary mt-4 text-xs" @click="limpiarFiltros">Limpiar filtros</button>
      </div>
    </div>
  </div>
</template>
