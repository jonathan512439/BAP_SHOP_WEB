<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { apiClient } from '../api/client'
import type { Brand, Model } from '@bap-shop/shared'
import BaseConfirmModal from '../components/BaseConfirmModal.vue'
import BasePagination from '../components/BasePagination.vue'
import BaseTable from '../components/BaseTable.vue'
import StatusBadge from '../components/StatusBadge.vue'

type BrandRow = Brand & { model_count?: number; product_count?: number }
type ModelRow = Model & { brand_name?: string; product_count?: number }

const ROWS_PER_PAGE = 5

const brands = ref<BrandRow[]>([])
const models = ref<ModelRow[]>([])
const isLoading = ref(true)
const selectedBrandId = ref('')
const brandSearch = ref('')
const modelSearch = ref('')
const brandStatusFilter = ref('')
const modelStatusFilter = ref('')
const brandFeedback = ref('')
const modelFeedback = ref('')
const isCreatingBrand = ref(false)
const isCreatingModel = ref(false)
const isArchiving = ref(false)

const newBrandName = ref('')
const newModelName = ref('')

const editingBrandId = ref<string | null>(null)
const editingModelId = ref<string | null>(null)
const brandEditName = ref('')
const modelEditName = ref('')
const brandIdPendingArchive = ref<string | null>(null)
const modelIdPendingArchive = ref<string | null>(null)
const brandIdPendingRestore = ref<string | null>(null)
const modelIdPendingRestore = ref<string | null>(null)
const actionFeedbackTitle = ref('')
const actionFeedbackMessage = ref('')

const brandPage = ref(1)
const modelPage = ref(1)

const filteredBrands = computed(() => {
  const search = brandSearch.value.trim().toLowerCase()

  return brands.value.filter((brand) => {
    if (brandStatusFilter.value === 'active' && !brand.is_active) return false
    if (brandStatusFilter.value === 'archived' && brand.is_active) return false
    if (!search) return true
    return `${brand.name} ${brand.slug}`.toLowerCase().includes(search)
  })
})

const selectedBrand = computed(() => brands.value.find((brand) => brand.id === selectedBrandId.value) ?? null)

const filteredModels = computed(() => {
  if (!selectedBrandId.value) return []

  const search = modelSearch.value.trim().toLowerCase()

  return models.value.filter((model) => {
    if (model.brand_id !== selectedBrandId.value) return false
    if (modelStatusFilter.value === 'active' && !model.is_active) return false
    if (modelStatusFilter.value === 'archived' && model.is_active) return false
    if (!search) return true
    return `${model.name} ${model.slug}`.toLowerCase().includes(search)
  })
})

const brandTotalPages = computed(() => Math.max(1, Math.ceil(filteredBrands.value.length / ROWS_PER_PAGE)))
const modelTotalPages = computed(() => Math.max(1, Math.ceil(filteredModels.value.length / ROWS_PER_PAGE)))

const paginatedBrands = computed(() => {
  const start = (brandPage.value - 1) * ROWS_PER_PAGE
  return filteredBrands.value.slice(start, start + ROWS_PER_PAGE)
})

const paginatedModels = computed(() => {
  const start = (modelPage.value - 1) * ROWS_PER_PAGE
  return filteredModels.value.slice(start, start + ROWS_PER_PAGE)
})

const fetchEntities = async () => {
  isLoading.value = true
  try {
    const [brandsRes, modelsRes] = await Promise.all([
      apiClient<{ data: BrandRow[] }>('/admin/brands'),
      apiClient<{ data: ModelRow[] }>('/admin/models'),
    ])
    brands.value = brandsRes.data
    models.value = modelsRes.data

    if (selectedBrandId.value && !brands.value.some((brand) => brand.id === selectedBrandId.value)) {
      selectedBrandId.value = ''
    }
  } catch (error: any) {
    showActionFeedback('No se pudieron cargar las marcas y modelos', error.message || 'Intenta nuevamente en unos segundos.')
  } finally {
    isLoading.value = false
  }
}

const showActionFeedback = (title: string, message: string) => {
  actionFeedbackTitle.value = title
  actionFeedbackMessage.value = message
}

const closeActionFeedback = () => {
  actionFeedbackTitle.value = ''
  actionFeedbackMessage.value = ''
}

const startBrandEdit = (brand: BrandRow) => {
  editingBrandId.value = brand.id
  brandEditName.value = brand.name
}

