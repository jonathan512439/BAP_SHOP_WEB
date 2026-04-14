import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PublicBrandingSettings } from '@bap-shop/shared'
import {
  DEFAULT_ADMIN_BANNER_TEXT,
  DEFAULT_ADMIN_BANNER_TITLE,
  DEFAULT_STORE_BANNER_TEXT,
  DEFAULT_STORE_BANNER_TITLE,
  DEFAULT_STORE_NAME,
} from '@bap-shop/shared'
import { apiClient } from '../api/client'

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
  admin_banner_title: DEFAULT_ADMIN_BANNER_TITLE,
  admin_banner_text: DEFAULT_ADMIN_BANNER_TEXT,
  admin_banner_image_url: '',
}

export const useBrandingStore = defineStore('admin-branding', () => {
  const branding = ref<PublicBrandingSettings>({ ...DEFAULT_BRANDING })
  const isLoaded = ref(false)
  const isLoading = ref(false)

  const loadBranding = async (force = false) => {
    if (isLoading.value || (isLoaded.value && !force)) return

    isLoading.value = true
    try {
      const response = await apiClient<{ data: Partial<PublicBrandingSettings> }>('/settings/public')
      branding.value = { ...DEFAULT_BRANDING, ...(response.data ?? {}) }
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
