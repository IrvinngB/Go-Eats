import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FaqSection from './FaqSection.vue'
import { ENVIO_COPY, FAQ_ITEMS } from './content'

function triggers(w: ReturnType<typeof mount>) {
  return w.findAll('button')
}

describe('FaqSection', () => {
  it('is the #preguntas bg band labelled by its single h2', () => {
    const w = mount(FaqSection)
    const s = w.get('section')
    expect(s.attributes('id')).toBe('preguntas')
    expect(s.classes()).toContain('lp-band-bg')
    expect(w.findAll('h2')).toHaveLength(1)
    expect(s.attributes('aria-labelledby')).toBe(w.get('h2').attributes('id'))
    expect(w.get('h2').text()).toBe('Preguntas frecuentes')
  })

  it('renders one h3 per question, each wrapping a button, in the content order', () => {
    const w = mount(FaqSection)
    expect(w.findAll('h3').map((h) => h.text())).toEqual(FAQ_ITEMS.map((i) => i.q))
    expect(w.findAll('h3 > button')).toHaveLength(FAQ_ITEMS.length)
  })

  it('starts fully collapsed with aria-controls pointing at a hidden labelled region', () => {
    const w = mount(FaqSection)
    for (const b of triggers(w)) {
      expect(b.attributes('type')).toBe('button')
      expect(b.attributes('aria-expanded')).toBe('false')
      const panel = w.get(`#${b.attributes('aria-controls')}`)
      expect(panel.attributes('role')).toBe('region')
      expect(panel.attributes('aria-labelledby')).toBe(b.attributes('id'))
      expect(panel.attributes('hidden')).toBeDefined()
    }
  })

  it('opens an item on click and shows its answer', async () => {
    const w = mount(FaqSection)
    await triggers(w)[2].trigger('click')
    const b = triggers(w)[2]
    expect(b.attributes('aria-expanded')).toBe('true')
    const panel = w.get(`#${b.attributes('aria-controls')}`)
    expect(panel.attributes('hidden')).toBeUndefined()
    expect(panel.text()).toBe(ENVIO_COPY)
  })

  it('keeps only one item open: opening B closes A', async () => {
    const w = mount(FaqSection)
    await triggers(w)[0].trigger('click')
    await triggers(w)[3].trigger('click')
    expect(triggers(w).map((b) => b.attributes('aria-expanded'))).toEqual(
      FAQ_ITEMS.map((_, i) => (i === 3 ? 'true' : 'false')),
    )
    expect(w.findAll('[role="region"]:not([hidden])')).toHaveLength(1)
  })

  it('closes the open item when it is activated again, leaving none open', async () => {
    const w = mount(FaqSection)
    await triggers(w)[1].trigger('click')
    await triggers(w)[1].trigger('click')
    expect(triggers(w).every((b) => b.attributes('aria-expanded') === 'false')).toBe(true)
    expect(w.findAll('[role="region"]:not([hidden])')).toHaveLength(0)
  })

  it('relies on native buttons for Enter and Space: no key handlers, no div triggers', () => {
    const w = mount(FaqSection)
    expect(w.html()).not.toMatch(/onkeydown|onkeyup|onkeypress/i)
    expect(w.findAll('[aria-expanded]').every((e) => e.element.tagName === 'BUTTON')).toBe(true)
  })

  it('uses unique ids for triggers and regions', () => {
    const w = mount(FaqSection)
    const ids = w.findAll('[id]').map((e) => e.attributes('id'))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no links, images or form controls besides the triggers', () => {
    const w = mount(FaqSection)
    expect(w.findAll('a, img, input, select, textarea')).toHaveLength(0)
  })
})
