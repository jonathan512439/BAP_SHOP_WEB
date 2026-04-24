import { logWarn, serializeError } from './logger'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type TurnstileContext = {
  requestId?: string
  source?: string
  environment?: string
}

/**
 * Verifica un token de Turnstile contra la API de Cloudflare.
 * Retorna true si la verificacion fue exitosa.
 */
export async function verifyTurnstile(token: string, secret: string, context: TurnstileContext = {}): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('secret', secret)
    formData.append('response', token)

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
    })

    const payload = await response.json<{ success: boolean; ['error-codes']?: string[] }>()
    if (!response.ok) {
      logWarn('turnstile_http_error', {
        requestId: context.requestId,
        source: context.source,
        environment: context.environment,
        status: response.status,
      })
      return false
    }

    if (!payload.success) {
      logWarn('turnstile_validation_failed', {
        requestId: context.requestId,
        source: context.source,
        environment: context.environment,
        errorCodes: payload['error-codes'] ?? [],
      })
    }

    return payload.success === true
  } catch (error) {
    logWarn('turnstile_request_failed', {
      requestId: context.requestId,
      source: context.source,
      environment: context.environment,
      error: serializeError(error, context.environment !== 'production'),
    })
    return false
  }
}
