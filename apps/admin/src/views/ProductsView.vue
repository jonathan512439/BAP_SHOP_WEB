<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatPrice, PHYSICAL_CONDITION_LABELS } from '@bap-shop/shared'
import { apiClient } from '../api/client'
import BaseConfirmModal from '../components/BaseConfirmModal.vue'
import BasePagination from '../components/BasePagination.vue'
import BaseTable from '../components/BaseTable.vue'
import StatusBadge from '../components/StatusBadge.vue'

interface ProductRow {
  id: string
  type: string
  status: string
  name: string
  sort_order: number
  size?: string | null
  price: number
  physical_condition: keyof typeof PHYSICAL_CONDITION_LABELS
  brand_name?: string | null
  model_name?: string | null
  primary_image?: string | null
  promo_pct?: number | null
}

const router = useRouter()
const products = ref<ProductRow[]>([])
const isLoading = ref(true)
const isUpdating = ref<string | null>(null)
const productPendingStatusChange = ref<{ id: string; name: string; nextStatus: string } | null>(null)
const meta = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })

const filters = ref({
  status: '',
  type: '',
  search: '',
})

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activo' },
  { value: 'hidden', label: 'Oculto' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'sold', label: 'Vendido' },
]

const typeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'sneaker', label: 'Sneaker' },
  { value: 'other', label: 'Otro' },
]

const transitionOptions = computed(() => {
  return (status: string) => {
    if (status === 'draft') return [{ value: 'active', label: 'Activar' }]
    if (status === 'active') return [{ value: 'hidden', label: 'Ocultar' }, { value: 'sold', label: 'Vender' }]
    if (status === 'hidden') return [{ value: 'active', label: 'Activar' }, { value: 'sold', label: 'Vender' }]
    if (status === 'reserved') return [{ value: 'active', label: 'Liberar' }, { value: 'sold', label: 'Vender' }]
    return []
  }
})

const summary = computed(() => ({
  total: products.value.length,
  active: products.value.filter((product) => product.status === 'active').length,
  draft: products.value.filter((product) => product.status === 'draft').length,
  reserved: products.value.filter((product) => product.status === 'reserved').length,
}))

const pendingStatusMessage = computed(() => {
  if (!productPendingStatusChange.value) {
    return ''
  }

  return `Cambiar "${productPendingStatusChange.value.name}" a ${productPendingStatusChange.value.nextStatus}.`
})

const fetchProducts = async (page = 1) => {
  isLoading.value = true
  try {
    const res = await apiClient<{ data: ProductRow[]; meta: typeof meta.value }>('/admin/products', {
      params: {
        page,
        limit: 20,
        status: filters.value.status,
        type: filters.value.type,
        search: filters.value.search,
      },
    })
    products.value = res.data
    meta.value = res.meta
  } catch (error: any) {
    alert(`Error cargando productos: ${error.message}`)
  } finally {
    isLoading.value = false
  }
}

const refreshFromFilters = () => {
  fetchProducts(1)
}

const clearFilters = () => {
  filters.value.status = ''
  filters.value.type = ''
  filters.value.search = ''
  fetchProducts(1)
}

const reloadProducts = () => {
  fetchProducts(meta.value.page)
}

const requestStatusChange = (product: ProductRow, nextStatus: string) => {
  productPendingStatusChange.value = {
    id: product.id,
    name: product.name,
    nextStatus,
  }
}

const closeStatusChangeModal = () => {
  productPendingStatusChange.value = null
}

const confirmStatusChange = async () => {
  if (!productPendingStatusChange.value) return

  isUpdating.value = productPendingStatusChange.value.id
  try {
    await apiClient(`/admin/products/${productPendingStatusChange.value.id}/status`, {
      method: 'PATCH',
      body: { status: productPendingStatusChange.value.nextStatus },
    })
    await fetchProducts(meta.value.page)
    closeStatusChangeModal()
  } catch (error: any) {
    alert(`Error actualizando estado: ${error.message}`)
  } finally {
    isUpdating.value = null
  }
}

