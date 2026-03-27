import crypto from 'crypto'

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 32

async function generateHash(password, pepper) {
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

import fs from 'fs'

generateHash('Admin123!', 'REPLACE_WITH_RANDOM_SECRET_MIN_32_CHARS').then(hash => {
  fs.writeFileSync('output_hash.txt', hash)
})
