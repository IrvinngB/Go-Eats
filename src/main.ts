import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'
import { routes } from './router'
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
  // Restore the session (GET /users/me) before the first sync and before the router resolves.
  try {
    await useGoEatsStore(pinia).restaurarSesion()
  } catch {
    // restaurarSesion never logs out on its own failures; mount anyway.
  }
  app.use(router)
  app.mount('#app')
}

bootstrap()