const cancelBrandEdit = () => {
  editingBrandId.value = null
  brandEditName.value = ''
}

const saveBrandEdit = async (brandId: string) => {
  if (!brandEditName.value.trim()) return

  try {
    await apiClient(`/admin/brands/${brandId}`, {
      method: 'PUT',
      body: { name: brandEditName.value.trim() },
    })
    cancelBrandEdit()
    await fetchEntities()
  } catch (error: any) {
    showActionFeedback('No se pudo actualizar la marca', error.message || 'Revisa los datos e intenta nuevamente.')
  }
}

const startModelEdit = (model: ModelRow) => {
  editingModelId.value = model.id
  modelEditName.value = model.name
}

const cancelModelEdit = () => {
  editingModelId.value = null
  modelEditName.value = ''
}

const saveModelEdit = async (modelId: string) => {
  if (!modelEditName.value.trim()) return

  try {
    await apiClient(`/admin/models/${modelId}`, {
      method: 'PUT',
      body: { name: modelEditName.value.trim() },
    })
    cancelModelEdit()
    await fetchEntities()
  } catch (error: any) {
    showActionFeedback('No se pudo actualizar el modelo', error.message || 'Revisa los datos e intenta nuevamente.')
  }
}

const createBrand = async () => {
  if (!newBrandName.value.trim()) {
    brandFeedback.value = 'Ingresa un nombre de marca.'
    return
  }

  isCreatingBrand.value = true
  brandFeedback.value = ''

  try {
    const response = await apiClient<{ data: { id: string; name: string } }>('/admin/brands', {
      method: 'POST',
      body: { name: newBrandName.value.trim() },
    })

    newBrandName.value = ''
    selectedBrandId.value = response.data.id
    await fetchEntities()
    brandFeedback.value = 'Marca creada. Ahora puedes gestionarla y agregar modelos debajo.'
    modelFeedback.value = `La marca ${response.data.name} ya esta seleccionada para crear modelos.`
  } catch (error: any) {
    brandFeedback.value = error.message || 'Error creando marca.'
  } finally {
    isCreatingBrand.value = false
  }
}

const createModel = async () => {
  if (!selectedBrandId.value) {
    modelFeedback.value = 'Selecciona una marca para agregar modelos.'
    return
  }
  if (!newModelName.value.trim()) {
    modelFeedback.value = 'Ingresa un nombre de modelo.'
    return
  }

  isCreatingModel.value = true
  modelFeedback.value = ''

  try {
    await apiClient('/admin/models', {
      method: 'POST',
      body: {
        brand_id: selectedBrandId.value,
        name: newModelName.value.trim(),
      },
    })

    newModelName.value = ''
    await fetchEntities()
    modelFeedback.value = 'Modelo creado correctamente.'
  } catch (error: any) {
    modelFeedback.value = error.message || 'Error creando modelo.'
  } finally {
    isCreatingModel.value = false
  }
}

const selectBrand = (brandId: string) => {
  selectedBrandId.value = brandId
  modelFeedback.value = ''
}

const closeBrandModal = () => {
  selectedBrandId.value = ''
  modelSearch.value = ''
  modelStatusFilter.value = ''
  editingModelId.value = null
  modelEditName.value = ''
  modelFeedback.value = ''
}

const requestArchiveBrand = (brandId: string) => {
  brandIdPendingArchive.value = brandId
}

const closeBrandArchiveModal = () => {
  brandIdPendingArchive.value = null
}

const archiveBrand = async () => {
  if (!brandIdPendingArchive.value) return
  isArchiving.value = true

  try {
    await apiClient(`/admin/brands/${brandIdPendingArchive.value}/archive`, { method: 'PATCH' })
    await fetchEntities()
    closeBrandArchiveModal()
  } catch (error: any) {
    showActionFeedback('No se pudo archivar la marca', error.message || 'Intenta nuevamente.')
  } finally {
    isArchiving.value = false
  }
}

const requestRestoreBrand = (brandId: string) => {
  brandIdPendingRestore.value = brandId
}

const closeBrandRestoreModal = () => {
  brandIdPendingRestore.value = null
}

