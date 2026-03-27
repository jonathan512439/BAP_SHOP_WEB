<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { applyDiscount, formatPrice } from '@bap-shop/shared'
import { apiClient } from '../api/client'
import BaseConfirmModal from '../components/BaseConfirmModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import FormField from '../components/FormField.vue'
import FormSelect from '../components/FormSelect.vue'
import FormToggle from '../components/FormToggle.vue'
import BaseTable from '../components/BaseTable.vue'

interface ProductRow {
  id: string
  name: string
  price: number
  primary_image?: string | null
}

interface PromotionRow {
  product_id: string
  product_name: string
  product_price: number
  discount_pct: number
  starts_at: string
  ends_at: string
  enabled: number
}

interface PromotionTableRow extends ProductRow {
  promotion: PromotionRow | null
}

const products = ref<ProductRow[]>([])
const promos = ref<PromotionRow[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const isConfirmingDisable = ref(false)
const editingProductId = ref<string | null>(null)
const productIdPendingDisable = ref<string | null>(null)
const filters = ref({
  search: '',
  status: '',
})

const form = ref({
  discountPct: 15,
  startsAt: '',
  endsAt: '',
  enabled: true,
})

const promoMap = computed(() => new Map(promos.value.map((promo) => [promo.product_id, promo])))

const rows = computed<PromotionTableRow[]>(() => {
  const normalizedSearch = filters.value.search.trim().toLowerCase()

  return products.value
    .map((product) => ({
      ...product,
      promotion: promoMap.value.get(product.id) ?? null,
    }))
    .filter((row) => {
      if (normalizedSearch) {
        const searchable = `${row.name} ${row.id}`.toLowerCase()
        if (!searchable.includes(normalizedSearch)) {
          return false
        }
      }

      if (filters.value.status === 'with_promo' && !row.promotion) return false
      if (filters.value.status === 'without_promo' && row.promotion) return false
      if (filters.value.status === 'active' && row.promotion?.enabled !== 1) return false
      if (filters.value.status === 'inactive' && (!row.promotion || row.promotion.enabled === 1)) return false

      return true
    })
})

const editingRow = computed<PromotionTableRow | null>(() => {
  if (!editingProductId.value) return null
  return rows.value.find((row) => row.id === editingProductId.value) ?? null
})

const previewPrice = computed(() => {
  if (!editingRow.value) return null
  return applyDiscount(editingRow.value.price, form.value.discountPct)
})

const toLocalInputValue = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

const toIsoDate = (value: string) => new Date(value).toISOString()

const createDefaultEndDate = () => {
  const now = new Date()
  now.setDate(now.getDate() + 7)
  return toLocalInputValue(now.toISOString())
}

const formatDate = (iso?: string | null) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

const buildImageUrl = (r2Key?: string | null) => {
  return r2Key ? `https://assets.bapshop.com/${r2Key}` : null
}

const fetchData = async () => {
  isLoading.value = true

  try {
    const [productsRes, promosRes] = await Promise.all([
      apiClient<{ data: ProductRow[] }>('/admin/products', {
        params: { status: 'active', page: 1, limit: 100 },
      }),
      apiClient<{ data: PromotionRow[] }>('/admin/promotions'),
    ])

    products.value = productsRes.data
    promos.value = promosRes.data
  } catch (error: any) {
    alert(`Error cargando promociones: ${error.message}`)
  } finally {
    isLoading.value = false
  }
}

const reloadPromotions = async () => {
  await fetchData()
}

const openEditor = (row: PromotionTableRow) => {
  editingProductId.value = row.id

  if (row.promotion) {
    form.value.discountPct = row.promotion.discount_pct
    form.value.startsAt = toLocalInputValue(row.promotion.starts_at)
    form.value.endsAt = toLocalInputValue(row.promotion.ends_at)
    form.value.enabled = row.promotion.enabled === 1
    return
  }

  form.value.discountPct = 15
  form.value.startsAt = toLocalInputValue(new Date().toISOString())
  form.value.endsAt = createDefaultEndDate()
  form.value.enabled = true
}

const closeEditor = () => {
  editingProductId.value = null
}

const requestDisablePromo = (productId: string) => {
  productIdPendingDisable.value = productId
}

const closeDisableModal = () => {
  productIdPendingDisable.value = null
}

const savePromotion = async () => {
  if (!editingProductId.value) return

  if (!form.value.startsAt || !form.value.endsAt) {
    alert('Debes completar fecha de inicio y fin.')
    return
  }

  isSaving.value = true

  try {
    await apiClient(`/admin/promotions/${editingProductId.value}`, {
      method: 'PUT',
      body: {
        discount_pct: form.value.discountPct,
        starts_at: toIsoDate(form.value.startsAt),
        ends_at: toIsoDate(form.value.endsAt),
        enabled: form.value.enabled,
      },
    })

    await fetchData()
    closeEditor()
  } catch (error: any) {
    alert(`Error guardando promocion: ${error.message}`)
  } finally {
    isSaving.value = false
  }
}

const disablePromo = async () => {
  if (!productIdPendingDisable.value) return
  isConfirmingDisable.value = true
  try {
    await apiClient(`/admin/promotions/${productIdPendingDisable.value}/disable`, { method: 'PATCH' })
    await fetchData()
    closeDisableModal()
  } catch (error: any) {
    alert(`Error desactivando promocion: ${error.message}`)
  } finally {
    isConfirmingDisable.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="promotions-view">
    <div class="header-actions">
      <div>
        <h2>Promociones</h2>
        <p class="header-copy">Configura una sola promocion por producto activo y revisa el precio final antes de guardar.</p>
      </div>
      <button type="button" class="btn btn-secondary" @click="reloadPromotions">Recargar</button>
    </div>

    <div class="admin-card filters-bar">
      <label class="filter-field search-field">
        <span>Buscar producto</span>
        <input v-model="filters.search" type="text" placeholder="Nombre o ID" />
      </label>

      <label class="filter-field">
        <span>Estado promo</span>
        <select v-model="filters.status">
          <option value="">Todos</option>
          <option value="with_promo">Con promo</option>
          <option value="without_promo">Sin promo</option>
          <option value="active">Activa</option>
          <option value="inactive">Inactiva</option>
        </select>
      </label>
    </div>

    <div v-if="isLoading" class="loading">Cargando...</div>

    <BaseTable
      v-else
      class="admin-card"
      :empty="rows.length === 0"
      empty-message="No hay productos activos que coincidan con los filtros."
      :colspan="7"
    >
      <template #head>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio base</th>
            <th>Promocion</th>
            <th>Precio final</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
      </template>

      <tr v-for="row in rows" :key="row.id">
        <td class="product-cell">
          <img v-if="buildImageUrl(row.primary_image)" :src="buildImageUrl(row.primary_image)!" alt="" class="thumb" />
          <div>
            <div class="fw-600">{{ row.name }}</div>
            <div class="text-secondary text-sm">{{ row.id }}</div>
          </div>
        </td>
        <td>{{ formatPrice(row.price) }}</td>
        <td>
          <span v-if="row.promotion" class="fw-600">{{ row.promotion.discount_pct }}%</span>
          <span v-else class="text-secondary">Sin promo</span>
        </td>
        <td>
          <span v-if="row.promotion" class="fw-600">
            {{ formatPrice(applyDiscount(row.price, row.promotion.discount_pct)) }}
          </span>
          <span v-else class="text-secondary">-</span>
        </td>
        <td class="text-sm">
          <template v-if="row.promotion">
            {{ formatDate(row.promotion.starts_at) }}<br />
            <span class="text-secondary">hasta {{ formatDate(row.promotion.ends_at) }}</span>
          </template>
          <span v-else class="text-secondary">-</span>
        </td>
        <td>
          <StatusBadge
            :status="row.promotion ? (row.promotion.enabled === 1 ? 'active' : 'inactive') : 'without_promo'"
            kind="generic"
          />
        </td>
        <td class="actions">
          <button type="button" class="btn btn-sm" @click="openEditor(row)">
            {{ row.promotion ? 'Editar' : 'Agregar' }}
          </button>
          <button
            v-if="row.promotion?.enabled === 1"
            type="button"
            class="btn btn-sm btn-danger"
            @click="requestDisablePromo(row.id)"
          >
            Desactivar
          </button>
        </td>
      </tr>
    </BaseTable>

    <div v-if="editingProductId" class="modal-backdrop" @click.self="closeEditor">
      <div class="modal admin-card">
        <h3>{{ promoMap.get(editingProductId) ? 'Editar promocion' : 'Nueva promocion' }}</h3>

        <div v-if="editingRow" class="preview-card">
          <div class="preview-name">{{ editingRow.name }}</div>
          <div class="preview-prices">
            <span class="text-secondary">Base: {{ formatPrice(editingRow.price) }}</span>
            <strong>Final: {{ formatPrice(previewPrice ?? editingRow.price) }}</strong>
          </div>
        </div>

        <div class="form-grid">
          <FormField label="Descuento (%)" help="El backend acepta valores entre 1 y 99.">
            <input v-model.number="form.discountPct" type="number" min="1" max="99" />
          </FormField>

          <FormField label="Inicio" help="Fecha y hora desde la cual la promo queda vigente.">
            <input v-model="form.startsAt" type="datetime-local" />
          </FormField>

          <FormField label="Fin" help="Cuando expire, el cron puede deshabilitarla automaticamente.">
            <input v-model="form.endsAt" type="datetime-local" />
          </FormField>

          <FormSelect label="Estado" help="Permite dejar la configuracion guardada sin publicarla activa.">
            <select v-model="form.enabled" class="form-select">
              <option :value="true">Habilitada</option>
              <option :value="false">Deshabilitada</option>
            </select>
          </FormSelect>

          <FormToggle
            v-model="form.enabled"
            label="Toggle rapido"
            help="Atajo visual para habilitar o deshabilitar la promocion."
          />
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="closeEditor">Cancelar</button>
          <button type="button" class="btn" :disabled="isSaving" @click="savePromotion">
            {{ isSaving ? 'Guardando...' : 'Guardar promocion' }}
          </button>
        </div>
      </div>
    </div>

    <BaseConfirmModal
      :is-open="!!productIdPendingDisable"
      title="Desactivar promocion"
      message="Esta accion deshabilitara la promocion vigente del producto y disparara un rebuild del catalogo."
      confirm-label="Desactivar"
      variant="danger"
      :is-loading="isConfirmingDisable"
      @cancel="closeDisableModal"
      @confirm="disablePromo"
    />
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
}

.header-actions h2 {
  font-size: 1.5rem;
  margin: 0 0 0.35rem;
}

.header-copy {
  color: var(--text-secondary);
  margin: 0;
}

.filters-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  align-items: end;
  margin-bottom: 1.5rem;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.filter-field span {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.filter-field input,
.filter-field select {
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.search-field {
  min-width: 260px;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.thumb {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--bg-tertiary);
}

.fw-600 {
  font-weight: 600;
}

.text-sm {
  font-size: 0.875rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.2);
  color: var(--danger);
  border: none;
}

.btn-danger:hover {
  background: var(--danger);
  color: white;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: grid;
  place-items: center;
  padding: 1.5rem;
}

.modal {
  width: min(540px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal h3 {
  margin: 0;
}

.preview-card {
  padding: 0.9rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.preview-name {
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.preview-prices {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.form-grid {
  display: grid;
  gap: 1rem;
}

.form-grid :deep(input[type='number']),
.form-grid :deep(input[type='datetime-local']),
.form-grid :deep(.form-select) {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  color: var(--text-primary);
  padding: 0.7rem 0.85rem;
  width: 100%;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
