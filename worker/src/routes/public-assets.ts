import { Hono } from 'hono'
import type { Context } from 'hono'
import { nowISO } from '@bap-shop/shared'
import type { HonoEnv } from '../types/env'
import { rebuildCatalogSnapshots } from '../lib/catalog-builder'
import { expirePendingOrdersAndReleaseProducts } from '../lib/order-expiry'
import { expireEndedPromotions } from '../lib/promotion-expiry'
import { logError, logInfo, serializeError } from '../lib/logger'

export const publicAssetsRouter = new Hono<HonoEnv>()

const CATALOG_MAINTENANCE_INTERVAL_MS = 60_000
const CATALOG_MAINTENANCE_KV_KEY = 'maintenance:catalog:last-run'

function buildCacheControlForAsset(assetPath: string): string {
  if (assetPath.endsWith('.json')) {
    // Manifest y snapshots deben refrescarse rapido para reflejar reservas/ventas.
    return 'public, max-age=10, must-revalidate'
  }

  return 'public, max-age=31536000, immutable'
}

function applyPublicAssetHeaders(headers: Headers): void {
  // Los snapshots e imagenes bajo /public no contienen datos sensibles.
  // Se consumen desde Store/Admin y deben poder leerse como assets cross-origin.
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
}

function normalizeOrigin(origin: string | undefined): string | null {
  if (!origin) return null
  const trimmed = origin.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

function shouldRunCatalogMaintenance(assetPath: string): boolean {
  if (!assetPath.endsWith('.json')) return false

  return (
    assetPath === 'manifest.json' ||
    assetPath.startsWith('catalog/') ||
    assetPath.startsWith('products/')
  )
}

async function runCatalogMaintenanceIfNeeded(
  c: Context<HonoEnv>,
  assetPath: string
) {
  if (!shouldRunCatalogMaintenance(assetPath)) return

  const nowMs = Date.now()
  try {
    const lastRunRaw = await c.env.KV.get(CATALOG_MAINTENANCE_KV_KEY)
    const lastRunMs = Number.parseInt(lastRunRaw || '0', 10)
    if (Number.isFinite(lastRunMs) && nowMs - lastRunMs < CATALOG_MAINTENANCE_INTERVAL_MS) {
      return
    }

    await c.env.KV.put(CATALOG_MAINTENANCE_KV_KEY, String(nowMs), {
      expirationTtl: 5 * 60,
    })

    const now = nowISO()
    const ordersResult = await expirePendingOrdersAndReleaseProducts(c.env.DB, now)
    const expiredPromotions = await expireEndedPromotions(c.env.DB, now)
    const dirtyRow = await c.env.DB
      .prepare("SELECT value FROM settings WHERE key = 'catalog_dirty'")
      .first<{ value: string }>()
    const isCatalogDirty = dirtyRow?.value === '1'

    if (
      !isCatalogDirty &&
      ordersResult.expiredOrders === 0 &&
      ordersResult.releasedProducts === 0 &&
      expiredPromotions === 0
    ) {
      return
    }

    await rebuildCatalogSnapshots(c.env.DB, c.env.R2, c.env.R2_PUBLIC_DOMAIN)
    logInfo('public_assets_catalog_maintenance', {
      requestId: c.get('requestId'),
      expiredOrders: ordersResult.expiredOrders,
      releasedProducts: ordersResult.releasedProducts,
      expiredPromotions,
      catalogDirty: isCatalogDirty,
    })
  } catch (error) {
    // Nunca bloquear entrega de assets por una falla de mantenimiento.
    logError('public_assets_catalog_maintenance_failed', {
      requestId: c.get('requestId'),
      error: serializeError(error, c.env.ENVIRONMENT !== 'production'),
    })
  }
}

function queueCatalogMaintenanceIfNeeded(c: Context<HonoEnv>, assetPath: string): void {
  const task = runCatalogMaintenanceIfNeeded(c, assetPath)
  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    c.executionCtx.waitUntil(task)
    return
  }
  void task
}

async function fetchFromFallback(c: Context<HonoEnv>, assetPath: string) {
  if (c.env.ENVIRONMENT !== 'staging') return null
  if (assetPath.endsWith('.json')) return null

  const fallbackOrigin = normalizeOrigin(c.env.ASSET_FALLBACK_ORIGIN)
  if (!fallbackOrigin) return null

  const upstream = await fetch(`${fallbackOrigin}/public/${assetPath}`, {
    method: 'GET',
    headers: {
      Accept: c.req.header('Accept') || '*/*',
    },
  })

  if (!upstream.ok) return null

  const headers = new Headers(upstream.headers)
  applyPublicAssetHeaders(headers)
  headers.set('x-asset-source', 'fallback')
  headers.set('Cache-Control', buildCacheControlForAsset(assetPath))

  return new Response(upstream.body, {
    status: 200,
    headers,
  })
}

publicAssetsRouter.options('/*', (c) => {
  const headers = new Headers()
  applyPublicAssetHeaders(headers)

  return new Response(null, {
    status: 204,
    headers,
  })
})

publicAssetsRouter.get('/*', async (c) => {
  const assetPath = c.req.path.replace(/^\/public\//, '')

  if (!assetPath || assetPath.includes('..')) {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    applyPublicAssetHeaders(headers)
    return new Response(JSON.stringify({ success: false, error: 'Asset no valido' }), {
      status: 400,
      headers,
    })
  }

  queueCatalogMaintenanceIfNeeded(c, assetPath)

  const key = `public/${assetPath}`
  const object = await c.env.R2.get(key)

  if (!object) {
    const fallbackResponse = await fetchFromFallback(c, assetPath)
    if (fallbackResponse) {
      return fallbackResponse
    }

    const headers = new Headers({ 'Content-Type': 'application/json' })
    applyPublicAssetHeaders(headers)
    return new Response(JSON.stringify({ success: false, error: 'Asset no encontrado' }), {
      status: 404,
      headers,
    })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  applyPublicAssetHeaders(headers)
  headers.set('Cache-Control', buildCacheControlForAsset(assetPath))

  return new Response(object.body, {
    status: 200,
    headers,
  })
})
