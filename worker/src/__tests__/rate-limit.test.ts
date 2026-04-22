import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { rateLimitMiddleware } from '../middleware'
import type { HonoEnv } from '../types/env'

describe('rateLimitMiddleware', () => {
  it('bloquea cuando el modo all supera el limite aunque las respuestas sean exitosas', async () => {
    const app = new Hono<HonoEnv>()

    app.post(
      '/limited',
      rateLimitMiddleware({
        keyPrefix: 'test:rl:all',
        maxAttempts: 2,
        windowSec: 60,
        mode: 'all',
        identity: 'ip',
      }),
      (c) => c.json({ success: true })
    )

    const request = () =>
      app.fetch(
        new Request('https://example.com/limited', {
          method: 'POST',
          headers: { 'CF-Connecting-IP': '203.0.113.10' },
        }),
        env,
        {} as ExecutionContext
      )

    expect((await request()).status).toBe(200)
    expect((await request()).status).toBe(200)
    expect((await request()).status).toBe(429)
  })

  it('en modo errors-only no penaliza respuestas exitosas', async () => {
    const app = new Hono<HonoEnv>()

    app.post(
      '/limited',
      rateLimitMiddleware({
        keyPrefix: 'test:rl:errors',
        maxAttempts: 1,
        windowSec: 60,
        mode: 'errors-only',
        identity: 'ip',
      }),
      (c) => c.json({ success: true })
    )

    const request = () =>
      app.fetch(
        new Request('https://example.com/limited', {
          method: 'POST',
          headers: { 'CF-Connecting-IP': '203.0.113.11' },
        }),
        env,
        {} as ExecutionContext
      )

    expect((await request()).status).toBe(200)
    expect((await request()).status).toBe(200)
  })
})
