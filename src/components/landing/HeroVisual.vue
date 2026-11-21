<script setup lang="ts">
import { Bike } from '@lucide/vue'
</script>

<template>
  <div class="flex items-center justify-center">
    <slot>
      <span class="lp-icon-chip" style="width: 9rem; height: 9rem">
        <Bike :size="72" aria-hidden="true" />
      </span>
    </slot>
  </div>
</template>
