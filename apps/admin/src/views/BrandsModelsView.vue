<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiClient } from '../api/client'
import type { Brand, Model } from '@bap-shop/shared'
import BaseConfirmModal from '../components/BaseConfirmModal.vue'
import BaseTable from '../components/BaseTable.vue'
import StatusBadge from '../components/StatusBadge.vue'

type BrandRow = Brand & { model_count?: number; product_count?: number }
type ModelRow = Model & { brand_name?: string; product_count?: number }

const brands = ref<BrandRow[]>([])
const models = ref<ModelRow[]>([])
const isLoading = ref(true)
const selectedBrandId = ref('')
const brandSearch = ref('')
const modelSearch = ref('')
const brandStatusFilter = ref('')
const modelStatusFilter = ref('')

const newBrandName = ref('')
const newModelName = ref('')
const newModelBrandId = ref('')

const editingBrandId = ref<string | null>(null)
const editingModelId = ref<string | null>(null)
const brandEditName = ref('')
const modelEditName = ref('')
const brandIdPendingArchive = ref<string | null>(null)
const modelIdPendingArchive = ref<string | null>(null)
const isArchiving = ref(false)

const filteredBrands = computed(() => {
  const search = brandSearch.value.trim().toLowerCase()

  return brands.value.filter((brand) => {
    if (brandStatusFilter.value === 'active' && !brand.is_active) return false
    if (brandStatusFilter.value === 'archived' && brand.is_active) return false

    if (!search) return true

    return `${brand.name} ${brand.slug}`.toLowerCase().includes(search)
  })
})

const filteredModels = computed(() => {
  const search = modelSearch.value.trim().toLowerCase()

  return models.value.filter((model) => {
    if (selectedBrandId.value && model.brand_id !== selectedBrandId.value) return false
    if (modelStatusFilter.value === 'active' && !model.is_active) return false
    if (modelStatusFilter.value === 'archived' && model.is_active) return false

    if (!search) return true

    const brandName = model.brand_name || brands.value.find((brand) => brand.id === model.brand_id)?.name || ''
    return `${model.name} ${model.slug} ${brandName}`.toLowerCase().includes(search)
  })
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
  } catch (error: any) {
    alert(`Error cargando catalogos: ${error.message}`)
  } finally {
    isLoading.value = false
  }
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
    alert(`Error actualizando marca: ${error.message}`)
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
    alert(`Error actualizando modelo: ${error.message}`)
  }
}

const createBrand = async () => {
  if (!newBrandName.value.trim()) return

  try {
    await apiClient('/admin/brands', {
      method: 'POST',
      body: { name: newBrandName.value.trim() },
    })
    newBrandName.value = ''
    await fetchEntities()
  } catch (error: any) {
    alert(`Error creando marca: ${error.message}`)
  }
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
    alert(`Error archivando marca: ${error.message}`)
  } finally {
    isArchiving.value = false
  }
}

const createModel = async () => {
  if (!newModelName.value.trim() || !newModelBrandId.value) return

  try {
    await apiClient('/admin/models', {
      method: 'POST',
      body: {
        brand_id: newModelBrandId.value,
        name: newModelName.value.trim(),
      },
    })
    newModelName.value = ''
    await fetchEntities()
  } catch (error: any) {
    alert(`Error creando modelo: ${error.message}`)
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
    alert(`Error archivando modelo: ${error.message}`)
  } finally {
    isArchiving.value = false
  }
}

onMounted(() => {
  fetchEntities()
})
</script>

