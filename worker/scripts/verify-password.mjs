import { pbkdf2Sync } from 'node:crypto'

const PBKDF2_ITERATIONS = 100_000

const password = process.argv[2]
const storedHash = process.argv[3]
const pepper = process.env.ADMIN_PEPPER

if (!password || !storedHash) {
  console.error('Uso: pnpm --filter worker verify-password <password> <storedHash>')
  process.exit(1)
}

if (!pepper) {
  console.error('Falta ADMIN_PEPPER en el entorno.')
  console.error(
    'Ejemplo PowerShell: $env:ADMIN_PEPPER="tu-pepper"; pnpm --filter worker verify-password BapShop1! "pbkdf2$..."'
  )
  process.exit(1)
}

const [algo, saltHex, expectedHashHex] = storedHash.split('$')
if (algo !== 'pbkdf2' || !saltHex || !expectedHashHex) {
  console.error('Formato de hash invalido. Debe ser pbkdf2$<salt_hex>$<hash_hex>.')
  process.exit(1)
}

const salt = Buffer.from(saltHex, 'hex')
const combined = `${pepper}:${password}`
const computedHashHex = pbkdf2Sync(combined, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex')

console.log('')
console.log(`Coincide: ${computedHashHex === expectedHashHex ? 'SI' : 'NO'}`)
console.log(`Hash esperado: ${expectedHashHex}`)
console.log(`Hash calculado: ${computedHashHex}`)
