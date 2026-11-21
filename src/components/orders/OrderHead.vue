<script setup lang="ts">
import { computed } from 'vue'
import StatusChip from './StatusChip.vue'
import type { PedidoVista } from './types'

const props = defineProps<{ pedido: PedidoVista; chip?: boolean }>()

// Payment status comes from the API (latest payment of the order); legacy values fall back to raw text.
const PAGO_LABELS: Record<string, string> = { pagado: 'Pagado', pendiente: 'Pago pendiente', fallido: 'Pago fallido' }
const TONO_PAGO: Record<string, string> = { pagado: 'cx-pago-ok', fallido: 'cx-pago-bad' }

const pago = computed(() => (props.pedido.pagoEstado ? (PAGO_LABELS[props.pedido.pagoEstado] ?? props.pedido.pagoEstado) : ''))
const metodo = computed(() => (props.pedido.metodoPago === 'contr_entrega' ? 'Contra entrega' : 'Pago electrónico (simulado)'))
</script>

<template>
  <header class="cx-order-head">
    <div class="cx-order-main">
      <h3 class="cx-h3">{{ pedido.comercioNombre }}</h3>
      <p class="cx-caption cx-soft"><span class="cx-mono">{{ pedido.id }}</span> · {{ pedido.fecha }}</p>
      <StatusChip v-if="chip" :estado="pedido.estado" />
    </div>
    <div class="cx-order-total">
      <p class="cx-price" data-test="order-total">B/ {{ pedido.total.toFixed(2) }}</p>
      <p class="cx-caption cx-soft">{{ metodo }}</p>
      <p v-if="pago" data-test="estado-pago" class="cx-caption cx-pago" :class="TONO_PAGO[pedido.pagoEstado as string]">{{ pago }}</p>
    </div>
  </header>
</template>