const restoreBrand = async () => {
  if (!brandIdPendingRestore.value) return
  isArchiving.value = true

  try {
    await apiClient(`/admin/brands/${brandIdPendingRestore.value}/restore`, { method: 'PATCH' })
    await fetchEntities()
    closeBrandRestoreModal()
  } catch (error: any) {
    showActionFeedback('No se pudo restaurar la marca', error.message || 'Intenta nuevamente.')
  } finally {
    isArchiving.value = false
  }
}

const requestArchiveModel = (modelId: string) => {
  modelIdPendingArchive.value = modelId
}

const closeModelArchiveModal = () => {
  modelIdPendingArchive.value = null
}

const archiveModel = async () => {
  if (!modelIdPendingArchive.value) return
  isArchiving.value = true

  try {
    await apiClient(`/admin/models/${modelIdPendingArchive.value}/archive`, { method: 'PATCH' })
    await fetchEntities()
    closeModelArchiveModal()
  } catch (error: any) {
    showActionFeedback('No se pudo archivar el modelo', error.message || 'Intenta nuevamente.')
  } finally {
    isArchiving.value = false
  }
}

const requestRestoreModel = (modelId: string) => {
  modelIdPendingRestore.value = modelId
}

const closeModelRestoreModal = () => {
  modelIdPendingRestore.value = null
}

const restoreModel = async () => {
  if (!modelIdPendingRestore.value) return
  isArchiving.value = true

  try {
    await apiClient(`/admin/models/${modelIdPendingRestore.value}/restore`, { method: 'PATCH' })
    await fetchEntities()
    closeModelRestoreModal()
  } catch (error: any) {
    showActionFeedback('No se pudo restaurar el modelo', error.message || 'Intenta nuevamente.')
  } finally {
    isArchiving.value = false
  }
}

onMounted(() => {
  fetchEntities()
})

watch([brandSearch, brandStatusFilter], () => {
  brandPage.value = 1
})

watch([selectedBrandId, modelSearch, modelStatusFilter], () => {
  modelPage.value = 1
})

watch(filteredBrands, (brandList) => {
  const lastPage = Math.max(1, Math.ceil(brandList.length / ROWS_PER_PAGE))
  if (brandPage.value > lastPage) {
    brandPage.value = lastPage
  }
})

watch(filteredModels, (modelList) => {
  const lastPage = Math.max(1, Math.ceil(modelList.length / ROWS_PER_PAGE))
  if (modelPage.value > lastPage) {
    modelPage.value = lastPage
  }
})
</script>

