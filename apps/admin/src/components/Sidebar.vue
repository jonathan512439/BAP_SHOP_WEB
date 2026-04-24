<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBrandingStore } from '../stores/branding'

defineProps<{
  isOpen?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const brandingStore = useBrandingStore()
const brandLogoSrc = computed(() => brandingStore.branding.brand_logo_url || '')
const brandTitle = computed(() => brandingStore.branding.store_name || 'BAP Shop')

const navSections = [
  {
    label: 'Operacion',
    items: [
      { name: 'Dashboard', path: '/' },
      { name: 'Pedidos', path: '/orders' },
      { name: 'Promociones', path: '/promotions' },
    ],
  },
  {
    label: 'Catalogo',
    items: [
      { name: 'Productos', path: '/products' },
      { name: 'Marcas y Modelos', path: '/brands' },
    ],
  },
  {
    label: 'Configuracion',
    items: [
      { name: 'Ajustes', path: '/settings' },
      { name: 'Auditoria', path: '/audit' },
      { name: 'Ayuda', path: '/help' },
    ],
  },
]

const isActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

const handleLogout = async () => {
  await authStore.logout()
  emit('close')
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar-container" :class="{ 'sidebar-open': isOpen }">
    <div class="brand">
      <div class="brand-copy">
        <img v-if="brandLogoSrc" :src="brandLogoSrc" alt="BAP Shop" class="brand-logo" />
        <div>
          <h1>{{ brandTitle }}</h1>
          <p>Panel de control</p>
        </div>
      </div>
      <button type="button" class="close-btn" aria-label="Cerrar menu lateral" @click="emit('close')">×</button>
    </div>

    <nav class="nav-menu">
      <section v-for="section in navSections" :key="section.label" class="nav-section">
        <h3 class="nav-section-label">{{ section.label }}</h3>
        <router-link
          v-for="item in section.items"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: isActive(item.path) }"
          @click="emit('close')"
        >
          {{ item.name }}
        </router-link>
      </section>
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
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border-light);
}

.brand-copy {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 12px;
}

.brand h1 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin: 0;
}

.brand p {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.close-btn {
  display: none;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.5rem;
  line-height: 1;
}

.nav-menu {
  flex: 1;
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-section-label {
  margin: 0;
  padding: 0 0.75rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-tertiary);
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 0.72rem 0.9rem;
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
  color: #082032;
}

.sidebar-footer {
  padding: 0.75rem;
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

@media (max-width: 900px) {
  .close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
