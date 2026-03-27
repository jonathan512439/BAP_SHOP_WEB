<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  PHYSICAL_CONDITION_LABELS,
  PRODUCT_STATUS,
  type Brand,
  type Model,
} from '@bap-shop/shared'
import { validatePrice } from '@bap-shop/shared'
import { ApiError, apiClient } from '../api/client'
import BaseConfirmModal from '../components/BaseConfirmModal.vue'
import FormField from '../components/FormField.vue'
import FormSelect from '../components/FormSelect.vue'
import FormTextarea from '../components/FormTextarea.vue'

type ProductStatus = 'draft' | 'active' | 'hidden' | 'reserved' | 'sold'

interface ProductDetailResponse {
  id: string
  type: 'sneaker' | 'other'
  status: ProductStatus
  name: string
  description?: string | null
  characteristics?: string | null
  brand_id?: string | null
  model_id?: string | null
  size?: string | null
  price: number
  physical_condition: keyof typeof PHYSICAL_CONDITION_LABELS
  images: Array<{
    id: string
    r2_key: string
    is_primary: 0 | 1
  }>
}

interface QueuedImage {
  file: File
  previewUrl: string
}

const route = useRoute()
const router = useRouter()
const isEdit = route.name === 'product-edit'
const productId = String(route.params.id ?? '')

const isLoading = ref(false)
const isSaving = ref(false)
const brands = ref<Brand[]>([])
const models = ref<Model[]>([])
const images = ref<ProductDetailResponse['images']>([])
const queuedImages = ref<QueuedImage[]>([])
const initialStatus = ref<ProductStatus>('draft')
const formError = ref('')
const activationErrors = ref<string[]>([])
const imageIdPendingDelete = ref<string | null>(null)
const isDeletingImage = ref(false)

const form = ref({
  name: '',
  description: '',
  characteristics: '',
  brandId: '',
  model_id: '',
  type: 'sneaker' as 'sneaker' | 'other',
  physical_condition: 'new' as keyof typeof PHYSICAL_CONDITION_LABELS,
  size: '',
  price: 0,
  status: 'draft' as ProductStatus,
})

const activeBrands = computed(() => brands.value.filter((brand) => brand.is_active))
const availableModels = computed(() =>
  models.value.filter((model) => !form.value.brandId || model.brand_id === form.value.brandId)
)

const existingImageCount = computed(() => images.value.length)
const totalImageCount = computed(() => images.value.length + queuedImages.value.length)
const hasPrimaryImage = computed(() => images.value.some((image) => image.is_primary === 1) || queuedImages.value.length > 0)

const availableStatuses = computed(() => {
  if (!isEdit) {
    return [
      { value: PRODUCT_STATUS.DRAFT, label: 'Borrador' },
      { value: PRODUCT_STATUS.ACTIVE, label: 'Activo (Visible)' },
    ]
  }

  const currentStatus = initialStatus.value
  if (currentStatus === PRODUCT_STATUS.RESERVED) {
    return [
      { value: PRODUCT_STATUS.RESERVED, label: 'Reservado' },
      { value: PRODUCT_STATUS.ACTIVE, label: 'Activo (Liberar)' },
      { value: PRODUCT_STATUS.SOLD, label: 'Vendido' },
    ]
  }

  if (currentStatus === PRODUCT_STATUS.HIDDEN) {
    return [
      { value: PRODUCT_STATUS.HIDDEN, label: 'Oculto' },
      { value: PRODUCT_STATUS.ACTIVE, label: 'Activo (Visible)' },
      { value: PRODUCT_STATUS.SOLD, label: 'Vendido' },
    ]
  }

  if (currentStatus === PRODUCT_STATUS.ACTIVE) {
    return [
      { value: PRODUCT_STATUS.ACTIVE, label: 'Activo (Visible)' },
      { value: PRODUCT_STATUS.HIDDEN, label: 'Oculto' },
      { value: PRODUCT_STATUS.SOLD, label: 'Vendido' },
    ]
  }

  if (currentStatus === PRODUCT_STATUS.SOLD) {
    return [{ value: PRODUCT_STATUS.SOLD, label: 'Vendido' }]
  }

  return [
    { value: PRODUCT_STATUS.DRAFT, label: 'Borrador' },
    { value: PRODUCT_STATUS.ACTIVE, label: 'Activo (Visible)' },
  ]
})

