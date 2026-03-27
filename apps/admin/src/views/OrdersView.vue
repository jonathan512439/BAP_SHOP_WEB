<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatPrice } from '@bap-shop/shared'
import { apiClient } from '../api/client'
import BaseConfirmModal from '../components/BaseConfirmModal.vue'
import FormDateInput from '../components/FormDateInput.vue'
import FormTextarea from '../components/FormTextarea.vue'
import BasePagination from '../components/BasePagination.vue'
import BaseTable from '../components\BaseTable.vue'
import StatusBadge from '../components/StatusBadge.vue'

interface OrderListRow {
  id: string
  order_code: string
  customer_name: string
  customer_phone: string
  status: string
  total: number
  item_count: number
  created_at: string
  expires_at: string
}

interface OrderDetail extends OrderListRow {
  subtotal: number
  discount: number
  notes?: string | null
  items: Array<{
    id: string
    product_name: string
    product_type: string
    product_size?: string | null
    unit_price: number
    promo_price?: number | null
    final_price: number
  }>
}

const orders = ref<OrderListRow[]>([])
const isLoading = ref(true)
const isDetailLoading = ref(false)
const isSavingNotes = ref(false)
const isUpdatingStatus = ref(false)
const selectedOrder = ref<OrderDetail | null>(null)
const detailNotes = ref('')
const pendingOrderStatus = ref<'confirmed' | 'cancelled' | null>(null)
const meta = ref({ page: 1, limit: 15, total: 0, totalPages: 1 })
const filters = ref({
  status: '',
  search: '',
  dateFrom: '',
  dateTo: '',
})

const formatDate = (iso?: string | null) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const selectedStatus = computed(() => selectedOrder.value?.status ?? '')

const fetchOrders = async (page = 1) => {
  isLoading.value = true
  try {
    const res = await apiClient<{ data: OrderListRow[]; meta: typeof meta.value }>('/admin/orders', {
      params: {
        page,
        limit: 15,
        status: filters.value.status || undefined,
        search: filters.value.search.trim() || undefined,
        date_from: filters.value.dateFrom || undefined,
        date_to: filters.value.dateTo || undefined,
      },
    })
    orders.value = res.data
    meta.value = res.meta
  } catch (error: any) {
    alert(`Error cargando pedidos: ${error.message}`)
  } finally {
    isLoading.value = false
  }
}

const applyFilters = async () => {
  await fetchOrders(1)
}

const clearFilters = async () => {
  filters.value.status = ''
  filters.value.search = ''
  filters.value.dateFrom = ''
  filters.value.dateTo = ''
  await fetchOrders(1)
}

const openOrder = async (id: string) => {
  isDetailLoading.value = true
  selectedOrder.value = null
  detailNotes.value = ''

  try {
    const res = await apiClient<{ data: OrderDetail }>(`/admin/orders/${id}`)
    selectedOrder.value = res.data
    detailNotes.value = res.data.notes ?? ''
  } catch (error: any) {
    alert(`Error cargando detalle: ${error.message}`)
  } finally {
    isDetailLoading.value = false
  }
}

const closeDetail = () => {
  selectedOrder.value = null
  detailNotes.value = ''
  pendingOrderStatus.value = null
}

const saveNotes = async () => {
  if (!selectedOrder.value) return

  isSavingNotes.value = true

  try {
    const res = await apiClient<{ data: { id: string; notes: string | null } }>(
      `/admin/orders/${selectedOrder.value.id}/notes`,
      {
        method: 'PATCH',
        body: {
          notes: detailNotes.value.trim() || '',
        },
      }
    )

    if (selectedOrder.value) {
      selectedOrder.value.notes = res.data.notes
    }
  } catch (error: any) {
    alert(`Error guardando notas: ${error.message}`)
  } finally {
    isSavingNotes.value = false
  }
}

const requestStatusChange = (newStatus: 'confirmed' | 'cancelled') => {
  pendingOrderStatus.value = newStatus
}

const closeStatusModal = () => {
  pendingOrderStatus.value = null
}

const updateStatus = async () => {
  if (!selectedOrder.value) return
  if (!pendingOrderStatus.value) return

  isUpdatingStatus.value = true

  try {
    await apiClient(`/admin/orders/${selectedOrder.value.id}/status`, {
      method: 'PATCH',
      body: {
        status: pendingOrderStatus.value,
        notes: detailNotes.value.trim() || undefined,
      },
    })

    await fetchOrders(meta.value.page)
    await openOrder(selectedOrder.value.id)
    closeStatusModal()
  } catch (error: any) {
    alert(`Error actualizando pedido: ${error.message}`)
  } finally {
    isUpdatingStatus.value = false
  }
}

onMounted(() => {
  fetchOrders()
})
</script>

