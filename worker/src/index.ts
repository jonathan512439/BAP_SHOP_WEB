import { Hono } from 'hono'
import type { HonoEnv } from './types/env'
import { corsMiddleware, databaseMiddleware, requestContextMiddleware, securityHeaders } from './middleware'
import { handleScheduled } from './cron'

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
app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      environment: c.env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
  })
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
  return c.json({ success: false, error: 'Endpoint no encontrado' }, 404)
})

app.onError((err, c) => {
  const requestId = c.get('requestId')
  console.error(`[Worker Error][${requestId}]`, err)

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
