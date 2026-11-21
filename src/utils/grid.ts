// Count-aware catalog grid (desing.md section 6: tiles add up to complete rows, no holes).
// Desktop uses a 6-column grid: rows of three tiles (span 2); a tail of 1 or 2 leftover tiles is
// stretched so the last row is still full. Tablet uses 2 columns (the last odd tile spans both).
// Mobile is always one column.

export interface GridCell {
  /** Columns taken on the 6-column desktop grid: 6, 3 or 2. */
  span: 2 | 3 | 6
  /** A lone item becomes the hero tile of the section. */
  hero: boolean
  /** Spans both columns on the 2-column tablet grid (the odd last item). */
  tabletWide: boolean
}

export function layoutGrid(count: number): GridCell[] {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return []
  if (n === 1) return [{ span: 6, hero: true, tabletWide: true }]

  // remainder 1 -> the last four tiles become a 2x2 block; remainder 2 -> the last two share a row.
  const rest = n % 3
  const stretched = rest === 1 ? 4 : rest === 2 ? 2 : 0
  return Array.from({ length: n }, (_, i) => ({
    span: i >= n - stretched ? 3 : 2,
    hero: false,
    tabletWide: n % 2 === 1 && i === n - 1,
  }))
}

export function cellClass(cell: GridCell): string {
  return [`cx-cell-${cell.span}`, cell.hero ? 'cx-cell-hero' : '', cell.tabletWide ? 'cx-cell-md-wide' : '']
    .filter(Boolean)
    .join(' ')
}