<template>
  <div class="brands-models-view">
    <div class="header-actions">
      <h2>Marcas y modelos</h2>
    </div>

    <div v-if="isLoading">Cargando datos...</div>

    <div v-else class="grid-layout">
      <div class="panel admin-card">
        <div class="panel-header">
          <h3>Marcas</h3>
        </div>

        <div class="filter-stack mt-4">
          <input v-model="brandSearch" class="form-input" placeholder="Buscar marca o slug" />
          <select v-model="brandStatusFilter" class="form-input">
            <option value="">Todas</option>
            <option value="active">Activas</option>
            <option value="archived">Archivadas</option>
          </select>
        </div>

        <div class="create-row mt-4">
          <input v-model="newBrandName" class="form-input" placeholder="Nueva marca" />
          <button type="button" class="btn btn-primary btn-sm" @click="createBrand">Agregar</button>
        </div>

        <BaseTable class="mt-4" :empty="filteredBrands.length === 0" empty-message="No hay marcas." :colspan="5">
          <template #head>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Slug</th>
                <th>Conteo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
          </template>

          <tr v-for="brand in filteredBrands" :key="brand.id">
            <td>
              <div v-if="editingBrandId === brand.id" class="inline-edit">
                <input v-model="brandEditName" class="form-input" />
                <button type="button" class="btn btn-sm" @click="saveBrandEdit(brand.id)">Guardar</button>
                <button type="button" class="btn btn-secondary btn-sm" @click="cancelBrandEdit">Cancelar</button>
              </div>
              <span v-else>{{ brand.name }}</span>
            </td>
            <td class="text-secondary text-sm">{{ brand.slug }}</td>
            <td class="text-secondary text-sm">{{ brand.model_count || 0 }} modelos / {{ brand.product_count || 0 }} productos</td>
            <td>
              <StatusBadge :status="brand.is_active ? 'active' : 'archived'" kind="generic" />
            </td>
            <td class="actions-cell">
              <button v-if="editingBrandId !== brand.id" type="button" class="btn btn-secondary btn-sm" @click="startBrandEdit(brand)">
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
            </td>
          </tr>
        </BaseTable>
      </div>

      <div class="panel admin-card">
        <div class="panel-header">
          <h3>Modelos</h3>
        </div>

        <div class="create-stack mt-4">
          <select v-model="newModelBrandId" class="form-input">
            <option value="">Selecciona una marca</option>
            <option v-for="brand in brands.filter((item) => item.is_active)" :key="brand.id" :value="brand.id">
              {{ brand.name }}
            </option>
          </select>
          <div class="create-row">
            <input v-model="newModelName" class="form-input" placeholder="Nuevo modelo" />
            <button type="button" class="btn btn-primary btn-sm" @click="createModel">Agregar</button>
          </div>
          <input v-model="modelSearch" class="form-input" placeholder="Buscar modelo, slug o marca" />
          <select v-model="selectedBrandId" class="form-input">
            <option value="">Filtrar por marca</option>
            <option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
          </select>
          <select v-model="modelStatusFilter" class="form-input">
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
          </select>
        </div>

        <BaseTable class="mt-4" :empty="filteredModels.length === 0" empty-message="No hay modelos." :colspan="5">
          <template #head>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Productos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
          </template>

          <tr v-for="model in filteredModels" :key="model.id">
            <td>
              <div v-if="editingModelId === model.id" class="inline-edit">
                <input v-model="modelEditName" class="form-input" />
                <button type="button" class="btn btn-sm" @click="saveModelEdit(model.id)">Guardar</button>
                <button type="button" class="btn btn-secondary btn-sm" @click="cancelModelEdit">Cancelar</button>
              </div>
              <span v-else>{{ model.name }}</span>
            </td>
            <td class="text-secondary text-sm">{{ model.brand_name || brands.find((brand) => brand.id === model.brand_id)?.name || model.brand_id }}</td>
            <td class="text-secondary text-sm">{{ model.product_count || 0 }}</td>
            <td>
              <StatusBadge :status="model.is_active ? 'active' : 'archived'" kind="generic" />
            </td>
            <td class="actions-cell">
              <button v-if="editingModelId !== model.id" type="button" class="btn btn-secondary btn-sm" @click="startModelEdit(model)">
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
            </td>
          </tr>
        </BaseTable>
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
      :is-open="!!modelIdPendingArchive"
      title="Archivar modelo"
      message="Esta accion desactivara el modelo. Si tiene productos activos o reservados, el backend la rechazara."
      confirm-label="Archivar modelo"
      variant="warning"
      :is-loading="isArchiving && !!modelIdPendingArchive"
      @cancel="closeModelArchiveModal"
      @confirm="archiveModel"
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

.grid-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 1024px) {
  .grid-layout {
    grid-template-columns: 1fr 1fr;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
}

.create-row {
  display: flex;
  gap: 0.75rem;
}

.create-stack {
  display: grid;
  gap: 0.75rem;
}

.filter-stack {
  display: grid;
  gap: 0.75rem;
}

.inline-edit {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
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
</style>
