import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

export async function enableForeignKeys(db: D1Database): Promise<void> {
  await db.prepare('PRAGMA foreign_keys = ON').run()
}

export const databaseMiddleware = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    await enableForeignKeys(c.env.DB)
    await next()
  }
}