const localValidationErrors = computed(() => {
  const issues: string[] = []

  if (!form.value.name.trim()) issues.push('El nombre es obligatorio.')
  if (!validatePrice(Number(form.value.price)).valid) issues.push('El precio debe ser un entero positivo.')

  if (form.value.type === 'sneaker') {
    if (!form.value.brandId) issues.push('Debes elegir una marca.')
    if (!form.value.model_id) issues.push('Debes elegir un modelo.')
    if (!form.value.size.trim()) issues.push('La talla es obligatoria para sneakers.')
  }

  if (form.value.type === 'other' && !form.value.characteristics.trim()) {
    issues.push('Agrega caracteristicas para productos tipo "other".')
  }

  if (form.value.status === PRODUCT_STATUS.ACTIVE && !hasPrimaryImage.value) {
    issues.push('Necesitas al menos una imagen para activar el producto.')
  }

  return issues
})

const canSubmit = computed(() => !isSaving.value && localValidationErrors.value.length === 0)

const resetServerErrors = () => {
  formError.value = ''
  activationErrors.value = []
}

const revokeQueuedImageUrls = () => {
  for (const image of queuedImages.value) {
    URL.revokeObjectURL(image.previewUrl)
  }
}

const loadInitialData = async () => {
  isLoading.value = true
  try {
    const [brandsRes, modelsRes] = await Promise.all([
      apiClient<{ data: Brand[] }>('/admin/brands'),
      apiClient<{ data: Model[] }>('/admin/models'),
    ])

    brands.value = brandsRes.data
    models.value = modelsRes.data

    if (!isEdit) return

    const res = await apiClient<{ data: ProductDetailResponse }>(`/admin/products/${productId}`)
    const product = res.data
    form.value = {
      name: product.name,
      description: product.description || '',
      characteristics: product.characteristics || '',
      brandId: product.brand_id || '',
      model_id: product.model_id || '',
      type: product.type,
      physical_condition: product.physical_condition,
      size: product.size || '',
      price: product.price,
      status: product.status,
    }
    initialStatus.value = product.status
    images.value = product.images || []
  } catch (error: any) {
    formError.value = error.message || 'Error cargando el formulario.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadInitialData()
})

const handleTypeChange = () => {
  resetServerErrors()

  if (form.value.type === 'other') {
    form.value.brandId = ''
    form.value.model_id = ''
    form.value.size = ''
    return
  }

  form.value.characteristics = ''
}

const handleBrandChange = () => {
  resetServerErrors()

  if (!availableModels.value.some((model) => model.id === form.value.model_id)) {
    form.value.model_id = ''
  }
}

const handleFileChange = (event: Event) => {
  resetServerErrors()

  const target = event.target as HTMLInputElement
  if (!target.files) return

  const nextFiles = Array.from(target.files)
  for (const file of nextFiles) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      formError.value = `Formato no permitido: ${file.name}`
      continue
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      formError.value = `La imagen ${file.name} supera 5MB.`
      continue
    }

    queuedImages.value.push({
      file,
      previewUrl: URL.createObjectURL(file),
    })
  }

  target.value = ''
}

const removeQueuedImage = (index: number) => {
  const [image] = queuedImages.value.splice(index, 1)
  if (image) URL.revokeObjectURL(image.previewUrl)
}

const buildProductPayload = () => {
  const basePayload: Record<string, unknown> = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || undefined,
    price: Number(form.value.price),
    physical_condition: form.value.physical_condition,
  }

  if (isEdit) {
    if (form.value.type === 'sneaker') {
      return {
        ...basePayload,
        model_id: form.value.model_id || undefined,
        size: form.value.size.trim() || undefined,
        characteristics: undefined,
      }
    }

    return {
      ...basePayload,
      characteristics: form.value.characteristics.trim() || undefined,
      model_id: undefined,
      size: undefined,
    }
  }

  if (form.value.type === 'sneaker') {
    return {
      ...basePayload,
      type: 'sneaker',
      model_id: form.value.model_id,
      size: form.value.size.trim(),
    }
  }

  return {
    ...basePayload,
    type: 'other',
    characteristics: form.value.characteristics.trim() || undefined,
  }
}

