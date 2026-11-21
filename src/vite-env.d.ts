/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_MAP_TILE_URL?: string
  readonly VITE_MAP_TILE_ATTRIBUTION?: string
  /** Build-time, default off: only the exact string 'true' shows the demo account switcher. */
  readonly VITE_ENABLE_DEMO_SWITCHER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
