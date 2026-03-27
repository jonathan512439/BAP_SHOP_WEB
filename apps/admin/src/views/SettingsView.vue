<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { buildWhatsappMessage, buildWhatsappUrl, normalizePhone, type OrderItem, PRODUCT_TYPE } from '@bap-shop/shared'
import { apiClient } from '../api/client'
import FormField from '../components/FormField.vue'
import FormTextarea from '../components/FormTextarea.vue'

const settings = ref({
  store_name: '',
  whatsapp_number: '',
  whatsapp_header: '',
  order_expiry_minutes: '120',
})

const isLoading = ref(true)
const isSaving = ref(false)
const feedback = ref('')

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

const previewMessage = computed(() =>
  buildWhatsappMessage(previewOrder.value, previewItems.value, {
    whatsapp_number: normalizePhone(settings.value.whatsapp_number || '59170000000'),
    store_name: settings.value.store_name || 'BAP Shop',
    whatsapp_header: settings.value.whatsapp_header || '',
  })
)

const previewUrl = computed(() => {
  const phone = settings.value.whatsapp_number.trim()
  if (!phone) return ''
  return buildWhatsappUrl(phone, previewMessage.value)
})

onMounted(async () => {
  isLoading.value = true
  try {
    const res = await apiClient<{ data: Record<string, string> }>('/admin/settings')
    settings.value.store_name = res.data.store_name || ''
    settings.value.whatsapp_number = res.data.whatsapp_number || ''
    settings.value.whatsapp_header = res.data.whatsapp_header || ''
    settings.value.order_expiry_minutes = res.data.order_expiry_minutes || '120'
  } catch (error: any) {
    feedback.value = `Error cargando ajustes: ${error.message}`
  } finally {
    isLoading.value = false
  }
})

const saveSettings = async () => {
  isSaving.value = true
  feedback.value = ''

  try {
    await apiClient('/admin/settings', {
      method: 'PUT',
      body: { ...settings.value },
    })
    feedback.value = 'Configuracion guardada.'
  } catch (error: any) {
    feedback.value = `Error guardando: ${error.message}`
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="settings-view">
    <div class="header-actions">
      <h2>Ajustes globales</h2>
    </div>

    <div v-if="isLoading">Cargando...</div>

    <div v-else class="settings-layout">
      <form class="admin-card settings-form" @submit.prevent="saveSettings">
        <h3>Datos de la tienda</h3>

        <FormField class="mt-4" label="Nombre de la tienda" help="Nombre visible en el panel, snapshots y mensajes.">
          <input v-model="settings.store_name" type="text" class="form-input" required />
        </FormField>

        <FormField label="Numero de WhatsApp" help="Usa formato internacional para generar enlaces consistentes.">
          <input v-model="settings.whatsapp_number" type="text" class="form-input" required placeholder="+59170000000" />
        </FormField>

        <FormTextarea
          v-model="settings.whatsapp_header"
          label="Cabecera del mensaje de WhatsApp"
          help="Texto inicial editable antes del detalle del pedido."
          :rows="3"
        />

        <h3>Mecanica de reservas</h3>
        <FormField class="mt-4" label="Tiempo de expiracion" help="Tiempo maximo que el pedido queda pendiente antes de liberar stock.">
          <select v-model="settings.order_expiry_minutes" class="form-input">
            <option value="60">60 minutos</option>
            <option value="120">120 minutos</option>
            <option value="240">240 minutos</option>
            <option value="480">480 minutos</option>
          </select>
        </FormField>

        <p v-if="feedback" class="feedback">{{ feedback }}</p>

        <div class="form-actions mt-4">
          <button type="submit" class="btn btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Guardando...' : 'Guardar ajustes' }}
          </button>
        </div>
      </form>

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
    </div>
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

.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
}

@media (min-width: 1100px) {
  .settings-layout {
    grid-template-columns: minmax(0, 0.95fr) minmax(320px, 0.9fr);
    align-items: start;
  }
}

.settings-form {
  max-width: 100%;
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

.feedback {
  margin-top: 1rem;
  color: var(--text-secondary);
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
</style>
