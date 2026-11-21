<script setup lang="ts">
import { RouterLink } from 'vue-router'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '../../components/landing/landing.css'
import HeroTile from '../../components/landing/HeroTile.vue'
import BentoGrid from '../../components/landing/BentoGrid.vue'
</script>

<template>
  <div class="landing min-h-screen">
    <header class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
      <span class="text-xl font-extrabold">Go Eats</span>
      <nav aria-label="Principal">
        <RouterLink to="/login" class="lp-link">Iniciar sesión</RouterLink>
      </nav>
    </header>
    <main class="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-8 md:gap-4">
      <HeroTile />
      <BentoGrid />
    </main>
    <footer class="mx-auto max-w-6xl px-4 py-6 text-sm" style="color: var(--lp-ink-faint)">
      <p>Go Eats. Comercios de tu zona, en tu puerta.</p>
    </footer>
  </div>
</template>
