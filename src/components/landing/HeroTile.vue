<script setup lang="ts">
import { RouterLink } from 'vue-router'
import HeroVisual from './HeroVisual.vue'
</script>

<template>
  <section class="lp-hero grid items-center gap-6 p-6 md:p-10 lg:grid-cols-2" aria-labelledby="lp-hero-title">
    <div class="flex flex-col items-start gap-4">
      <h1 id="lp-hero-title" class="lp-display">Pide a los comercios de tu zona</h1>
      <p class="text-lg" style="color: var(--lp-ink-soft)">
        Descubre las tiendas que llegan a tu dirección, elige lo que necesitas y recibe tu pedido en casa.
      </p>
      <div class="flex flex-wrap gap-3">
        <RouterLink to="/tiendas" class="lp-btn">Pedir ahora</RouterLink>
        <RouterLink to="/login" class="lp-btn lp-btn-secondary">Iniciar sesión</RouterLink>
      </div>
    </div>
    <HeroVisual />
  </section>
</template>
