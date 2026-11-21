/**
 * Demo accounts and their shared password. Loaded ONLY through a dynamic `import()` guarded by
 * `DEMO_SWITCHER` (src/config.ts), so a build with the flag off never emits this module and the
 * credentials never reach the production bundle.
 */
export interface DemoAccount {
  email: string
  role: string
  name: string
  label: string
  avatar: string
}

export const DEMO_PASSWORD = 'demo1234'

export const CUENTAS_DEMO: DemoAccount[] = [
  { email: 'carlos@ejemplo.pa', role: 'customer', name: 'Carlos Andrade', label: 'Cliente (Carlos)', avatar: 'CA' },
  { email: 'hector.endara@ejemplo.pa', role: 'merchant', name: 'Héctor Endara', label: 'Comercio (Diablicos)', avatar: 'HE' },
  { email: 'maria.cedeno@ejemplo.pa', role: 'courier', name: 'María Cedeño', label: 'Repartidor (María)', avatar: 'MC' },
  { email: 'javier.morales@ejemplo.pa', role: 'courier', name: 'Javier Morales', label: 'Repartidor (Javier)', avatar: 'JM' },
  { email: 'contabilidad@goeats.pa', role: 'accountant', name: 'Marta Pinzón', label: 'Contabilidad (Marta)', avatar: 'MP' },
  { email: 'admin@goeats.pa', role: 'admin', name: 'Administrador General', label: 'Admin (Go Eats)', avatar: 'AG' },
]

/** Credentials prefilled in the login form when the demo flag is on. */
export const DEMO_LOGIN = { email: CUENTAS_DEMO[0].email, password: DEMO_PASSWORD }
