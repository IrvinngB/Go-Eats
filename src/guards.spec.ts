import { describe, it, expect, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from './router'
import { installGuards, installSessionExpiry, safeRedirect, rutaPorRol } from './guards'

// guards.ts only needs the registration point of the expiry hook: capture it to fire it by hand.
const hook = vi.hoisted(() => ({ fire: null as null | (() => void) }))
vi.mock('./services/api', () => ({
  setSessionExpiredHandler: (fn: null | (() => void)) => {
    hook.fire = fn
  },
}))

type Session = { autenticado: boolean; rol: string }

function setup(session: Session, ready: Promise<unknown> = Promise.resolve()) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const store = { ...session }
  installGuards(router, store, ready)
  return { router, store }
}

const anon: Session = { autenticado: false, rol: 'customer' }
const as = (rol: string): Session => ({ autenticado: true, rol })

describe('rutaPorRol', () => {
  it('maps each role to its home', () => {
    expect(rutaPorRol).toEqual({
      customer: '/tiendas',
      merchant: '/panel-comercio',
      courier: '/panel-repartidor',
      accountant: '/panel-contabilidad',
      admin: '/panel-admin',
    })
  })
})

describe('guards: anonymous', () => {
  it.each(['/pedidos', '/perfil', '/panel-admin', '/panel-comercio', '/panel-repartidor', '/panel-contabilidad'])(
    'sends %s to /login with the redirect',
    async (path) => {
      const { router } = setup(anon)
      await router.push(path)
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe(path)
    },
  )

  it.each([
    ['/', 'landing'],
    ['/login', 'login'],
    ['/tiendas', 'stores'],
    ['/tiendas/c1', 'store-detail'],
  ])('keeps public %s open', async (path, name) => {
    const { router } = setup(anon)
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(name)
    expect(router.currentRoute.value.fullPath).toBe(path)
  })

  it('an unknown path ends at the public /tiendas', async () => {
    const { router } = setup(anon)
    await router.push('/no-existe')
    expect(router.currentRoute.value.fullPath).toBe('/tiendas')
  })
})

describe('guards: authenticated', () => {
  it('customer to the admin panel lands on /tiendas', async () => {
    const { router } = setup(as('customer'))
    await router.push('/panel-admin')
    expect(router.currentRoute.value.fullPath).toBe('/tiendas')
  })

  it('merchant on a customer route lands on its panel', async () => {
    const { router } = setup(as('merchant'))
    await router.push('/pedidos')
    expect(router.currentRoute.value.fullPath).toBe('/panel-comercio')
  })

  it.each(['/tiendas', '/tiendas/c1', '/pedidos', '/perfil'])('admin on customer route %s lands on /panel-admin', async (path) => {
    const { router } = setup(as('admin'))
    await router.push(path)
    expect(router.currentRoute.value.fullPath).toBe('/panel-admin')
  })

  it('each panel is only for its own role', async () => {
    const { router } = setup(as('courier'))
    await router.push('/panel-contabilidad')
    expect(router.currentRoute.value.fullPath).toBe('/panel-repartidor')
    await router.push('/panel-repartidor')
    expect(router.currentRoute.value.fullPath).toBe('/panel-repartidor')
  })

  it.each([
    ['customer', '/tiendas'],
    ['merchant', '/panel-comercio'],
    ['courier', '/panel-repartidor'],
    ['accountant', '/panel-contabilidad'],
    ['admin', '/panel-admin'],
  ])('%s at /login goes to %s', async (rol, home) => {
    const { router } = setup(as(rol))
    await router.push('/login')
    expect(router.currentRoute.value.fullPath).toBe(home)
  })

  it('unknown path for a merchant ends at the panel', async () => {
    const { router } = setup(as('merchant'))
    await router.push('/no-existe')
    expect(router.currentRoute.value.fullPath).toBe('/panel-comercio')
  })

  it('customer keeps customer routes', async () => {
    const { router } = setup(as('customer'))
    await router.push('/pedidos')
    expect(router.currentRoute.value.fullPath).toBe('/pedidos')
  })

  it('reads the session at navigation time (logout makes routes protected again)', async () => {
    const { router, store } = setup(as('customer'))
    await router.push('/pedidos')
    store.autenticado = false
    await router.push('/perfil')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/perfil')
  })
})

