import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/env'
import { RATE_LIMITS, rateLimitMiddleware, authMiddleware, csrfMiddleware, parseCookie, sha256 } from '../middleware'
import { verifyPassword, generateSessionToken, generateCsrfToken, hashPassword } from '../lib/auth'
import { logAction } from '../lib/audit'
import { verifyTurnstile } from '../lib/turnstile'
import { generateId, nowISO, addHoursISO, SESSION_DURATION_HOURS } from '@bap-shop/shared'

export const authRouter = new Hono<HonoEnv>()

function cookieOptions(isPublicEnv: boolean, maxAge: number, httpOnly: boolean) {
  return {
    path: '/' as const,
    sameSite: (isPublicEnv ? 'Lax' : 'Strict') as 'Lax' | 'Strict',
    secure: isPublicEnv,
    httpOnly,
    maxAge,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setSessionCookies(c: Context<HonoEnv, any>, token: string, csrfToken: string) {
  const isPublicEnv = c.env.ENVIRONMENT !== 'development'
  const maxAge = SESSION_DURATION_HOURS * 3600

  setCookie(c, 'bap_session', encodeURIComponent(token), cookieOptions(isPublicEnv, maxAge, true))
  setCookie(c, 'bap_csrf', csrfToken, cookieOptions(isPublicEnv, maxAge, false))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clearSessionCookies(c: Context<HonoEnv, any>) {
  const isPublicEnv = c.env.ENVIRONMENT !== 'development'
  deleteCookie(c, 'bap_session', { path: '/', secure: isPublicEnv, sameSite: isPublicEnv ? 'Lax' : 'Strict' })
  deleteCookie(c, 'bap_csrf', { path: '/', secure: isPublicEnv, sameSite: isPublicEnv ? 'Lax' : 'Strict' })
}

type AuthDebugDetails = Record<string, string | number | boolean | null>

function includeAuthDebug(c: Context<HonoEnv>) {
  return c.env.ENVIRONMENT === 'development'
}

function authError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<HonoEnv, any>,
  status: 401 | 422 | 500,
  error: string,
  debugCode: string,
  debugDetails: AuthDebugDetails = {},
) {
  const shouldIncludeDebug = includeAuthDebug(c)
  const payload: {
    success: false
    error: string
    debug?: { code: string } & AuthDebugDetails
  } = { success: false, error }

  if (shouldIncludeDebug) {
    payload.debug = { code: debugCode, ...debugDetails }
  }

  const response = c.json(payload, status)
  if (shouldIncludeDebug) {
    response.headers.set('x-auth-debug-code', debugCode)
  }
  return response
}

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  turnstileToken: z.string().min(1),
})