const reorderProduct = async (product: ProductRow, direction: 'up' | 'down') => {
  const currentIndex = products.value.findIndex((item) => item.id === product.id)
  if (currentIndex === -1) return

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  const adjacent = products.value[targetIndex]
  if (!adjacent) return

  isUpdating.value = product.id

  try {
    await Promise.all([
      apiClient(`/admin/products/${product.id}/sort`, {
        method: 'PATCH',
        body: { sort_order: adjacent.sort_order },
      }),
      apiClient(`/admin/products/${adjacent.id}/sort`, {
        method: 'PATCH',
        body: { sort_order: product.sort_order },
      }),
    ])

    await fetchProducts(meta.value.page)
  } catch (error: any) {
    alert(`Error reordenando producto: ${error.message}`)
  } finally {
    isUpdating.value = null
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<template>
  <div class="products-view">
    <div class="header-actions">
      <div class="filters-row">
        <input
          v-model="filters.search"
          type="search"
          class="form-input search-input"
          placeholder="Buscar por nombre, marca o modelo"
          @keyup.enter="refreshFromFilters"
        />
        <select v-model="filters.status" class="form-input" @change="refreshFromFilters">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select v-model="filters.type" class="form-input" @change="refreshFromFilters">
          <option v-for="option in typeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button type="button" class="btn btn-secondary" @click="refreshFromFilters">Filtrar</button>
        <button type="button" class="btn btn-secondary" @click="clearFilters">Limpiar</button>
        <button type="button" class="btn btn-secondary" @click="reloadProducts">Recargar</button>
      </div>

      <button type="button" class="btn btn-primary" @click="router.push('/products/new')">+ Nuevo producto</button>
    </div>

    <div class="summary-grid">
      <div class="summary-card admin-card">
        <span class="summary-label">En tabla</span>
        <strong>{{ summary.total }}</strong>
      </div>
      <div class="summary-card admin-card">
        <span class="summary-label">Activos</span>
        <strong>{{ summary.active }}</strong>
      </div>
      <div class="summary-card admin-card">
        <span class="summary-label">Borradores</span>
        <strong>{{ summary.draft }}</strong>
      </div>
      <div class="summary-card admin-card">
        <span class="summary-label">Reservados</span>
        <strong>{{ summary.reserved }}</strong>
      </div>
    </div>

    <div v-if="isLoading" class="loading">Cargando catalogo seguro...</div>

    <BaseTable
      v-else
      class="mt-4"
      :empty="products.length === 0"
      empty-message="No hay productos que coincidan con el filtro actual."
      :colspan="8"
    >
      <template #head>
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Producto</th>
            <th>Marca/Modelo</th>
            <th>Estado</th>
            <th>Precio</th>
            <th>Orden</th>
            <th>Mover</th>
            <th>Acciones</th>
          </tr>
        </thead>
      </template>

      <tr v-for="product in products" :key="product.id">
        <td>
          <div v-if="product.primary_image" class="img-preview">
            <img :src="`https://assets.bapshop.com/${product.primary_image}`" alt="" />
          </div>
          <div v-else class="img-preview empty">Sin img</div>
        </td>
        <td>
          <div class="fw-500">{{ product.name }}</div>
          <div class="text-xs text-secondary">
            {{ product.type }} | {{ PHYSICAL_CONDITION_LABELS[product.physical_condition] || product.physical_condition }}
            <span v-if="product.size"> | Talla {{ product.size }}</span>
          </div>
          <div class="text-xs text-secondary product-id">{{ product.id }}</div>
        </td>
        <td>
          <div>{{ product.brand_name || 'N/A' }}</div>
          <div class="text-xs text-secondary">{{ product.model_name || 'N/A' }}</div>
        </td>
        <td>
          <StatusBadge :status="product.status" kind="product" />
        </td>
        <td>
          <div class="fw-500">{{ formatPrice(product.price) }}</div>
          <div v-if="product.promo_pct" class="text-xs text-secondary">Promo {{ product.promo_pct }}%</div>
        </td>
        <td class="text-xs text-secondary">#{{ product.sort_order }}</td>
        <td class="actions-cell">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="isUpdating === product.id || products[0]?.id === product.id"
            @click="reorderProduct(product, 'up')"
          >
            Subir
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="isUpdating === product.id || products[products.length - 1]?.id === product.id"
            @click="reorderProduct(product, 'down')"
          >
            Bajar
          </button>
        </td>
        <td class="actions-cell">
          <button type="button" class="btn btn-secondary btn-sm" @click="router.push(`/products/${product.id}/edit`)">
            Editar
          </button>
          <button
            v-for="option in transitionOptions(product.status)"
            :key="option.value"
            type="button"
            class="btn btn-sm"
            :disabled="isUpdating === product.id"
            @click="requestStatusChange(product, option.value)"
          >
            {{ option.label }}
          </button>
        </td>
      </tr>
    </BaseTable>

    <BasePagination
      v-if="meta.totalPages > 1"
      :page="meta.page"
      :total-pages="meta.totalPages"
      @previous="fetchProducts(meta.page - 1)"
      @next="fetchProducts(meta.page + 1)"
    />

    <BaseConfirmModal
      :is-open="!!productPendingStatusChange"
      title="Cambiar estado del producto"
      :message="pendingStatusMessage"
      confirm-label="Confirmar cambio"
      variant="warning"
      :is-loading="!!isUpdating"
      @cancel="closeStatusChangeModal"
      @confirm="confirmStatusChange"
    />
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.filters-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex: 1;
}

.search-input {
  min-width: 280px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.summary-label {
  font-size: 0.78rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.img-preview {
  width: 48px;
  height: 48px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.img-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fw-500 {
  font-weight: 500;
}

.text-xs {
  font-size: 0.75rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.product-id {
  font-family: monospace;
}

.mt-4 {
  margin-top: 1.5rem;
}

.btn-sm {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
