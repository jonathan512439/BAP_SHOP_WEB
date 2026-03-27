import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

/**
 * Middleware de headers de seguridad HTTP.
 * Se aplica a todas las respuestas del Worker.
 */
export const securityHeaders = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    await next()

    const isProd = c.env.ENVIRONMENT === 'production'
    const storeDomain = c.env.STORE_DOMAIN
    const adminDomain = c.env.ADMIN_DOMAIN
    const r2Domain = c.env.R2_PUBLIC_DOMAIN

    // Content Security Policy
    const csp = [
      `default-src 'self'`,
      `script-src 'self'`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' https://${r2Domain} data:`,
      `connect-src 'self' https://${storeDomain} https://${adminDomain}`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; ')

    c.res.headers.set('Content-Security-Policy', csp)
    c.res.headers.set('X-Frame-Options', 'DENY')
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.res.headers.set('X-XSS-Protection', '0') // Deprecated, pero por si acaso

    if (isProd) {
      c.res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }

    // Eliminar headers que revelan información innecesaria
    c.res.headers.delete('Server')
    c.res.headers.delete('X-Powered-By')
  }
}
