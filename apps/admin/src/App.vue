<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import { useBrandingStore } from './stores/branding'

const route = useRoute()
const brandingStore = useBrandingStore()
const isLoginRoute = computed(() => route.name === 'login')
const isSidebarOpen = ref(false)
const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    products: 'Productos',
    'product-new': 'Nuevo Producto',
    'product-edit': 'Editar Producto',
    brands: 'Marcas y Modelos',
    orders: 'Pedidos',
    promotions: 'Promociones',
    settings: 'Ajustes',
    audit: 'Auditoria',
    help: 'Ayuda',
    login: 'Login',
  }

  return titles[String(route.name ?? '')] || 'BAP-SHOP Admin'
})
const brandLogoSrc = computed(() => brandingStore.branding.brand_logo_url || '')

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
        <div class="user-menu">
          <img v-if="brandLogoSrc" :src="brandLogoSrc" alt="BAP Shop" class="topbar-logo" />
          <span>Admin</span>
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
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
}

.user-menu {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-secondary);
  font-weight: 600;
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
  background: var(--bg-secondary);
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
</style>
