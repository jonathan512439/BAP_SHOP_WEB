<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  buildWhatsappMessage,
  DEFAULT_WHATSAPP_TEMPLATE,
  buildWhatsappUrl,
  normalizePhone,
  type OrderItem,
  PRODUCT_TYPE,
} from '@bap-shop/shared'
import { apiClient } from '../api/client'
import FormField from '../components/FormField.vue'
import FormTextarea from '../components/FormTextarea.vue'
import {
  describeImageOptimization,
  describeVideoOptimization,
  optimizeBrandingImage,
  optimizeBrandingVideo,
} from '../lib/media'
import { useBrandingStore } from '../stores/branding'

type BrandingAssetType = 'logo' | 'store-banner' | 'store-banner-video' | 'admin-banner'
type BrandingAssetSettingKey =
  | 'brand_logo_url'
  | 'store_banner_image_url'
  | 'store_banner_video_url'
  | 'admin_banner_image_url'

const settings = ref({
  store_name: '',
  whatsapp_number: '',
  whatsapp_header: '',
  whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
  order_expiry_minutes: '120',
  brand_logo_url: '',
  social_facebook_url: '',
  social_tiktok_url: '',
  social_instagram_url: '',
  store_banner_title: '',
  store_banner_text: '',
  store_banner_image_url: '',
  store_banner_video_url: '',
  store_banner_media_type: 'image' as 'image' | 'video',
  admin_banner_title: '',
  admin_banner_text: '',
  admin_banner_image_url: '',
})

const brandingStore = useBrandingStore()
const isLoading = ref(true)
const isSaving = ref(false)
const feedback = ref('')
const passwordFeedback = ref('')
const isChangingPassword = ref(false)
const uploading = ref<Record<BrandingAssetType, boolean>>({
  logo: false,
  'store-banner': false,
  'store-banner-video': false,
  'admin-banner': false,
})
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const previewOrder = computed(() => ({
  order_code: 'BAP-20260326-A1B2',
  customer_name: 'Cliente Demo',
  customer_phone: '+591 70000000',
  subtotal: 80000,
  discount: 12000,
  total: 68000,
}))

const previewItems = computed<OrderItem[]>(() => [
  {
    id: 'demo-1',
    order_id: 'preview',
    product_id: 'demo-prod-1',
    product_name: 'Nike Air Force 1 Low',
    product_type: PRODUCT_TYPE.SNEAKER,
    product_size: '42',
    unit_price: 45000,
    promo_price: 36000,
    final_price: 36000,
  },
  {
    id: 'demo-2',
    order_id: 'preview',
    product_id: 'demo-prod-2',
    product_name: 'BAP Cap',
    product_type: PRODUCT_TYPE.OTHER,
    product_size: null,
    unit_price: 35000,
    promo_price: null,
    final_price: 32000,
  },
])

const logoPreviewUrl = computed(() => settings.value.brand_logo_url || '/brand/bap-logo.svg')

const previewMessage = computed(() =>
  buildWhatsappMessage(previewOrder.value, previewItems.value, {
    whatsapp_number: normalizePhone(settings.value.whatsapp_number || '59170000000'),
    store_name: settings.value.store_name || 'BAP Shop',
    whatsapp_header: settings.value.whatsapp_header || '',
    whatsapp_template: settings.value.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
  })
)

const previewUrl = computed(() => {
  const phone = settings.value.whatsapp_number.trim()
  if (!phone) return ''
  return buildWhatsappUrl(phone, previewMessage.value)
})