const saveProduct = async () => {
  resetServerErrors()

  if (localValidationErrors.value.length > 0) {
    formError.value = 'Corrige los campos marcados antes de guardar.'
    return
  }

  isSaving.value = true

  try {
    const endpoint = isEdit ? `/admin/products/${productId}` : '/admin/products'
    const method = isEdit ? 'PUT' : 'POST'
    const payload = buildProductPayload()
    const res = await apiClient<{ data: { id: string } }>(endpoint, { method, body: payload })
    const newProductId = isEdit ? productId : res.data.id

    if (queuedImages.value.length > 0) {
      for (const queuedImage of queuedImages.value) {
        await apiClient(`/admin/products/${newProductId}/images`, {
          method: 'POST',
          body: queuedImage.file,
          headers: {
            Accept: 'application/json',
            'Content-Type': queuedImage.file.type,
          },
        })
      }
    }

    if (form.value.status !== initialStatus.value && form.value.status !== PRODUCT_STATUS.DRAFT) {
      await apiClient(`/admin/products/${newProductId}/status`, {
        method: 'PATCH',
        body: { status: form.value.status },
      })
    }

    revokeQueuedImageUrls()
    queuedImages.value = []
    router.push('/products')
  } catch (error) {
    if (error instanceof ApiError) {
      formError.value = error.message
    } else {
      formError.value = 'Error guardando producto.'
    }

    const apiError = error as { status?: number; message?: string }
    if (apiError.status === 422 && typeof error === 'object' && error !== null) {
      const maybeData = (error as any).data
      if (Array.isArray(maybeData?.errors)) {
        activationErrors.value = maybeData.errors
      }
    }
  } finally {
    isSaving.value = false
  }
}

const requestDeleteImage = (imgId: string) => {
  imageIdPendingDelete.value = imgId
}

const closeDeleteImageModal = () => {
  imageIdPendingDelete.value = null
}

const deleteImage = async () => {
  if (!imageIdPendingDelete.value) return

  isDeletingImage.value = true

  try {
    await apiClient(`/admin/products/${productId}/images/${imageIdPendingDelete.value}`, { method: 'DELETE' })
    images.value = images.value.filter((image) => image.id !== imageIdPendingDelete.value)
    closeDeleteImageModal()
  } catch (error: any) {
    formError.value = error.message || 'Error eliminando imagen.'
  } finally {
    isDeletingImage.value = false
  }
}

const setPrimaryImage = async (imgId: string) => {
  try {
    await apiClient(`/admin/products/${productId}/images/${imgId}/primary`, { method: 'PATCH' })
    images.value = images.value.map((image) => ({
      ...image,
      is_primary: image.id === imgId ? 1 : 0,
    }))
  } catch (error: any) {
    formError.value = error.message || 'Error definiendo imagen principal.'
  }
}
</script>

