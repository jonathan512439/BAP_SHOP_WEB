<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatPrice } from '@bap-shop/shared'
import { apiClient } from '../api/client'
import { useBrandingStore } from '../stores/branding'

interface DashboardOrder {
  id: string
  order_code: string
  customer_name: string
  status: string
  total: number
  created_at: string
}

interface DashboardAudit {
  id: string
  action: string
  entity_type: string
  entity_id: string
  admin_username?: string
  created_at: string
}

const router = useRouter()
const brandingStore = useBrandingStore()
const isLoading = ref(true)
const summary = ref({
  pendingOrders: 0,
  activeProducts: 0,
  reservedProducts: 0,
  confirmedOrders: 0,
})
const recentOrders = ref<DashboardOrder[]>([])
const recentAudit = ref<DashboardAudit[]>([])

const cards = computed(() => [
  {
    title: 'Pedidos pendientes',
    value: summary.value.pendingOrders,
    tone: 'text-accent',
    actionLabel: 'Ver pedidos',
    action: () => router.push('/orders'),
  },
  {
    title: 'Articulos reservados',
    value: summary.value.reservedProducts,
    tone: 'text-warning',
    actionLabel: 'Ver catalogo',
    action: () => router.push('/products'),
  },
  {
    title: 'Catalogo activo',
    value: summary.value.activeProducts,
    tone: 'text-success',
    actionLabel: 'Ir a productos',
    action: () => router.push('/products'),
  },
  {
    title: 'Pedidos confirmados',
    value: summary.value.confirmedOrders,
    tone: '',
    actionLabel: 'Ver auditoria',
    action: () => router.push('/audit'),
  },
])

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
const fallbackLogoSrc = '/brand/bap-logo.svg'
const brandLogoSrc = computed(() => brandingStore.branding.brand_logo_url || fallbackLogoSrc)
const adminBannerTitle = computed(() => brandingStore.branding.admin_banner_title || 'BAP Shop Admin')
const adminBannerText = computed(() => (
  brandingStore.branding.admin_banner_text ||
  'Gestion centralizada de catalogo, promociones, pedidos y ajustes.'
))

