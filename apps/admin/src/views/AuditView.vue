<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiClient } from '../api/client'
import FormDateInput from '../components/FormDateInput.vue'
import BasePagination from '../components/BasePagination.vue'
import BaseTable from '../components/BaseTable.vue'
import BaseConfirmModal from '../components/BaseConfirmModal.vue'

const logs = ref<any[]>([])
const isLoading = ref(true)
const expandedId = ref<string | null>(null)
const meta = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const errorTitle = ref('')
const errorMessage = ref('')
const filters = ref({
  action: '',
  entityType: '',
  dateFrom: '',
  dateTo: '',
})

const formatDate = (iso: string) => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

const prettyJson = (value?: string | null) => {
  if (!value) return '-'

  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

const toggleRow = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id
}

const fetchLogs = async (page = 1) => {
  isLoading.value = true
  try {
    const res = await apiClient<{ data: any[]; meta: typeof meta.value }>('/admin/audit', {
      params: {
        page,
        limit: meta.value.limit,
        action: filters.value.action.trim() || undefined,
        entity_type: filters.value.entityType.trim() || undefined,
        date_from: filters.value.dateFrom || undefined,
        date_to: filters.value.dateTo || undefined,
      },
    })
    logs.value = res.data
    meta.value = res.meta
  } catch (error: any) {
    errorTitle.value = 'No se pudieron cargar los logs'
    errorMessage.value = error?.message || 'Intenta nuevamente en unos segundos.'
  } finally {
    isLoading.value = false
  }
}

const closeErrorModal = () => {
  errorTitle.value = ''
  errorMessage.value = ''
}

const applyFilters = async () => {
  expandedId.value = null
  await fetchLogs(1)
}

const clearFilters = async () => {
  filters.value.action = ''
  filters.value.entityType = ''
  filters.value.dateFrom = ''
  filters.value.dateTo = ''
  expandedId.value = null
  await fetchLogs(1)
}

const reloadLogs = async () => {
  await fetchLogs(meta.value.page)
}

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="audit-view">
    <div class="header-actions">
      <h2>Registro de auditoria</h2>
      <button type="button" class="btn btn-secondary" @click="reloadLogs">Recargar</button>
    </div>

    <div class="admin-card filters-bar">
      <label class="filter-field">
        <span>Accion</span>
        <input v-model="filters.action" type="text" placeholder="product.status, order.confirm..." @keyup.enter="applyFilters" />
      </label>

      <label class="filter-field">
        <span>Entidad</span>
        <input v-model="filters.entityType" type="text" placeholder="product, order, settings..." @keyup.enter="applyFilters" />
      </label>

      <FormDateInput v-model="filters.dateFrom" label="Desde" />

      <FormDateInput v-model="filters.dateTo" label="Hasta" />

      <div class="filter-actions">
        <button type="button" class="btn btn-secondary" @click="clearFilters">Limpiar</button>
        <button type="button" class="btn btn-primary" @click="applyFilters">Aplicar filtros</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading">Cargando...</div>

    <div v-else class="admin-card">
      <BaseTable :empty="logs.length === 0" empty-message="No hay registros de auditoria." :colspan="6">
        <template #head>
          <thead>
          <tr>
            <th>Fecha</th>
            <th>Admin</th>
            <th>Accion</th>
            <th>Entidad</th>
            <th>ID entidad</th>
            <th>Diff</th>
          </tr>
        </thead>
        </template>

        <template v-for="log in logs" :key="log.id">
          <tr>
            <td class="text-sm text-secondary">{{ formatDate(log.created_at) }}</td>
            <td class="text-sm fw-500">{{ log.admin_username || log.admin_id }}</td>
            <td>
              <span class="action-badge">{{ log.action }}</span>
            </td>
            <td class="text-sm">{{ log.entity_type }}</td>
            <td class="text-sm code">{{ log.entity_id || '-' }}</td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm" @click="toggleRow(log.id)">
                {{ expandedId === log.id ? 'Ocultar' : 'Ver JSON' }}
              </button>
            </td>
          </tr>
          <tr v-if="expandedId === log.id" class="expanded-row">
            <td colspan="6">
              <div class="json-grid">
                <div class="json-card">
                  <h4>Valor anterior</h4>
                  <pre>{{ prettyJson(log.old_value) }}</pre>
                </div>
                <div class="json-card">
                  <h4>Valor nuevo</h4>
                  <pre>{{ prettyJson(log.new_value) }}</pre>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </BaseTable>

      <BasePagination
        v-if="meta.totalPages > 1"
        :page="meta.page"
        :total-pages="meta.totalPages"
        @previous="fetchLogs(meta.page - 1)"
        @next="fetchLogs(meta.page + 1)"
        @go-to-page="fetchLogs"
      />
    </div>
  </div>

  <BaseConfirmModal
    :is-open="!!errorTitle"
    :title="errorTitle"
    :message="errorMessage"
    confirm-label="Entendido"
    variant="neutral"
    single-action
    @confirm="closeErrorModal"
    @cancel="closeErrorModal"
  />
</template>

<style scoped>
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.filter-field span {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.filter-field input {
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.filter-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.fw-500 {
  font-weight: 500;
}

.text-sm {
  font-size: 0.875rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.code {
  font-family: monospace;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.action-badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-focus);
}

.expanded-row td {
  background: var(--bg-tertiary);
}

.json-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 960px) {
  .json-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.json-card {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  padding: 1rem;
}

.json-card h4 {
  margin: 0 0 0.75rem;
}

.json-card pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
}
</style>
