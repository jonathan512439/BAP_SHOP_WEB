import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../../types/env'
import { RATE_LIMITS, authMiddleware, csrfMiddleware, rateLimitMiddleware, validateUuidParams } from '../../middleware'
import { logAction } from '../../lib/audit'
import { generateId, generateSlug, nowISO } from '@bap-shop/shared'

export const adminBrandsRouter = new Hono<HonoEnv>()
adminBrandsRouter.use('*', authMiddleware())
adminBrandsRouter.use('/:id/*', validateUuidParams('id'))
adminBrandsRouter.use('/:id', validateUuidParams('id'))

// GET /admin/brands
adminBrandsRouter.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT b.id, b.name, b.slug, b.is_active, b.created_at,
      (SELECT COUNT(*) FROM models WHERE brand_id = b.id) AS model_count,
      (SELECT COUNT(*) FROM products p JOIN models m ON m.id = p.model_id WHERE m.brand_id = b.id) AS product_count
     FROM brands b
     ORDER BY b.name ASC`
  ).all()
  return c.json({ success: true, data: rows.results })
})

// POST /admin/brands
const brandSchema = z.object({
  name: z.string().min(1).max(100).trim(),
})

adminBrandsRouter.post('/', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', brandSchema), async (c) => {
  const { name } = c.req.valid('json')
  const slug = generateSlug(name)

  const existing = await c.env.DB.prepare('SELECT id FROM brands WHERE slug = ?').bind(slug).first()
  if (existing) return c.json({ success: false, error: 'Ya existe una marca con ese nombre' }, 409)

  const id = generateId()
  await c.env.DB.prepare(
    'INSERT INTO brands (id, name, slug, is_active, created_at) VALUES (?, ?, ?, 1, ?)'
  ).bind(id, name, slug, nowISO()).run()

  await logAction(c.env.DB, c.get('adminId'), 'brand.create', 'brand', id, null, { name, slug })
  return c.json({ success: true, data: { id, name, slug } }, 201)
})

// PUT /admin/brands/:id
adminBrandsRouter.put('/:id', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', brandSchema), async (c) => {
  const { id } = c.req.param()
  const { name } = c.req.valid('json')
  const slug = generateSlug(name)

  const brand = await c.env.DB.prepare('SELECT * FROM brands WHERE id = ?').bind(id).first()
  if (!brand) return c.json({ success: false, error: 'Marca no encontrada' }, 404)

  const existing = await c.env.DB.prepare(
    'SELECT id FROM brands WHERE slug = ? AND id <> ?'
  ).bind(slug, id).first()
  if (existing) {
    return c.json({ success: false, error: 'Ya existe otra marca con ese nombre' }, 409)
  }

  await c.env.DB.prepare('UPDATE brands SET name = ?, slug = ? WHERE id = ?').bind(name, slug, id).run()
  await logAction(c.env.DB, c.get('adminId'), 'brand.update', 'brand', id, brand, { name, slug })

  return c.json({ success: true, data: { id, name, slug } })
})

// PATCH /admin/brands/:id/archive
adminBrandsRouter.patch('/:id/archive', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), async (c) => {
  const { id } = c.req.param()

  const brand = await c.env.DB.prepare('SELECT id FROM brands WHERE id = ?').bind(id).first()
  if (!brand) return c.json({ success: false, error: 'Marca no encontrada' }, 404)

  const activeProducts = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM products p
     JOIN models m ON m.id = p.model_id
     WHERE m.brand_id = ? AND p.status IN ('active','reserved')`
  ).bind(id).first<{ cnt: number }>()

  if (activeProducts && activeProducts.cnt > 0) {
    return c.json({
      success: false,
      error: `No puedes archivar esta marca porque tiene ${activeProducts.cnt} producto(s) activo(s) o reservado(s)`,
    }, 409)
  }

  await c.env.DB.prepare('UPDATE brands SET is_active = 0 WHERE id = ?').bind(id).run()
  await logAction(c.env.DB, c.get('adminId'), 'brand.archive', 'brand', id)

  return c.json({ success: true })
})

// PATCH /admin/brands/:id/restore
adminBrandsRouter.patch('/:id/restore', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), async (c) => {
  const { id } = c.req.param()

  const brand = await c.env.DB.prepare('SELECT id, is_active FROM brands WHERE id = ?').bind(id).first<{ id: string; is_active: number }>()
  if (!brand) return c.json({ success: false, error: 'Marca no encontrada' }, 404)

  await c.env.DB.prepare('UPDATE brands SET is_active = 1 WHERE id = ?').bind(id).run()
  await logAction(c.env.DB, c.get('adminId'), 'brand.restore', 'brand', id, brand, { is_active: 1 })

  return c.json({ success: true })
})

// ============================================================
// MODELOS
// ============================================================
export const adminModelsRouter = new Hono<HonoEnv>()
adminModelsRouter.use('*', authMiddleware())
adminModelsRouter.use('/:id/*', validateUuidParams('id'))
adminModelsRouter.use('/:id', validateUuidParams('id'))