<template>
  <div class="brands-models-view">
    <div class="header-actions">
      <h2>Marcas y modelos</h2>
    </div>

    <div v-if="isLoading">Cargando datos...</div>

    <template v-else>
      <section class="panel admin-card">
        <div class="panel-header">
          <h3>Marcas</h3>
        </div>

        <div class="brand-toolbar mt-4">
          <div class="filter-stack">
            <input v-model="brandSearch" class="form-input" placeholder="Buscar marca o slug" />
            <select v-model="brandStatusFilter" class="form-input">
              <option value="">Todas</option>
              <option value="active">Activas</option>
              <option value="archived">Archivadas</option>
            </select>
          </div>

          <form class="create-row" @submit.prevent="createBrand">
            <input v-model="newBrandName" class="form-input" placeholder="Nueva marca" />
            <button type="submit" class="btn btn-primary btn-sm" :disabled="isCreatingBrand">
              {{ isCreatingBrand ? 'Creando...' : 'Agregar marca' }}
            </button>
          </form>
        </div>

        <p v-if="brandFeedback" class="feedback-note mt-4">{{ brandFeedback }}</p>

        <BaseTable class="mt-4" :empty="filteredBrands.length === 0" empty-message="No hay marcas." :colspan="5">
          <template #head>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Conteo</th>
                <th>Estado</th>
                <th>Seleccion</th>
                <th>Acciones</th>
              </tr>
            </thead>
          </template>

          <tr v-for="brand in paginatedBrands" :key="brand.id">
            <td>
              <div v-if="editingBrandId === brand.id" class="inline-edit">
                <input v-model="brandEditName" class="form-input" />
                <button type="button" class="btn btn-primary btn-sm" @click="saveBrandEdit(brand.id)">Guardar</button>
                <button type="button" class="btn btn-secondary btn-sm" @click="cancelBrandEdit">Cancelar</button>
              </div>
              <span v-else>{{ brand.name }}</span>
            </td>
            <td class="text-secondary text-sm">{{ brand.model_count || 0 }} modelos / {{ brand.product_count || 0 }} productos</td>
            <td>
              <StatusBadge :status="brand.is_active ? 'active' : 'archived'" kind="generic" />
            </td>
            <td>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :class="{ 'is-selected': selectedBrandId === brand.id }"
                @click="selectBrand(brand.id)"
              >
                {{ selectedBrandId === brand.id ? 'Seleccionada' : 'Ver modelos' }}
              </button>
            </td>
            <td class="actions-cell">
              <button
                v-if="editingBrandId !== brand.id"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="startBrandEdit(brand)"
              >
                Editar
              </button>
              <button
                v-if="brand.is_active"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="requestArchiveBrand(brand.id)"
              >
                Archivar
              </button>
              <button
                v-else
                type="button"
                class="btn btn-secondary btn-sm"
                @click="requestRestoreBrand(brand.id)"
              >
                Restaurar
              </button>
            </td>
          </tr>
        </BaseTable>

        <BasePagination
          v-if="filteredBrands.length > ROWS_PER_PAGE"
          class="mt-4"
          :page="brandPage"
          :total-pages="brandTotalPages"
          @previous="brandPage = Math.max(1, brandPage - 1)"
          @next="brandPage = Math.min(brandTotalPages, brandPage + 1)"
        />
      </section>

    </template>

    <div v-if="selectedBrand" class="modal-backdrop" @click.self="closeBrandModal">
      <div class="modal-card admin-card">
        <div class="modal-header">
          <div>
            <p class="modal-eyebrow">Modelos por marca</p>
            <h3>{{ selectedBrand.name }}</h3>
            <p class="panel-copy">{{ selectedBrand.model_count || 0 }} modelos registrados en esta marca.</p>
          </div>

          <button type="button" class="btn btn-secondary btn-sm modal-close" @click="closeBrandModal">
            Cerrar
          </button>
        </div>

        <div class="selected-brand-card">
          <strong>{{ selectedBrand.name }}</strong>
          <span>{{ selectedBrand.product_count || 0 }} productos asociados</span>
        </div>

        <div class="model-tools mt-4">
          <div class="create-stack">
            <div class="create-copy">
              <strong>Agregar modelo</strong>
              <p>El nuevo modelo se registrara dentro de {{ selectedBrand.name }}.</p>
            </div>
            <form class="create-row" @submit.prevent="createModel">
              <input v-model="newModelName" class="form-input" placeholder="Nuevo modelo" />
              <button type="submit" class="btn btn-primary btn-sm create-model-btn" :disabled="isCreatingModel">
                {{ isCreatingModel ? 'Creando...' : 'Agregar modelo' }}
              </button>
            </form>
            <p v-if="modelFeedback" class="feedback-note">{{ modelFeedback }}</p>
          </div>

          <div class="filter-stack">
            <input v-model="modelSearch" class="form-input" placeholder="Buscar modelo o slug" />
            <select v-model="modelStatusFilter" class="form-input">
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="archived">Archivados</option>
            </select>
          </div>
        </div>

        <BaseTable class="mt-4" :empty="filteredModels.length === 0" empty-message="No hay modelos para esta marca." :colspan="4">
          <template #head>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Productos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
          </template>

          <tr v-for="model in paginatedModels" :key="model.id">
            <td>
              <div v-if="editingModelId === model.id" class="inline-edit">
                <input v-model="modelEditName" class="form-input" />
                <button type="button" class="btn btn-primary btn-sm" @click="saveModelEdit(model.id)">Guardar</button>
                <button type="button" class="btn btn-secondary btn-sm" @click="cancelModelEdit">Cancelar</button>
              </div>
              <span v-else>{{ model.name }}</span>
            </td>
            <td class="text-secondary text-sm">{{ model.product_count || 0 }}</td>
            <td>
              <StatusBadge :status="model.is_active ? 'active' : 'archived'" kind="generic" />
            </td>
            <td class="actions-cell">
              <button
                v-if="editingModelId !== model.id"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="startModelEdit(model)"
              >
                Editar
              </button>
              <button
                v-if="model.is_active"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="requestArchiveModel(model.id)"
              >
                Archivar
              </button>
              <button
                v-else
                type="button"
                class="btn btn-secondary btn-sm"
                @click="requestRestoreModel(model.id)"
              >
                Restaurar
              </button>
            </td>
          </tr>
          
        </BaseTable>

        <BasePagination
          v-if="filteredModels.length > ROWS_PER_PAGE"
          class="mt-4"
          :page="modelPage"
          :total-pages="modelTotalPages"
          @previous="modelPage = Math.max(1, modelPage - 1)"
          @next="modelPage = Math.min(modelTotalPages, modelPage + 1)"
        />
      </div>
    </div>

    <BaseConfirmModal
      :is-open="!!brandIdPendingArchive"
      title="Archivar marca"
      message="Esta accion desactivara la marca. Si tiene productos activos o reservados, el backend la rechazara."
      confirm-label="Archivar marca"
      variant="warning"
      :is-loading="isArchiving && !!brandIdPendingArchive"
      @cancel="closeBrandArchiveModal"
      @confirm="archiveBrand"
    />

    <BaseConfirmModal
      :is-open="!!brandIdPendingRestore"
      title="Restaurar marca"
      message="La marca volvera a estar disponible para usarla en modelos y productos."
      confirm-label="Restaurar marca"
      variant="neutral"
      :is-loading="isArchiving && !!brandIdPendingRestore"
      @cancel="closeBrandRestoreModal"
      @confirm="restoreBrand"
    />

    <BaseConfirmModal
      :is-open="!!modelIdPendingArchive"
      title="Archivar modelo"
      message="Esta accion desactivara el modelo. Si tiene productos activos o reservados, el backend la rechazara."
      confirm-label="Archivar modelo"
      variant="warning"
      :is-loading="isArchiving && !!modelIdPendingArchive"
      @cancel="closeModelArchiveModal"
      @confirm="archiveModel"
    />

    <BaseConfirmModal
      :is-open="!!modelIdPendingRestore"
      title="Restaurar modelo"
      message="El modelo volvera a estar disponible. Si la marca sigue archivada, primero tendras que restaurar la marca."
      confirm-label="Restaurar modelo"
      variant="neutral"
      :is-loading="isArchiving && !!modelIdPendingRestore"
      @cancel="closeModelRestoreModal"
      @confirm="restoreModel"
    />

    <BaseConfirmModal
      :is-open="!!actionFeedbackTitle"
      :title="actionFeedbackTitle"
      :message="actionFeedbackMessage"
      confirm-label="Entendido"
      variant="neutral"
      single-action
      @confirm="closeActionFeedback"
      @cancel="closeActionFeedback"
    />
  </div>
