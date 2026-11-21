import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HeroVisual from './HeroVisual.vue'

describe('HeroVisual', () => {
  it('is decorative: the root is hidden from assistive technology', () => {
    const w = mount(HeroVisual)
    expect(w.attributes('aria-hidden')).toBe('true')
  })

  it('renders the phone mock with the four order statuses from ESTADO_LABELS, in order', () => {
    const w = mount(HeroVisual)
    const labels = w.findAll('.lp-phone-row').map((r) => r.text())
    expect(labels).toEqual(['Confirmado', 'En preparación', 'En camino', 'Entregado'])
  })

  it('builds the phone with a frame and a screen', () => {
    const w = mount(HeroVisual)
    expect(w.findAll('.lp-phone')).toHaveLength(1)
    expect(w.find('.lp-phone .lp-phone-screen').exists()).toBe(true)
  })

  it('marks exactly one row as the current step', () => {
    const w = mount(HeroVisual)
    const current = w.findAll('.lp-phone-row[data-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toBe('En camino')
  })

  it('draws flat geometric shapes from the palette tokens', () => {
    const html = mount(HeroVisual).html()
    for (const token of ['--lp-primary)', '--lp-indigo)', '--lp-amber)']) expect(html).toContain(token)
    expect(html).not.toMatch(/gradient|blur/i)
  })

  it('has no Bike icon and no digits in its text', () => {
    const w = mount(HeroVisual)
    expect(w.html()).not.toMatch(/lucide-bike|bike/i)
    expect(w.text()).not.toMatch(/\d/)
  })

  it('lets a slot replace the default art', () => {
    const w = mount(HeroVisual, { slots: { default: '<img alt="x" src="/x.png">' } })
    expect(w.find('img').exists()).toBe(true)
    expect(w.find('.lp-phone').exists()).toBe(false)
  })
})
