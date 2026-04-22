import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient, setCsrfToken } from '../src/api/client'

describe('apiClient', () => {
  beforeEach(() => {
    const sessionStorage = new Map<string, string>()

    Object.defineProperty(globalThis, 'document', {
      value: {
        cookie: 'bap_csrf=test-csrf-token',
      },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(globalThis, 'window', {
      value: {
        dispatchEvent: vi.fn(),
        sessionStorage: {
          getItem: vi.fn((key: string) => sessionStorage.get(key) ?? null),
          setItem: vi.fn((key: string, value: string) => {
            sessionStorage.set(key, value)
          }),
          removeItem: vi.fn((key: string) => {
            sessionStorage.delete(key)
          }),
        },
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serializa params y body JSON, incluyendo CSRF en mutaciones', async () => {
    setCsrfToken('stored-csrf-token')

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await apiClient<{ success: boolean; data: { ok: boolean } }>('/admin/settings', {
      method: 'PUT',
      params: {
        page: 2,
        empty: '',
      },
      body: {
        store_name: 'BAP Shop',
      },
    })

    expect(result.data.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8787/admin/settings?page=2',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
      })
    )

    const config = fetchMock.mock.calls[0]?.[1]
    const headers = config?.headers as Headers
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-CSRF-Token')).toBe('stored-csrf-token')
    expect(config?.body).toBe(JSON.stringify({ store_name: 'BAP Shop' }))
  })

  it('lanza ApiError y emite evento de unauthorized en 401', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(apiClient('/auth/me')).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      status: 401,
      message: 'No autorizado',
    })

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    expect(dispatchSpy.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent)
    expect((dispatchSpy.mock.calls[0]?.[0] as CustomEvent).type).toBe('auth:unauthorized')
  })
})