onMounted(async () => {
  brandingStore.loadBranding()
  isLoading.value = true

  try {
    const [
      pendingOrdersRes,
      activeProductsRes,
      reservedProductsRes,
      confirmedOrdersRes,
      recentOrdersRes,
      recentAuditRes,
    ] = await Promise.all([
      apiClient<{ meta: { total: number } }>('/admin/orders', { params: { status: 'pending', page: 1, limit: 1 } }),
      apiClient<{ meta: { total: number } }>('/admin/products', { params: { status: 'active', page: 1, limit: 1 } }),
      apiClient<{ meta: { total: number } }>('/admin/products', { params: { status: 'reserved', page: 1, limit: 1 } }),
      apiClient<{ meta: { total: number } }>('/admin/orders', { params: { status: 'confirmed', page: 1, limit: 1 } }),
      apiClient<{ data: DashboardOrder[] }>('/admin/orders', { params: { page: 1, limit: 5 } }),
      apiClient<{ data: DashboardAudit[] }>('/admin/audit', { params: { page: 1, limit: 5 } }),
    ])

    summary.value.pendingOrders = pendingOrdersRes.meta?.total ?? 0
    summary.value.activeProducts = activeProductsRes.meta?.total ?? 0
    summary.value.reservedProducts = reservedProductsRes.meta?.total ?? 0
    summary.value.confirmedOrders = confirmedOrdersRes.meta?.total ?? 0

    recentOrders.value = recentOrdersRes.data
    recentAudit.value = recentAuditRes.data
  } catch (error) {
    console.error('Error cargando dashboard', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="dashboard-view">
    <section class="brand-banner admin-card">
      <img
        v-if="brandingStore.branding.admin_banner_image_url"
        :src="brandingStore.branding.admin_banner_image_url"
        :alt="adminBannerTitle"
        class="brand-banner-image"
      />
      <img :src="brandLogoSrc" alt="BAP Shop" class="brand-banner-logo" />
      <div>
        <p class="brand-kicker">Marca activa</p>
        <h2>{{ adminBannerTitle }}</h2>
        <p class="brand-copy">{{ adminBannerText }}</p>
      </div>
    </section>

    <div class="stats-grid">
      <div v-for="card in cards" :key="card.title" class="stat-card admin-card">
        <h3>{{ card.title }}</h3>
        <span class="stat-value" :class="card.tone">{{ isLoading ? '...' : card.value }}</span>
        <button type="button" class="btn btn-secondary btn-sm" @click="card.action">
          {{ card.actionLabel }}
        </button>
      </div>
    </div>

    <div class="dashboard-grid mt-4">
      <section class="admin-card">
        <div class="section-header">
          <h3>Pedidos recientes</h3>
          <button type="button" class="btn btn-secondary btn-sm" @click="router.push('/orders')">Abrir modulo</button>
        </div>

        <div v-if="isLoading" class="empty-copy">Cargando...</div>
        <div v-else-if="recentOrders.length === 0" class="empty-copy">Todavia no hay pedidos recientes.</div>

        <div v-else class="stack-list">
          <button
            v-for="order in recentOrders"
            :key="order.id"
            type="button"
            class="list-row"
            @click="router.push('/orders')"
          >
            <div>
              <strong>{{ order.order_code }}</strong>
              <p>{{ order.customer_name }}</p>
            </div>
            <div class="row-meta">
              <span>{{ formatPrice(order.total) }}</span>
              <small>{{ formatDate(order.created_at) }}</small>
            </div>
          </button>
        </div>
      </section>

      <section class="admin-card">
        <div class="section-header">
          <h3>Auditoria reciente</h3>
          <button type="button" class="btn btn-secondary btn-sm" @click="router.push('/audit')">Abrir modulo</button>
        </div>

        <div v-if="isLoading" class="empty-copy">Cargando...</div>
        <div v-else-if="recentAudit.length === 0" class="empty-copy">Todavia no hay eventos registrados.</div>

        <div v-else class="stack-list">
          <button
            v-for="log in recentAudit"
            :key="log.id"
            type="button"
            class="list-row"
            @click="router.push('/audit')"
          >
            <div>
              <strong>{{ log.action }}</strong>
              <p>{{ log.entity_type }} · {{ log.entity_id }}</p>
            </div>
            <div class="row-meta">
              <span>{{ log.admin_username || 'admin' }}</span>
              <small>{{ formatDate(log.created_at) }}</small>
            </div>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.brand-banner {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
  border: 1px solid rgba(245, 158, 11, 0.16);
}

.brand-banner-image {
  width: 100%;
  min-height: 140px;
  max-height: 220px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid var(--border-light);
}

.brand-banner-logo {
  width: clamp(88px, 11vw, 132px);
  height: auto;
  object-fit: contain;
}

.brand-kicker {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--accent-primary);
}

.brand-banner h2 {
  margin: 0 0 0.35rem;
  font-size: 1.4rem;
}

.brand-copy {
  margin: 0;
  color: var(--text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 1100px) {
  .dashboard-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 172px;
}

.stat-card h3 {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
}

.stack-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  text-align: left;
}

.list-row:hover {
  border-color: var(--border-focus);
}

.list-row p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.row-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  color: var(--text-secondary);
}

.row-meta small {
  font-size: 0.75rem;
}

.empty-copy {
  color: var(--text-tertiary);
}

.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
}

.text-accent {
  color: var(--accent-primary);
}

.text-warning {
  color: var(--warning);
}

.text-success {
  color: var(--success);
}

.mt-4 {
  margin-top: 1.5rem;
}

@media (max-width: 900px) {
  .brand-banner {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
  }

  .stat-card {
    min-height: auto;
    gap: 0.55rem;
    padding: 0.95rem;
  }

  .stat-card h3 {
    font-size: 0.78rem;
    line-height: 1.25;
  }

  .stat-value {
    font-size: 1.55rem;
  }

  .dashboard-grid {
    gap: 1rem;
  }

  .section-header {
    margin-bottom: 0.75rem;
  }

  .list-row {
    padding: 0.72rem 0.8rem;
    gap: 0.75rem;
  }

  .list-row strong {
    font-size: 0.84rem;
  }

  .list-row p,
  .row-meta,
  .row-meta small {
    font-size: 0.74rem;
  }

  .btn-sm {
    padding: 0.25rem 0.45rem;
    font-size: 0.72rem;
  }
}

@media (max-width: 560px) {
  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
