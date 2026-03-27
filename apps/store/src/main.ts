import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

// Rutas base
const routes = [
  { path: '/', redirect: '/zapatillas' },
  { path: '/zapatillas', name: 'sneakers', component: () => import('./views/CatalogView.vue') },
  { path: '/otros', name: 'others', component: () => import('./views/CatalogView.vue') },
  { path: '/products/:id', name: 'product-detail', component: () => import('./views/ProductDetailView.vue') },
  { path: '/checkout', name: 'checkout', component: () => import('./views/CheckoutView.vue') },
  { path: '/confirmacion', name: 'confirmation', component: () => import('./views/SuccessView.vue') },
  { path: '/success', redirect: '/confirmacion' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(pinia)
app.mount('#app')
