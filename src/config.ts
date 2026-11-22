/**
 * Build-time flag (default OFF): shows the demo account switcher in the TopBar.
 * Only the exact string 'true' enables it. Baked in by Vite, so it must be set when BUILDING
 * (Docker build arg / .env.development), never at runtime.
 */
export const DEMO_SWITCHER: boolean = import.meta.env.VITE_ENABLE_DEMO_SWITCHER === 'true'
