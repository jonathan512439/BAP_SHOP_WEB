import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

export const requestContextMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const requestId = c.req.header('cf-ray') || crypto.randomUUID()
    c.set('requestId', requestId)

    await next()

    c.res.headers.set('X-Request-Id', requestId)
  }
}
