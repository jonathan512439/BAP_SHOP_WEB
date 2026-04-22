// ============================================================
// Verificación de Cloudflare Turnstile
// Función centralizada usada por auth y orders.
// ============================================================

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifica un token de Turnstile contra la API de Cloudflare.
 * Retorna true si la verificación fue exitosa.
 */
export async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append('secret', secret)
    formData.append('response', token)

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json<{ success: boolean }>()
    return data.success === true
  } catch {
    return false
  }
}
