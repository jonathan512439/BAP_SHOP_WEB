import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../../types/env'
import { authMiddleware, csrfMiddleware } from '../../middleware'
import { logAction } from '../../lib/audit'
import { rebuildCatalogSnapshots } from '../../lib/catalog-builder'
import { nowISO } from '@bap-shop/shared'

export const adminOrdersRouter = new Hono<HonoEnv>()
adminOrdersRouter.use('*', authMiddleware())

// GET /admin/orders?status=&page=&limit=&search=
adminOrdersRouter.get('/', async (c) => {
  const status = c.req.query('status')
  const search = c.req.query('search')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
  const limit = Math.min(50, parseInt(c.req.query('limit') ?? '20', 10))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const bindings: unknown[] = []

  if (status) { conditions.push('o.status = ?'); bindings.push(status) }
  if (search) {
    conditions.push('(o.order_code LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)')
    const like = `%${search}%`
    bindings.push(like, like, like)
  }
  if (dateFrom) {
    conditions.push('o.created_at >= ?')
    bindings.push(dateFrom)
  }
  if (dateTo) {
    conditions.push('o.created_at <= ?')
    bindings.push(dateTo)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT o.id, o.order_code, o.customer_name, o.customer_phone,
              o.status, o.subtotal, o.discount, o.total,
              o.created_at, o.expires_at,
              COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...bindings, limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM orders o ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: rows.results,
    meta: { page, limit, total: total?.cnt ?? 0, totalPages: Math.ceil((total?.cnt ?? 0) / limit) },
  })
})

// GET /admin/orders/:id
adminOrdersRouter.get('/:id', async (c) => {
  const { id } = c.req.param()
  const [order, items] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first(),
    c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all(),
  ])
  if (!order) return c.json({ success: false, error: 'Pedido no encontrado' }, 404)
  return c.json({ success: true, data: { ...order, items: items.results } })
})

// PATCH /admin/orders/:id/status
const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
  notes: z.string().max(500).optional(),
})

const updateNotesSchema = z.object({
  notes: z.string().max(500).optional(),
})

adminOrdersRouter.patch('/:id/status', csrfMiddleware(), zValidator('json', updateStatusSchema), async (c) => {
  const { id } = c.req.param()
  const { status, notes } = c.req.valid('json')
  const now = nowISO()

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<{
    id: string; status: string; order_code: string
  }>()
  if (!order) return c.json({ success: false, error: 'Pedido no encontrado' }, 404)
  if (order.status !== 'pending') {
    return c.json({ success: false, error: `No se puede cambiar el estado de un pedido en estado "${order.status}"` }, 409)
  }

  // Obtener los productIds del pedido para actualizarlos
  const itemsResult = await c.env.DB.prepare(
    'SELECT product_id FROM order_items WHERE order_id = ?'
  ).bind(id).all<{ product_id: string }>()
  const productIds = itemsResult.results.map((i) => i.product_id)
  const placeholders = productIds.map(() => '?').join(', ')

  const statements: D1PreparedStatement[] = []

  // Actualizar estado del pedido
  statements.push(
    c.env.DB.prepare(
      'UPDATE orders SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?'
    ).bind(status, notes ?? null, now, id)
  )

  if (status === 'confirmed') {
    // Artículos → sold
    statements.push(
      c.env.DB.prepare(
        `UPDATE products SET status = 'sold', reserved_order_id = NULL, reserved_until = NULL, updated_at = ?
         WHERE id IN (${placeholders}) AND reserved_order_id = ?`
      ).bind(now, ...productIds, id)
    )
  } else {
    // status === 'cancelled' → artículos vuelven a active
    statements.push(
      c.env.DB.prepare(
        `UPDATE products SET status = 'active', reserved_order_id = NULL, reserved_until = NULL, updated_at = ?
         WHERE id IN (${placeholders}) AND reserved_order_id = ?`
      ).bind(now, ...productIds, id)
    )
  }

  await c.env.DB.batch(statements)
  await logAction(c.env.DB, c.get('adminId'), `order.${status}`, 'order', id, { status: order.status }, { status })

  // Rebuild catálogo (artículos liberados o vendidos)
  await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)

  return c.json({ success: true, data: { id, status } })
})

// PATCH /admin/orders/:id/notes
adminOrdersRouter.patch('/:id/notes', csrfMiddleware(), zValidator('json', updateNotesSchema), async (c) => {
  const { id } = c.req.param()
  const { notes } = c.req.valid('json')
  const now = nowISO()

  const order = await c.env.DB.prepare('SELECT id, notes FROM orders WHERE id = ?').bind(id).first<{
    id: string
    notes: string | null
  }>()

  if (!order) {
    return c.json({ success: false, error: 'Pedido no encontrado' }, 404)
  }

  const nextNotes = notes?.trim() || null

  await c.env.DB.prepare('UPDATE orders SET notes = ?, updated_at = ? WHERE id = ?')
    .bind(nextNotes, now, id)
    .run()

  await logAction(c.env.DB, c.get('adminId'), 'order.notes', 'order', id, { notes: order.notes }, { notes: nextNotes })

  return c.json({
    success: true,
    data: {
      id,
      notes: nextNotes,
    },
  })
})
