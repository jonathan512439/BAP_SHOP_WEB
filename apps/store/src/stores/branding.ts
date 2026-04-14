import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PublicBrandingSettings } from '@bap-shop/shared'
import {
  DEFAULT_STORE_BANNER_TEXT,
  DEFAULT_STORE_BANNER_TITLE,
  DEFAULT_STORE_NAME,
} from '@bap-shop/shared'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

const DEFAULT_BRANDING: PublicBrandingSettings = {
  store_name: DEFAULT_STORE_NAME,
  brand_logo_url: '',
  social_facebook_url: '',
  social_tiktok_url: '',
  social_instagram_url: '',
  store_banner_title: DEFAULT_STORE_BANNER_TITLE,
  store_banner_text: DEFAULT_STORE_BANNER_TEXT,
  store_banner_image_url: '',
  store_banner_video_url: '',
  store_banner_media_type: 'image',
  admin_banner_title: 'BAP Shop Admin',
  admin_banner_text: 'Gestion centralizada de catalogo, promociones, pedidos y ajustes.',
  admin_banner_image_url: '',
}

export const useBrandingStore = defineStore('store-branding', () => {
  const branding = ref<PublicBrandingSettings>({ ...DEFAULT_BRANDING })
  const isLoaded = ref(false)
  const isLoading = ref(false)

  const loadBranding = async () => {
    if (isLoading.value || isLoaded.value) return

    isLoading.value = true
    try {
      const response = await fetch(`${API_BASE_URL}/settings/public`)
      if (!response.ok) throw new Error('No se pudo cargar la marca publica')
      const payload = await response.json() as { data?: Partial<PublicBrandingSettings> }
      branding.value = { ...DEFAULT_BRANDING, ...(payload.data ?? {}) }
    } catch (error) {
      console.error(error)
      branding.value = { ...DEFAULT_BRANDING }
    } finally {
      isLoaded.value = true
      isLoading.value = false
    }
  }

  return {
    branding,
    isLoaded,
    isLoading,
    loadBranding,
  }
})
