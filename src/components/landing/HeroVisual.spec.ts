import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HeroVisual from './HeroVisual.vue'

describe('HeroVisual', () => {
  it('renders a decorative Lucide icon by default', () => {
    const svg = mount(HeroVisual).find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('lets a slot replace the fallback icon', () => {
    const w = mount(HeroVisual, { slots: { default: '<img alt="Repartidor en bicicleta" src="/x.png">' } })
    expect(w.find('img').attributes('alt')).toBe('Repartidor en bicicleta')
    expect(w.find('svg').exists()).toBe(false)
  })

  it('uses a flat tone, no inline gradient', () => {
    const w = mount(HeroVisual)
    expect(w.html()).not.toMatch(/gradient|blur/i)
  })
})
