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

type ProductAction = 'active' | 'hidden' | 'reserved' | 'sold' | 'delete'

interface ProductPendingAction {
  id: string
  name: string
  action: ProductAction
}

interface FeedbackModalState {
  title: string
  message: string
  variant: 'danger' | 'warning' | 'neutral'
}

const router = useRouter()
const products = ref<ProductRow[]>([])
const isLoading = ref(true)
const isUpdating = ref<string | null>(null)
const productPendingAction = ref<ProductPendingAction | null>(null)
const feedbackModal = ref<FeedbackModalState | null>(null)
const meta = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const publicAssetsBase = import.meta.env.VITE_ASSETS_URL || 'https://pub-470a5675dc7d4e9d949688372b59b080.r2.dev/public'

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

const actionLabels: Record<ProductAction, string> = {
  active: 'Activar',
  hidden: 'Ocultar',
  reserved: 'Reservar',
  sold: 'Vender',
  delete: 'Eliminar',
}

const actionClassMap: Record<ProductAction, string> = {
  active: 'btn-action-active',
  hidden: 'btn-action-hidden',
  reserved: 'btn-action-reserved',
  sold: 'btn-action-sold',
  delete: 'btn-action-delete',
}

const modalVariantMap: Record<ProductAction, 'danger' | 'warning' | 'neutral'> = {
  active: 'neutral',
  hidden: 'warning',
  reserved: 'warning',
  sold: 'danger',
  delete: 'danger',
}

const actionOptions = computed(() => {
  return (status: string): Array<{ value: ProductAction; label: string; className: string }> => {
    const options: ProductAction[] = []

    if (status !== 'active') options.push('active')
    if (status === 'active') options.push('hidden', 'reserved', 'sold')
    if (status === 'hidden') options.push('reserved', 'sold')
    if (status === 'sold') options.push('hidden')
    if (status === 'reserved') options.push('sold')
    if (status !== 'sold') options.push('delete')
    if (status === 'sold') options.push('delete')

    return options.map((value) => ({
      value,
      label: actionLabels[value],
      className: actionClassMap[value],
    }))
  }
})

const summary = computed(() => ({
  total: products.value.length,
  active: products.value.filter((product) => product.status === 'active').length,
  draft: products.value.filter((product) => product.status === 'draft').length,
  reserved: products.value.filter((product) => product.status === 'reserved').length,
}))

const pendingActionMessage = computed(() => {
  if (!productPendingAction.value) {
    return ''
  }

  if (productPendingAction.value.action === 'delete') {
    return `Eliminar "${productPendingAction.value.name}" del sistema. Esta accion borra el producto, sus imagenes y su promocion asociada.`
  }

  return `Cambiar "${productPendingAction.value.name}" a ${actionLabels[productPendingAction.value.action].toLowerCase()}.`
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
    feedbackModal.value = {
      title: 'No se pudieron cargar los productos',
      message: error.message || 'Ocurrio un error cargando el listado.',
      variant: 'danger',
    }
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

const requestAction = (product: ProductRow, action: ProductAction) => {
  productPendingAction.value = {
    id: product.id,
    name: product.name,
    action,
  }
}

const closeActionModal = () => {
  productPendingAction.value = null
}

const closeFeedbackModal = () => {
  feedbackModal.value = null
}

const confirmAction = async () => {
  if (!productPendingAction.value) return

  isUpdating.value = productPendingAction.value.id
  try {
    if (productPendingAction.value.action === 'delete') {
      await apiClient(`/admin/products/${productPendingAction.value.id}`, {
        method: 'DELETE',
      })
    } else {
      await apiClient(`/admin/products/${productPendingAction.value.id}/status`, {
        method: 'PATCH',
        body: { status: productPendingAction.value.action },
      })
    }
    await fetchProducts(meta.value.page)
    closeActionModal()
  } catch (error: any) {
    feedbackModal.value = {
      title: 'No se pudo completar la accion',
      message: error.message || 'Revisa el estado del producto e intenta nuevamente.',
      variant: 'warning',
    }
  } finally {
    isUpdating.value = null
  }
}

const pendingActionLabel = computed(() => {
  if (!productPendingAction.value) return 'Confirmar'
  return productPendingAction.value.action === 'delete' ? 'Eliminar producto' : 'Confirmar cambio'
})

const pendingActionVariant = computed(() => {
  if (!productPendingAction.value) return 'warning'
  return modalVariantMap[productPendingAction.value.action]
})

const imageUrl = (r2Key: string | null | undefined) => {
  if (!r2Key) return ''
  const normalizedKey = r2Key.startsWith('public/') ? r2Key.slice('public/'.length) : r2Key
  return `${publicAssetsBase}/${normalizedKey}`
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
      :colspan="7"
    >
      <template #head>
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Producto</th>
            <th>Marca/Modelo</th>
            <th>Estado</th>
            <th>Precio</th>
            <th>Acciones</th>
          </tr>
        </thead>
      </template>

      <tr v-for="product in products" :key="product.id">
        <td>
          <div v-if="product.primary_image" class="img-preview">
            <img :src="imageUrl(product.primary_image)" alt="" />
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
        
        <td class="actions-cell">
          <button type="button" class="btn btn-secondary btn-sm action-edit" @click="router.push(`/products/${product.id}/edit`)">
            Editar
          </button>
          <button
            v-for="option in actionOptions(product.status)"
            :key="option.value"
            type="button"
            class="btn btn-sm"
            :class="option.className"
            :disabled="isUpdating === product.id"
            @click="requestAction(product, option.value)"
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
      :is-open="!!productPendingAction"
      :title="productPendingAction?.action === 'delete' ? 'Eliminar producto' : 'Cambiar estado del producto'"
      :message="pendingActionMessage"
      :confirm-label="pendingActionLabel"
      :variant="pendingActionVariant"
      :is-loading="!!isUpdating"
      @cancel="closeActionModal"
      @confirm="confirmAction"
    />

    <BaseConfirmModal
      :is-open="!!feedbackModal"
      :title="feedbackModal?.title || 'Aviso'"
      :message="feedbackModal?.message || ''"
      confirm-label="Entendido"
      cancel-label="Cerrar"
      :variant="feedbackModal?.variant || 'neutral'"
      single-action
      @cancel="closeFeedbackModal"
      @confirm="closeFeedbackModal"
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

.action-edit {
  border-color: rgba(59, 130, 246, 0.35);
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-action-active {
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.32);
  color: #d1fae5;
}

.btn-action-hidden {
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.32);
  color: #fde68a;
}

.btn-action-reserved {
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(59, 130, 246, 0.32);
  color: #bfdbfe;
}

.btn-action-sold {
  background: rgba(239, 68, 68, 0.14);
  border: 1px solid rgba(239, 68, 68, 0.32);
  color: #fecaca;
}

.btn-action-delete {
  background: rgba(220, 38, 38, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.38);
  color: #fee2e2;
}
</style>
