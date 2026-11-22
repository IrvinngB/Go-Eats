<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CTA_COPY as COPY } from './content'
</script>

<template>
  <section class="lp-band-primary-tint" aria-labelledby="lp-cta-title">
    <div class="mx-auto flex max-w-[1200px] flex-col items-center gap-8 px-4 py-16 text-center md:px-8 md:py-24">
      <div class="flex max-w-2xl flex-col items-center gap-4">
        <h2 id="lp-cta-title" class="lp-title m-0">{{ COPY.title }}</h2>
        <p class="lp-lead m-0">{{ COPY.lead }}</p>
      </div>
      <div class="flex flex-wrap items-center justify-center gap-4">
        <RouterLink to="/tiendas" class="lp-btn">{{ COPY.primary }}</RouterLink>
        <RouterLink to="/login" class="lp-btn lp-btn-secondary" style="background: var(--lp-bg)">{{ COPY.secondary }}</RouterLink>
      </div>
    </div>
  </section>
</template>
