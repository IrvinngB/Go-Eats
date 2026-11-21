<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { MapPin } from '@lucide/vue'
import { COVERAGE_COPY } from './content'
import type { Zona } from '../../composables/useLandingData'

const props = defineProps<{ zonas: Zona[]; zonasError: boolean; cargando: boolean }>()

// Own chunk: Leaflet, its CSS and the zone data only load once the section nears the viewport.
const CoverageMap = defineAsyncComponent(() => import('../CoverageMap.vue'))

// No IntersectionObserver means chips only: the map never loads without a viewport signal.
const soportaObserver = typeof IntersectionObserver !== 'undefined'
const hayZonas = computed(() => !props.zonasError && props.zonas.length > 0)
const mostrarFallback = computed(() => !props.cargando && !hayZonas.value)
const mapaReservado = computed(() => soportaObserver && (props.cargando || hayZonas.value))

const envoltorio = ref<HTMLElement | null>(null)
const mapaVisible = ref(false)
let observer: IntersectionObserver | null = null

function detener() {
  observer?.disconnect()
  observer = null
}

watch(envoltorio, (el) => {
  detener()
  if (!el || mapaVisible.value || !soportaObserver) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        mapaVisible.value = true
        detener()
      }
    },
    { rootMargin: '200px' },
  )
  observer.observe(el)
})

onBeforeUnmount(detener)
</script>

<template>
  <section id="cobertura" class="lp-band-surface" aria-labelledby="lp-coverage-title">
    <div
      class="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-16 md:px-8 md:py-24 lg:gap-16"
      :class="{ 'lg:grid-cols-[5fr_7fr]': mapaReservado }"
    >
      <div class="flex flex-col gap-8">
        <div class="flex max-w-xl flex-col gap-3">
          <p class="lp-eyebrow m-0" style="color: var(--lp-primary-text)">{{ COVERAGE_COPY.eyebrow }}</p>
          <h2 id="lp-coverage-title" class="lp-title m-0">{{ COVERAGE_COPY.title }}</h2>
          <p class="lp-lead m-0">{{ COVERAGE_COPY.lead }}</p>
        </div>

        <div v-if="hayZonas" class="flex flex-col gap-4">
          <p id="lp-coverage-zones" class="m-0 text-base font-extrabold" style="color: var(--lp-ink-soft)">
            {{ COVERAGE_COPY.chipsLabel }}
          </p>
          <ul class="m-0 flex list-none flex-wrap gap-3 p-0" role="list" aria-labelledby="lp-coverage-zones">
            <li v-for="zona in zonas" :key="zona.id" data-test="zone-chip" class="lp-chip lp-chip-on-surface">
              <MapPin :size="18" aria-hidden="true" style="color: var(--lp-primary-text)" />
              {{ zona.name }}
            </li>
          </ul>
        </div>

        <div v-else-if="mostrarFallback" data-test="coverage-fallback" class="lp-store-fallback lp-store-fallback-on-surface max-w-xl">
          <span class="lp-store-icon">
            <MapPin :size="28" aria-hidden="true" style="color: var(--lp-primary-text)" />
          </span>
          <p class="m-0 text-lg leading-relaxed">{{ zonasError ? COVERAGE_COPY.error : COVERAGE_COPY.empty }}</p>
        </div>
      </div>

      <div
        v-if="mapaReservado"
        ref="envoltorio"
        data-test="map-wrapper"
        role="img"
        :aria-label="COVERAGE_COPY.mapLabel"
        class="lp-map-frame"
      >
        <CoverageMap v-if="mapaVisible && hayZonas" estatico altura="100%" />
      </div>
    </div>
  </section>
</template>
