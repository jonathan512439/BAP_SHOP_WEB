const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'
const CSRF_STORAGE_KEY = 'bap_admin_csrf'
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)

function getCsrfToken(): string | null {
  const stored = readStoredCsrfToken()
  if (stored) {
    return stored
  }

  const match = document.cookie.match(new RegExp('(^| )bap_csrf=([^;]+)'))
  return match ? match[2] : null
}

function readStoredCsrfToken(): string | null {
  try {
    return window.sessionStorage.getItem(CSRF_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setCsrfToken(token: string | null) {
  try {
    if (token) {
      window.sessionStorage.setItem(CSRF_STORAGE_KEY, token)
    } else {
      window.sessionStorage.removeItem(CSRF_STORAGE_KEY)
    }
  } catch {
    // Ignorar errores de almacenamiento; el fallback por cookie cubre same-origin.
  }
}

export function clearCsrfToken() {
  setCsrfToken(null)
}

type JsonBody = Record<string, unknown> | unknown[]

interface FetchOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | undefined>
  body?: BodyInit | JsonBody | null
  timeoutMs?: number
}

export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function isJsonBody(value: unknown): value is JsonBody {
  return (
    !!value &&
    typeof value === 'object' &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof Blob) &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value)
  )
}

export async function apiClient<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, body, timeoutMs, ...customConfig } = options

  const headers = new Headers(customConfig.headers)
  headers.set('Accept', 'application/json')

  const method = customConfig.method?.toUpperCase() || 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }
  }

  let url = `${API_BASE_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value))
      }
    }

    const queryString = searchParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
    credentials: 'include',
  }

  const timeout = Number.isFinite(timeoutMs) ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS
  const timeoutController = new AbortController()
  const upstreamSignal = customConfig.signal
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      timeoutController.abort(upstreamSignal.reason)
    } else {
      upstreamSignal.addEventListener('abort', () => timeoutController.abort(upstreamSignal.reason), { once: true })
    }
  }

  if (timeout > 0) {
    timeoutId = setTimeout(() => timeoutController.abort(new Error('request_timeout')), timeout)
  }

  config.signal = timeoutController.signal

  if (isJsonBody(body)) {
    headers.set('Content-Type', 'application/json')
    config.body = JSON.stringify(body)
  } else if (body !== undefined) {
    config.body = body
  }

  let response: Response
  try {
    response = await fetch(url, config)
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('El servidor tardo demasiado en responder. Intenta nuevamente.', 0, { cause: 'timeout' })
    }

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiError('Sin conexion a internet. Revisa tu red y vuelve a intentar.', 0, { cause: 'offline' })
    }

    throw new ApiError('No se pudo conectar con el servidor. Intenta nuevamente en unos segundos.', 0, {
      cause: error instanceof Error ? error.message : 'network_error',
    })
  }
  if (timeoutId) {
    clearTimeout(timeoutId)
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError((data as { error?: string }).error || 'Error en la peticion', response.status, data)
  }

  return data as T
}
