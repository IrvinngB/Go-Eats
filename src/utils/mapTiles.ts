// Raster tile source for every Leaflet map in the app.
//
// Default: the OpenStreetMap standard tile server (no API key). Its tile usage
// policy (operations.osmfoundation.org/policies/tiles) is meant for light,
// non-commercial use. Production should point to a keyed provider or its own
// tile server by setting these build-time env vars:
//   VITE_MAP_TILE_URL          e.g. https://tiles.example.com/{z}/{x}/{y}.png?key=...
//   VITE_MAP_TILE_ATTRIBUTION  e.g. © Example Maps © OpenStreetMap contributors
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_TILE_ATTRIBUTION = '© OpenStreetMap contributors'

export const TILE_URL: string = import.meta.env.VITE_MAP_TILE_URL || DEFAULT_TILE_URL
export const TILE_ATTRIBUTION: string = import.meta.env.VITE_MAP_TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION
