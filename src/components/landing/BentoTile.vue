<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{ title: string; text: string; icon: Component; tone?: 'neutral' | 'brand'; span?: string }>(),
  { tone: 'neutral', span: '' },
)
</script>

<template>
  <article :class="['lp-tile', 'flex flex-col gap-3 p-5 md:p-6', { 'lp-tile-brand': tone === 'brand' }, span]">
    <span class="lp-icon-chip">
      <component :is="icon" :size="24" aria-hidden="true" />
    </span>
    <h2 class="text-xl font-extrabold">{{ title }}</h2>
    <p style="color: var(--lp-ink-soft)">{{ text }}</p>
  </article>
</template>
