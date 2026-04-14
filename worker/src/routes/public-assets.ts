import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'

export const publicAssetsRouter = new Hono<HonoEnv>()

publicAssetsRouter.get('/*', async (c) => {
  const assetPath = c.req.path.replace(/^\/public\//, '')

  if (!assetPath || assetPath.includes('..')) {
    return c.json({ success: false, error: 'Asset no valido' }, 400)
  }

  const key = `public/${assetPath}`
  const object = await c.env.R2.get(key)

  if (!object) {
    return c.json({ success: false, error: 'Asset no encontrado' }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', key.endsWith('.json') ? 'public, max-age=60' : 'public, max-age=31536000, immutable')
  }

  return new Response(object.body, {
    status: 200,
    headers,
  })
})
