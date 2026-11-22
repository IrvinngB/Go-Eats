import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderTimeline from './OrderTimeline.vue'

const steps = (estado: string, fecha = '20 nov, 10:30 a. m.') => mount(OrderTimeline, { props: { estado, fecha } })
const states = (w: ReturnType<typeof steps>) => w.findAll('[data-test="timeline-step"]').map((s) => s.attributes('data-state'))

describe('OrderTimeline: vertical steps per canonical state', () => {
  it.each([
    ['pendiente', ['current', 'pending', 'pending', 'pending', 'pending', 'pending']],
    ['confirmado', ['done', 'current', 'pending', 'pending', 'pending', 'pending']],
    ['en_preparacion', ['done', 'done', 'current', 'pending', 'pending', 'pending']],
    ['listo_para_recoger', ['done', 'done', 'done', 'current', 'pending', 'pending']],
    ['en_camino', ['done', 'done', 'done', 'done', 'current', 'pending']],
    ['entregado', ['done', 'done', 'done', 'done', 'done', 'current']],
  ])('%s', (estado, expected) => {
    expect(states(steps(estado))).toEqual(expected)
  })

  it.each(['rechazado', 'cancelado', 'en camino', ''])('%j renders no steps at all', (estado) => {
    const w = steps(estado)
    expect(w.findAll('[data-test="timeline-step"]')).toHaveLength(0)
    expect(w.find('ol').exists()).toBe(false)
  })

  it('is an ordered list with a label and marks only the current step with aria-current', () => {
    const w = steps('en_preparacion')
    expect(w.find('ol').attributes('aria-label')).toBe('Progreso del pedido')
    const current = w.findAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toContain('En preparación')
  })

  it('every step shows its Spanish title; done steps carry a check icon, the others a number', () => {
    const w = steps('listo_para_recoger')
    const items = w.findAll('[data-test="timeline-step"]')
    expect(items.map((i) => i.find('.cx-step-title').text())).toEqual([
      'Pendiente', 'Confirmado', 'En preparación', 'Listo para recoger', 'En camino', 'Entregado',
    ])
    expect(items.map((i) => i.find('[data-test="step-check"]').exists())).toEqual([true, true, true, false, false, false])
    expect(items.map((i) => i.find('.cx-step-num').exists())).toEqual([false, false, false, true, true, true])
    expect(items[3].find('.cx-step-num').text()).toBe('4')
  })

  it('only shows times it has: the order date on the first step, nothing invented on the rest', () => {
    const w = steps('en_camino', '20 nov, 10:30 a. m.')
    const times = w.findAll('[data-test="timeline-step"]').map((s) => s.find('.cx-step-time').exists() ? s.find('.cx-step-time').text() : '')
    expect(times[0]).toBe('20 nov, 10:30 a. m.')
    expect(times.slice(1, 4)).toEqual(['', '', ''])
    expect(times[4]).toBe('Estado actual')
    expect(times[5]).toBe('')
    expect(w.text()).not.toMatch(/\d{1,2}:\d{2}.*\d{1,2}:\d{2}.*\d{1,2}:\d{2}/s)
  })

  it('without a date the first step has no time line', () => {
    const w = steps('confirmado', '')
    expect(w.findAll('.cx-step-time').map((t) => t.text())).toEqual(['Estado actual'])
  })
})
