import { afterEach, describe, expect, it, vi } from 'vitest'

async function load() {
  vi.resetModules()
  return import('./mapTiles')
}

describe('mapTiles', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to the OSM standard tile URL without subdomain or retina placeholders', async () => {
    const { TILE_URL } = await load()
    expect(TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
  })

  it('defaults the attribution to OpenStreetMap contributors', async () => {
    const { TILE_ATTRIBUTION } = await load()
    expect(TILE_ATTRIBUTION).toBe('© OpenStreetMap contributors')
  })

  it('is overridable through VITE_MAP_TILE_URL and VITE_MAP_TILE_ATTRIBUTION', async () => {
    vi.stubEnv('VITE_MAP_TILE_URL', 'https://tiles.example.com/{z}/{x}/{y}.png?key=k')
    vi.stubEnv('VITE_MAP_TILE_ATTRIBUTION', '© Example')
    const { TILE_URL, TILE_ATTRIBUTION } = await load()
    expect(TILE_URL).toBe('https://tiles.example.com/{z}/{x}/{y}.png?key=k')
    expect(TILE_ATTRIBUTION).toBe('© Example')
  })

  it('falls back to the defaults when the env vars are empty strings', async () => {
    vi.stubEnv('VITE_MAP_TILE_URL', '')
    vi.stubEnv('VITE_MAP_TILE_ATTRIBUTION', '')
    const { TILE_URL, TILE_ATTRIBUTION } = await load()
    expect(TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(TILE_ATTRIBUTION).toBe('© OpenStreetMap contributors')
  })
})