describe('guards: session restore', () => {
  it('does not decide until the restore finished', async () => {
    let finish!: () => void
    const ready = new Promise<void>((r) => (finish = r))
    const { router, store } = setup(anon, ready)
    let settled = false
    const nav = router.push('/panel-admin').then(() => (settled = true))
    await new Promise((r) => setTimeout(r, 10))
    expect(settled).toBe(false)
    // the restore completes as an authenticated admin
    store.autenticado = true
    store.rol = 'admin'
    finish()
    await nav
    expect(router.currentRoute.value.fullPath).toBe('/panel-admin')
  })

  it('a failed restore still lets the guard decide as anonymous', async () => {
    const { router } = setup(anon, Promise.reject(new Error('boom')))
    await router.push('/pedidos')
    expect(router.currentRoute.value.name).toBe('login')
  })
})

describe('safeRedirect', () => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  it('accepts an internal path allowed for the role', () => {
    expect(safeRedirect(router, '/tiendas/c1', 'customer')).toBe('/tiendas/c1')
    expect(safeRedirect(router, '/pedidos', 'customer')).toBe('/pedidos')
    expect(safeRedirect(router, '/panel-admin', 'admin')).toBe('/panel-admin')
    expect(safeRedirect(router, '/tiendas/c1?x=1', 'customer')).toBe('/tiendas/c1?x=1')
  })

  it('rejects a path of another role', () => {
    expect(safeRedirect(router, '/panel-admin', 'customer')).toBeNull()
    expect(safeRedirect(router, '/pedidos', 'merchant')).toBeNull()
    expect(safeRedirect(router, '/tiendas', 'admin')).toBeNull()
  })

  it.each([
    '//evil.com',
    '//evil.com/panel-admin',
    'https://evil.com',
    'http://evil.com/tiendas',
    'javascript:alert(1)',
    'data:text/html,x',
    '/\\evil.com',
    '\\\\evil.com',
    '/tiendas\\..\\x',
    '%2F%2Fevil.com',
    '/%2Fevil.com',
    '/%5Cevil.com',
    '/%09/evil.com',
    '/\t/evil.com',
    ' //evil.com',
    '///evil.com',
    'tiendas',
    '',
    '/login',
    '/no-existe',
  ])('rejects %j', (raw) => {
    expect(safeRedirect(router, raw, 'customer')).toBeNull()
  })

  it('rejects non-strings and takes the first of repeated params', () => {
    expect(safeRedirect(router, undefined, 'customer')).toBeNull()
    expect(safeRedirect(router, null, 'customer')).toBeNull()
    expect(safeRedirect(router, ['//evil.com', '/pedidos'], 'customer')).toBeNull()
    expect(safeRedirect(router, ['/pedidos', '//evil.com'], 'customer')).toBe('/pedidos')
  })

  it('an unknown role has no valid redirect to a panel', () => {
    expect(safeRedirect(router, '/panel-admin', 'hacker')).toBeNull()
  })
})

describe('installSessionExpiry', () => {
  function setupExpiry(session: Session) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const store = {
      ...session,
      cerrarSesion: vi.fn(() => {
        store.autenticado = false
        store.rol = 'customer'
      }),
    }
    installGuards(router, store)
    installSessionExpiry(router, store)
    return { router, store }
  }

  it('a real session that expires is logged out and sent to /login with the current path', async () => {
    const { router, store } = setupExpiry(as('merchant'))
    await router.push('/panel-comercio')
    hook.fire!()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(store.cerrarSesion).toHaveBeenCalledWith('Tu sesión expiró. Inicia sesión de nuevo.')
    expect(router.currentRoute.value.query.redirect).toBe('/panel-comercio')
    expect(store.autenticado).toBe(false)
  })

  it('an anonymous visitor is never touched (public sync)', async () => {
    const { router, store } = setupExpiry(anon)
    await router.push('/tiendas')
    hook.fire!()
    await new Promise((r) => setTimeout(r, 10))
    expect(store.cerrarSesion).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/tiendas')
  })

  it('does not navigate again when already on /login', async () => {
    const { router, store } = setupExpiry(anon)
    await router.push('/login')
    store.autenticado = true // a session that expires while the login page is open
    hook.fire!()
    await new Promise((r) => setTimeout(r, 10))
    expect(store.cerrarSesion).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.fullPath).toBe('/login')
  })
})
