import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

const ALLOWED_ORIGINS_DEV = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8788']

/**
 * Middleware CORS estricto.
 * En producción solo permite los dominios configurados en env.
 * En desarrollo permite localhost.
 */
export const corsMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const origin = c.req.header('Origin') ?? ''
    const isDevelopment = c.env.ENVIRONMENT === 'development'
    const publicOrigins = [`https://${c.env.STORE_DOMAIN}`, `https://${c.env.ADMIN_DOMAIN}`]

    if (!c.env.STORE_DOMAIN.startsWith('www.')) {
      publicOrigins.push(`https://www.${c.env.STORE_DOMAIN}`)
    }

    const allowedOrigins = isDevelopment
      ? [...ALLOWED_ORIGINS_DEV, ...publicOrigins]
      : publicOrigins

    const isAllowed = allowedOrigins.includes(origin)

    // Preflight
    if (c.req.method === 'OPTIONS') {
      if (!isAllowed) return c.text('Forbidden', 403)
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
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
