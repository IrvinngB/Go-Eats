<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { ESTADO_LABELS } from '../../mockData'
import { CADENA, estadoVisual } from '../../utils/orderStatus'

const props = defineProps<{ estado: string; fecha?: string }>()

const actual = computed(() => estadoVisual(props.estado).paso)

function estadoPaso(i: number): 'done' | 'current' | 'pending' {
  return i < actual.value ? 'done' : i === actual.value ? 'current' : 'pending'
}

// The API only gives the creation date of the order. It labels the first step; no other time is invented.
function hora(i: number): string {
  if (i === 0 && props.fecha) return props.fecha
  return i === actual.value ? 'Estado actual' : ''
}
</script>

<template>
  <ol v-if="actual >= 0" class="cx-steps" aria-label="Progreso del pedido">
    <li
      v-for="(paso, i) in CADENA"
      :key="paso"
      class="cx-step"
      data-test="timeline-step"
      :data-state="estadoPaso(i)"
      :aria-current="i === actual ? 'step' : undefined"
    >
      <span class="cx-step-dot">
        <Check v-if="i < actual" :size="16" :stroke-width="3" data-test="step-check" aria-hidden="true" />
        <span v-else class="cx-step-num">{{ i + 1 }}</span>
      </span>
      <span class="cx-step-text">
        <span class="cx-step-title">{{ ESTADO_LABELS[paso] }}</span>
        <span v-if="hora(i)" class="cx-step-time">{{ hora(i) }}</span>
      </span>
    </li>
  </ol>
</template>