</template>

<style scoped>
.header-actions {
  margin-bottom: 1rem;
}

.header-actions h2 {
  font-size: 1.5rem;
  margin: 0;
}

.panel {
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.panel-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.panel-copy {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.brand-toolbar,
.model-tools {
  display: grid;
  gap: 1rem;
}

@media (min-width: 960px) {
  .brand-toolbar,
  .model-tools {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
}

.filter-stack,
.create-stack {
  display: grid;
  gap: 0.75rem;
}

.create-row,
.inline-edit,
.actions-cell {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.actions-cell {
  flex-wrap: wrap;
}

.selected-brand-card {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
}

.selected-brand-card strong {
  font-size: 1rem;
}

.selected-brand-card span {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.empty-brand-state {
  padding: 1rem;
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.03);
}

.create-copy {
  display: grid;
  gap: 0.2rem;
}

.create-copy strong {
  font-size: 0.95rem;
}

.create-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.btn-sm {
  padding: 0.25rem 0.7rem;
  font-size: 0.72rem;
}

.is-selected {
  border-color: rgba(59, 130, 246, 0.35);
  color: #bfdbfe;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.68);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 80;
}

.modal-card {
  width: min(1100px, 100%);
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.modal-eyebrow {
  margin: 0 0 0.35rem;
  color: var(--accent-primary);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
}

.modal-close {
  flex-shrink: 0;
}

.create-model-btn {
  min-width: 130px;
}

.text-sm {
  font-size: 0.875rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.mt-4 {
  margin-top: 1rem;
}

.feedback-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

@media (max-width: 900px) {
  .panel-header,
  .modal-header,
  .create-row,
  .inline-edit,
  .actions-cell,
  .selected-brand-card {
    flex-direction: column;
    align-items: stretch;
  }

  .create-row .btn,
  .inline-edit .btn,
  .actions-cell .btn,
  .modal-close {
    width: 100%;
  }

  .modal-card {
    width: 100%;
    max-height: calc(100vh - 1.5rem);
  }
}
</style>
