import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

/**
 * Middleware de autenticación del admin.
 * Lee la cookie bap_session, verifica el token en D1,
 * e inyecta adminId, adminUsername y csrfToken en el contexto de Hono.
 */
export const authMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    // Leer cookie de sesión
    const cookieHeader = c.req.header('Cookie') ?? ''
    const sessionToken = parseCookie(cookieHeader, 'bap_session')

    if (!sessionToken) {
      return c.json({ success: false, error: 'No autorizado' }, 401)
    }

    // Hashear el token para comparar contra la base de datos
    const tokenHash = await sha256(sessionToken)

    // Buscar sesión activa (no expirada) — incluye ip_address para validación
    const now = new Date().toISOString()
    const row = await c.env.DB.prepare(
      `SELECT s.id, s.admin_id, s.csrf_token, s.ip_address, a.username
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`
    )
      .bind(tokenHash, now)
      .first<{ id: string; admin_id: string; csrf_token: string; ip_address: string | null; username: string }>()

    if (!row) {
      return c.json({ success: false, error: 'Sesión inválida o expirada' }, 401)
    }

    // Validación estricta de IP — previene session hijacking
    // Si la IP almacenada existe y no coincide con la IP actual, rechazar
    const currentIp = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? null
    if (row.ip_address && currentIp && row.ip_address !== currentIp) {
      // Eliminar la sesión comprometida
      await c.env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?')
        .bind(row.id)
        .run()
      return c.json({ success: false, error: 'Sesión inválida — IP no coincide' }, 401)
    }

    // Inyectar datos del admin en el contexto
    c.set('sessionId', row.id)
    c.set('adminId', row.admin_id)
    c.set('adminUsername', row.username)
    c.set('csrfToken', row.csrf_token)

    await next()
  }
}

/**
 * Middleware de validación de CSRF.
 * Solo aplica a métodos mutantes (POST, PUT, PATCH, DELETE).
 * Compara el header X-CSRF-Token contra el csrf_token de la sesión.
 * Debe usarse DESPUÉS del authMiddleware.
 */
export const csrfMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const method = c.req.method
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await next()
      return
    }

    const headerToken = c.req.header('X-CSRF-Token')
    const sessionCsrf = c.get('csrfToken')

    if (!headerToken || !sessionCsrf || headerToken !== sessionCsrf) {
      return c.json({ success: false, error: 'Token CSRF inválido' }, 403)
    }

    await next()
  }
}

// ============================================================
// Helpers internos
// ============================================================

/**
 * Parsea una cookie específica del header Cookie.
 */
export function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

/**
 * Genera el hash SHA-256 de un string (usado para hashear el token de sesión).
 * Trabaja con la Web Crypto API disponible en Workers.
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
