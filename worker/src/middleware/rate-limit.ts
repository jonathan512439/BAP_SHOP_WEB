import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

// Ventana de tiempo en segundos y máximo de intentos
const DEFAULT_WINDOW_SEC = 15 * 60   // 15 minutos
const DEFAULT_MAX_ATTEMPTS = 5        // máximo intentos

/**
 * Middleware de rate limiting usando Cloudflare KV.
 * KV es eventualmente consistente entre regiones (no es un lock global perfecto),
 * pero es una capa de protección razonable para este caso de uso.
 *
 * @param keyPrefix - Prefijo para la clave KV (ej: "rl:login")
 * @param maxAttempts - Número máximo de intentos en la ventana
 * @param windowSec - Tamaño de la ventana en segundos
 */
export const rateLimitMiddleware = (
  keyPrefix: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowSec = DEFAULT_WINDOW_SEC
): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    // Obtener IP del cliente
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
    const kvKey = `${keyPrefix}:${ip}`

    // Leer contador actual
    const raw = await c.env.KV.get(kvKey)
    const attempts = raw ? parseInt(raw, 10) : 0

    if (attempts >= maxAttempts) {
      return c.json(
        {
          success: false,
          error: 'Demasiados intentos. Espera antes de volver a intentar.',
        },
        429,
        {
          'Retry-After': String(windowSec),
          'X-RateLimit-Limit': String(maxAttempts),
          'X-RateLimit-Remaining': '0',
        }
      )
    }

    await next()

    // Si la respuesta es un error (401, 403, 422) — incrementar contador
    // Si la respuesta es éxito (2xx) — resetear el contador
    const status = c.res.status
    if (status === 401 || status === 403 || status === 422) {
      await c.env.KV.put(kvKey, String(attempts + 1), { expirationTtl: windowSec })
    } else if (status >= 200 && status < 300) {
      await c.env.KV.delete(kvKey)
    }
  }
}
