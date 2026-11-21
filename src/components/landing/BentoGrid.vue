<script setup lang="ts">
import BentoTile from './BentoTile.vue'
import { tiles } from './tiles'
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-12">
    <BentoTile v-for="t in tiles" :key="t.key" :title="t.title" :text="t.text" :icon="t.icon" :tone="t.tone" :span="t.span" />
  </div>
</template>
