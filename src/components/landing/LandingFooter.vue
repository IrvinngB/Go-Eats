<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { FOOTER_COPY as COPY, FOOTER_GROUPS as GROUPS } from './content'
import BrandLogo from './BrandLogo.vue'
</script>

<template>
  <!-- Plain lists, not a nav: the header holds the only navigation landmark. Anchors are plain <a href="#id">. -->
  <footer class="lp-band-indigo">
    <div class="mx-auto grid max-w-[1200px] gap-12 px-4 py-14 md:px-8 md:py-16 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-16">
      <div class="flex flex-col items-start gap-3">
        <BrandLogo variant="sobre-indigo" />
        <p class="m-0 max-w-xs text-base leading-relaxed" style="color: var(--lp-on-indigo-soft)">{{ COPY.tagline }}</p>
      </div>
      <div v-for="group in GROUPS" :key="group.id" class="flex flex-col gap-2">
        <p :id="group.id" class="lp-eyebrow m-0" style="color: var(--lp-on-indigo-soft)">{{ group.label }}</p>
        <ul class="m-0 flex list-none flex-col p-0" role="list" :aria-labelledby="group.id">
          <li v-for="link in group.links" :key="link.href">
            <a v-if="link.href.startsWith('#')" :href="link.href" class="lp-foot-link">{{ link.label }}</a>
            <RouterLink v-else :to="link.href" class="lp-foot-link">{{ link.label }}</RouterLink>
          </li>
        </ul>
      </div>
      <p
        data-test="footer-copyright"
        class="lp-foot-rule m-0 pt-8 text-sm lg:col-span-3"
        style="color: var(--lp-on-indigo-soft)"
      >{{ COPY.copyright }}</p>
    </div>
  </footer>
</template>
