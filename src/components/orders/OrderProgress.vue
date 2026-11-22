<script setup lang="ts">
import { computed } from 'vue'
import { CADENA, estadoVisual } from '../../utils/orderStatus'

const props = defineProps<{ estado: string }>()

const visual = computed(() => estadoVisual(props.estado))
const total = CADENA.length

// Dots sit at the center of each of the equal segments and the fill ends on the current dot: (step + 0.5) / total.
const ancho = computed(() => `${((visual.value.paso + 0.5) / total) * 100}%`)

function posicion(i: number) {
  return `${((i + 0.5) / total) * 100}%`
}

function estadoDot(i: number): 'done' | 'current' | 'pending' {
  const p = visual.value.paso
  return i < p ? 'done' : i === p ? 'current' : 'pending'
}
</script>

<template>
  <div v-if="visual.paso >= 0" class="cx-progress">
    <!-- 8px pill; the step dots and the "Paso n de 6" text say where the order is, so the fill color is not the only signal. -->
    <div
      class="cx-progress-track"
      data-test="timeline-progress"
      role="progressbar"
      aria-label="Progreso del pedido"
      aria-valuemin="1"
      :aria-valuemax="total"
      :aria-valuenow="visual.paso + 1"
      :aria-valuetext="`${visual.pasoTexto}: ${visual.label}`"
    >
      <span class="cx-progress-fill" data-test="progress-fill" :style="{ width: ancho }" />
      <span
        v-for="(paso, i) in CADENA"
        :key="paso"
        class="cx-progress-dot"
        data-test="progress-dot"
        :data-state="estadoDot(i)"
        :style="{ left: posicion(i) }"
      />
    </div>
    <p class="cx-caption cx-soft">{{ visual.pasoTexto }}</p>
  </div>
</template>
