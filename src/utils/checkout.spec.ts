import { describe, it, expect } from 'vitest'
import { resumenPedido } from './checkout'

describe('resumenPedido', () => {
  it('adds the delivery fee to the subtotal', () => {
    expect(resumenPedido(12.5, 2.5)).toEqual({ subtotal: 12.5, envio: 2.5, total: 15 })
  })

  it('rounds to cents so floating point noise never reaches the screen', () => {
    expect(resumenPedido(0.1 + 0.2, 1.1)).toEqual({ subtotal: 0.3, envio: 1.1, total: 1.4 })
  })

  it('treats a missing fee as zero', () => {
    expect(resumenPedido(8, undefined)).toEqual({ subtotal: 8, envio: 0, total: 8 })
  })
})
