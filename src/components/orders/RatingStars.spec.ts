import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingStars from './RatingStars.vue'

function setup(value = 3) {
  const w = mount(RatingStars, { props: { modelValue: value, label: 'Servicio del comercio', 'onUpdate:modelValue': (v: number) => w.setProps({ modelValue: v }) }, attachTo: document.body })
  return w
}
const radios = (w: ReturnType<typeof setup>) => w.findAll('[role="radio"]')
const checked = (w: ReturnType<typeof setup>) => radios(w).map((r) => r.attributes('aria-checked'))

describe('RatingStars: a radiogroup of 5 real buttons', () => {
  it('has a labelled radiogroup and five radio buttons named "n de 5 estrellas"', () => {
    const w = setup()
    expect(w.find('[role="radiogroup"]').attributes('aria-label')).toBe('Servicio del comercio')
    expect(radios(w)).toHaveLength(5)
    expect(radios(w).map((r) => r.element.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'])
    expect(radios(w).map((r) => r.attributes('aria-label'))).toEqual(['1 de 5 estrellas', '2 de 5 estrellas', '3 de 5 estrellas', '4 de 5 estrellas', '5 de 5 estrellas'])
    expect(radios(w).every((r) => r.attributes('type') === 'button')).toBe(true)
    w.unmount()
  })

  it('aria-checked marks exactly the selected value; only that radio is in the tab order (roving tabindex)', () => {
    const w = setup(3)
    expect(checked(w)).toEqual(['false', 'false', 'true', 'false', 'false'])
    expect(radios(w).map((r) => r.attributes('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1'])
    w.unmount()
  })

  it('stars up to the value are filled (data-lleno), the rest hollow', () => {
    const w = setup(2)
    expect(radios(w).map((r) => r.attributes('data-lleno'))).toEqual(['true', 'true', 'false', 'false', 'false'])
    w.unmount()
  })

  it('a click selects', async () => {
    const w = setup(1)
    await radios(w)[3].trigger('click')
    expect(checked(w)).toEqual(['false', 'false', 'false', 'true', 'false'])
    w.unmount()
  })

  it('ArrowRight and ArrowUp go up, ArrowLeft and ArrowDown go down; moving selects and moves focus', async () => {
    const w = setup(3)
    await radios(w)[2].trigger('keydown', { key: 'ArrowRight' })
    expect(checked(w)[3]).toBe('true')
    expect(document.activeElement).toBe(radios(w)[3].element)
    await radios(w)[3].trigger('keydown', { key: 'ArrowUp' })
    expect(checked(w)[4]).toBe('true')
    await radios(w)[4].trigger('keydown', { key: 'ArrowLeft' })
    expect(checked(w)[3]).toBe('true')
    await radios(w)[3].trigger('keydown', { key: 'ArrowDown' })
    expect(checked(w)[2]).toBe('true')
    w.unmount()
  })

  it('arrows wrap around at both ends', async () => {
    const w = setup(5)
    await radios(w)[4].trigger('keydown', { key: 'ArrowRight' })
    expect(checked(w)[0]).toBe('true')
    await radios(w)[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(checked(w)[4]).toBe('true')
    w.unmount()
  })

  it('Home selects 1 and End selects 5', async () => {
    const w = setup(3)
    await radios(w)[2].trigger('keydown', { key: 'Home' })
    expect(checked(w)).toEqual(['true', 'false', 'false', 'false', 'false'])
    await radios(w)[0].trigger('keydown', { key: 'End' })
    expect(checked(w)).toEqual(['false', 'false', 'false', 'false', 'true'])
    w.unmount()
  })

  it('Space and Enter on a focused radio select it (native button click)', async () => {
    const w = setup(1)
    // jsdom does not synthesize the click a browser fires for Space/Enter on a button, so assert the handler is the click one
    // and that these keys are not swallowed or turned into arrow moves.
    const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    radios(w)[2].element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    radios(w)[2].element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
    await radios(w)[2].trigger('click')
    expect(checked(w)[2]).toBe('true')
    w.unmount()
  })

  it('announces the new value politely after the user changes it, and says nothing on first render', async () => {
    const w = setup(5)
    const live = () => w.find('[aria-live="polite"]')
    expect(live().exists()).toBe(true)
    expect(live().text()).toBe('')
    await radios(w)[1].trigger('click')
    expect(live().text()).toBe('Servicio del comercio: 2 de 5 estrellas')
    w.unmount()
  })

  it('does not touch the value for unrelated keys', async () => {
    const w = setup(4)
    await radios(w)[3].trigger('keydown', { key: 'a' })
    await radios(w)[3].trigger('keydown', { key: 'Tab' })
    expect(checked(w)[3]).toBe('true')
    w.unmount()
  })
})
