import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../../types/env'
import { RATE_LIMITS, authMiddleware, csrfMiddleware, rateLimitMiddleware } from '../../middleware'
import { logAction } from '../../lib/audit'
import { loadAllSettings, upsertSetting } from '../../lib/settings'
import {
  DEFAULT_ADMIN_BANNER_TEXT,
  DEFAULT_ADMIN_BANNER_TITLE,
  DEFAULT_ORDER_EXPIRY_MINUTES,
  DEFAULT_STORE_BANNER_TEXT,
  DEFAULT_STORE_BANNER_TITLE,
  DEFAULT_STORE_NAME,
  SETTINGS_KEYS,
} from '@bap-shop/shared'

export const adminSettingsRouter = new Hono<HonoEnv>()
adminSettingsRouter.use('*', authMiddleware())

const ALLOWED_SETTINGS_KEYS = [
  SETTINGS_KEYS.WHATSAPP_NUMBER,
  SETTINGS_KEYS.STORE_NAME,
  SETTINGS_KEYS.WHATSAPP_HEADER,
  SETTINGS_KEYS.WHATSAPP_TEMPLATE,
  SETTINGS_KEYS.ORDER_EXPIRY_MINUTES,
  SETTINGS_KEYS.BRAND_LOGO_URL,
  SETTINGS_KEYS.SOCIAL_FACEBOOK_URL,
  SETTINGS_KEYS.SOCIAL_TIKTOK_URL,
  SETTINGS_KEYS.SOCIAL_INSTAGRAM_URL,
  SETTINGS_KEYS.STORE_BANNER_TITLE,
  SETTINGS_KEYS.STORE_BANNER_TEXT,
  SETTINGS_KEYS.STORE_BANNER_IMAGE_URL,
  SETTINGS_KEYS.STORE_BANNER_VIDEO_URL,
  SETTINGS_KEYS.STORE_BANNER_MEDIA_TYPE,
  SETTINGS_KEYS.ADMIN_BANNER_TITLE,
  SETTINGS_KEYS.ADMIN_BANNER_TEXT,
  SETTINGS_KEYS.ADMIN_BANNER_IMAGE_URL,
] as const

const BRANDING_UPLOADS = {
  logo: {
    settingKey: SETTINGS_KEYS.BRAND_LOGO_URL,
    folder: 'logo',
    maxBytes: 2 * 1024 * 1024,
    allowedMimes: ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'] as const,
  },
  'store-banner': {
    settingKey: SETTINGS_KEYS.STORE_BANNER_IMAGE_URL,
    folder: 'store-banner',
    maxBytes: 5 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/webp', 'image/jpeg'] as const,
  },
  'store-banner-video': {
    settingKey: SETTINGS_KEYS.STORE_BANNER_VIDEO_URL,
    folder: 'store-banner-video',
    maxBytes: 8 * 1024 * 1024,
    allowedMimes: ['video/mp4'] as const,
  },
  'admin-banner': {
    settingKey: SETTINGS_KEYS.ADMIN_BANNER_IMAGE_URL,
    folder: 'admin-banner',
    maxBytes: 5 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/webp', 'image/jpeg'] as const,
  },
} as const

const MIME_EXTENSIONS: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'video/mp4': 'mp4',
}

export const DEFAULT_PUBLIC_BRANDING_SETTINGS = {
  store_name: DEFAULT_STORE_NAME,
  brand_logo_url: '',
  social_facebook_url: '',
  social_tiktok_url: '',
  social_instagram_url: '',
  store_banner_title: DEFAULT_STORE_BANNER_TITLE,
  store_banner_text: DEFAULT_STORE_BANNER_TEXT,
  store_banner_image_url: '',
  store_banner_video_url: '',
  store_banner_media_type: 'image',
  admin_banner_title: DEFAULT_ADMIN_BANNER_TITLE,
  admin_banner_text: DEFAULT_ADMIN_BANNER_TEXT,
  admin_banner_image_url: '',
}

function getPublicAssetOrigin(publicDomain: string) {
  const domain = publicDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return `https://${domain}`
}

export function normalizeManagedBrandingUrl(url: string, publicDomain: string) {
  const value = url.trim()
  if (!value) return ''

  if (value.startsWith('public/branding/')) {
    return `${getPublicAssetOrigin(publicDomain)}/${value}`
  }

  if (value.startsWith('/public/branding/')) {
    return `${getPublicAssetOrigin(publicDomain)}${value}`
  }

  try {
    const parsedUrl = new URL(value)
    if (!parsedUrl.pathname.startsWith('/public/branding/')) {
      return value
    }

    return `${getPublicAssetOrigin(publicDomain)}${parsedUrl.pathname}${parsedUrl.search}`
  } catch {
    return value
  }
}