async function loadSettings() {
  isLoading.value = true
  try {
    const response = await apiClient<{ data: Record<string, string> }>('/admin/settings')
    settings.value = {
      store_name: response.data.store_name || '',
      whatsapp_number: response.data.whatsapp_number || '',
      whatsapp_header: response.data.whatsapp_header || '',
      whatsapp_template: response.data.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
      order_expiry_minutes: response.data.order_expiry_minutes || '120',
      brand_logo_url: response.data.brand_logo_url || '',
      social_facebook_url: response.data.social_facebook_url || '',
      social_tiktok_url: response.data.social_tiktok_url || '',
      social_instagram_url: response.data.social_instagram_url || '',
      store_banner_title: response.data.store_banner_title || '',
      store_banner_text: response.data.store_banner_text || '',
      store_banner_image_url: response.data.store_banner_image_url || '',
      store_banner_video_url: response.data.store_banner_video_url || '',
      store_banner_media_type: response.data.store_banner_media_type === 'video' ? 'video' : 'image',
      admin_banner_title: response.data.admin_banner_title || '',
      admin_banner_text: response.data.admin_banner_text || '',
      admin_banner_image_url: response.data.admin_banner_image_url || '',
    }
  } catch (error: any) {
    feedback.value = `Error cargando ajustes: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadSettings(), brandingStore.loadBranding(true)])
})

const saveSettings = async () => {
  isSaving.value = true
  feedback.value = ''

  try {
    await apiClient('/admin/settings', {
      method: 'PUT',
      body: { ...settings.value },
    })
    await brandingStore.loadBranding(true)
    feedback.value = 'Configuracion guardada.'
  } catch (error: any) {
    feedback.value = `Error guardando: ${error.message}`
  } finally {
    isSaving.value = false
  }
}

const uploadAsset = async (assetType: BrandingAssetType, file: File | null) => {
  if (!file) return

  feedback.value = ''
  uploading.value[assetType] = true

  try {
    let preparedFile = file

    if (assetType === 'store-banner-video') {
      feedback.value = 'Preparando video del banner...'
      preparedFile = await optimizeBrandingVideo(file, (progress) => {
        feedback.value = `Optimizando video del banner... ${Math.round(progress * 100)}%`
      })
      feedback.value = describeVideoOptimization(file, preparedFile)
    } else {
      feedback.value = 'Optimizando imagen...'
      preparedFile = await optimizeBrandingImage(file, assetType === 'logo' ? 'logo' : 'banner')
      feedback.value = describeImageOptimization(file, preparedFile)
    }

    const response = await apiClient<{ data: { key: string; value: string } }>(`/admin/settings/assets/${assetType}`, {
      method: 'POST',
      headers: {
        'Content-Type': preparedFile.type,
      },
      body: preparedFile,
    })

    const key = response.data.key as BrandingAssetSettingKey
    settings.value[key] = response.data.value
    await brandingStore.loadBranding(true)
    feedback.value = `${feedback.value} Asset actualizado correctamente.`
  } catch (error: any) {
    feedback.value = `Error subiendo asset: ${error.message}`
  } finally {
    uploading.value[assetType] = false
  }
}

const onAssetSelected = async (event: Event, assetType: BrandingAssetType) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  await uploadAsset(assetType, file)
  input.value = ''
}

const changePassword = async () => {
  passwordFeedback.value = ''

  if (!passwordForm.value.currentPassword || !passwordForm.value.newPassword || !passwordForm.value.confirmPassword) {
    passwordFeedback.value = 'Completa todos los campos para cambiar la contraseña.'
    return
  }

  if (passwordForm.value.newPassword.length < 8) {
    passwordFeedback.value = 'La nueva contraseña debe tener al menos 8 caracteres.'
    return
  }

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordFeedback.value = 'La confirmación de la nueva contraseña no coincide.'
    return
  }

  isChangingPassword.value = true

  try {
    await apiClient('/auth/password', {
      method: 'PATCH',
      body: {
        currentPassword: passwordForm.value.currentPassword,
        newPassword: passwordForm.value.newPassword,
      },
    })
    passwordForm.value.currentPassword = ''
    passwordForm.value.newPassword = ''
    passwordForm.value.confirmPassword = ''
    passwordFeedback.value = 'Contraseña actualizada. Las otras sesiones activas fueron cerradas.'
  } catch (error: any) {
    passwordFeedback.value = `Error cambiando contraseña: ${error.message}`
  } finally {
    isChangingPassword.value = false
  }
}
</script>

<template>
  <div class="settings-view">
    <div class="header-actions">
      <h2>Ajustes globales</h2>
      <p>Administra identidad visual, banner principal y configuracion operativa de la tienda.</p>
    </div>

    <div v-if="isLoading">Cargando...</div>

    <div v-else class="settings-layout">
      <form class="admin-card settings-form" @submit.prevent="saveSettings">
        <h3>Datos de la tienda</h3>

        <FormField class="mt-4" label="Nombre de la tienda" help="Nombre visible en el panel, el store y los mensajes.">
          <input v-model="settings.store_name" type="text" class="form-input" required />
        </FormField>

        <FormField label="Numero de recepcion de ventas por WhatsApp" help="Este es el numero al que se enviara el comprobante desde el checkout.">
          <input
            v-model="settings.whatsapp_number"
            type="text"
            class="form-input"
            required
            placeholder="+59170000000"
          />
        </FormField>

        <FormTextarea
          v-model="settings.whatsapp_header"
          label="Cabecera del mensaje de WhatsApp"
          help="Texto inicial editable antes del comprobante del pedido."
          :rows="3"
        />

        <FormTextarea
          v-model="settings.whatsapp_template"
          label="Ajustar mensaje del comprobante"
          help="Puedes usar placeholders: {{store_name_upper}}, {{store_name}}, {{whatsapp_header_block}}, {{order_code}}, {{customer_name}}, {{customer_phone}}, {{items}}, {{subtotal}}, {{discount_block}} y {{total}}."
          :rows="14"
        />

        <h3>Redes sociales de la tienda</h3>
        <FormField
          class="mt-4"
          label="Facebook"
          help="Pega el enlace completo del perfil o pagina. Si queda vacio, no se mostrara en la tienda."
        >
          <input
            v-model="settings.social_facebook_url"
            type="url"
            class="form-input"
            placeholder="https://www.facebook.com/tu-pagina"
          />
        </FormField>

        <FormField
          label="TikTok"
          help="Pega el enlace completo del perfil. Si queda vacio, no se mostrara en la tienda."
        >
          <input
            v-model="settings.social_tiktok_url"
            type="url"
            class="form-input"
            placeholder="https://www.tiktok.com/@tu-cuenta"
          />
        </FormField>

        <FormField
          label="Instagram"
          help="Pega el enlace completo del perfil. Si queda vacio, no se mostrara en la tienda."
        >
          <input
            v-model="settings.social_instagram_url"
            type="url"
            class="form-input"
            placeholder="https://www.instagram.com/tu-cuenta"
          />
        </FormField>

        <h3>Logo de marca</h3>
        <div class="asset-panel">
          <img :src="logoPreviewUrl" alt="Logo actual" class="asset-logo-preview" />
          <div class="asset-copy">
            <strong>Logo visible en cliente y admin</strong>
            <p>Formato recomendado: SVG con fondo transparente. Tambien acepta PNG, WebP o JPG.</p>
            <p>Tamano sugerido: horizontal, 1200x400 o superior. Si es raster, se optimiza automaticamente antes de subir.</p>
            <label class="btn btn-secondary asset-upload">
              {{ uploading.logo ? 'Subiendo...' : 'Cambiar logo' }}
              <input
                type="file"
                accept=".svg,image/svg+xml,image/png,image/webp,image/jpeg"
                class="hidden-input"
                :disabled="uploading.logo"
                @change="onAssetSelected($event, 'logo')"
              />
            </label>
          </div>
        </div>

        <h3>Banner del store</h3>
        <FormField class="mt-4" label="Titulo del banner" help="Mensaje principal que se muestra al entrar al catalogo.">
          <input v-model="settings.store_banner_title" type="text" class="form-input" required />
        </FormField>

        <FormTextarea
          v-model="settings.store_banner_text"
          label="Texto del banner"
          help="Descripcion corta para reforzar la marca y la propuesta de valor."
          :rows="3"
        />

        <div class="media-type-card">
          <label class="media-type-option">
            <input v-model="settings.store_banner_media_type" type="radio" value="image" />
            <span>Usar imagen como banner</span>
          </label>
          <label class="media-type-option">
            <input v-model="settings.store_banner_media_type" type="radio" value="video" />
            <span>Usar video como banner</span>
          </label>
        </div>

        <div class="asset-panel compact-panel">
          <img
            v-if="settings.store_banner_image_url"
            :src="settings.store_banner_image_url"
            alt="Banner del store"
            class="asset-banner-preview"
          />
          <div class="asset-copy">
            <strong>Imagen del banner del cliente</strong>
            <p>Formatos admitidos: JPG, PNG o WebP.</p>
            <p>Tamano sugerido: 1600x700. Se convierte automaticamente a WebP optimizado antes de subir.</p>
            <label class="btn btn-secondary asset-upload">
              {{ uploading['store-banner'] ? 'Subiendo...' : 'Cambiar banner del store' }}
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                class="hidden-input"
                :disabled="uploading['store-banner']"
                @change="onAssetSelected($event, 'store-banner')"
              />
            </label>
          </div>
        </div>

        <div class="asset-panel compact-panel">
          <video
            v-if="settings.store_banner_video_url"
            :src="settings.store_banner_video_url"
            class="asset-banner-preview"
            muted
            loop
            playsinline
            autoplay
          />
          <div class="asset-copy">
            <strong>Video del banner del cliente</strong>
            <p>Formato admitido: MP4 sin audio. Recomendado: 4 a 10 segundos en loop, H.264.</p>
            <p>Tamano ideal: 1280x720 o 1600x900. Se optimiza automaticamente a MP4 sin audio y liviano antes de subir.</p>
            <label class="btn btn-secondary asset-upload">
              {{ uploading['store-banner-video'] ? 'Subiendo...' : 'Cambiar video del banner' }}
              <input
                type="file"
                accept="video/mp4"
                class="hidden-input"
                :disabled="uploading['store-banner-video']"
                @change="onAssetSelected($event, 'store-banner-video')"
              />
            </label>
          </div>
        </div>

        <h3>Banner del admin</h3>
        <FormField class="mt-4" label="Titulo del banner" help="Texto principal visible en el dashboard y login.">
          <input v-model="settings.admin_banner_title" type="text" class="form-input" required />
        </FormField>

        <FormTextarea
          v-model="settings.admin_banner_text"
          label="Texto del banner"
          help="Descripcion breve para contextualizar el panel."
          :rows="3"
        />

        <div class="asset-panel compact-panel">
          <img
            v-if="settings.admin_banner_image_url"
            :src="settings.admin_banner_image_url"
            alt="Banner del admin"
            class="asset-banner-preview"
          />
          <div class="asset-copy">
            <strong>Imagen del banner del admin</strong>
            <p>Formatos admitidos: JPG, PNG o WebP.</p>
            <p>Tamano sugerido: 1600x700. Se convierte automaticamente a WebP optimizado antes de subir.</p>
            <label class="btn btn-secondary asset-upload">
              {{ uploading['admin-banner'] ? 'Subiendo...' : 'Cambiar banner del admin' }}
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                class="hidden-input"
                :disabled="uploading['admin-banner']"
                @change="onAssetSelected($event, 'admin-banner')"
              />
            </label>
          </div>
        </div>

        <h3>Mecanica de reservas</h3>
        <FormField class="mt-4" label="Tiempo de expiracion" help="Tiempo maximo que el pedido queda pendiente antes de liberar stock.">
          <select v-model="settings.order_expiry_minutes" class="form-input">
            <option value="10">10 minutos</option>
            <option value="20">20 minutos</option>
            <option value="30">30 minutos</option>
            <option value="60">60 minutos</option>
            <option value="120">2 horas</option>
            <option value="240">4 horas</option>
            <option value="1440">24 horas</option>
          </select>
        </FormField>

        <h3>Seguridad de acceso</h3>
        <FormField class="mt-4" label="Contraseña actual" help="Ingresa tu contraseña vigente para autorizar el cambio.">
          <input v-model="passwordForm.currentPassword" type="password" class="form-input" autocomplete="current-password" />
        </FormField>

        <FormField label="Nueva contraseña" help="Usa al menos 8 caracteres para una credencial más robusta.">
          <input v-model="passwordForm.newPassword" type="password" class="form-input" autocomplete="new-password" />
        </FormField>

        <FormField label="Confirmar nueva contraseña">
          <input v-model="passwordForm.confirmPassword" type="password" class="form-input" autocomplete="new-password" />
        </FormField>

        <p v-if="passwordFeedback" class="feedback">{{ passwordFeedback }}</p>

        <div class="inline-actions">
          <button type="button" class="btn btn-secondary" :disabled="isChangingPassword" @click="changePassword">
            {{ isChangingPassword ? 'Actualizando...' : 'Cambiar contraseña' }}
          </button>
        </div>

        <p v-if="feedback" class="feedback">{{ feedback }}</p>

        <div class="form-actions mt-4">
          <button type="submit" class="btn btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Guardando...' : 'Guardar ajustes' }}
          </button>
        </div>
      </form>

      <div class="preview-stack">
        <div class="admin-card preview-card">
          <div class="preview-header">
            <h3>Preview del mensaje</h3>
            <a v-if="previewUrl" :href="previewUrl" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
              Abrir preview
            </a>
          </div>
          <pre class="message-preview">{{ previewMessage }}</pre>
          <p class="preview-note">
            El cliente puede editar este mensaje antes de enviarlo. El panel sigue siendo la fuente de verdad.
          </p>
        </div>

        <div class="admin-card preview-card">
          <h3>Preview visual</h3>
          <div class="branding-preview">
            <img :src="logoPreviewUrl" alt="Logo" class="branding-preview-logo" />
            <div>
              <strong>{{ settings.store_name || 'BAP Shop' }}</strong>
              <p>{{ settings.store_banner_title || 'Piezas seleccionadas, stock real' }}</p>
              <small>{{ settings.store_banner_text || 'Catalogo actualizado desde el panel.' }}</small>
            </div>
          </div>
          <img
            v-if="settings.store_banner_media_type === 'image' && settings.store_banner_image_url"
            :src="settings.store_banner_image_url"
            alt="Preview banner store"
            class="branding-preview-banner"
          />
          <video
            v-if="settings.store_banner_media_type === 'video' && settings.store_banner_video_url"
            :src="settings.store_banner_video_url"
            class="branding-preview-banner"
            muted
            loop
            playsinline
            autoplay
          />
          <img
            v-if="settings.admin_banner_image_url"
            :src="settings.admin_banner_image_url"
            alt="Preview banner admin"
            class="branding-preview-banner"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  margin-bottom: 2rem;
}

.header-actions h2 {
  font-size: 1.5rem;
  margin: 0 0 0.35rem;
}

.header-actions p {
  margin: 0;
  color: var(--text-secondary);
}

.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
}

@media (min-width: 1180px) {
  .settings-layout {
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    align-items: start;
  }
}

.settings-form :deep(.form-input) {
  width: 100%;
}

h3 {
  font-size: 1.125rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 0.5rem;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
}

h3:first-of-type {
  margin-top: 0;
}

.asset-panel {
  display: grid;
  grid-template-columns: minmax(140px, 220px) minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  background: var(--bg-tertiary);
}

.media-type-card {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.media-type-option {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.media-type-option input {
  accent-color: var(--accent-primary);
}

.compact-panel {
  margin-top: 1rem;
}

.asset-logo-preview {
  width: 100%;
  max-width: 220px;
  height: 120px;
  object-fit: contain;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  padding: 1rem;
}

.asset-banner-preview {
  width: 100%;
  min-height: 150px;
  object-fit: cover;
  border-radius: 18px;
}

.asset-copy {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.asset-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.asset-upload {
  align-self: flex-start;
  margin-top: 0.35rem;
}

.hidden-input {
  display: none;
}

.preview-stack {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.preview-header h3 {
  border-bottom: 0;
  margin: 0;
  padding: 0;
}

.message-preview {
  margin: 0;
  padding: 1rem;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
}

.preview-note {
  color: var(--text-secondary);
  margin: 0;
}

.branding-preview {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}

.branding-preview-logo {
  width: 88px;
  height: 88px;
  object-fit: contain;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.75rem;
}

.branding-preview strong {
  display: block;
  margin-bottom: 0.35rem;
}

.branding-preview p,
.branding-preview small {
  color: var(--text-secondary);
}

.branding-preview p {
  margin: 0 0 0.35rem;
}

.branding-preview small {
  display: block;
}

.branding-preview-banner {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid var(--border-light);
}

.feedback {
  margin-top: 1rem;
  color: var(--text-secondary);
}

.inline-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: 1rem;
}

.mt-4 {
  margin-top: 1.5rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--border-light);
  padding-top: 1.5rem;
}

@media (max-width: 760px) {
  .asset-panel,
  .branding-preview {
    grid-template-columns: 1fr;
  }

  .asset-upload {
    width: 100%;
    justify-content: center;
  }

  .preview-header {
    align-items: stretch;
    flex-direction: column;
  }

  .form-actions {
    justify-content: stretch;
  }

  .form-actions .btn {
    width: 100%;
  }

  .inline-actions .btn {
    width: 100%;
  }
}
</style>
