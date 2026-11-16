import type { RouteRecordRaw } from 'vue-router'

export type Role = 'customer' | 'merchant' | 'courier' | 'accountant' | 'admin'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tiendas' },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/tiendas', name: 'stores', component: () => import('./views/customer/StoresView.vue') },
  { path: '/tiendas/:id', name: 'store-detail', component: () => import('./views/customer/StoreDetailView.vue') },
  { path: '/pedidos', name: 'orders', component: () => import('./views/customer/OrdersView.vue') },
  { path: '/perfil', name: 'profile', component: () => import('./views/customer/ProfileView.vue') },
  { path: '/panel-comercio', name: 'merchant', component: () => import('./views/merchant/MerchantView.vue') },
  { path: '/panel-repartidor', name: 'courier', component: () => import('./views/courier/CourierView.vue') },
  { path: '/panel-contabilidad', name: 'accountant', component: () => import('./views/accountant/AccountingView.vue') },
  { path: '/panel-admin', name: 'admin', component: () => import('./views/admin/AdminView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/tiendas' },
]
