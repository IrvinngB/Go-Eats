<script setup lang="ts">
import { ChevronRight, Store } from '@lucide/vue'
import { useInstallPrompt } from '../../composables/useInstallPrompt'
import { INSTALL_COPY as COPY } from './content'

// Same singleton as the floating PwaStatus banner (which hides itself on the landing).
const { canInstall, installed, isIos, install } = useInstallPrompt()

// Home-screen layout: nine app tiles (the Go Eats one is at index 4) and a dock. Flat tones, decorative.
const tones = ['var(--lp-primary-tint)', 'var(--lp-amber-tint)', 'var(--lp-surface-strong)', 'var(--lp-amber-tint)', '', 'var(--lp-primary-tint)', 'var(--lp-surface-strong)', 'var(--lp-primary-tint)', 'var(--lp-amber-tint)'] as const
</script>

<template>
  <section v-if="!installed" id="instalar" class="lp-band-surface" aria-labelledby="lp-install-title">
    <div class="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-20">
      <div class="flex flex-col items-start gap-5">
        <p class="lp-eyebrow m-0" style="color: var(--lp-primary-text)">{{ COPY.eyebrow }}</p>
        <h2 id="lp-install-title" class="lp-title m-0">{{ COPY.title }}</h2>
        <p class="lp-lead m-0">{{ COPY.lead }}</p>

        <button v-if="canInstall" type="button" class="lp-btn lp-btn-secondary" style="background: var(--lp-bg)" @click="install()">
          {{ COPY.cta }}
        </button>
        <div v-else-if="isIos" data-test="install-ios" class="flex flex-col gap-2 text-base font-bold">
          <p class="m-0" style="color: var(--lp-ink-soft)">{{ COPY.iosIntro }}</p>
          <p class="m-0 flex flex-wrap items-center gap-x-1 gap-y-1 text-lg">
            <span>{{ COPY.iosShare }}</span>
            <ChevronRight :size="20" aria-label="y luego" role="img" />
            <span>{{ COPY.iosAdd }}</span>
          </p>
        </div>
        <p v-else data-test="install-neutral" class="m-0 max-w-xl text-base leading-relaxed" style="color: var(--lp-ink-soft)">
          {{ COPY.neutral }}
        </p>
      </div>

      <!-- Decorative: a phone home screen with the Go Eats tile, flat shapes only. -->
      <div data-test="install-visual" aria-hidden="true" class="relative mx-auto w-full max-w-[320px] px-6 py-8">
        <span class="absolute left-1/2 top-1/2 aspect-square w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full" style="background: var(--lp-primary-tint)" />
        <span class="absolute right-2 top-2 aspect-square w-[20%] rounded-full" style="background: var(--lp-amber)" />
        <div class="lp-phone relative mx-auto w-full max-w-[12rem]">
          <div class="lp-phone-screen flex min-h-[22rem] flex-col justify-between gap-4 px-3 pb-3 pt-5">
            <div class="grid grid-cols-3 gap-x-3 gap-y-4">
              <template v-for="(tone, i) in tones" :key="i">
                <span v-if="i !== 4" class="aspect-square rounded-[16px]" :style="{ background: tone }" />
                <span v-else class="flex flex-col items-center gap-1">
                  <span class="flex aspect-square w-full items-center justify-center rounded-[16px]" style="background: var(--lp-primary); color: var(--lp-on-primary)">
                    <Store :size="28" />
                  </span>
                  <span class="text-[11px] font-extrabold leading-none">Go Eats</span>
                </span>
              </template>
            </div>
            <div class="grid grid-cols-4 gap-3 rounded-[16px] p-2" style="background: var(--lp-surface)">
              <span v-for="n in 4" :key="n" class="aspect-square rounded-[12px]" style="background: var(--lp-surface-strong)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
