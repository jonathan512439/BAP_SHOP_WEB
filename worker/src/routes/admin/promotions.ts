import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../../types/env'
import { authMiddleware, csrfMiddleware } from '../../middleware'
import { logAction } from '../../lib/audit'
import { rebuildCatalogSnapshots } from '../../lib/catalog-builder'
import { nowISO } from '@bap-shop/shared'

export const adminPromotionsRouter = new Hono<HonoEnv>()
adminPromotionsRouter.use('*', authMiddleware())

// GET /admin/promotions
adminPromotionsRouter.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT pp.*, p.name AS product_name, p.status AS product_status, p.price AS product_price
     FROM product_promotions pp
     JOIN products p ON p.id = pp.product_id
     ORDER BY p.name ASC`
  ).all()
  return c.json({ success: true, data: rows.results })
})

// PUT /admin/promotions/:productId  (UPSERT)
const promotionSchema = z.object({
  discount_pct: z.number().int().min(1).max(99),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  enabled: z.boolean().default(true),
}).refine((d) => d.ends_at > d.starts_at, {
  message: 'La fecha de fin debe ser posterior a la de inicio',
})

adminPromotionsRouter.put('/:productId', csrfMiddleware(), zValidator('json', promotionSchema), async (c) => {
  const { productId } = c.req.param()
  const { discount_pct, starts_at, ends_at, enabled } = c.req.valid('json')
  const now = nowISO()

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first()
  if (!product) return c.json({ success: false, error: 'Producto no encontrado' }, 404)

  const existing = await c.env.DB.prepare('SELECT * FROM product_promotions WHERE product_id = ?').bind(productId).first()

  await c.env.DB.prepare(
    `INSERT INTO product_promotions (product_id, discount_pct, starts_at, ends_at, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(product_id) DO UPDATE SET
       discount_pct = excluded.discount_pct,
       starts_at    = excluded.starts_at,
       ends_at      = excluded.ends_at,
       enabled      = excluded.enabled,
       updated_at   = excluded.updated_at`
  ).bind(productId, discount_pct, starts_at, ends_at, enabled ? 1 : 0, now, now).run()

  await logAction(c.env.DB, c.get('adminId'), 'promotion.upsert', 'promotion', productId,
    existing ?? null, { discount_pct, starts_at, ends_at, enabled })

  await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)

  return c.json({ success: true, data: { productId, discount_pct, starts_at, ends_at, enabled } })
})

// PATCH /admin/promotions/:productId/disable
adminPromotionsRouter.patch('/:productId/disable', csrfMiddleware(), async (c) => {
  const { productId } = c.req.param()
  const now = nowISO()

  const promo = await c.env.DB.prepare('SELECT * FROM product_promotions WHERE product_id = ?').bind(productId).first()
  if (!promo) return c.json({ success: false, error: 'Promoción no encontrada' }, 404)

  await c.env.DB.prepare(
    'UPDATE product_promotions SET enabled = 0, updated_at = ? WHERE product_id = ?'
  ).bind(now, productId).run()

  await logAction(c.env.DB, c.get('adminId'), 'promotion.disable', 'promotion', productId, promo, { enabled: false })
  await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)

  return c.json({ success: true })
})
