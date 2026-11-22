<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Star } from '@lucide/vue'

const props = defineProps<{ modelValue: number; label: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const grupo = ref<HTMLElement | null>(null)
const anuncio = ref('')

// Radiogroup of real buttons: the checked one is the single tab stop, arrows move AND select (WAI-ARIA radio pattern).
function elegir(n: number, enfocar = false) {
  emit('update:modelValue', n)
  anuncio.value = `${props.label}: ${n} de 5 estrellas`
  if (enfocar) nextTick(() => grupo.value?.querySelectorAll<HTMLElement>('[role="radio"]')[n - 1]?.focus())
}

function alTeclear(e: KeyboardEvent) {
  const actual = props.modelValue || 1
  let destino: number | null = null
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') destino = actual === 5 ? 1 : actual + 1
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') destino = actual === 1 ? 5 : actual - 1
  else if (e.key === 'Home') destino = 1
  else if (e.key === 'End') destino = 5
  if (destino === null) return // Space and Enter keep their native button click
  e.preventDefault()
  elegir(destino, true)
}
</script>

<template>
  <div class="cx-stars-wrap">
    <div ref="grupo" class="cx-stars" role="radiogroup" :aria-label="label" @keydown="alTeclear">
      <button
        v-for="n in 5"
        :key="n"
        type="button"
        role="radio"
        class="cx-star"
        :aria-checked="modelValue === n ? 'true' : 'false'"
        :aria-label="`${n} de 5 estrellas`"
        :tabindex="(modelValue || 1) === n ? 0 : -1"
        :data-lleno="n <= modelValue ? 'true' : 'false'"
        @click="elegir(n)"
      >
        <Star :size="28" aria-hidden="true" />
      </button>
    </div>
    <span class="cx-sr-only" aria-live="polite">{{ anuncio }}</span>
  </div>
</template>
