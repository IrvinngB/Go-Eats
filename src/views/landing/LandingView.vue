<script setup lang="ts">
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '../../components/landing/landing.css'
import LandingNav from '../../components/landing/LandingNav.vue'
import HeroSection from '../../components/landing/HeroSection.vue'
import BrandLogo from '../../components/landing/BrandLogo.vue'
</script>

<template>
  <div class="landing min-h-screen">
    <LandingNav />
    <main id="contenido" tabindex="-1">
      <HeroSection />
      <!-- WU4+ add the category strip, steps, stores, coverage, roles, install, FAQ and CTA band here. -->
    </main>
    <!-- Minimal footer; WU7 replaces it with LandingFooter. -->
    <footer class="lp-band-indigo">
      <div class="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-12 md:px-8">
        <BrandLogo variant="sobre-indigo" />
        <p class="m-0 text-sm" style="color: var(--lp-on-indigo-soft)">Go Eats. Comercios de tu zona, en tu puerta.</p>
      </div>
    </footer>
  </div>
</template>
