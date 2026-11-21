import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderProgress from './OrderProgress.vue'

const bar = (estado: string) => mount(OrderProgress, { props: { estado } })

describe('OrderProgress: 8px bar with step dots, not color alone', () => {
  it('exposes a progressbar with value, range and a spoken text', () => {
    const el = bar('en_preparacion').find('[role="progressbar"]')
    expect(el.attributes('aria-valuemin')).toBe('1')
    expect(el.attributes('aria-valuemax')).toBe('6')
    expect(el.attributes('aria-valuenow')).toBe('3')
    expect(el.attributes('aria-valuetext')).toBe('Paso 3 de 6: En preparación')
    expect(el.attributes('aria-label')).toBe('Progreso del pedido')
  })

  it('draws one dot per step and marks done, current and pending by shape/data, not only color', () => {
    const dots = bar('listo_para_recoger').findAll('[data-test="progress-dot"]')
    expect(dots.map((d) => d.attributes('data-state'))).toEqual(['done', 'done', 'done', 'current', 'pending', 'pending'])
  })

  it('the fill reaches the current dot (segment centers: (step + 0.5) / 6)', () => {
    const fill = (e: string) => bar(e).find('[data-test="progress-fill"]').attributes('style')
    expect(fill('pendiente')).toContain('width: 8.33')
    expect(fill('en_camino')).toContain('width: 75%')
    expect(fill('entregado')).toContain('width: 91.66')
  })

  it('also prints the step as visible text', () => {
    expect(bar('en_camino').text()).toContain('Paso 5 de 6')
  })

  it.each(['rechazado', 'cancelado', 'en camino', ''])('renders nothing for %j (no steps to measure)', (e) => {
    expect(bar(e).find('[role="progressbar"]').exists()).toBe(false)
  })
})
