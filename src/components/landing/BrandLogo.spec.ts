import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import colorUrl from '../../assets/brand/go-eats-wordmark-color.svg'
import indigoUrl from '../../assets/brand/go-eats-wordmark-sobre-indigo.svg'
import BrandLogo from './BrandLogo.vue'

async function mountLogo(props?: { variant?: 'color' | 'sobre-indigo' }) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'landing', component: { render: () => null } }],
  })
  await router.push('/')
  await router.isReady()
  return mount(BrandLogo, { props, global: { plugins: [router] } })
}

describe('BrandLogo', () => {
  it('defaults to the color wordmark with alt "Go Eats"', async () => {
    const img = (await mountLogo()).get('img')
    expect(img.attributes('src')).toBe(colorUrl)
    expect(img.attributes('alt')).toBe('Go Eats')
  })

  it('uses the sobre-indigo asset for the indigo variant, with the same alt', async () => {
    const img = (await mountLogo({ variant: 'sobre-indigo' })).get('img')
    expect(img.attributes('src')).toBe(indigoUrl)
    expect(img.attributes('alt')).toBe('Go Eats')
    expect(colorUrl).not.toBe(indigoUrl)
  })

  it('keeps each variant intrinsic aspect ratio from its viewBox', async () => {
    const color = (await mountLogo()).get('img').attributes()
    const indigo = (await mountLogo({ variant: 'sobre-indigo' })).get('img').attributes()
    expect([color.width, color.height]).toEqual(['551', '250'])
    expect([indigo.width, indigo.height]).toEqual(['631', '330'])
  })

  it('wraps the image in a link to /', async () => {
    const link = (await mountLogo()).get('a')
    expect(link.attributes('href')).toBe('/')
    expect(link.find('img').exists()).toBe(true)
  })

  it('does not recolor the artwork (no inline style, filter or fill classes)', async () => {
    const img = (await mountLogo({ variant: 'sobre-indigo' })).get('img')
    expect(img.attributes('style')).toBeUndefined()
    expect(img.classes().some((c) => /filter|fill|invert|brightness/.test(c))).toBe(false)
  })
})
