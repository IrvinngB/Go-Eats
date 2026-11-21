import { describe, it, expect } from 'vitest'
import {
  coincideBusqueda,
  extraerCategorias,
  filtrarProductos,
  filtrarYOrdenarComercios,
  tienePromocion,
} from './catalog'

describe('catalog browsing helpers', () => {
  it('matches search queries case- and accent-insensitively', () => {
    expect(coincideBusqueda('Fonda La Istmeña', 'istmena')).toBe(true)
    expect(coincideBusqueda('Café & Panadería', 'CAFE')).toBe(true)
    expect(coincideBusqueda('Sancocho de gallina', '  gallina ')).toBe(true)
    expect(coincideBusqueda('Sancocho de gallina', 'pizza')).toBe(false)
    expect(coincideBusqueda('Cualquier cosa', '')).toBe(true)
  })

  it('detects promotions when precioRegular is strictly greater than effective precio', () => {
    expect(tienePromocion({ precio: 4.5, precioRegular: 6.0 })).toBe(true)
    expect(tienePromocion({ precio: 6.0, precioRegular: 6.0 })).toBe(false)
    expect(tienePromocion({ precio: 6.0 })).toBe(false)
  })

  it('extracts unique non-empty categories preserving first-seen order', () => {
    const items = [
      { categoria: 'Platos fuertes' },
      { categoria: 'Bebidas' },
      { categoria: 'Platos fuertes' },
      { categoria: ' ' },
    ]
    expect(extraerCategorias(items, 'categoria')).toEqual(['Platos fuertes', 'Bebidas'])
  })

  it('filters merchants by name/description/category and sorts by rating or name', () => {
    const comercios = [
      { id: 'c1', nombre: 'Verde Bistro', tipo: 'Saludable', descripcion: 'Bowls y jugos', rating: 4.6, activo: false },
      { id: 'c2', nombre: 'Fonda Istmeña', tipo: 'Típica panameña', descripcion: 'Sancocho y arroz', rating: 4.9, activo: true },
      { id: 'c3', nombre: 'Asados El Istmo', tipo: 'Típica panameña', descripcion: 'Carnes a la brasa', rating: 4.7, activo: true },
    ]

    expect(filtrarYOrdenarComercios(comercios, { busqueda: 'istmena' }).map((c) => c.id)).toEqual(['c2'])
    expect(filtrarYOrdenarComercios(comercios, { categoria: 'Típica panameña', orden: 'rating' }).map((c) => c.id)).toEqual(['c2', 'c3'])
    expect(filtrarYOrdenarComercios(comercios, { orden: 'nombre' }).map((c) => c.id)).toEqual(['c3', 'c2', 'c1'])
  })

  it('filters products by search query and category', () => {
    const productos = [
      { id: 'p1', nombre: 'Sancocho de gallina', descripcion: 'Con ñame y culantro', categoria: 'Sopas', precio: 5.5, precioRegular: 6.5 },
      { id: 'p2', nombre: 'Chicha de maracuyá', descripcion: 'Natural', categoria: 'Bebidas', precio: 2.0, precioRegular: 2.0 },
    ]

    expect(filtrarProductos(productos, { busqueda: 'maracuya' }).map((p) => p.id)).toEqual(['p2'])
    expect(filtrarProductos(productos, { busqueda: 'name' }).map((p) => p.id)).toEqual(['p1'])
    expect(filtrarProductos(productos, { categoria: 'Sopas' }).map((p) => p.id)).toEqual(['p1'])
    expect(filtrarProductos(productos, { busqueda: 'sushi' })).toEqual([])
  })
})
