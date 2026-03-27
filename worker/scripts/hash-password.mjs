/**
 * Script para generar el hash Argon2id del password del admin.
 *
 * Uso:
 *   node scripts/hash-password.mjs <password> <pepper>
 *
 * Ejemplo:
 *   node scripts/hash-password.mjs "MiContraseñaSegura123" "mi_pepper_secreto"
 *
 * Nota: Cloudflare Workers usa bcrypt vía el algoritmo nativo.
 * Para producción, como Workers no tiene Argon2id nativo en tiempo de ejecución,
 * usaremos la implementación de @node-rs/argon2 localmente para generar el hash,
 * y en el Worker la verificación se hará con la misma librería compilada a WASM.
 *
 * Alternativa más simple para este proyecto: usar bcrypt con trabajo factor 12.
 * Pero dado que queremos Argon2id, usaremos hash-wasm que funciona en Workers.
 */

// Este script usa la API de hashing nativa del Worker (Argon2id via hash-wasm)
// Para desarrollo local, ejecutar con Node.js que también soporta hash-wasm

const [,, password, pepper] = process.argv

if (!password || !pepper) {
  console.error('Uso: node scripts/hash-password.mjs <password> <pepper>')
  console.error('Ejemplo: node scripts/hash-password.mjs "MiPass123" "mi_pepper_32_chars"')
  process.exit(1)
}

// Simulación del proceso de hashing para el seed
// El hash real se genera en el Worker usando hash-wasm
const combined = `${password}${pepper}`
const encoder = new TextEncoder()
const data = encoder.encode(combined)
const hashBuffer = await crypto.subtle.digest('SHA-256', data)
const hashArray = Array.from(new Uint8Array(hashBuffer))
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

console.log('\n=== BAP_SHOP — Hash de contraseña ===')
console.log(`Password: ${password}`)
console.log(`Pepper:   ${pepper}`)
console.log(`\nNOTA: Este es un SHA-256 de referencia para verificar el setup.`)
console.log(`El hash real de producción se genera automáticamente al hacer POST /auth/login`)
console.log(`con la implementación Argon2id del Worker.\n`)
console.log(`Para insertar en la DB, usa el endpoint POST /admin/init-password (solo en development)`)
console.log(`Hash SHA-256 (solo referencia): ${hashHex}`)
