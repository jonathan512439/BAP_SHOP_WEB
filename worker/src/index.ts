import { Hono } from 'hono'
import type { HonoEnv } from './types/env'
import { RATE_LIMITS, corsMiddleware, databaseMiddleware, rateLimitMiddleware, requestContextMiddleware, securityHeaders } from './middleware'
import { handleScheduled } from './cron'
import { logError, serializeError } from './lib/logger'

// Import de Routers
import { authRouter } from './routes/auth'
import { ordersRouter } from './routes/orders'
import { publicAssetsRouter } from './routes/public-assets'
import { adminProductsRouter } from './routes/admin/products'
import { adminBrandsRouter, adminModelsRouter } from './routes/admin/brands-models'
import { adminPromotionsRouter } from './routes/admin/promotions'
import { adminOrdersRouter } from './routes/admin/orders'
import { adminSettingsRouter, adminAuditRouter, publicSettingsRouter } from './routes/admin/settings-audit'

// ============================================================
// Aplicación Hono principal
// ============================================================
const app = new Hono<HonoEnv>()

// Middlewares globales (se ejecutan en TODAS las peticiones)
app.use('*', requestContextMiddleware())
app.use('*', databaseMiddleware())
app.use('*', corsMiddleware())
app.use('*', securityHeaders())

// Health check
app.get('/health', rateLimitMiddleware(RATE_LIMITS.health), (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      environment: c.env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
  })
})

app.get('/health/deps', rateLimitMiddleware(RATE_LIMITS.health), async (c) => {
  const checks = {
    d1: { ok: true as boolean, error: null as string | null },
    kv: { ok: true as boolean, error: null as string | null },
    r2: { ok: true as boolean, error: null as string | null },
  }

  try {
    await c.env.DB.prepare('SELECT 1').first()
  } catch (error) {
    checks.d1.ok = false
    checks.d1.error = error instanceof Error ? error.message : 'unknown'
  }

  try {
    await c.env.KV.get('health:probe')
  } catch (error) {
    checks.kv.ok = false
    checks.kv.error = error instanceof Error ? error.message : 'unknown'
  }

  try {
    await c.env.R2.head('public/manifest.json')
  } catch (error) {
    checks.r2.ok = false
    checks.r2.error = error instanceof Error ? error.message : 'unknown'
  }

  const allOk = checks.d1.ok && checks.kv.ok && checks.r2.ok

  return c.json(
    {
      success: allOk,
      data: {
        status: allOk ? 'ok' : 'degraded',
        environment: c.env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
        checks,
      },
    },
    allOk ? 200 : 503
  )
})

// ============================================================
// Montado de APIs Públicas
// ============================================================
app.route('/auth', authRouter)
app.route('/orders', ordersRouter)
app.route('/settings', publicSettingsRouter)
app.route('/public', publicAssetsRouter)

// ============================================================
// Montado de APIs Admin
// ============================================================
// El router admin base. Cada sub-router define e inyecta `authMiddleware` por su cuenta.
const adminRouter = new Hono<HonoEnv>()
adminRouter.route('/products', adminProductsRouter)
adminRouter.route('/brands', adminBrandsRouter)
adminRouter.route('/models', adminModelsRouter)
adminRouter.route('/promotions', adminPromotionsRouter)
adminRouter.route('/orders', adminOrdersRouter)
adminRouter.route('/settings', adminSettingsRouter)
adminRouter.route('/audit', adminAuditRouter)

app.route('/admin', adminRouter)

// ============================================================
// Manejadores de Errores
// ============================================================
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint no encontrado',
    meta: {
      requestId: c.get('requestId'),
    },
  }, 404)
})

app.onError((err, c) => {
  const requestId = c.get('requestId')
  logError('http_unhandled_error', {
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    error: serializeError(err, c.env.ENVIRONMENT !== 'production'),
  })

  return c.json(
    {
      success: false,
      error: 'Internal server error',
      meta: {
        requestId,
      },
    },
    500
  )
})

// ============================================================
// Exports requeridos por Cloudflare Workers
// ============================================================
export default {
  // Handler HTTP
  fetch: app.fetch,

  // Handler de Tareas programadas
  async scheduled(
    event: ScheduledEvent,
    env: HonoEnv['Bindings'],
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(handleScheduled(event.cron, env))
  },
}
