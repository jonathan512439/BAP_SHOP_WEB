<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const navItems = [
  { name: 'Dashboard', path: '/' },
  { name: 'Catalogo', path: '/products' },
  { name: 'Marcas y Modelos', path: '/brands' },
  { name: 'Promociones', path: '/promotions' },
  { name: 'Pedidos', path: '/orders' },
  { name: 'Ajustes', path: '/settings' },
  { name: 'Auditoria', path: '/audit' },
  { name: 'Ayuda', path: '/help' },
]

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar-container">
    <div class="brand">
      <h1>BAP Admin</h1>
    </div>

    <nav class="nav-menu">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-link"
        :class="{ active: route.path === item.path }"
      >
        {{ item.name }}
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <button type="button" class="nav-link logout-btn" @click="handleLogout">
        Cerrar sesion
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.brand {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.brand h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.nav-menu {
  flex: 1;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.nav-link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-link.active {
  background: var(--accent-primary);
  color: white;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-light);
}

.logout-btn {
  width: 100%;
  justify-content: flex-start;
  color: var(--text-secondary);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}
</style>
