import { Hono } from 'hono'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/env'

export const publicAssetsRouter = new Hono<HonoEnv>()

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

async function fetchFromFallback(c: Context<HonoEnv>, assetPath: string) {
  if (c.env.ENVIRONMENT !== 'staging') return null

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

  if (!headers.has('Cache-Control')) {
    headers.set(
      'Cache-Control',
      assetPath.endsWith('.json') ? 'public, max-age=60' : 'public, max-age=31536000, immutable'
    )
  }

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

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', key.endsWith('.json') ? 'public, max-age=60' : 'public, max-age=31536000, immutable')
  }

  return new Response(object.body, {
    status: 200,
    headers,
  })
})
