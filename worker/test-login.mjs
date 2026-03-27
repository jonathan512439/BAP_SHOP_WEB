fetch('http://127.0.0.1:8787/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'Admin123!',
    turnstileToken: '1x00000000000000000000AA' // Clave de prueba oficial frontend
  })
}).then(async res => {
  console.log('Status:', res.status)
  console.log('Response:', await res.text())
}).catch(console.error)
