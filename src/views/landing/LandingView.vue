<script setup lang="ts">
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '../../components/landing/landing.css'
import LandingNav from '../../components/landing/LandingNav.vue'
import HeroSection from '../../components/landing/HeroSection.vue'
import CategoryStrip from '../../components/landing/CategoryStrip.vue'
import StepsSection from '../../components/landing/StepsSection.vue'
import StoresSection from '../../components/landing/StoresSection.vue'
import CoverageSection from '../../components/landing/CoverageSection.vue'
import RolePanels from '../../components/landing/RolePanels.vue'
import BrandLogo from '../../components/landing/BrandLogo.vue'
import { useLandingData } from '../../composables/useLandingData'

// One fetch for the whole page: stores and zones share this composable, sections only receive props.
const { estado, loading, tiendas, zonas, zonasError } = useLandingData()
</script>

<template>
  <div class="landing min-h-screen">
    <LandingNav />
    <main id="contenido" tabindex="-1">
      <HeroSection />
      <CategoryStrip />
      <StepsSection />
      <StoresSection :estado="estado" :tiendas="tiendas" />
      <CoverageSection :zonas="zonas" :zonas-error="zonasError" :cargando="loading" />
      <!-- WU6-7 add install, FAQ and the CTA band after the roles. -->
      <RolePanels />
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
