import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
import { useAuthStore } from './stores/auth'

const routes = [
  { path: '/', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { requiresAuth: true } },
  { path: '/products', name: 'products', component: () => import('./views/ProductsView.vue'), meta: { requiresAuth: true } },
  { path: '/products/new', name: 'product-new', component: () => import('./views/ProductFormView.vue'), meta: { requiresAuth: true } },
  { path: '/products/:id/edit', name: 'product-edit', component: () => import('./views/ProductFormView.vue'), meta: { requiresAuth: true } },
  { path: '/brands', name: 'brands', component: () => import('./views/BrandsModelsView.vue'), meta: { requiresAuth: true } },
  { path: '/orders', name: 'orders', component: () => import('./views/OrdersView.vue'), meta: { requiresAuth: true } },
  { path: '/promotions', name: 'promotions', component: () => import('./views/PromotionsView.vue'), meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue'), meta: { requiresAuth: true } },
  { path: '/audit', name: 'audit', component: () => import('./views/AuditView.vue'), meta: { requiresAuth: true } },
  { path: '/help', name: 'help', component: () => import('./views/HelpView.vue'), meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia) // Usar pinia ANTES que el router para poder inyectar stores en beforeEach

window.addEventListener('auth:unauthorized', () => {
  const authStore = useAuthStore()
  authStore.reset()

  if (router.currentRoute.value.name !== 'login') {
    router.push('/login')
  }
})

// Guard de Autenticación Real (M4.2)
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  
  // En la primera carga, verificar la cookie
  if (authStore.isInitializing) {
    await authStore.checkSession()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    next('/') // Si ya estoy logueado y voy a /login, ir al dashboard
  } else {
    next()
  }
})

app.use(router)
app.mount('#app')
