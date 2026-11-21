import { describe, it, expect } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from './router'

const makeRouter = () => createRouter({ history: createMemoryHistory(), routes })

describe('router', () => {
  it('resolves / to the landing route without redirecting', async () => {
    const router = makeRouter()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('landing')
    expect(router.currentRoute.value.fullPath).toBe('/')
    const root = routes.find((r) => r.path === '/')
    expect(root?.redirect).toBeUndefined()
  })

  it('keeps the catch-all redirecting to /tiendas', async () => {
    const router = makeRouter()
    await router.push('/no-existe')
    expect(router.currentRoute.value.fullPath).toBe('/tiendas')
    expect(router.currentRoute.value.name).toBe('stores')
  })

  it('still resolves /tiendas and /login by name', async () => {
    const router = makeRouter()
    await router.push('/tiendas')
    expect(router.currentRoute.value.name).toBe('stores')
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')
  })
})
