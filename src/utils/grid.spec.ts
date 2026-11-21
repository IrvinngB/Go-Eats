import { describe, it, expect } from 'vitest'
import { layoutGrid, cellClass } from './grid'

const COUNTS = Array.from({ length: 13 }, (_, i) => i)

describe('layoutGrid (6-column desktop grid, 2-column tablet grid)', () => {
  it('returns one cell per item', () => {
    for (const n of COUNTS) expect(layoutGrid(n)).toHaveLength(n)
  })

  it('packs desktop rows to exactly 6 columns for every count 0..12 (no holes)', () => {
    for (const n of COUNTS) {
      let used = 0
      for (const cell of layoutGrid(n)) {
        used += cell.span
        expect(used, `count ${n}`).toBeLessThanOrEqual(6)
        if (used === 6) used = 0
      }
      expect(used, `count ${n} leaves an unfinished row`).toBe(0)
    }
  })

  it('matches the designed layouts for 1..6', () => {
    const spans = (n: number) => layoutGrid(n).map((c) => c.span)
    expect(spans(1)).toEqual([6])
    expect(spans(2)).toEqual([3, 3])
    expect(spans(3)).toEqual([2, 2, 2])
    expect(spans(4)).toEqual([3, 3, 3, 3])
    expect(spans(5)).toEqual([2, 2, 2, 3, 3])
    expect(spans(6)).toEqual([2, 2, 2, 2, 2, 2])
  })

  it('keeps rows of three and stretches only the tail for larger counts', () => {
    expect(layoutGrid(7).map((c) => c.span)).toEqual([2, 2, 2, 3, 3, 3, 3])
    expect(layoutGrid(8).map((c) => c.span)).toEqual([2, 2, 2, 2, 2, 2, 3, 3])
    expect(layoutGrid(12).every((c) => c.span === 2)).toBe(true)
  })

  it('marks only a single item as the hero', () => {
    expect(layoutGrid(1)[0].hero).toBe(true)
    for (const n of COUNTS.filter((x) => x !== 1)) {
      expect(layoutGrid(n).some((c) => c.hero), `count ${n}`).toBe(false)
    }
  })

  it('stretches the last tablet cell only when the count is odd', () => {
    for (const n of COUNTS.filter((x) => x > 0)) {
      const wide = layoutGrid(n).map((c) => c.tabletWide)
      expect(wide.slice(0, -1).every((w) => w === false), `count ${n}`).toBe(true)
      expect(wide[n - 1], `count ${n}`).toBe(n % 2 === 1)
    }
  })
})

describe('cellClass', () => {
  it('maps a cell to its CSS classes', () => {
    expect(cellClass({ span: 6, hero: true, tabletWide: true })).toBe('cx-cell-6 cx-cell-hero cx-cell-md-wide')
    expect(cellClass({ span: 3, hero: false, tabletWide: false })).toBe('cx-cell-3')
  })
})
