<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { FAQ_COPY as COPY, FAQ_ITEMS as ITEMS } from './content'

// Single-open accordion: one id or none. Native buttons give Enter and Space for free.
const openId = ref<string | null>(null)

function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <section id="preguntas" class="lp-band-bg" aria-labelledby="lp-faq-title">
    <div class="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
      <div class="flex flex-col items-start gap-4 lg:sticky lg:top-24 lg:self-start">
        <p class="lp-eyebrow m-0" style="color: var(--lp-primary-text)">{{ COPY.eyebrow }}</p>
        <h2 id="lp-faq-title" class="lp-title m-0">{{ COPY.title }}</h2>
        <p class="lp-lead m-0">{{ COPY.lead }}</p>
      </div>
      <div class="lp-faq">
        <div v-for="item in ITEMS" :key="item.id" class="lp-faq-item">
          <h3 class="m-0">
            <button
              :id="`lp-faq-q-${item.id}`"
              type="button"
              class="lp-faq-trigger"
              :aria-expanded="openId === item.id ? 'true' : 'false'"
              :aria-controls="`lp-faq-a-${item.id}`"
              @click="toggle(item.id)"
            >
              <span>{{ item.q }}</span>
              <ChevronDown :size="24" aria-hidden="true" class="lp-faq-icon shrink-0" />
            </button>
          </h3>
          <div
            :id="`lp-faq-a-${item.id}`"
            role="region"
            :aria-labelledby="`lp-faq-q-${item.id}`"
            :hidden="openId !== item.id"
          >
            <p class="m-0 pb-6 pr-10 text-base leading-relaxed md:text-lg" style="color: var(--lp-ink-soft)">{{ item.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