authRouter.post(
  '/login',
  rateLimitMiddleware(RATE_LIMITS.login),
  zValidator('json', loginSchema),
  async (c) => {
    const { username, password, turnstileToken } = c.req.valid('json')
    const normalizedUsername = username.trim()

    const turnstileSecret = c.env.TURNSTILE_SECRET_ADMIN ?? c.env.TURNSTILE_SECRET
    const turnstileOk = await verifyTurnstile(turnstileToken, turnstileSecret, {
      requestId: c.get('requestId'),
      source: 'auth.login',
      environment: c.env.ENVIRONMENT,
    })
    if (!turnstileOk) {
      return authError(c, 422, 'Verificacion de seguridad fallida', 'turnstile_failed')
    }

    const pepper = c.env.ADMIN_PEPPER?.trim()
    if (!pepper) {
      return authError(c, 500, 'Configuracion de autenticacion invalida', 'pepper_missing')
    }

    const admin = await c.env.DB.prepare(
      'SELECT id, username, password_hash FROM admins WHERE username = ? COLLATE NOCASE LIMIT 1'
    )
      .bind(normalizedUsername)
      .first<{ id: string; username: string; password_hash: string }>()

    if (!admin) {
      return authError(c, 401, 'Credenciales incorrectas', 'user_not_found', {
        attempted_username: normalizedUsername,
      })
    }

    const hashFormatOk = /^pbkdf2\$[0-9a-fA-F]+\$[0-9a-fA-F]+$/.test(admin.password_hash)
    if (!hashFormatOk) {
      return authError(c, 401, 'Credenciales incorrectas', 'hash_format_invalid', {
        username: admin.username,
        hash_prefix: admin.password_hash.slice(0, 12),
        hash_length: admin.password_hash.length,
      })
    }

    const passwordOk = await verifyPassword(password, admin.password_hash, pepper)
    if (!passwordOk) {
      return authError(c, 401, 'Credenciales incorrectas', 'password_mismatch', {
        username: admin.username,
      })
    }

    const { token, tokenHash } = await generateSessionToken()
    const csrfToken = generateCsrfToken()
    const sessionId = generateId()
    const now = nowISO()
    const expiresAt = addHoursISO(SESSION_DURATION_HOURS)
    const ip = c.req.header('CF-Connecting-IP') ?? null
    const ua = c.req.header('User-Agent') ?? null

    await c.env.DB.prepare(
      `INSERT INTO admin_sessions
        (id, admin_id, token_hash, csrf_token, ip_address, user_agent, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(sessionId, admin.id, tokenHash, csrfToken, ip, ua, now, expiresAt)
      .run()

    const MAX_SESSIONS_PER_ADMIN = 5
    await c.env.DB.prepare(
      `DELETE FROM admin_sessions WHERE admin_id = ? AND expires_at < ?`
    )
      .bind(admin.id, now)
      .run()

    await c.env.DB.prepare(
      `DELETE FROM admin_sessions
       WHERE admin_id = ? AND id NOT IN (
         SELECT id FROM admin_sessions
         WHERE admin_id = ?
         ORDER BY created_at DESC
         LIMIT ?
       )`
    )
      .bind(admin.id, admin.id, MAX_SESSIONS_PER_ADMIN)
      .run()

    setSessionCookies(c, token, csrfToken)

    return c.json({
      success: true,
      data: { adminId: admin.id, username: admin.username, csrfToken },
    })
  }
)

authRouter.post('/logout', authMiddleware(), csrfMiddleware(), async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? ''
  const token = parseCookie(cookieHeader, 'bap_session')

  if (token) {
    const tokenHash = await sha256(token)
    await c.env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run()
  }

  clearSessionCookies(c)
  return c.json({ success: true })
})

authRouter.get('/me', authMiddleware(), rateLimitMiddleware(RATE_LIMITS.authSession), async (c) => {
  return c.json({
    success: true,
    data: {
      adminId: c.get('adminId'),
      username: c.get('adminUsername'),
      csrfToken: c.get('csrfToken'),
    },
  })
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
})

authRouter.patch(
  '/password',
  authMiddleware(),
  csrfMiddleware(),
  rateLimitMiddleware(RATE_LIMITS.passwordChange),
  zValidator('json', changePasswordSchema),
  async (c) => {
    const { currentPassword, newPassword } = c.req.valid('json')

    if (currentPassword === newPassword) {
      return c.json({ success: false, error: 'La nueva contrasena debe ser diferente a la actual' }, 422)
    }

    const admin = await c.env.DB.prepare(
      'SELECT id, username, password_hash FROM admins WHERE id = ? LIMIT 1'
    )
      .bind(c.get('adminId'))
      .first<{ id: string; username: string; password_hash: string }>()

    if (!admin) {
      return c.json({ success: false, error: 'Administrador no encontrado' }, 404)
    }

    const pepper = c.env.ADMIN_PEPPER?.trim()
    if (!pepper) {
      return c.json({ success: false, error: 'Configuracion de autenticacion invalida' }, 500)
    }

    const passwordOk = await verifyPassword(currentPassword, admin.password_hash, pepper)
    if (!passwordOk) {
      return c.json({ success: false, error: 'La contrasena actual es incorrecta' }, 401)
    }

    const newHash = await hashPassword(newPassword, pepper)

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').bind(newHash, admin.id),
      c.env.DB.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND id <> ?').bind(admin.id, c.get('sessionId')),
    ])

    await logAction(
      c.env.DB,
      admin.id,
      'auth.password_change',
      'admin',
      admin.id,
      { username: admin.username },
      { invalidated_other_sessions: true }
    )

    return c.json({ success: true })
  }
)
