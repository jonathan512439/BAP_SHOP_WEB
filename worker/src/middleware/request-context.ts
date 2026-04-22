import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'
import { logInfo, logWarn } from '../lib/logger'

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/

function getRequestId(headerValue?: string): string {
  if (headerValue && REQUEST_ID_PATTERN.test(headerValue)) {
    return headerValue
  }

  return crypto.randomUUID()
}

function shouldLogRequest(
  environment: HonoEnv['Bindings']['ENVIRONMENT'],
  method: string,
  path: string,
  status: number,
  durationMs: number
): boolean {
  if (path.startsWith('/public/')) {
    return status >= 400
  }

  if (status >= 400 || durationMs >= 1000) {
    return true
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true
  }

  return environment !== 'production'
}

export const requestContextMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const startedAt = Date.now()
    const requestId = getRequestId(c.req.header('x-request-id') || c.req.header('cf-ray'))
    const method = c.req.method
    const path = new URL(c.req.url).pathname

    c.set('requestId', requestId)

    try {
      await next()
    } finally {
      const durationMs = Date.now() - startedAt
      const status = c.res.status || 200
      c.res.headers.set('X-Request-Id', requestId)

      if (shouldLogRequest(c.env.ENVIRONMENT, method, path, status, durationMs)) {
        const log = status >= 400 ? logWarn : logInfo
        log('http_request', {
          requestId,
          method,
          path,
          status,
          durationMs,
        })
      }
    }
  }
}