<template>
  <div class="orders-view">
    <div class="header-actions">
      <h2>Gestion de pedidos</h2>
    </div>

    <div class="admin-card filters-bar">
      <div class="filter-field">
        <label for="order-status-filter">Estado</label>
        <select id="order-status-filter" v-model="filters.status">
          <option value="">Todos</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmado</option>
          <option value="cancelled">Cancelado</option>
          <option value="expired">Expirado</option>
        </select>
      </div>

      <div class="filter-field search-field">
        <label for="order-search-filter">Buscar</label>
        <input
          id="order-search-filter"
          v-model="filters.search"
          type="text"
          placeholder="Codigo, cliente o telefono"
          @keyup.enter="applyFilters"
        />
      </div>

      <FormDateInput v-model="filters.dateFrom" label="Desde" />

      <FormDateInput v-model="filters.dateTo" label="Hasta" />

      <div class="filter-actions">
        <button type="button" class="btn btn-secondary" @click="clearFilters">Limpiar</button>
        <button type="button" class="btn btn-primary" @click="applyFilters">Aplicar filtros</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading">Cargando pedidos...</div>

    <div v-else class="admin-card">
      <BaseTable :empty="orders.length === 0" empty-message="No hay pedidos registrados." :colspan="7">
        <template #head>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Items</th>
              <th>Detalle</th>
            </tr>
          </thead>
        </template>

        <tr v-for="order in orders" :key="order.id">
          <td class="order-code">#{{ order.order_code }}</td>
          <td>
            <div class="customer-name">{{ order.customer_name }}</div>
            <div class="customer-phone">{{ order.customer_phone }}</div>
          </td>
          <td class="text-sm text-secondary">{{ formatDate(order.created_at) }}</td>
          <td><StatusBadge :status="order.status" kind="order" /></td>
          <td class="order-total">{{ formatPrice(order.total) }}</td>
          <td class="text-sm text-secondary">{{ order.item_count }}</td>
          <td>
            <button type="button" class="btn btn-secondary btn-sm" @click="openOrder(order.id)">Ver detalle</button>
          </td>
        </tr>
      </BaseTable>

      <BasePagination
        v-if="meta.totalPages > 1"
        class="mt-4"
        :page="meta.page"
        :total-pages="meta.totalPages"
        @previous="fetchOrders(meta.page - 1)"
        @next="fetchOrders(meta.page + 1)"
      />
    </div>

    <div v-if="selectedOrder || isDetailLoading" class="modal-backdrop" @click.self="closeDetail">
      <div class="modal admin-card">
        <div v-if="isDetailLoading" class="loading">Cargando detalle...</div>

        <template v-else-if="selectedOrder">
          <div class="modal-header">
            <div>
              <h3>{{ selectedOrder.order_code }}</h3>
              <p class="text-secondary">{{ selectedOrder.customer_name }} · {{ selectedOrder.customer_phone }}</p>
            </div>
            <StatusBadge :status="selectedOrder.status" kind="order" />
          </div>

          <div class="detail-grid">
            <div class="detail-card">
              <span class="detail-label">Creado</span>
              <strong>{{ formatDate(selectedOrder.created_at) }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">Expira</span>
              <strong>{{ formatDate(selectedOrder.expires_at) }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">Subtotal</span>
              <strong>{{ formatPrice(selectedOrder.subtotal) }}</strong>
            </div>
            <div class="detail-card">
              <span class="detail-label">Total</span>
              <strong>{{ formatPrice(selectedOrder.total) }}</strong>
            </div>
          </div>

          <div class="items-block">
            <h4>Items</h4>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Talla</th>
                    <th>Precio final</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedOrder.items" :key="item.id">
                    <td>{{ item.product_name }}</td>
                    <td>{{ item.product_type }}</td>
                    <td>{{ item.product_size || '-' }}</td>
                    <td>{{ formatPrice(item.final_price) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <FormTextarea
            v-model="detailNotes"
            label="Notas internas"
            placeholder="Observaciones del panel para confirmar o cancelar"
            help="Estas notas quedan asociadas al pedido en el panel."
            :rows="4"
          />

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeDetail">Cerrar</button>
            <button type="button" class="btn btn-secondary" :disabled="isSavingNotes" @click="saveNotes">
              {{ isSavingNotes ? 'Guardando...' : 'Guardar notas' }}
            </button>
            <button
              v-if="selectedStatus === 'pending'"
              type="button"
              class="btn btn-danger"
              @click="requestStatusChange('cancelled')"
            >
              Cancelar pedido
            </button>
            <button
              v-if="selectedStatus === 'pending'"
              type="button"
              class="btn btn-success"
              @click="requestStatusChange('confirmed')"
            >
              Confirmar venta
            </button>
          </div>
        </template>
      </div>
    </div>

    <BaseConfirmModal
      :is-open="!!pendingOrderStatus"
      title="Cambiar estado del pedido"
      :message="pendingOrderStatus ? `Confirmar cambio del pedido a ${pendingOrderStatus}.` : ''"
      :confirm-label="pendingOrderStatus === 'confirmed' ? 'Confirmar venta' : 'Cancelar pedido'"
      :variant="pendingOrderStatus === 'confirmed' ? 'warning' : 'danger'"
      :is-loading="isUpdatingStatus"
      @cancel="closeStatusModal"
      @confirm="updateStatus"
    />
  </div>
</template>

<style scoped>
.header-actions {
  margin-bottom: 2rem;
}

.header-actions h2 {
  font-size: 1.5rem;
  margin: 0;
}

.filters-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  align-items: end;
  margin-bottom: 1.5rem;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.filter-field label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.filter-field input,
.filter-field select {
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.search-field {
  min-width: 240px;
}

.filter-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: flex-end;
}

.order-code {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary);
}

.customer-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.customer-phone {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.order-total {
  font-weight: 700;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.mt-4 {
  margin-top: 1.5rem;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  display: grid;
  place-items: center;
  padding: 1.5rem;
}

.modal {
  width: min(900px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-height: calc(100vh - 3rem);
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.modal-header h3 {
  margin: 0 0 0.35rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

.detail-card {
  padding: 0.9rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
}

.detail-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
  text-transform: uppercase;
}

.items-block h4 {
  margin: 0 0 0.75rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-success {
  background: var(--success);
  color: white;
}

.btn-danger {
  background: var(--danger);
  color: white;
}
</style>
