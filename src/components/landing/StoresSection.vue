<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { MapPin, Store } from '@lucide/vue'
import { STORES_COPY } from './content'
import { resolveStoreIcon } from './storeIcons'
import type { LandingEstado, Tienda } from '../../composables/useLandingData'

defineProps<{ estado: LandingEstado; tiendas: Tienda[] }>()
</script>

<template>
  <section id="tiendas" class="lp-band-bg" aria-labelledby="lp-stores-title">
    <div class="mx-auto max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
      <div class="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
        <div class="flex max-w-2xl flex-col gap-3">
          <p class="lp-eyebrow m-0" style="color: var(--lp-primary-text)">{{ STORES_COPY.eyebrow }}</p>
          <h2 id="lp-stores-title" class="lp-title m-0">{{ STORES_COPY.title }}</h2>
          <p class="lp-lead m-0">{{ STORES_COPY.lead }}</p>
        </div>
        <RouterLink to="/tiendas" class="lp-btn lp-btn-secondary self-start md:self-auto">{{ STORES_COPY.cta }}</RouterLink>
      </div>

      <div v-if="estado === 'loading'" aria-busy="true">
        <p role="status" class="sr-only">{{ STORES_COPY.loading }}</p>
        <ul class="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6" role="list" aria-hidden="true">
          <li v-for="n in 3" :key="n" data-test="store-skeleton" class="lp-store-tile lp-store-skeleton">
            <span class="lp-store-icon lp-store-bone"></span>
            <span class="flex w-full flex-1 flex-col gap-3">
              <span class="lp-store-bone lp-store-bone-line"></span>
              <span class="lp-store-bone lp-store-bone-line lp-store-bone-short"></span>
            </span>
          </li>
        </ul>
      </div>

      <ul
        v-else-if="estado === 'ready'"
        class="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
        role="list"
      >
        <li v-for="tienda in tiendas" :key="tienda.id" data-test="store-tile" class="lp-store-tile">
          <span class="lp-store-icon">
            <component :is="resolveStoreIcon(tienda.icon)" :size="28" aria-hidden="true" style="color: var(--lp-primary-text)" />
          </span>
          <div class="flex min-w-0 flex-col gap-1">
            <h3 class="m-0 text-xl font-extrabold leading-snug">{{ tienda.name }}</h3>
            <p class="m-0 text-base" style="color: var(--lp-ink-soft)">{{ tienda.category }}</p>
            <p class="m-0 mt-2 flex items-center gap-1.5 text-base font-bold" style="color: var(--lp-ink-soft)">
              <MapPin :size="16" aria-hidden="true" class="shrink-0" />
              {{ tienda.zoneName }}
            </p>
          </div>
        </li>
      </ul>

      <div v-else data-test="stores-fallback" class="lp-store-fallback">
        <span class="lp-store-icon">
          <Store :size="28" aria-hidden="true" style="color: var(--lp-primary-text)" />
        </span>
        <p class="m-0 text-lg leading-relaxed">{{ estado === 'empty' ? STORES_COPY.empty : STORES_COPY.error }}</p>
      </div>
    </div>
  </section>
</template>
