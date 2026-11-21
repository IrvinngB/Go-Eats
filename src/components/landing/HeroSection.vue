<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Check } from '@lucide/vue'
import HeroVisual from './HeroVisual.vue'
</script>

<template>
  <section class="lp-band-primary-tint overflow-hidden" aria-labelledby="lp-hero-title">
    <div
      class="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 md:px-8 md:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24"
    >
      <div class="flex flex-col items-start gap-6">
        <p
          class="m-0 rounded-full px-4 py-1.5 text-sm font-bold"
          style="background: var(--lp-bg); color: var(--lp-primary-text)"
        >
          Delivery de comercios locales
        </p>
        <h1 id="lp-hero-title" class="lp-display m-0">Pide a los comercios de tu zona</h1>
        <p class="lp-lead m-0">
          Descubre las tiendas que llegan a tu dirección, elige lo que necesitas y sigue el estado de tu pedido
          hasta tu puerta.
        </p>
        <div class="flex flex-wrap items-center gap-4">
          <RouterLink to="/tiendas" class="lp-btn">Pedir ahora</RouterLink>
          <RouterLink to="/login" class="lp-btn lp-btn-secondary" style="background: var(--lp-bg)">
            Iniciar sesión
          </RouterLink>
        </div>
        <p
          data-test="hero-note"
          class="m-0 inline-flex items-center gap-2 text-sm font-bold"
          style="color: var(--lp-ink-soft)"
        >
          <Check :size="16" aria-hidden="true" style="color: var(--lp-primary-text)" />Pagas en efectivo al recibir tu pedido.
        </p>
      </div>
      <HeroVisual />
    </div>
  </section>
</template>
