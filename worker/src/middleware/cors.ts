import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

const ALLOWED_ORIGINS_DEV = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8788']

const normalizeHost = (raw: string): string => {
  let value = raw.trim().toLowerCase()
  value = value.replace(/^https?:\/\//, '')
  value = value.replace(/\/.*$/, '')
  return value
}

const buildExactOrigins = (host: string): string[] => {
  const origins = new Set<string>()
  const normalized = normalizeHost(host)
  if (!normalized) return []

  if (normalized.startsWith('localhost:') || normalized === 'localhost') {
    origins.add(`http://${normalized}`)
    origins.add(`https://${normalized}`)
    return Array.from(origins)
  }

  origins.add(`https://${normalized}`)
  if (!normalized.startsWith('www.')) {
    origins.add(`https://www.${normalized}`)
  }

  return Array.from(origins)
}

/**
 * Middleware CORS estricto.
 * En produccion permite solo los dominios exactos configurados en env.
 * En desarrollo permite localhost.
 */
export const corsMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const origin = c.req.header('Origin')?.trim() ?? ''
    const isDevelopment = c.env.ENVIRONMENT === 'development'

    const publicHosts = [c.env.STORE_DOMAIN, c.env.ADMIN_DOMAIN]
    const publicOrigins = Array.from(new Set(publicHosts.flatMap((host) => buildExactOrigins(host))))

    const allowedOrigins = isDevelopment
      ? [...ALLOWED_ORIGINS_DEV, ...publicOrigins]
      : publicOrigins

    const isAllowed = allowedOrigins.includes(origin)

    // Preflight
    if (c.req.method === 'OPTIONS') {
      if (!isAllowed) {
        return new Response('Forbidden', {
          status: 403,
          headers: {
            Vary: 'Origin',
          },
        })
      }

      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token,Idempotency-Key',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      })
    }

    await next()

    if (isAllowed) {
      c.res.headers.set('Access-Control-Allow-Origin', origin)
      c.res.headers.set('Access-Control-Allow-Credentials', 'true')
      c.res.headers.set('Vary', 'Origin')
    }
  }
}
