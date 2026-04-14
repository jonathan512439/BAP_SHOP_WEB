import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { setDocumentMeta } from './lib/seo'
import './style.css'

// Rutas base
const routes = [
  { path: '/', redirect: '/zapatillas' },
  {
    path: '/zapatillas',
    name: 'sneakers',
    component: () => import('./views/CatalogView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Zapatillas Disponibles',
      description:
        'Explora zapatillas disponibles en BAP Shop, tienda de Oruro - Bolivia, con fotos, tallas y compra coordinada por WhatsApp.',
      robots: 'index,follow',
    },
  },
  {
    path: '/otros',
    name: 'others',
    component: () => import('./views/CatalogView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Otros Articulos',
      description:
        'Descubre accesorios y articulos complementarios disponibles en BAP Shop, tienda ubicada en Oruro - Bolivia.',
      robots: 'index,follow',
    },
  },
  {
    path: '/products/:id',
    name: 'product-detail',
    component: () => import('./views/ProductDetailView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Detalle del Producto',
      description: 'Consulta fotos, estado, talla y precio del producto antes de coordinar tu compra.',
      robots: 'index,follow',
    },
  },
  {
    path: '/checkout',
    name: 'checkout',
    component: () => import('./views/CheckoutView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Solicitar Compra',
      description: 'Completa tus datos y coordina tu compra con BAP Shop en Oruro - Bolivia.',
      robots: 'noindex,nofollow',
    },
  },
  {
    path: '/confirmacion',
    name: 'confirmation',
    component: () => import('./views/SuccessView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Solicitud Enviada',
      description: 'Tu solicitud fue enviada y puedes continuar la coordinacion final por WhatsApp con la tienda.',
      robots: 'noindex,nofollow',
    },
  },
  {
    path: '/como-comprar',
    name: 'how-to-buy',
    component: () => import('./views/HowToBuyView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Como Comprar',
      description:
        'Conoce el paso a paso para elegir tus productos y coordinar tu compra en BAP Shop, Oruro - Bolivia.',
      robots: 'index,follow',
    },
  },
  {
    path: '/nosotros',
    name: 'about',
    component: () => import('./views/AboutView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Nosotros',
      description: 'Conoce a BAP Shop, tienda de Oruro - Bolivia, su propuesta y su forma de atencion.',
      robots: 'index,follow',
    },
  },
  {
    path: '/preguntas-frecuentes',
    name: 'faq',
    component: () => import('./views/FaqView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Preguntas Frecuentes',
      description: 'Resuelve dudas sobre compras, entregas, envios y atencion de BAP Shop en Oruro - Bolivia.',
      robots: 'index,follow',
    },
  },
  {
    path: '/politicas',
    name: 'policies',
    component: () => import('./views/PoliciesView.vue'),
    meta: {
      title: 'BAP Shop Oruro - Bolivia | Politicas y Condiciones',
      description: 'Revisa las condiciones de compra, pagos, entregas y atencion de BAP Shop en Oruro - Bolivia.',
      robots: 'index,follow',
    },
  },
  { path: '/success', redirect: '/confirmacion' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }

    if (to.fullPath !== from.fullPath) {
      return { top: 0, left: 0 }
    }

    return false
  },
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'BAP Shop Oruro - Bolivia | Tienda de Sneakers'
  const description =
    typeof to.meta.description === 'string'
      ? to.meta.description
      : 'Tienda online de Oruro - Bolivia con zapatillas y articulos disponibles para coordinar tu compra por WhatsApp.'
  const robots = typeof to.meta.robots === 'string' ? to.meta.robots : 'index,follow'

  setDocumentMeta({
    title,
    description,
    canonicalPath: to.path,
    robots,
    ogType: 'website',
  })
})

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(pinia)
app.mount('#app')
