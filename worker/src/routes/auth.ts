import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../types/env'
import { rateLimitMiddleware, authMiddleware, csrfMiddleware, parseCookie, sha256 } from '../middleware'
import { verifyPassword, generateSessionToken, generateCsrfToken } from '../lib/auth'
import { generateId, nowISO, addHoursISO, SESSION_DURATION_HOURS } from '@bap-shop/shared'

export const authRouter = new Hono<HonoEnv>()

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
  rateLimitMiddleware('rl:login', 5, 15 * 60),
  zValidator('json', loginSchema),
  async (c) => {
    const { username, password, turnstileToken } = c.req.valid('json')

    // 1. Verificar Turnstile
    const turnstileOk = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET)
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

    // 5. Limpiar sesiones expiradas del mismo admin (housekeeping)
    await c.env.DB.prepare(
      `DELETE FROM admin_sessions WHERE admin_id = ? AND expires_at < ?`
    )
      .bind(admin.id, now)
      .run()

    // 6. Setear cookies
    const isProd = c.env.ENVIRONMENT === 'production'
    const adminDomain = c.env.ADMIN_DOMAIN
    const maxAgeSec = SESSION_DURATION_HOURS * 3600

    const headers = new Headers({ 'Content-Type': 'application/json' })
    headers.append(
      'Set-Cookie',
      buildCookie('bap_session', encodeURIComponent(token), {
        maxAge: maxAgeSec,
        domain: isProd ? adminDomain : undefined,
        httpOnly: true,
        secure: isProd,
      })
    )
    headers.append(
      'Set-Cookie',
      buildCookie('bap_csrf', csrfToken, {
        maxAge: maxAgeSec,
        domain: isProd ? adminDomain : undefined,
        httpOnly: false,
        secure: isProd,
      })
    )

    return new Response(JSON.stringify({ success: true, data: { adminId: admin.id, username: admin.username } }), {
      status: 200,
      headers,
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

  const isProd = c.env.ENVIRONMENT === 'production'
  const adminDomain = c.env.ADMIN_DOMAIN
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append(
    'Set-Cookie',
    buildCookie('bap_session', '', {
      maxAge: 0,
      domain: isProd ? adminDomain : undefined,
      httpOnly: true,
      secure: isProd,
    })
  )
  headers.append(
    'Set-Cookie',
    buildCookie('bap_csrf', '', {
      maxAge: 0,
      domain: isProd ? adminDomain : undefined,
      httpOnly: false,
      secure: isProd,
    })
  )

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  })
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
    },
  })
})

// ============================================================
// Helper: verificar token de Turnstile
// ============================================================
async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('secret', secret)
    formData.append('response', token)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json<{ success: boolean }>()
    return data.success === true
  } catch {
    return false
  }
}

function buildCookie(
  name: string,
  value: string,
  options: {
    maxAge: number
    domain?: string
    httpOnly: boolean
    secure: boolean
  }
): string {
  const parts = [`${name}=${value}`, 'Path=/', 'SameSite=Strict', `Max-Age=${options.maxAge}`]

  if (options.httpOnly) {
    parts.push('HttpOnly')
  }
  if (options.secure) {
    parts.push('Secure')
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }

  return parts.join('; ')
}
