<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ROLES } from './content'
</script>

<template>
  <!-- Merchants: indigo band, copy left, capabilities right. -->
  <section :id="ROLES.merchant.id" class="lp-band-indigo" aria-labelledby="lp-merchant-title">
    <div class="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-20">
      <div class="flex flex-col items-start gap-5">
        <p class="lp-eyebrow m-0" style="color: var(--lp-on-indigo-soft)">{{ ROLES.merchant.eyebrow }}</p>
        <h2 id="lp-merchant-title" class="lp-title m-0">{{ ROLES.merchant.title }}</h2>
        <p class="lp-lead m-0" style="color: var(--lp-on-indigo-soft)">{{ ROLES.merchant.lead }}</p>
        <RouterLink to="/login" class="lp-btn lp-btn-secondary" style="background: var(--lp-bg)">
          {{ ROLES.merchant.cta }}
        </RouterLink>
      </div>
      <ul class="m-0 flex list-none flex-col gap-8 p-0" role="list">
        <li v-for="point in ROLES.merchant.points" :key="point.title" class="flex items-start gap-4">
          <component :is="point.icon" :size="32" aria-hidden="true" class="mt-1 shrink-0" style="color: var(--lp-primary)" />
          <div class="flex flex-col gap-1">
            <h3 class="m-0 text-xl font-extrabold">{{ point.title }}</h3>
            <p class="m-0 text-base leading-relaxed" style="color: var(--lp-on-indigo-soft)">{{ point.text }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>

  <!-- Couriers: amber tint band, mirrored layout. -->
  <section :id="ROLES.courier.id" class="lp-band-amber-tint" aria-labelledby="lp-courier-title">
    <div class="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-20">
      <div class="flex flex-col items-start gap-5 lg:order-2">
        <p class="lp-eyebrow m-0" style="color: var(--lp-ink-soft)">{{ ROLES.courier.eyebrow }}</p>
        <h2 id="lp-courier-title" class="lp-title m-0">{{ ROLES.courier.title }}</h2>
        <p class="lp-lead m-0">{{ ROLES.courier.lead }}</p>
        <RouterLink to="/login" class="lp-btn lp-btn-secondary" style="background: var(--lp-bg)">
          {{ ROLES.courier.cta }}
        </RouterLink>
      </div>
      <ul class="m-0 flex list-none flex-col gap-8 p-0 lg:order-1" role="list">
        <li v-for="point in ROLES.courier.points" :key="point.title" class="flex items-start gap-4">
          <span class="lp-icon-disc" aria-hidden="true">
            <component :is="point.icon" :size="24" />
          </span>
          <div class="flex flex-col gap-1">
            <h3 class="m-0 text-xl font-extrabold">{{ point.title }}</h3>
            <p class="m-0 text-base leading-relaxed" style="color: var(--lp-ink-soft)">{{ point.text }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