export function normalizeBrandingSettings(settings: Record<string, string>, publicDomain: string): Record<string, string> {
  return {
    ...settings,
    [SETTINGS_KEYS.BRAND_LOGO_URL]: normalizeManagedBrandingUrl(settings[SETTINGS_KEYS.BRAND_LOGO_URL] || '', publicDomain),
    [SETTINGS_KEYS.STORE_BANNER_IMAGE_URL]: normalizeManagedBrandingUrl(
      settings[SETTINGS_KEYS.STORE_BANNER_IMAGE_URL] || '',
      publicDomain
    ),
    [SETTINGS_KEYS.STORE_BANNER_VIDEO_URL]: normalizeManagedBrandingUrl(
      settings[SETTINGS_KEYS.STORE_BANNER_VIDEO_URL] || '',
      publicDomain
    ),
    [SETTINGS_KEYS.ADMIN_BANNER_IMAGE_URL]: normalizeManagedBrandingUrl(
      settings[SETTINGS_KEYS.ADMIN_BANNER_IMAGE_URL] || '',
      publicDomain
    ),
  }
}

export function getPublicBrandingSettings(settings: Record<string, string>, publicDomain: string) {
  const normalizedSettings = normalizeBrandingSettings(settings, publicDomain)

  return {
    store_name: normalizedSettings[SETTINGS_KEYS.STORE_NAME] || DEFAULT_PUBLIC_BRANDING_SETTINGS.store_name,
    brand_logo_url: normalizedSettings[SETTINGS_KEYS.BRAND_LOGO_URL] || DEFAULT_PUBLIC_BRANDING_SETTINGS.brand_logo_url,
    social_facebook_url:
      normalizedSettings[SETTINGS_KEYS.SOCIAL_FACEBOOK_URL] || DEFAULT_PUBLIC_BRANDING_SETTINGS.social_facebook_url,
    social_tiktok_url:
      normalizedSettings[SETTINGS_KEYS.SOCIAL_TIKTOK_URL] || DEFAULT_PUBLIC_BRANDING_SETTINGS.social_tiktok_url,
    social_instagram_url:
      normalizedSettings[SETTINGS_KEYS.SOCIAL_INSTAGRAM_URL] || DEFAULT_PUBLIC_BRANDING_SETTINGS.social_instagram_url,
    store_banner_title:
      normalizedSettings[SETTINGS_KEYS.STORE_BANNER_TITLE] || DEFAULT_PUBLIC_BRANDING_SETTINGS.store_banner_title,
    store_banner_text:
      normalizedSettings[SETTINGS_KEYS.STORE_BANNER_TEXT] || DEFAULT_PUBLIC_BRANDING_SETTINGS.store_banner_text,
    store_banner_image_url:
      normalizedSettings[SETTINGS_KEYS.STORE_BANNER_IMAGE_URL] || DEFAULT_PUBLIC_BRANDING_SETTINGS.store_banner_image_url,
    store_banner_video_url:
      normalizedSettings[SETTINGS_KEYS.STORE_BANNER_VIDEO_URL] || DEFAULT_PUBLIC_BRANDING_SETTINGS.store_banner_video_url,
    store_banner_media_type:
      normalizedSettings[SETTINGS_KEYS.STORE_BANNER_MEDIA_TYPE] === 'video' ? 'video' : DEFAULT_PUBLIC_BRANDING_SETTINGS.store_banner_media_type,
    admin_banner_title:
      normalizedSettings[SETTINGS_KEYS.ADMIN_BANNER_TITLE] || DEFAULT_PUBLIC_BRANDING_SETTINGS.admin_banner_title,
    admin_banner_text:
      normalizedSettings[SETTINGS_KEYS.ADMIN_BANNER_TEXT] || DEFAULT_PUBLIC_BRANDING_SETTINGS.admin_banner_text,
    admin_banner_image_url:
      normalizedSettings[SETTINGS_KEYS.ADMIN_BANNER_IMAGE_URL] || DEFAULT_PUBLIC_BRANDING_SETTINGS.admin_banner_image_url,
  }
}



function extractManagedBrandingKey(url: string): string | null {
  const value = url.trim()

  if (value.startsWith('public/branding/')) return value
  if (value.startsWith('/public/branding/')) return value.slice(1)

  try {
    const parsedUrl = new URL(value)
    if (!parsedUrl.pathname.startsWith('/public/branding/')) return null
    return parsedUrl.pathname.slice(1)
  } catch {
    return null
  }
}

const settingsSchema = z.object({
  whatsapp_number: z.string().min(7).max(20).regex(/^\+?\d[\d\s\-().]+$/).optional(),
  store_name: z.string().min(1).max(100).optional(),
  whatsapp_header: z.string().max(200).optional(),
  whatsapp_template: z.string().max(4000).optional(),
  order_expiry_minutes: z.enum(['10', '20', '30', '60', '120', '240', '1440']).optional(),
  brand_logo_url: z.string().max(500).optional(),
  social_facebook_url: z.string().max(500).optional(),
  social_tiktok_url: z.string().max(500).optional(),
  social_instagram_url: z.string().max(500).optional(),
  store_banner_title: z.string().min(1).max(120).optional(),
  store_banner_text: z.string().max(240).optional(),
  store_banner_image_url: z.string().max(500).optional(),
  store_banner_video_url: z.string().max(500).optional(),
  store_banner_media_type: z.enum(['image', 'video']).optional(),
  admin_banner_title: z.string().min(1).max(120).optional(),
  admin_banner_text: z.string().max(240).optional(),
  admin_banner_image_url: z.string().max(500).optional(),
})