<template>
  <div class="product-form-view">
    <div class="header-actions">
      <h2>{{ isEdit ? 'Editar producto' : 'Nuevo producto' }}</h2>
      <button type="button" class="btn btn-secondary" @click="router.push('/products')">Volver</button>
    </div>

    <div v-if="isLoading" class="loading">Cargando...</div>

    <div v-else class="form-container">
      <form class="admin-card" @submit.prevent="saveProduct">
        <div v-if="formError" class="error-banner">
          <strong>Error:</strong> {{ formError }}
        </div>

        <div v-if="activationErrors.length > 0" class="warning-banner">
          <strong>Faltantes para activar:</strong>
          <ul>
            <li v-for="issue in activationErrors" :key="issue">{{ issue }}</li>
          </ul>
        </div>

        <div v-if="localValidationErrors.length > 0" class="hint-card">
          <strong>Checklist local:</strong>
          <ul>
            <li v-for="issue in localValidationErrors" :key="issue">{{ issue }}</li>
          </ul>
        </div>

        <div class="grid-form">
          <FormField class="span-2" label="Nombre del producto" help="Nombre visible en snapshots, tienda y panel.">
            <input v-model="form.name" type="text" class="form-input" required />
          </FormField>

          <FormTextarea
            v-model="form.description"
            class="span-2"
            label="Descripcion"
            help="Texto breve que se mostrara en detalle y contexto del producto."
            :rows="3"
          />

          <FormTextarea
            v-model="form.characteristics"
            v-if="form.type === 'other'"
            class="span-2"
            label="Caracteristicas"
            help="Campo obligatorio para productos de tipo other."
            :rows="3"
          />

          <FormSelect label="Tipo" help="No se puede cambiar despues de crear el producto.">
            <select v-model="form.type" class="form-input" :disabled="isEdit" @change="handleTypeChange">
              <option value="sneaker">Sneaker</option>
              <option value="other">Otro</option>
            </select>
          </FormSelect>

          <FormSelect label="Condicion fisica" help="Impacta filtros publicos y contexto del articulo.">
            <select v-model="form.physical_condition" class="form-input">
              <option v-for="(label, key) in PHYSICAL_CONDITION_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </FormSelect>

          <FormSelect
            v-if="form.type === 'sneaker'"
            label="Marca"
            help="Solo se listan marcas activas."
          >
            <select v-model="form.brandId" class="form-input" @change="handleBrandChange">
              <option value="">Selecciona una marca</option>
              <option v-for="brand in activeBrands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
            </select>
          </FormSelect>

          <FormSelect
            v-if="form.type === 'sneaker'"
            label="Modelo"
            help="La lista depende de la marca seleccionada."
          >
            <select v-model="form.model_id" class="form-input">
              <option value="">Selecciona un modelo</option>
              <option v-for="model in availableModels" :key="model.id" :value="model.id">{{ model.name }}</option>
            </select>
          </FormSelect>

          <FormField
            v-if="form.type === 'sneaker'"
            label="Talla"
            help="Campo obligatorio para sneakers."
          >
            <input v-model="form.size" type="text" class="form-input" />
          </FormField>

          <FormSelect
            label="Estado"
            help="Activar ejecuta validaciones adicionales y puede disparar rebuild del catalogo."
          >
            <select v-model="form.status" class="form-input">
              <option v-for="status in availableStatuses" :key="status.value" :value="status.value">
                {{ status.label }}
              </option>
            </select>
          </FormSelect>

          <FormField label="Precio" help="Ingresa un entero positivo en la moneda base del sistema.">
            <input v-model.number="form.price" type="number" min="1" step="1" class="form-input" />
          </FormField>
        </div>

        <div class="form-separator"></div>

        <div class="section-header">
          <div>
            <h3>Imagenes</h3>
            <p class="text-secondary text-sm">{{ totalImageCount }} imagen(es) entre servidor y cola local.</p>
          </div>
        </div>

        <div v-if="isEdit" class="images-manager">
          <div class="existing-images">
            <div v-for="img in images" :key="img.id" class="image-box" :class="{ primary: img.is_primary }">
              <img :src="`https://assets.bapshop.com/${img.r2_key}`" alt="" />
              <div class="img-actions">
                <button v-if="!img.is_primary" type="button" class="img-btn" title="Principal" @click="setPrimaryImage(img.id)">
                  Principal
                </button>
                <button type="button" class="img-btn delete" title="Borrar" @click="requestDeleteImage(img.id)">
                  Borrar
                </button>
              </div>
            </div>
            <p v-if="existingImageCount === 0" class="text-secondary text-sm">No hay imagenes cargadas todavia.</p>
          </div>
        </div>

        <FormField
          class="mt-4"
          label="Subir nuevas imagenes"
          help="Formatos permitidos: JPG, PNG, WebP. Maximo 5MB por archivo."
        >
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" class="form-input file-input" @change="handleFileChange" />
        </FormField>

        <div v-if="queuedImages.length > 0" class="queued-grid mt-4">
          <div v-for="(image, index) in queuedImages" :key="`${image.file.name}-${index}`" class="queued-card">
            <img :src="image.previewUrl" alt="" />
            <div class="queued-meta">
              <strong>{{ image.file.name }}</strong>
              <span>{{ Math.round(image.file.size / 1024) }} KB</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" @click="removeQueuedImage(index)">Quitar</button>
          </div>
        </div>

        <div class="form-actions mt-4">
          <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
            {{ isSaving ? 'Guardando...' : 'Guardar producto' }}
          </button>
        </div>
      </form>

      <BaseConfirmModal
        :is-open="!!imageIdPendingDelete"
        title="Eliminar imagen"
        message="Esta accion eliminara la imagen del producto y puede cambiar la imagen principal visible en el catalogo."
        confirm-label="Eliminar imagen"
        variant="danger"
        :is-loading="isDeletingImage"
        @cancel="closeDeleteImageModal"
        @confirm="deleteImage"
      />
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-actions h2 {
  font-size: 1.5rem;
  margin: 0;
}

.error-banner,
.warning-banner,
.hint-card {
  padding: 1rem 1.1rem;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.error-banner {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #fecaca;
}

.warning-banner {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fde68a;
}

.hint-card {
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.error-banner ul,
.warning-banner ul,
.hint-card ul {
  margin: 0.5rem 0 0;
  padding-left: 1.2rem;
}

.grid-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.span-2 {
  grid-column: span 2;
}

.form-separator {
  height: 1px;
  background: var(--border-light);
  margin: 2rem 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header h3 {
  margin: 0;
}

.images-manager {
  margin-top: 1rem;
}

.existing-images {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.image-box {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 2px solid transparent;
}

.image-box.primary {
  border-color: var(--accent-primary);
}

.image-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.img-actions {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.35rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.image-box:hover .img-actions {
  opacity: 1;
}

.img-btn {
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.35rem;
}

.img-btn.delete:hover {
  color: var(--danger);
}

.file-input {
  padding: 1rem;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-focus);
}

.queued-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.queued-card {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-tertiary);
}

.queued-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.queued-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  font-size: 0.8rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--border-light);
  padding-top: 1.5rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 1.5rem;
}

.grid-form :deep(.form-input) {
  width: 100%;
}

@media (max-width: 900px) {
  .grid-form {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }
}
</style>
