import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BentoGrid from './BentoGrid.vue'
import { tiles } from './tiles'

describe('BentoGrid', () => {
  const w = mount(BentoGrid)

  it('renders exactly six tiles with heading, text and icon', () => {
    const articles = w.findAll('article')
    expect(articles).toHaveLength(6)
    for (const a of articles) {
      expect(a.find('h2').text().length).toBeGreaterThan(0)
      expect(a.find('p').text().length).toBeGreaterThan(0)
      expect(a.find('svg[aria-hidden="true"]').exists()).toBe(true)
    }
  })

  it('covers the six topics in order', () => {
    expect(w.findAll('h2').map((h) => h.text())).toEqual([
      'Cómo funciona',
      'Cobertura',
      'Rapidez',
      'Seguimiento',
      'Costo de envío',
      'Descarga la app',
    ])
  })

  it('uses 2 / 4 / 12 columns with 12px / 16px gaps', () => {
    const cls = w.classes()
    expect(cls).toEqual(expect.arrayContaining(['grid', 'grid-cols-2', 'md:grid-cols-4', 'lg:grid-cols-12', 'gap-3', 'md:gap-4']))
  })

  it('each desktop row sums to 12 columns', () => {
    const lg = tiles.map((t) => Number(/lg:col-span-(\d+)/.exec(t.span)?.[1]))
    expect(lg.slice(0, 3).reduce((a, b) => a + b, 0)).toBe(12)
    expect(lg.slice(3).reduce((a, b) => a + b, 0)).toBe(12)
  })

  it('has at most two brand-tone tiles', () => {
    expect(tiles.filter((t) => t.tone === 'brand')).toHaveLength(2)
  })

  it('copy has no invented amounts, delivery minutes or payment brand names', () => {
    const text = w.text()
    expect(text).not.toMatch(/\d/)
    expect(text).not.toMatch(/\$|B\/\.|minutos|min\b|Yappy|Paguelo/i)
  })

  it('has no inline gradient', () => {
    expect(w.html()).not.toMatch(/gradient|blur/i)
  })
})
