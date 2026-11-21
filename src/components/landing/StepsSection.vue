<script setup lang="ts">
import { STEPS } from './content'
</script>

<template>
  <section id="como-funciona" class="lp-band-surface" aria-labelledby="lp-steps-title">
    <div class="mx-auto max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
      <div class="mb-12 flex max-w-2xl flex-col gap-3 md:mb-16">
        <p class="lp-eyebrow m-0" style="color: var(--lp-primary-text)">Pedir en Go Eats</p>
        <h2 id="lp-steps-title" class="lp-title m-0">Así funciona</h2>
        <p class="lp-lead m-0">De la tienda a tu puerta en cuatro pasos.</p>
      </div>
      <ol class="lp-steps m-0 grid list-none gap-10 p-0 lg:grid-cols-4 lg:gap-8" role="list">
        <li v-for="step in STEPS" :key="step.n" class="lp-step">
          <span class="lp-step-number" data-test="step-number" aria-hidden="true">{{ step.n }}</span>
          <div class="flex flex-col gap-2">
            <component :is="step.icon" :size="28" aria-hidden="true" style="color: var(--lp-primary-text)" />
            <h3 class="m-0 text-xl font-extrabold leading-snug md:text-2xl">{{ step.title }}</h3>
            <p class="m-0 text-base leading-relaxed" style="color: var(--lp-ink-soft)">{{ step.text }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
