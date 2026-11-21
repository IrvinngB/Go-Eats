<script setup lang="ts">
import { CATEGORIES } from './content'
</script>

<template>
  <section class="lp-band-bg" aria-label="Tipos de comercio">
    <div class="mx-auto max-w-[1200px] px-4 py-10 md:px-8 md:py-12">
      <ul class="m-0 flex list-none flex-wrap justify-center gap-3 p-0" role="list">
        <li
          v-for="category in CATEGORIES"
          :key="category.name"
          data-test="category-chip"
          class="lp-chip"
        >
          <component :is="category.icon" :size="20" aria-hidden="true" style="color: var(--lp-primary-text)" />
          {{ category.name }}
        </li>
      </ul>
    </div>
  </section>
</template>
