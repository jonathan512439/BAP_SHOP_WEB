import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, generateSessionToken, generateCsrfToken } from '../lib/auth'

describe('Auth Lib (Crypto)', () => {
  const pepper = 'super-secret-pepper-string-12345'
  const plain = 'mySecurePassword123'

  it('hashPassword and verifyPassword should work together with PBKDF2', async () => {
    const hash = await hashPassword(plain, pepper)
    
    // Debería incluir salt|iterations|hashBase64
    expect(hash.split('$').length).toBe(3)

    // Verification positiva
    const isOk = await verifyPassword(plain, hash, pepper)
    expect(isOk).toBe(true)

    // Verification negativa con mala password
    const isBad = await verifyPassword('wrong-password', hash, pepper)
    expect(isBad).toBe(false)
    
    // Verification negativa con mal pepper
    const isBadPepper = await verifyPassword(plain, hash, 'another-pepper')
    expect(isBadPepper).toBe(false)
  })

  it('generateSessionToken should generate a valid base64 token and its SHA256 hash', async () => {
    const { token, tokenHash } = await generateSessionToken()
    
    expect(token.length).toBeGreaterThan(32)
    expect(tokenHash.length).toBe(64) // SHA-256 is 64 hex chars
    expect(token).not.toEqual(tokenHash)
  })

  it('generateSessionToken tokens should be unique', async () => {
    const { token: t1 } = await generateSessionToken()
    const { token: t2 } = await generateSessionToken()
    
    expect(t1).not.toEqual(t2)
  })

  it('generateCsrfToken should generate a properly formatted 64-char hex string', () => {
    const token = generateCsrfToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })
})
