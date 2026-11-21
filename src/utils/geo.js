// Coordenadas geográficas y utilidades para Ciudad de Panamá

export const COORDENADAS_ZONAS = {
  'san-francisco': { lat: 8.9865, lng: -79.4975, color: '#00B19D', radioM: 1800, nombre: 'San Francisco' },
  'costa-del-este': { lat: 9.0150, lng: -79.4670, color: '#3B82F6', radioM: 2200, nombre: 'Costa del Este' },
  'bella-vista': { lat: 8.9780, lng: -79.5250, color: '#F59E0B', radioM: 1600, nombre: 'Bella Vista' },
  'condado-del-rey': { lat: 9.0350, lng: -79.5280, color: '#8B5CF6', radioM: 2000, nombre: 'Condado del Rey' },
  'el-cangrejo': { lat: 8.9870, lng: -79.5260, color: '#EC4899', radioM: 1400, nombre: 'El Cangrejo' },
  'punta-pacifica': { lat: 8.9760, lng: -79.5080, color: '#10B981', radioM: 1500, nombre: 'Punta Pacífica' },
  'obarrio': { lat: 8.9880, lng: -79.5160, color: '#6366F1', radioM: 1400, nombre: 'Obarrio' },
  'marbella': { lat: 8.9790, lng: -79.5170, color: '#F97316', radioM: 1300, nombre: 'Marbella' },
  'clayton': { lat: 9.0050, lng: -79.5750, color: '#14B8A6', radioM: 2500, nombre: 'Clayton' },
  'brisas-del-golf': { lat: 9.0600, lng: -79.4600, color: '#06B6D4', radioM: 2600, nombre: 'Brisas del Golf' },
}

export const CENTRO_PANAMA = { lat: 8.9865, lng: -79.5150 }

export function getCoordenadasComercio(codigo, slugZona) {
  const base = COORDENADAS_ZONAS[slugZona] || CENTRO_PANAMA
  const seed = (codigo || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const offsetLat = ((seed % 15) - 7) * 0.0016
  const offsetLng = (((seed * 7) % 15) - 7) * 0.0016
  return {
    lat: +(base.lat + offsetLat).toFixed(5),
    lng: +(base.lng + offsetLng).toFixed(5),
  }
}

// Fórmula de Haversine para distancia en kilómetros
export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371 // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return +(R * c).toFixed(2)
}

// Encuentra la zona más cercana a una coordenada GPS
export function encontrarZonaMasCercana(lat, lng) {
  let menorDistancia = Infinity
  let zonaCercana = 'san-francisco'

  for (const [slug, datos] of Object.entries(COORDENADAS_ZONAS)) {
    const dist = calcularDistanciaKm(lat, lng, datos.lat, datos.lng)
    if (dist < menorDistancia) {
      menorDistancia = dist
      zonaCercana = slug
    }
  }

  return { slug: zonaCercana, distanciaKm: menorDistancia }
}

// Distancia haversine en metros, sin redondear (calcularDistanciaKm redondea a 10 m).
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ¿El punto cae dentro del círculo (centro + radioM) de alguna zona? El borde cuenta como dentro.
// Solo informativo: la cobertura existe únicamente en el frontend y nunca bloquea un pedido.
export function puntoEnCobertura(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  return Object.values(COORDENADAS_ZONAS).some((z) => distanciaMetros(lat, lng, z.lat, z.lng) <= z.radioM)
}
