import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import worker from '../index'

describe('request context', () => {
  it('propaga X-Request-Id en respuestas exitosas', async () => {
    const response = await worker.fetch(
      new Request('https://api.bab-shop.test/health', {
        headers: {
          'X-Request-Id': 'test-request-123',
        },
      }),
      env,
      {} as ExecutionContext
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Request-Id')).toBe('test-request-123')
  })

  it('incluye requestId en respuestas 404', async () => {
    const response = await worker.fetch(
      new Request('https://api.bab-shop.test/no-existe', {
        headers: {
          'X-Request-Id': 'missing-route-123',
        },
      }),
      env,
      {} as ExecutionContext
    )

    const payload = await response.json() as {
      success: boolean
      meta?: { requestId?: string }
    }

    expect(response.status).toBe(404)
    expect(response.headers.get('X-Request-Id')).toBe('missing-route-123')
    expect(payload.success).toBe(false)
    expect(payload.meta?.requestId).toBe('missing-route-123')
  })
})
