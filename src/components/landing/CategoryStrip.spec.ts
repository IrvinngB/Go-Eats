import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryStrip from './CategoryStrip.vue'
import { CATEGORIES } from './content'

describe('CategoryStrip', () => {
  it('lists every category name as a chip, in order', () => {
    const w = mount(CategoryStrip)
    expect(w.findAll('[data-test="category-chip"]').map((c) => c.text())).toEqual(CATEGORIES.map((c) => c.name))
  })

  it('draws one decorative Lucide icon per chip', () => {
    const w = mount(CategoryStrip)
    const chips = w.findAll('[data-test="category-chip"]')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      const svg = chip.find('svg')
      expect(svg.exists()).toBe(true)
      expect(svg.attributes('aria-hidden')).toBe('true')
    }
  })

  it('shows no digits and no counts', () => {
    expect(mount(CategoryStrip).text()).not.toMatch(/\d/)
  })

  it('is static: no link, button or tab stop', () => {
    const w = mount(CategoryStrip)
    expect(w.findAll('a, button, [tabindex], [role="button"], [role="link"]')).toHaveLength(0)
  })

  it('is a labelled section with a list of chips', () => {
    const w = mount(CategoryStrip)
    expect(w.element.tagName).toBe('SECTION')
    expect(w.attributes('aria-label')).toBe('Tipos de comercio')
    expect(w.findAll('ul > li')).toHaveLength(CATEGORIES.length)
  })

  it('sits on the white band and has no heading to break the outline', () => {
    const w = mount(CategoryStrip)
    expect(w.classes()).toContain('lp-band-bg')
    expect(w.findAll('h1, h2, h3')).toHaveLength(0)
  })
})
