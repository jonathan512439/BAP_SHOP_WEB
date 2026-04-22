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

// ============================================================
// Helpers de cookies
// ============================================================

/** Opciones comunes de cookie según el entorno */
function cookieOptions(isProd: boolean, maxAge: number, httpOnly: boolean) {
  return {
    path: '/' as const,
    sameSite: (isProd ? 'Lax' : 'Strict') as 'Lax' | 'Strict',
    secure: isProd,
    httpOnly,
    maxAge,
  }
}

/** Setea las cookies de sesión y CSRF */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setSessionCookies(c: Context<HonoEnv, any>, token: string, csrfToken: string) {
  const isProd = c.env.ENVIRONMENT === 'production'
  const maxAge = SESSION_DURATION_HOURS * 3600

  setCookie(c, 'bap_session', encodeURIComponent(token), cookieOptions(isProd, maxAge, true))
  setCookie(c, 'bap_csrf', csrfToken, cookieOptions(isProd, maxAge, false))
}

/** Limpia las cookies de sesión y CSRF */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clearSessionCookies(c: Context<HonoEnv, any>) {
  const isProd = c.env.ENVIRONMENT === 'production'

  deleteCookie(c, 'bap_session', { path: '/', secure: isProd, sameSite: isProd ? 'Lax' : 'Strict' })
  deleteCookie(c, 'bap_csrf', { path: '/', secure: isProd, sameSite: isProd ? 'Lax' : 'Strict' })
}

// ============================================================
// POST /auth/login
// ============================================================
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

    // 1. Verificar Turnstile
    const turnstileSecret = c.env.TURNSTILE_SECRET_ADMIN ?? c.env.TURNSTILE_SECRET
    const turnstileOk = await verifyTurnstile(turnstileToken, turnstileSecret)
    if (!turnstileOk) {
      return c.json({ success: false, error: 'Verificación de seguridad fallida' }, 422)
    }

    // 2. Buscar admin por username
    const admin = await c.env.DB.prepare(
      'SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1'
    )
      .bind(username)
      .first<{ id: string; username: string; password_hash: string }>()

    if (!admin) {
      return c.json({ success: false, error: 'Credenciales incorrectas' }, 401)
    }

    // 3. Verificar contraseña
    const passwordOk = await verifyPassword(password, admin.password_hash, c.env.ADMIN_PEPPER)
    if (!passwordOk) {
      return c.json({ success: false, error: 'Credenciales incorrectas' }, 401)
    }

    // 4. Crear sesión
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

    // 5. Housekeeping: limpiar sesiones expiradas + limitar sesiones activas
    const MAX_SESSIONS_PER_ADMIN = 5
    await c.env.DB.prepare(
      `DELETE FROM admin_sessions WHERE admin_id = ? AND expires_at < ?`
    )
      .bind(admin.id, now)
      .run()

    // Eliminar sesiones más antiguas si se excede el límite
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

    // 6. Setear cookies usando Hono setCookie
    setSessionCookies(c, token, csrfToken)

    return c.json({
      success: true,
      data: { adminId: admin.id, username: admin.username, csrfToken },
    })
  }
)

// ============================================================
// POST /auth/logout
// ============================================================
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

// ============================================================
// GET /auth/me
// ============================================================
authRouter.get('/me', authMiddleware(), async (c) => {
  return c.json({
    success: true,
    data: {
      adminId: c.get('adminId'),
      username: c.get('adminUsername'),
      csrfToken: c.get('csrfToken'),
    },
  })
})

// ============================================================
// PATCH /auth/password
// ============================================================
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
      return c.json({ success: false, error: 'La nueva contraseña debe ser diferente a la actual' }, 422)
    }

    const admin = await c.env.DB.prepare(
      'SELECT id, username, password_hash FROM admins WHERE id = ? LIMIT 1'
    )
      .bind(c.get('adminId'))
      .first<{ id: string; username: string; password_hash: string }>()

    if (!admin) {
      return c.json({ success: false, error: 'Administrador no encontrado' }, 404)
    }

    const passwordOk = await verifyPassword(currentPassword, admin.password_hash, c.env.ADMIN_PEPPER)
    if (!passwordOk) {
      return c.json({ success: false, error: 'La contraseña actual es incorrecta' }, 401)
    }

    const newHash = await hashPassword(newPassword, c.env.ADMIN_PEPPER)

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
