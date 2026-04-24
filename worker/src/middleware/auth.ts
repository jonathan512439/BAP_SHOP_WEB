import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'
import { logWarn } from '../lib/logger'

type SessionIpMode = 'strict' | 'subnet' | 'off'

/**
 * Middleware de autenticacion del admin.
 * Lee la cookie bap_session, verifica el token en D1,
 * e inyecta adminId, adminUsername y csrfToken en el contexto de Hono.
 */
export const authMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const cookieHeader = c.req.header('Cookie') ?? ''
    const sessionToken = parseCookie(cookieHeader, 'bap_session')

    if (!sessionToken) {
      return c.json({ success: false, error: 'No autorizado' }, 401)
    }

    const tokenHash = await sha256(sessionToken)
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
      return c.json({ success: false, error: 'Sesion invalida o expirada' }, 401)
    }

    const currentIp = getRequestIp(c)
    const ipMode = resolveSessionIpMode(c.env.ENVIRONMENT, c.env.SESSION_IP_MODE)

    if (row.ip_address && currentIp && !isSessionIpAllowed(row.ip_address, currentIp, ipMode)) {
      if (ipMode === 'strict') {
        await c.env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?')
          .bind(row.id)
          .run()

        return c.json({ success: false, error: 'Sesion invalida por cambio de red. Vuelve a iniciar sesion.' }, 401)
      }

      // En modo subnet/off permitimos continuidad y registramos la nueva IP observada.
      await c.env.DB.prepare('UPDATE admin_sessions SET ip_address = ? WHERE id = ?')
        .bind(currentIp, row.id)
        .run()

      logWarn('auth_session_ip_rotated', {
        requestId: c.get('requestId'),
        sessionId: row.id,
        adminId: row.admin_id,
        previousIp: row.ip_address,
        currentIp,
        mode: ipMode,
      })
    }

    c.set('sessionId', row.id)
    c.set('adminId', row.admin_id)
    c.set('adminUsername', row.username)
    c.set('csrfToken', row.csrf_token)

    await next()
  }
}

/**
 * Middleware de validacion de CSRF.
 * Solo aplica a metodos mutantes (POST, PUT, PATCH, DELETE).
 * Debe usarse despues del authMiddleware.
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
      return c.json({ success: false, error: 'Token CSRF invalido' }, 403)
    }

    await next()
  }
}

function getRequestIp(c: Parameters<MiddlewareHandler<HonoEnv>>[0]) {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? null
}

function resolveSessionIpMode(environment: HonoEnv['Bindings']['ENVIRONMENT'], configuredMode?: string): SessionIpMode {
  if (configuredMode === 'strict' || configuredMode === 'subnet' || configuredMode === 'off') {
    return configuredMode
  }

  if (environment === 'production' || environment === 'staging') {
    return 'subnet'
  }

  return 'off'
}

function isSessionIpAllowed(storedIp: string, currentIp: string, mode: SessionIpMode) {
  if (mode === 'off') return true
  if (storedIp === currentIp) return true
  if (mode === 'strict') return false

  const storedFamily = getIpFamily(storedIp)
  const currentFamily = getIpFamily(currentIp)
  if (!storedFamily || !currentFamily || storedFamily !== currentFamily) return false

  if (storedFamily === 'ipv4') {
    return toIpv4Subnet24(storedIp) === toIpv4Subnet24(currentIp)
  }

  return toIpv6Subnet64(storedIp) === toIpv6Subnet64(currentIp)
}

function getIpFamily(ip: string): 'ipv4' | 'ipv6' | null {
  if (ip.includes('.')) return 'ipv4'
  if (ip.includes(':')) return 'ipv6'
  return null
}

function toIpv4Subnet24(ip: string) {
  const segments = ip.split('.')
  if (segments.length !== 4) return ip
  return `${segments[0]}.${segments[1]}.${segments[2]}`
}

function toIpv6Subnet64(ip: string) {
  const raw = ip.split('%')[0]
  const segments = raw.split(':')
  return segments.slice(0, 4).join(':') || raw
}

/**
 * Parsea una cookie especifica del header Cookie.
 */
export function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

/**
 * Genera el hash SHA-256 de un string.
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
