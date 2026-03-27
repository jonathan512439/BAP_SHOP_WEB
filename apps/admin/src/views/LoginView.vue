<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMsg = ref('')
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

const turnstileToken = ref('')
const turnstileWidgetId = ref<any>(null)

onMounted(() => {
  // Cargar Turnstile script dinámicamente
  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  document.head.appendChild(script)

  script.onload = () => {
    // @ts-ignore
    if (window.turnstile) {
      // @ts-ignore
      turnstileWidgetId.value = window.turnstile.render('#turnstile-admin', {
        sitekey: turnstileSiteKey,
        callback: (token: string) => {
          turnstileToken.value = token
        },
        'error-callback': () => {
          errorMsg.value = 'Error validando seguridad. Refresca la página.'
        }
      })
    }
  }
})

onUnmounted(() => {
  // @ts-ignore
  if (window.turnstile && turnstileWidgetId.value !== null) {
    // @ts-ignore
    window.turnstile.remove(turnstileWidgetId.value)
  }
})

const handleLogin = async () => {
  if (!turnstileToken.value) {
    errorMsg.value = 'Espera la validación antibot'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    // Llama al store para hacer el login, que a su vez llama a POST /auth/login
    await authStore.login(username.value, password.value, turnstileToken.value)
    router.push('/')
  } catch (err: any) {
    errorMsg.value = err.message || 'Credenciales incorrectas'
    // Reiniciar Turnstile si hubo error (bot, contraseña mala, etc)
    // @ts-ignore
    if (window.turnstile && turnstileWidgetId.value !== null) {
      // @ts-ignore
      window.turnstile.reset(turnstileWidgetId.value)
      turnstileToken.value = ''
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-box admin-card">
    <div class="header">
      <h2>BAP Shop Admin</h2>
      <p>Inicia sesión para gestionar el catálogo</p>
    </div>

    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label class="form-label">Usuario</label>
        <input type="text" v-model="username" class="form-input" required autofocus />
      </div>
      <div class="form-group">
        <label class="form-label">Contraseña</label>
        <input type="password" v-model="password" class="form-input" required />
      </div>

      <!-- Contenedor Turnstile -->
      <div id="turnstile-admin" style="margin-top: 1rem;"></div>

      <div v-if="errorMsg" class="error-alert">
        {{ errorMsg }}
      </div>

      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading || !turnstileToken">
        {{ isLoading ? 'Entrando...' : 'Ingresar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-box {
  width: 100%;
  max-width: 400px;
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  animation: slideUp 0.4s ease;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.header p {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.w-full {
  width: 100%;
  margin-top: 1.5rem;
}

.error-alert {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  font-size: 0.875rem;
  border-radius: var(--radius-md);
  text-align: center;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
