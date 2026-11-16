<script setup>
import { ESTADO_BADGES, ESTADO_LABELS } from '../mockData'

defineProps({
  estado: { type: String, required: true },
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
    :class="ESTADO_BADGES[estado] || 'bg-gray-100 text-gray-600 border-gray-200'"
  >
    {{ ESTADO_LABELS[estado] || estado }}
  </span>
</template>
