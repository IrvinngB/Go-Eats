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
import InstallSection from '../../components/landing/InstallSection.vue'
import FaqSection from '../../components/landing/FaqSection.vue'
import CtaBand from '../../components/landing/CtaBand.vue'
import LandingFooter from '../../components/landing/LandingFooter.vue'
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
      <RolePanels />
      <InstallSection />
      <FaqSection />
      <CtaBand />
    </main>
    <LandingFooter />
  </div>
</template>
