import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'
import { routes } from './router'
import { installGuards, installSessionExpiry } from './guards'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './stores/useGoEatsStore'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  const store = useGoEatsStore(pinia)
  // Restore the session (GET /users/me) before the first sync and before any guard decision.
  // restaurarSesion never logs out on its own failures; a rejection still lets the app mount anonymous.
  const restored = store.restaurarSesion()
  installGuards(router, store, restored)
  installSessionExpiry(router, store)
  await restored.catch(() => undefined)
  app.use(router)
  app.mount('#app')
}

bootstrap()