adminSettingsRouter.get('/', async (c) => {
  const settings = await loadAllSettings(c.env.DB)
  return c.json({ success: true, data: normalizeBrandingSettings(settings, c.env.R2_PUBLIC_DOMAIN) })
})

adminSettingsRouter.put('/', rateLimitMiddleware(RATE_LIMITS.adminMutation), csrfMiddleware(), zValidator('json', settingsSchema), async (c) => {
  const updates = c.req.valid('json')
  const entries = Object.entries(updates).filter(([key]) =>
    ALLOWED_SETTINGS_KEYS.includes(key as (typeof ALLOWED_SETTINGS_KEYS)[number])
  )

  if (entries.length === 0) {
    return c.json({ success: false, error: 'No se recibieron valores validos para actualizar' }, 422)
  }

  const oldValues = await loadAllSettings(c.env.DB)

  const statements = entries.map(([key, value]) =>
    c.env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(key, String(value))
  )

  await c.env.DB.batch(statements)

  const newValues = { ...oldValues, ...Object.fromEntries(entries.map(([key, value]) => [key, String(value)])) }
  await logAction(c.env.DB, c.get('adminId'), 'settings.update', 'settings', 'global', oldValues, newValues)

  return c.json({ success: true, data: normalizeBrandingSettings(newValues, c.env.R2_PUBLIC_DOMAIN) })
})

adminSettingsRouter.post('/assets/:assetType', rateLimitMiddleware(RATE_LIMITS.brandingUpload), csrfMiddleware(), async (c) => {
  const { assetType } = c.req.param()
  const config = BRANDING_UPLOADS[assetType as keyof typeof BRANDING_UPLOADS]

  if (!config) {
    return c.json({ success: false, error: 'Tipo de asset no soportado' }, 404)
  }

  const contentType = c.req.header('Content-Type') ?? ''
  if (!config.allowedMimes.includes(contentType as never)) {
    return c.json({ success: false, error: 'Formato no valido. Revisa las especificaciones del archivo.' }, 422)
  }

  const body = await c.req.arrayBuffer()
  if (body.byteLength === 0) {
    return c.json({ success: false, error: 'No se recibio ningun archivo' }, 422)
  }
  if (body.byteLength > config.maxBytes) {
    return c.json({ success: false, error: 'El archivo supera el tamano permitido' }, 422)
  }

  const ext = MIME_EXTENSIONS[contentType]
  if (!ext) {
    return c.json({ success: false, error: 'No se pudo determinar la extension del archivo' }, 422)
  }

  const oldRow = await c.env.DB.prepare('SELECT value FROM settings WHERE key = ?')
    .bind(config.settingKey)
    .first<{ value: string }>()

  const r2Key = `public/branding/${config.folder}-${Date.now()}.${ext}`
  await c.env.R2.put(r2Key, body, { httpMetadata: { contentType } })

  const publicUrl = `https://${c.env.R2_PUBLIC_DOMAIN}/${r2Key}`
  await upsertSetting(c.env.DB, config.settingKey, publicUrl)

  const previousKey = oldRow?.value ? extractManagedBrandingKey(oldRow.value) : null
  if (previousKey && previousKey !== r2Key) {
    await c.env.R2.delete(previousKey)
  }

  await logAction(
    c.env.DB,
    c.get('adminId'),
    'settings.asset.upload',
    'settings',
    config.settingKey,
    { value: oldRow?.value ?? null },
    { value: publicUrl }
  )

  return c.json({
    success: true,
    data: {
      key: config.settingKey,
      value: publicUrl,
      contentType,
      size: body.byteLength,
    },
  })
})

export const adminAuditRouter = new Hono<HonoEnv>()
adminAuditRouter.use('*', authMiddleware())

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

  if (action) {
    conditions.push('al.action LIKE ?')
    bindings.push(`%${action}%`)
  }
  if (entityType) {
    conditions.push('al.entity_type = ?')
    bindings.push(entityType)
  }
  if (dateFrom) {
    conditions.push('al.created_at >= ?')
    bindings.push(dateFrom)
  }
  if (dateTo) {
    conditions.push('al.created_at <= ?')
    bindings.push(dateTo)
  }

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

export const publicSettingsRouter = new Hono<HonoEnv>()

publicSettingsRouter.get('/public', async (c) => {
  const settings = await loadAllSettings(c.env.DB)
  return c.json({
    success: true,
    data: {
      ...getPublicBrandingSettings(settings, c.env.R2_PUBLIC_DOMAIN),
      order_expiry_minutes: settings[SETTINGS_KEYS.ORDER_EXPIRY_MINUTES] || String(DEFAULT_ORDER_EXPIRY_MINUTES),
    },
  })
})
