import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StepsSection from './StepsSection.vue'
import { ENVIO_COPY } from './content'

describe('StepsSection', () => {
  it('is the como-funciona anchor target on the surface band, titled by an h2', () => {
    const w = mount(StepsSection)
    expect(w.attributes('id')).toBe('como-funciona')
    expect(w.attributes('aria-labelledby')).toBe('lp-steps-title')
    expect(w.classes()).toContain('lp-band-surface')
    expect(w.find('h2#lp-steps-title').text()).toBe('Así funciona')
  })

  it('renders exactly four steps numbered 1 to 4 in order', () => {
    const w = mount(StepsSection)
    expect(w.findAll('ol > li')).toHaveLength(4)
    expect(w.findAll('[data-test="step-number"]').map((n) => n.text())).toEqual(['1', '2', '3', '4'])
  })

  it('titles each step with an h3', () => {
    const w = mount(StepsSection)
    expect(w.findAll('li h3').map((h) => h.text())).toEqual([
      'Elige un comercio',
      'Arma tu carrito',
      'Confirma y paga al recibir',
      'Sigue el estado de tu pedido',
    ])
  })

  it('states cash on delivery and the exact shipping sentence in step 3', () => {
    const w = mount(StepsSection)
    const third = w.findAll('ol > li')[2].text()
    expect(third).toContain('efectivo')
    expect(third).toContain(ENVIO_COPY)
  })

  it('hides the decorative numerals and icons from assistive technology', () => {
    const w = mount(StepsSection)
    for (const n of w.findAll('[data-test="step-number"]')) expect(n.attributes('aria-hidden')).toBe('true')
    const icons = w.findAll('li svg')
    expect(icons).toHaveLength(4)
    for (const i of icons) expect(i.attributes('aria-hidden')).toBe('true')
  })

  it('has no link, no button and no card article', () => {
    const w = mount(StepsSection)
    expect(w.findAll('a, button, article')).toHaveLength(0)
  })
})
