<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import { useBrandingStore } from './stores/branding'
import { useConnectivity } from './composables/useConnectivity'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const router = useRouter()
const brandingStore = useBrandingStore()
const authStore = useAuthStore()
const { isOnline } = useConnectivity()
const isLoginRoute = computed(() => route.name === 'login')
const isSidebarOpen = ref(false)
const globalSearchQuery = ref('')
const isLoggingOut = ref(false)

const handleGlobalSearch = () => {
  if (globalSearchQuery.value.trim()) {
    router.push({ path: '/products', query: { search: globalSearchQuery.value.trim() } })
    globalSearchQuery.value = ''
  }
}

const handleLogout = async () => {
  isLoggingOut.value = true
  try {
    await authStore.logout()
    router.push('/login')
  } finally {
    isLoggingOut.value = false
  }
}

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    dashboard: 'Resumen general',
    products: 'Catalogo de productos',
    'product-new': 'Nuevo Producto',
    'product-edit': 'Editar Producto',
    brands: 'Marcas y Modelos',
    orders: 'Gestion de pedidos',
    promotions: 'Promociones',
    settings: 'Ajustes del sistema',
    audit: 'Auditoria',
    help: 'Centro de ayuda',
    login: 'Login',
  }

  return titles[String(route.name ?? '')] || 'BAP-SHOP Admin'
})

function setFavicon(url: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')

  if (!url) {
    link?.remove()
    return
  }

  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  link.type = url.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
  link.href = url
}

watch(
  () => route.fullPath,
  () => {
    isSidebarOpen.value = false
  }
)

onMounted(() => {
  brandingStore.loadBranding()
})

watch(
  () => brandingStore.branding.brand_logo_url,
  (logoUrl) => {
    setFavicon(logoUrl || null)
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="!isOnline" class="connection-banner" role="alert">
    Sin conexion a internet. Evita guardar cambios hasta recuperar la conexion.
  </div>

  <div class="admin-layout" v-if="!isLoginRoute">
    <div
      v-if="isSidebarOpen"
      class="sidebar-backdrop"
      @click="isSidebarOpen = false"
    />
    <Sidebar
      class="sidebar"
      :is-open="isSidebarOpen"
      @close="isSidebarOpen = false"
    />
    <main class="main-content">
      <header class="topbar">
        <div class="topbar-title">
          <button
            type="button"
            class="menu-toggle"
            aria-label="Abrir menu lateral"
            @click="isSidebarOpen = true"
          >
            <span />
            <span />
            <span />
          </button>
          <h2>{{ pageTitle }}</h2>
        </div>
        <div class="topbar-right">
          <div class="global-search">
            <input
              v-model="globalSearchQuery"
              type="search"
              placeholder="Buscar productos..."
              @keyup.enter="handleGlobalSearch"
            />
          </div>
          <button type="button" class="btn-logout" @click="handleLogout" :disabled="isLoggingOut">
            {{ isLoggingOut ? 'Saliendo...' : 'Cerrar Sesion' }}
          </button>
        </div>
      </header>
      <div class="page-container">
        <RouterView />
      </div>
    </main>
  </div>
  
  <div v-else class="login-layout">
    <RouterView />
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-main);
}

.connection-banner {
  position: fixed;
  inset: 0 0 auto;
  z-index: 100;
  padding: 0.75rem 1rem;
  text-align: center;
  background: #7f1d1d;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
}

.connection-banner + .admin-layout,
.connection-banner + .login-layout {
  padding-top: 2.75rem;
}

.sidebar {
  width: 250px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  height: 64px;
  background: linear-gradient(90deg, rgba(18, 28, 48, 0.95), rgba(26, 39, 64, 0.88));
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.global-search input {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: rgba(0, 0, 0, 0.2);
  color: white;
}

.btn-logout {
  padding: 0.5rem 1rem;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.topbar-logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 10px;
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.topbar h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.menu-toggle {
  display: none;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: rgba(11, 18, 32, 0.65);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.25rem;
}

.menu-toggle span {
  width: 1rem;
  height: 2px;
  background: var(--text-primary);
  border-radius: 999px;
}

.page-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

.sidebar-backdrop {
  display: none;
}

.login-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-main);
}

@media (max-width: 900px) {
  .admin-layout {
    position: relative;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
    width: min(82vw, 280px);
    transform: translateX(-100%);
    transition: transform var(--transition-fast);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  }

  .sidebar.sidebar-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    z-index: 30;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .topbar {
    padding: 0 1rem;
  }

  .user-menu span {
    display: none;
  }

  .page-container {
    padding: 1rem;
  }
}

@media (max-width: 640px) {
  .global-search {
    display: none;
  }

  .layout-content {
    padding: 1rem;
  }
}
</style>
