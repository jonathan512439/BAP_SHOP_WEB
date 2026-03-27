import { sha256 } from '../middleware/auth'

// ============================================================
// Librería de autenticación del admin
// Hashing: SHA-256(pepper + password) como base
// Workers no soporta Argon2id nativamente. Usamos un enfoque
// compatible con la Web Crypto API disponible en Workers:
// PBKDF2 con SHA-256 + salt + pepper.
// Es más fuerte que bcrypt para entornos Workers y sin deps externas.
// ============================================================

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 32

/**
 * Genera un hash seguro de contraseña usando PBKDF2-SHA256.
 * El pepper se combina con el password antes de hashear.
 * El salt se genera aleatoriamente y se incluye en el resultado.
 *
 * Formato del hash: pbkdf2$<salt_hex>$<hash_hex>
 */
export async function hashPassword(password: string, pepper: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const saltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('')

  const combined = `${pepper}:${password}`
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(combined),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )

  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `pbkdf2$${saltHex}$${hashHex}`
}

/**
 * Verifica una contraseña contra un hash almacenado.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  pepper: string
): Promise<boolean> {
  try {
    const [algo, saltHex, expectedHashHex] = storedHash.split('$')
    if (algo !== 'pbkdf2' || !saltHex || !expectedHashHex) return false

    // Reconstruir salt desde hex
    const saltBytes = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))

    const combined = `${pepper}:${password}`
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(combined),
      'PBKDF2',
      false,
      ['deriveBits']
    )

    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      256
    )

    const computedHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Comparación segura a tiempo constante
    return constantTimeEqual(computedHex, expectedHashHex)
  } catch {
    return false
  }
}

/**
 * Genera un token de sesión criptográficamente seguro.
 * Retorna el token plano (para la cookie) y su hash SHA-256 (para la DB).
 */
export async function generateSessionToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(48))
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  const tokenHash = await sha256(token)
  return { token, tokenHash }
}

/**
 * Genera un token CSRF (32 bytes aleatorios en hex).
 */
export function generateCsrfToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Comparación de strings a tiempo constante.
 * Previene timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
