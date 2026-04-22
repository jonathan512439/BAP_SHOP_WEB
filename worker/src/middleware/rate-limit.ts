import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

type RateLimitMode = 'errors-only' | 'all'
type RateLimitIdentity = 'ip' | 'admin-or-ip'

type RateLimitConfig = {
  keyPrefix: string
  maxAttempts: number
  windowSec: number
  mode?: RateLimitMode
  identity?: RateLimitIdentity
}

const DEFAULT_WINDOW_SEC = 15 * 60
const DEFAULT_MAX_ATTEMPTS = 5

export const RATE_LIMITS = {
  login: {
    keyPrefix: 'rl:login',
    maxAttempts: 5,
    windowSec: 15 * 60,
    mode: 'errors-only',
    identity: 'ip',
  },
  publicOrders: {
    keyPrefix: 'rl:orders',
    maxAttempts: 10,
    windowSec: 60 * 60,
    mode: 'all',
    identity: 'ip',
  },
  passwordChange: {
    keyPrefix: 'rl:password-change',
    maxAttempts: 5,
    windowSec: 15 * 60,
    mode: 'errors-only',
    identity: 'admin-or-ip',
  },
  adminMutation: {
    keyPrefix: 'rl:admin-mutation',
    maxAttempts: 120,
    windowSec: 15 * 60,
    mode: 'all',
    identity: 'admin-or-ip',
  },
  imageUpload: {
    keyPrefix: 'rl:img-upload',
    maxAttempts: 30,
    windowSec: 5 * 60,
    mode: 'all',
    identity: 'admin-or-ip',
  },
  brandingUpload: {
    keyPrefix: 'rl:branding-upload',
    maxAttempts: 15,
    windowSec: 5 * 60,
    mode: 'all',
    identity: 'admin-or-ip',
  },
} satisfies Record<string, RateLimitConfig>

function getClientIp(c: Parameters<MiddlewareHandler<HonoEnv>>[0]) {
  const forwardedFor = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
  return c.req.header('CF-Connecting-IP') ?? forwardedFor ?? 'unknown'
}

function getRateLimitIdentity(c: Parameters<MiddlewareHandler<HonoEnv>>[0], identity: RateLimitIdentity) {
  if (identity === 'admin-or-ip') {
    const adminId = c.get('adminId')
    if (adminId) return `admin:${adminId}`
  }

  return `ip:${getClientIp(c)}`
}

function shouldCountResponse(status: number, mode: RateLimitMode) {
  if (mode === 'all') return true
  return status === 401 || status === 403 || status === 422
}

/**
 * Rate limiting con Cloudflare KV.
 * KV es eventualmente consistente entre regiones: esto reduce abuso en la app,
 * pero no reemplaza las reglas WAF de Cloudflare.
 */
export const rateLimitMiddleware = (
  keyOrConfig: string | RateLimitConfig,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowSec = DEFAULT_WINDOW_SEC
): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const config: RateLimitConfig =
      typeof keyOrConfig === 'string'
        ? {
            keyPrefix: keyOrConfig,
            maxAttempts,
            windowSec,
            mode: 'errors-only',
            identity: 'ip',
          }
        : keyOrConfig

    const mode = config.mode ?? 'errors-only'
    const identity = config.identity ?? 'ip'
    const kvKey = `${config.keyPrefix}:${getRateLimitIdentity(c, identity)}`

    const raw = await c.env.KV.get(kvKey)
    const attempts = raw ? parseInt(raw, 10) : 0

    if (attempts >= config.maxAttempts) {
      return c.json(
        {
          success: false,
          error: 'Demasiados intentos. Espera antes de volver a intentar.',
        },
        429,
        {
          'Retry-After': String(config.windowSec),
          'X-RateLimit-Limit': String(config.maxAttempts),
          'X-RateLimit-Remaining': '0',
        }
      )
    }

    await next()

    const status = c.res.status

    if (shouldCountResponse(status, mode)) {
      const nextAttempts = attempts + 1
      await c.env.KV.put(kvKey, String(nextAttempts), { expirationTtl: config.windowSec })
      c.res.headers.set('X-RateLimit-Limit', String(config.maxAttempts))
      c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.maxAttempts - nextAttempts)))
      return
    }

    if (mode === 'errors-only' && status >= 200 && status < 300) {
      await c.env.KV.delete(kvKey)
    }
  }
}
