<script setup lang="ts">
import { ChevronDown, MapPin } from '@lucide/vue'
import type { PedidoVista } from './types'

defineProps<{ pedido: PedidoVista }>()
</script>

<template>
  <details class="cx-details">
    <summary class="cx-details-sum">
      <span>Ver detalle del pedido</span>
      <ChevronDown :size="20" aria-hidden="true" />
    </summary>
    <div class="cx-details-body">
      <ul v-if="pedido.items.length" class="cx-details-list">
        <li v-for="(it, i) in pedido.items" :key="i" class="cx-details-row">
          <span>{{ it.cantidad }}× {{ it.nombre }}<em v-if="it.observacion" class="cx-details-note"> — {{ it.observacion }}</em></span>
          <span class="cx-tabular">B/ {{ (it.cantidad * it.precio).toFixed(2) }}</span>
        </li>
      </ul>
      <p class="cx-small cx-soft cx-details-address">
        <MapPin :size="16" aria-hidden="true" />
        <span>Dir.: {{ pedido.direccion }}</span>
      </p>
      <slot />
    </div>
  </details>
</template>
