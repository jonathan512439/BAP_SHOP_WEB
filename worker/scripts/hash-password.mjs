import { pbkdf2Sync, randomBytes } from 'node:crypto'

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 32

const password = process.argv[2]
const username = process.argv[3] || 'admin'
const pepper = process.env.ADMIN_PEPPER

if (!password) {
  console.error('Uso: pnpm --filter worker hash-password <password> [username]')
  process.exit(1)
}

if (!pepper) {
  console.error('Falta ADMIN_PEPPER en el entorno.')
  console.error('Ejemplo PowerShell: $env:ADMIN_PEPPER="tu-pepper"; pnpm --filter worker hash-password BapShop1!')
  process.exit(1)
}

const salt = randomBytes(SALT_LENGTH)
const combined = `${pepper}:${password}`
const hash = pbkdf2Sync(combined, salt, PBKDF2_ITERATIONS, 32, 'sha256')

const saltHex = salt.toString('hex')
const hashHex = hash.toString('hex')
const storedHash = `pbkdf2$${saltHex}$${hashHex}`

console.log('')
console.log('Hash generado:')
console.log(storedHash)
console.log('')
console.log('SQL sugerido:')
console.log(`UPDATE admins SET password_hash = '${storedHash}' WHERE username = '${username}';`)
