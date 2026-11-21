import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
vi.mock('../../services/api', () => ({
  default: { get, post, patch: vi.fn(), put, delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import ProfileView from './ProfileView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

function http(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } })
}
const row = (id: number, type: string, status = 'pendiente', response: string | null = null) => ({
  id, user_id: 1, user_name: 'Ana', request_type: type, detail: `detalle ${id}`, status,
  admin_response: response, created_at: '2026-01-01T10:00:00Z', resolved_at: null,
})

function serve(consent: boolean | 'fail', arco: unknown[] = []) {
  get.mockImplementation(async (url: string) => {
    if (url === '/users/me/consent') {
      if (consent === 'fail') throw http(500)
      return { data: { accepted: consent, policy_version: 'v1', accepted_at: '2026-01-01T10:00:00Z' } }
    }
    if (url === '/users/me/arco') return { data: arco }
    throw new Error(`unexpected ${url}`)
  })
}

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'customer'
  store.usuario = { nombre: 'Ana', email: 'ana@t.pa', telefono: '600', consentimientoLey81: null }
  const w = mount(ProfileView, { global: { plugins: [pinia], stubs: { RouterLink: true } } })
  await flushPromises()
  return { w, store }
}

const checkbox = (w: Awaited<ReturnType<typeof setup>>['w']) => w.find('[data-test="consent-toggle"]')

beforeEach(() => {
  for (const m of [get, post, put]) m.mockReset()
})

describe('ProfileView consent toggle', () => {
  it('reads the server state on mount: accepted shows checked and no revoked notice', async () => {
    serve(true)
    const { w } = await setup()
    expect(get).toHaveBeenCalledWith('/users/me/consent')
    expect((checkbox(w).element as HTMLInputElement).checked).toBe(true)
    expect(w.find('[data-test="consent-revoked"]').exists()).toBe(false)
  })

  it('a revoked user sees the toggle off and the explanation that new orders are blocked and data is kept', async () => {
    serve(false)
    const { w } = await setup()
    expect((checkbox(w).element as HTMLInputElement).checked).toBe(false)
    const note = w.find('[data-test="consent-revoked"]').text()
    expect(note).toContain('No podrás hacer nuevos pedidos')
    expect(note).toContain('tus datos se conservan')
  })

  it('unchecking PUTs accepted=false and shows the revoked notice', async () => {
    serve(true)
    put.mockResolvedValue({ data: { accepted: false, policy_version: 'v1', accepted_at: '2026-01-02T10:00:00Z' } })
    const { w } = await setup()
    await checkbox(w).setValue(false)
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/users/me/consent', { accepted: false })
    expect((checkbox(w).element as HTMLInputElement).checked).toBe(false)
    expect(w.find('[data-test="consent-revoked"]').exists()).toBe(true)
  })

  it('checking again PUTs accepted=true (re-grant) and hides the notice', async () => {
    serve(false)
    put.mockResolvedValue({ data: { accepted: true, policy_version: 'v1', accepted_at: '2026-01-02T10:00:00Z' } })
    const { w } = await setup()
    await checkbox(w).setValue(true)
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/users/me/consent', { accepted: true })
    expect(w.find('[data-test="consent-revoked"]').exists()).toBe(false)
  })

  it('a failed write puts the toggle back and shows the error', async () => {
    serve(true)
    put.mockRejectedValue(http(500))
    const { w, store } = await setup()
    await checkbox(w).setValue(false)
    await flushPromises()
    expect((checkbox(w).element as HTMLInputElement).checked).toBe(true)
    expect(store.usuario.consentimientoLey81).toBe(true)
    expect(store.notificacion).toMatchObject({ texto: 'El servidor tuvo un problema. Inténtalo más tarde.', tipo: 'error' })
  })

  it('if the state cannot be loaded the toggle is disabled instead of guessing', async () => {
    serve('fail')
    const { w } = await setup()
    expect((checkbox(w).element as HTMLInputElement).disabled).toBe(true)
    expect(w.find('[data-test="consent-load-error"]').exists()).toBe(true)
  })
})

describe('ProfileView ARCO', () => {
  it('lists the own requests in server order (newest first) with Spanish status labels and the admin response', async () => {
    serve(true, [row(3, 'Oposición', 'respondida', 'Ya está resuelto'), row(1, 'Acceso')])
    const { w } = await setup()
    expect(get).toHaveBeenCalledWith('/users/me/arco')
    const items = w.findAll('[data-test="arco-item"]')
    expect(items.map((i) => i.text())).toEqual([
      expect.stringContaining('Oposición'),
      expect.stringContaining('Acceso'),
    ])
    expect(items[0].text()).toContain('Respondida')
    expect(items[0].text()).toContain('Ya está resuelto')
    expect(items[1].text()).toContain('Pendiente')
  })

  it('offers exactly the four closed request types', async () => {
    serve(true)
    const { w } = await setup()
    expect(w.findAll('[data-test="arco-type"]').map((b) => b.attributes('data-type'))).toEqual(['Acceso', 'Rectificación', 'Cancelación', 'Oposición'])
  })

  it('submits the chosen type and detail, then shows it at the top of the history', async () => {
    serve(true, [row(1, 'Acceso')])
    post.mockResolvedValue({ data: row(2, 'Oposición') })
    const { w } = await setup()
    await w.findAll('[data-test="arco-type"]')[3].trigger('click')
    await w.find('textarea').setValue('No uso mis datos para publicidad')
    await w.find('[data-test="arco-submit"]').trigger('click')
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/users/me/arco', { request_type: 'Oposición', detail: 'No uso mis datos para publicidad' })
    const items = w.findAll('[data-test="arco-item"]')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Oposición')
  })

  it('does not call the API for a detail shorter than 5 characters', async () => {
    serve(true)
    const { w, store } = await setup()
    await w.find('textarea').setValue('abc')
    await w.find('[data-test="arco-submit"]').trigger('click')
    await flushPromises()
    expect(post).not.toHaveBeenCalled()
    expect(store.notificacion.texto).toContain('al menos 5 caracteres')
  })

  it('a failed submit keeps the text and adds nothing to the history', async () => {
    serve(true)
    post.mockRejectedValue(http(403, { detail: 'consent_required' }))
    const { w } = await setup()
    await w.find('textarea').setValue('Quiero conocer mis datos')
    await w.find('[data-test="arco-submit"]').trigger('click')
    await flushPromises()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('Quiero conocer mis datos')
    expect(w.findAll('[data-test="arco-item"]')).toHaveLength(0)
  })
})
