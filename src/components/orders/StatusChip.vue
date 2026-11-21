<script setup lang="ts">
import { computed } from 'vue'
import { Bike, ChefHat, CircleCheck, CircleQuestionMark, CircleX, Receipt, UserCheck } from '@lucide/vue'
import { estadoVisual, type IconoEstado } from '../../utils/orderStatus'

const props = defineProps<{ estado: string }>()

const ICONOS: Record<IconoEstado, unknown> = {
  receipt: Receipt,
  'chef-hat': ChefHat,
  'user-check': UserCheck,
  bike: Bike,
  'circle-check': CircleCheck,
  'circle-x': CircleX,
  'circle-question-mark': CircleQuestionMark,
}

const visual = computed(() => estadoVisual(props.estado))
</script>

<template>
  <!-- Status is never color alone: icon + text + tone (desing.md "Status chips"). -->
  <span class="cx-estado" :class="`cx-estado-${visual.tone}`" :data-estado="visual.estado">
    <component :is="ICONOS[visual.icon]" :size="16" aria-hidden="true" />
    {{ visual.label }}
  </span>
</template>
