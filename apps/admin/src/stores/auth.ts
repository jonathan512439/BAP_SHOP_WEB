import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '../api/client'
export const useAuthStore = defineStore('auth', () => {
  const adminId = ref<string | null>(null)
  const username = ref<string | null>(null)
  const isInitializing = ref(true)

  const isAuthenticated = computed(() => !!adminId.value)

  const checkSession = async () => {
    isInitializing.value = true
    try {
      const { data } = await apiClient<{ data: { adminId: string, username: string } }>('/auth/me')
      adminId.value = data.adminId
      username.value = data.username
    } catch {
      adminId.value = null
      username.value = null
    } finally {
      isInitializing.value = false
    }
  }

  const login = async (user: string, pass: string, turnstileToken: string) => {
    const { data } = await apiClient<{ data: { adminId: string, username: string } }>('/auth/login', {
      method: 'POST',
      body: { username: user, password: pass, turnstileToken } as any
    })
    
    adminId.value = data.adminId
    username.value = data.username
  }

  const logout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' })
    } catch {
      // El panel debe limpiar estado local aunque el backend ya no responda.
    } finally {
      adminId.value = null
      username.value = null
    }
  }

  const reset = () => {
    adminId.value = null
    username.value = null
  }

  return {
    adminId,
    username,
    isInitializing,
    isAuthenticated,
    checkSession,
    login,
    logout,
    reset
  }
})
