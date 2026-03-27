import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '../src/api/client'
import { useAuthStore } from '../src/stores/auth'

const apiClientMock = vi.fn()

vi.mock('../src/api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number
    data?: unknown

    constructor(message: string, status: number, data?: unknown) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.data = data
    }
  },
  apiClient: (...args: unknown[]) => apiClientMock(...args),
}))

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiClientMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('checkSession hidrata admin autenticado', async () => {
    apiClientMock.mockResolvedValue({
      data: {
        adminId: 'admin-1',
        username: 'admin',
      },
    })

    const auth = useAuthStore()
    await auth.checkSession()

    expect(auth.adminId).toBe('admin-1')
    expect(auth.username).toBe('admin')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isInitializing).toBe(false)
  })

  it('checkSession limpia estado si la sesion no existe', async () => {
    apiClientMock.mockRejectedValue(new ApiError('No autorizado', 401))

    const auth = useAuthStore()
    auth.adminId = 'admin-1'
    auth.username = 'admin'

    await auth.checkSession()

    expect(auth.adminId).toBeNull()
    expect(auth.username).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.isInitializing).toBe(false)
  })

  it('login guarda admin autenticado', async () => {
    apiClientMock.mockResolvedValue({
      data: {
        adminId: 'admin-1',
        username: 'admin',
      },
    })

    const auth = useAuthStore()
    await auth.login('admin', 'secret', 'turnstile-token')

    expect(apiClientMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'secret',
        turnstileToken: 'turnstile-token',
      },
    })
    expect(auth.adminId).toBe('admin-1')
    expect(auth.username).toBe('admin')
  })

  it('logout limpia estado aunque la API falle', async () => {
    apiClientMock.mockRejectedValue(new ApiError('network', 500))

    const auth = useAuthStore()
    auth.adminId = 'admin-1'
    auth.username = 'admin'

    await auth.logout()

    expect(auth.adminId).toBeNull()
    expect(auth.username).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })
})