// GET /admin/models?brand_id=
adminModelsRouter.get('/', async (c) => {
  const brandId = c.req.query('brand_id')
  let query = `SELECT m.id, m.brand_id, m.name, m.slug, m.is_active, m.created_at,
    b.name AS brand_name,
    (SELECT COUNT(*) FROM products WHERE model_id = m.id) AS product_count
   FROM models m JOIN brands b ON b.id = m.brand_id`
  const bindings: string[] = []
  if (brandId) { query += ' WHERE m.brand_id = ?'; bindings.push(brandId) }
  query += ' ORDER BY b.name ASC, m.name ASC'

  const rows = await c.env.DB.prepare(query).bind(...bindings).all()
  return c.json({ success: true, data: rows.results })
})

const modelSchema = z.object({
  brand_id: z.string().min(1).max(120).trim(),
  name: z.string().min(1).max(100).trim(),
})

// POST /admin/models
adminModelsRouter.post('/', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', modelSchema), async (c) => {
  const { brand_id, name } = c.req.valid('json')
  const slug = generateSlug(name)

  const brand = await c.env.DB.prepare('SELECT id FROM brands WHERE id = ? AND is_active = 1').bind(brand_id).first()
  if (!brand) return c.json({ success: false, error: 'Marca no encontrada o inactiva' }, 404)

  const existing = await c.env.DB.prepare('SELECT id FROM models WHERE brand_id = ? AND slug = ?').bind(brand_id, slug).first()
  if (existing) return c.json({ success: false, error: 'Ya existe un modelo con ese nombre en esta marca' }, 409)

  const id = generateId()
  await c.env.DB.prepare(
    'INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).bind(id, brand_id, name, slug, nowISO()).run()

  await logAction(c.env.DB, c.get('adminId'), 'model.create', 'model', id, null, { brand_id, name, slug })
  return c.json({ success: true, data: { id, brand_id, name, slug } }, 201)
})

// PUT /admin/models/:id
adminModelsRouter.put('/:id', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', z.object({ name: z.string().min(1).max(100).trim() })), async (c) => {
  const { id } = c.req.param()
  const { name } = c.req.valid('json')
  const slug = generateSlug(name)

  const model = await c.env.DB.prepare('SELECT * FROM models WHERE id = ?').bind(id).first<{ brand_id: string }>()
  if (!model) return c.json({ success: false, error: 'Modelo no encontrado' }, 404)

  const existing = await c.env.DB.prepare(
    'SELECT id FROM models WHERE brand_id = ? AND slug = ? AND id <> ?'
  ).bind(model.brand_id, slug, id).first()
  if (existing) {
    return c.json({ success: false, error: 'Ya existe otro modelo con ese nombre en esta marca' }, 409)
  }

  await c.env.DB.prepare('UPDATE models SET name = ?, slug = ? WHERE id = ?').bind(name, slug, id).run()
  await logAction(c.env.DB, c.get('adminId'), 'model.update', 'model', id, model, { name, slug })

  return c.json({ success: true, data: { id, name, slug } })
})

// PATCH /admin/models/:id/archive
adminModelsRouter.patch('/:id/archive', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), async (c) => {
  const { id } = c.req.param()

  const model = await c.env.DB.prepare('SELECT id FROM models WHERE id = ?').bind(id).first()
  if (!model) return c.json({ success: false, error: 'Modelo no encontrado' }, 404)

  const activeProducts = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM products WHERE model_id = ? AND status IN ('active','reserved')`
  ).bind(id).first<{ cnt: number }>()

  if (activeProducts && activeProducts.cnt > 0) {
    return c.json({
      success: false,
      error: `No puedes archivar este modelo porque tiene ${activeProducts.cnt} producto(s) activo(s) o reservado(s)`,
    }, 409)
  }

  await c.env.DB.prepare('UPDATE models SET is_active = 0 WHERE id = ?').bind(id).run()
  await logAction(c.env.DB, c.get('adminId'), 'model.archive', 'model', id)

  return c.json({ success: true })
})

// PATCH /admin/models/:id/restore
adminModelsRouter.patch('/:id/restore', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), async (c) => {
  const { id } = c.req.param()

  const model = await c.env.DB.prepare(
    `SELECT m.id, m.brand_id, m.is_active, b.is_active AS brand_is_active
     FROM models m
     JOIN brands b ON b.id = m.brand_id
     WHERE m.id = ?`
  ).bind(id).first<{ id: string; brand_id: string; is_active: number; brand_is_active: number }>()
  if (!model) return c.json({ success: false, error: 'Modelo no encontrado' }, 404)

  if (!model.brand_is_active) {
    return c.json({
      success: false,
      error: 'No puedes restaurar este modelo mientras su marca este archivada. Restaura la marca primero.',
    }, 409)
  }

  await c.env.DB.prepare('UPDATE models SET is_active = 1 WHERE id = ?').bind(id).run()
  await logAction(c.env.DB, c.get('adminId'), 'model.restore', 'model', id, model, { is_active: 1 })

  return c.json({ success: true })
})
