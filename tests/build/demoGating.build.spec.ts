import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Build-level proof: the demo credentials must not ship in a flag-off bundle (they are baked in at build time).
const scratch = mkdtempSync(join(tmpdir(), 'goeats-demo-gating-'))

function bundleText(flag: 'true' | 'false'): string {
  const outDir = join(scratch, `flag-${flag}`)
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'silent'], {
    cwd: process.cwd(),
    env: { ...process.env, VITE_ENABLE_DEMO_SWITCHER: flag },
    stdio: 'pipe',
  })
  const assets = join(outDir, 'assets')
  return readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(assets, f), 'utf8'))
    .join('\n')
}

describe('demo credentials gating (production bundle)', () => {
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  it('flag OFF: bundle carries neither the demo password nor the demo account emails', () => {
    const js = bundleText('false')
    expect(js.length).toBeGreaterThan(1000)
    expect(js.includes('demo1234')).toBe(false)
    expect(js.includes('ejemplo.pa')).toBe(false)
  }, 240_000)

  it('flag ON: bundle carries the demo password and the demo accounts', () => {
    const js = bundleText('true')
    expect(js.includes('demo1234')).toBe(true)
    expect(js.includes('ejemplo.pa')).toBe(true)
  }, 240_000)
})
