import type { MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../types/env'

// Patrón UUID v4 estricto
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Params que NO son UUIDs (e.g., asset type strings)
const NON_UUID_PARAMS = new Set(['assetType'])

/**
 * Middleware que valida que los parámetros de ruta especificados sean UUIDs válidos.
 * Retorna 400 si algún parámetro no cumple el formato UUID.
 * 
 * @example
 * // Valida params específicos
 * router.get('/:id', validateUuidParams('id'), async (c) => { ... })
 * 
 * // Sin argumentos: valida TODOS los params excepto los de NON_UUID_PARAMS
 * router.use('*', validateUuidParams())
 */
export function validateUuidParams(...paramNames: string[]): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const params = c.req.param() as Record<string, string>

    // Si se especificaron names, solo validar esos
    const keysToValidate = paramNames.length > 0
      ? paramNames
      : Object.keys(params).filter((k) => !NON_UUID_PARAMS.has(k))

    for (const name of keysToValidate) {
      const value = params[name]
      if (value && !UUID_REGEX.test(value)) {
        return c.json(
          { success: false, error: `Parámetro '${name}' no es un UUID válido` },
          400
        )
      }
    }
    await next()
  }
}
