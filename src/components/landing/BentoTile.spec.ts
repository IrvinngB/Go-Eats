import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Map } from '@lucide/vue'
import BentoTile from './BentoTile.vue'

describe('BentoTile', () => {
  const props = { title: 'Cobertura', text: 'Texto de prueba', icon: Map }

  it('renders h2, paragraph and a decorative icon', () => {
    const w = mount(BentoTile, { props })
    expect(w.find('h2').text()).toBe('Cobertura')
    expect(w.find('p').text()).toBe('Texto de prueba')
    expect(w.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('applies the brand tone only when requested', () => {
    expect(mount(BentoTile, { props }).classes()).not.toContain('lp-tile-brand')
    expect(mount(BentoTile, { props: { ...props, tone: 'brand' } }).classes()).toContain('lp-tile-brand')
  })

  it('forwards the span classes', () => {
    const w = mount(BentoTile, { props: { ...props, span: 'col-span-2 lg:col-span-5' } })
    expect(w.classes()).toContain('lg:col-span-5')
  })
})
