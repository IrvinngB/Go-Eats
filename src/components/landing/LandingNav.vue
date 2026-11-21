<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BrandLogo from './BrandLogo.vue'

// Anchors target sections added by later work units; they are hidden below md.
const anchors = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#cobertura', label: 'Cobertura' },
  { href: '#preguntas', label: 'Preguntas' },
]

function skipToContent() {
  document.getElementById('contenido')?.focus()
}
</script>

<template>
  <a href="#contenido" class="lp-skip" @click.prevent="skipToContent">Saltar al contenido</a>
  <header class="lp-band-bg sticky top-0 z-40" style="border-bottom: 1px solid var(--lp-border)">
    <nav aria-label="Principal" class="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:px-8">
      <BrandLogo variant="color" />
      <ul class="m-0 hidden list-none items-center gap-1 p-0 md:flex">
        <li v-for="a in anchors" :key="a.href">
          <a :href="a.href" class="lp-nav-link">{{ a.label }}</a>
        </li>
      </ul>
      <RouterLink to="/login" class="lp-btn lp-btn-secondary">Iniciar sesión</RouterLink>
    </nav>
  </header>
</template>
