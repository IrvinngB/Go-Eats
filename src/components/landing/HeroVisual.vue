<script setup lang="ts">
import { Check, Store, Truck } from '@lucide/vue'
import { ESTADO_LABELS } from '../../mockData'

// Order progress shown in the mock: the third step is the current one.
const steps = ['confirmado', 'en preparación', 'en camino', 'entregado'] as const
const current = 2
const label = (key: (typeof steps)[number]) => ESTADO_LABELS[key]
</script>

<template>
  <div aria-hidden="true" class="relative mx-auto w-full max-w-[460px] px-6 py-10 sm:px-10">
    <slot>
      <!-- Flat geometric shapes behind the phone -->
      <span
        class="absolute left-1/2 top-1/2 aspect-square w-[94%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style="background: var(--lp-primary)"
      />
      <span class="absolute right-0 top-2 aspect-square w-[22%] rounded-full" style="background: var(--lp-amber)" />
      <span class="absolute bottom-6 left-0 aspect-square w-[16%] rounded-full" style="background: var(--lp-indigo)" />
      <span
        class="absolute left-2 top-4 aspect-square w-[14%] rounded-full"
        style="border: 6px solid var(--lp-bg)"
      />
      <span
        class="absolute bottom-1 right-4 aspect-square w-[13%] rotate-12 rounded-[12px]"
        style="background: var(--lp-bg)"
      />

      <!-- Phone UI mock -->
      <div class="lp-phone relative mx-auto w-full max-w-[14.5rem] sm:max-w-[17rem]">
        <div class="lp-phone-screen flex flex-col gap-2">
          <div class="flex items-center gap-3 px-2 py-2">
            <span
              class="inline-flex h-9 w-9 items-center justify-center rounded-full"
              style="background: var(--lp-amber-tint); color: var(--lp-ink)"
            >
              <Store :size="20" />
            </span>
            <span class="text-base font-extrabold">Tu pedido</span>
          </div>
          <div
            v-for="(key, i) in steps"
            :key="key"
            class="lp-phone-row"
            :data-current="i === current ? 'true' : 'false'"
          >
            <span
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              :style="
                i < current
                  ? 'background: var(--lp-primary); color: var(--lp-on-primary)'
                  : i === current
                    ? 'background: var(--lp-indigo); color: var(--lp-on-indigo)'
                    : 'border: 2px solid var(--lp-border)'
              "
            >
              <Check v-if="i < current" :size="16" />
              <Truck v-else-if="i === current" :size="16" />
            </span>
            <span>{{ label(key) }}</span>
          </div>
        </div>
      </div>
    </slot>
  </div>
</template>
