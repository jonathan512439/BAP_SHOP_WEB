import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../../types/env'
import { authMiddleware, csrfMiddleware } from '../../middleware'
import { logAction } from '../../lib/audit'

export const adminSettingsRouter = new Hono<HonoEnv>()
adminSettingsRouter.use('*', authMiddleware())

const ALLOWED_SETTINGS_KEYS = [
  'whatsapp_number',
  'store_name',
  'whatsapp_header',
  'order_expiry_minutes',
] as const

// GET /admin/settings
adminSettingsRouter.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  const settings = Object.fromEntries(rows.results.map((r) => [r.key, r.value]))
  return c.json({ success: true, data: settings })
})

// PUT /admin/settings
const settingsSchema = z.object({
  whatsapp_number: z.string().min(7).max(20).regex(/^\+?\d[\d\s\-().]+$/).optional(),
  store_name: z.string().min(1).max(100).optional(),
  whatsapp_header: z.string().max(200).optional(),
  order_expiry_minutes: z.enum(['60', '120', '240', '480']).optional(),
})

adminSettingsRouter.put('/', csrfMiddleware(), zValidator('json', settingsSchema), async (c) => {
  const updates = c.req.valid('json')
  const entries = Object.entries(updates).filter(([k]) =>
    ALLOWED_SETTINGS_KEYS.includes(k as typeof ALLOWED_SETTINGS_KEYS[number])
  )

  if (entries.length === 0) {
    return c.json({ success: false, error: 'No se recibieron valores válidos para actualizar' }, 422)
  }

  const oldRows = await c.env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  const oldValues = Object.fromEntries(oldRows.results.map((r) => [r.key, r.value]))

  // Upsert batch
  const statements = entries.map(([key, value]) =>
    c.env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(key, String(value))
  )

  await c.env.DB.batch(statements)

  const newValues = { ...oldValues, ...Object.fromEntries(entries.map(([k, v]) => [k, String(v)])) }
  await logAction(c.env.DB, c.get('adminId'), 'settings.update', 'settings', 'global', oldValues, newValues)

  return c.json({ success: true, data: newValues })
})

// ============================================================
// AUDITORÍA
// ============================================================
export const adminAuditRouter = new Hono<HonoEnv>()
adminAuditRouter.use('*', authMiddleware())

// GET /admin/audit?action=&entity_type=&date_from=&date_to=&page=&limit=
adminAuditRouter.get('/', async (c) => {
  const action = c.req.query('action')
  const entityType = c.req.query('entity_type')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
  const limit = Math.min(100, parseInt(c.req.query('limit') ?? '50', 10))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const bindings: unknown[] = []

  if (action) { conditions.push('al.action LIKE ?'); bindings.push(`%${action}%`) }
  if (entityType) { conditions.push('al.entity_type = ?'); bindings.push(entityType) }
  if (dateFrom) { conditions.push('al.created_at >= ?'); bindings.push(dateFrom) }
  if (dateTo) { conditions.push('al.created_at <= ?'); bindings.push(dateTo) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT al.*, a.username AS admin_username
       FROM audit_log al
       JOIN admins a ON a.id = al.admin_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...bindings, limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM audit_log al ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: rows.results,
    meta: { page, limit, total: total?.cnt ?? 0, totalPages: Math.ceil((total?.cnt ?? 0) / limit) },
  })
})
