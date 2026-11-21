<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import colorUrl from '../../assets/brand/go-eats-wordmark-color.svg'
import sobreIndigoUrl from '../../assets/brand/go-eats-wordmark-sobre-indigo.svg'

const props = withDefaults(defineProps<{ variant?: 'color' | 'sobre-indigo' }>(), { variant: 'color' })

// Intrinsic sizes come from each SVG viewBox (sobre-indigo carries a 40px padded rect).
const asset = computed(() =>
  props.variant === 'sobre-indigo'
    ? { src: sobreIndigoUrl, width: 631, height: 330 }
    : { src: colorUrl, width: 551, height: 250 },
)
</script>

<template>
  <RouterLink to="/" class="inline-flex min-h-[44px] items-center">
    <img :src="asset.src" alt="Go Eats" :width="asset.width" :height="asset.height" class="h-10 w-auto" />
  </RouterLink>
</template>
