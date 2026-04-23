import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'

export const publicAssetsRouter = new Hono<HonoEnv>()

function applyPublicAssetHeaders(headers: Headers): void {
  // Los snapshots e imagenes bajo /public no contienen datos sensibles.
  // Se consumen desde Store/Admin y deben poder leerse como assets cross-origin.
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
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
