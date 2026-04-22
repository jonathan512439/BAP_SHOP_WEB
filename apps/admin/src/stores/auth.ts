import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient, clearCsrfToken, setCsrfToken } from '../api/client'
export const useAuthStore = defineStore('auth', () => {
  const adminId = ref<string | null>(null)
  const username = ref<string | null>(null)
  const isInitializing = ref(true)

  const isAuthenticated = computed(() => !!adminId.value)

  const checkSession = async () => {
    isInitializing.value = true
    try {
      const { data } = await apiClient<{ data: { adminId: string, username: string, csrfToken: string } }>('/auth/me')
      adminId.value = data.adminId
      username.value = data.username
      setCsrfToken(data.csrfToken)
    } catch {
      adminId.value = null
      username.value = null
      clearCsrfToken()
    } finally {
      isInitializing.value = false
    }
  }

  const login = async (user: string, pass: string, turnstileToken: string) => {
    const { data } = await apiClient<{ data: { adminId: string, username: string, csrfToken: string } }>('/auth/login', {
      method: 'POST',
      body: { username: user, password: pass, turnstileToken },
    })
    
    adminId.value = data.adminId
    username.value = data.username
    setCsrfToken(data.csrfToken)
  }

  const logout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' })
    } catch {
      // El panel debe limpiar estado local aunque el backend ya no responda.
    } finally {
      adminId.value = null
      username.value = null
      clearCsrfToken()
    }
  }

  const reset = () => {
    adminId.value = null
    username.value = null
    clearCsrfToken()
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
