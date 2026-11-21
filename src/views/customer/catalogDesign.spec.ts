import { describe, expect, it } from 'vitest'
import stores from './StoresView.vue?raw'
import detail from './StoreDetailView.vue?raw'

// The whole StoreDetailView template, cart drawer and checkout included (PR2 brought them into the scan).
const template = (src: string) => src.slice(src.indexOf('<template>'))
const views = { StoresView: template(stores), StoreDetailView: template(detail) }

describe('catalog views follow the Friendly Bento rules', () => {
  for (const [name, src] of Object.entries(views)) {
    describe(name, () => {
      it('is scoped to the light .cx catalog root', () => {
        expect(src).toMatch(/class="cx"/)
      })

      it('imports the catalog stylesheet', () => {
        expect(name === 'StoresView' ? stores : detail).toContain("components/catalog/catalog.css")
      })

      it('never puts white text on the primary fill', () => {
        expect(src).not.toMatch(/bg-brand[^"'`]*text-white|text-white[^"'`]*bg-brand/)
        expect(src).not.toMatch(/[\s"'`]btn-primary[\s"'`]/)
        expect(src).not.toMatch(/\btext-white\b/)
      })

      it('has no ad-hoc Tailwind radii, shadows, borders or translucency on the catalog', () => {
        expect(src).not.toMatch(/\brounded(-[\w[\]./]+)?\b/)
        expect(src).not.toMatch(/\bshadow(-[\w[\]./]+)?\b/)
        expect(src).not.toMatch(/\bborder(-[\w[\]./]+)?\b/)
        expect(src).not.toMatch(/bg-white\/|backdrop-|bg-gradient|\bblur\b/)
        expect(src).not.toMatch(/[\s"'`](card|btn-secondary|btn-primary)[\s"'`]/)
      })

      it('uses only Lucide stroke icons (no inline svg)', () => {
        expect(src).not.toMatch(/<svg/)
      })
    })
  }
})
