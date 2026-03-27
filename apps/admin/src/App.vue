<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import Sidebar from './components/Sidebar.vue'

const route = useRoute()
const isLoginRoute = computed(() => route.name === 'login')
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

  return titles[String(route.name ?? '')] || 'BAP Admin'
})
</script>

<template>
  <div class="admin-layout" v-if="!isLoginRoute">
    <Sidebar class="sidebar" />
    <main class="main-content">
      <header class="topbar">
        <h2>{{ pageTitle }}</h2>
        <div class="user-menu">Admin</div>
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

.topbar h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.page-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

.login-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-main);
}
</style>
