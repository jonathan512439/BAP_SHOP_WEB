<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBrandingStore } from '../stores/branding'

const router = useRouter()
const authStore = useAuthStore()
const brandingStore = useBrandingStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMsg = ref('')
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

const turnstileToken = ref('')
const turnstileWidgetId = ref<any>(null)
const brandLogoSrc = computed(() => brandingStore.branding.brand_logo_url || '')
const adminBannerTitle = computed(() => brandingStore.branding.admin_banner_title || 'BAP Shop Admin')
const adminBannerText = computed(() => (
  brandingStore.branding.admin_banner_text ||
  'Inicia sesion para gestionar catalogo, promociones, pedidos y ajustes.'
))
const storeName = computed(() => brandingStore.branding.store_name || 'BAP Shop')

onMounted(() => {
  brandingStore.loadBranding()
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
          errorMsg.value = ''
        },
        'error-callback': () => {
          errorMsg.value = 'No se pudo validar la seguridad. Revisa que el widget de Turnstile permita este dominio y recarga la pagina.'
        },
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
    errorMsg.value = 'Completa primero la validacion de seguridad.'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    await authStore.login(username.value, password.value, turnstileToken.value)
    router.push('/')
  } catch (err: any) {
    errorMsg.value = err.message || 'Credenciales incorrectas'
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
  <div class="login-shell">
    <div class="login-box admin-card">
      <div class="header">
        <img v-if="brandLogoSrc" :src="brandLogoSrc" alt="BAP Shop" class="login-logo" />
        <p class="eyebrow">Acceso administrativo</p>
        <h2>{{ adminBannerTitle }}</h2>
        <p>{{ adminBannerText }}</p>
        <small class="brand-note">{{ storeName }}</small>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label">Usuario</label>
          <input v-model="username" type="text" class="form-input" required autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Contrasena</label>
          <input v-model="password" type="password" class="form-input" required />
        </div>

        <div id="turnstile-admin" class="turnstile-box"></div>

        <div v-if="errorMsg" class="error-alert">
          {{ errorMsg }}
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="isLoading || !turnstileToken">
          {{ isLoading ? 'Entrando...' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  width: 100%;
  display: flex;
  justify-content: center;
}

.login-box {
  width: 100%;
  max-width: 430px;
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.4s ease;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-logo {
  width: min(220px, 62%);
  height: auto;
  margin: 0 auto 1rem;
  display: block;
  filter: drop-shadow(0 18px 32px rgba(15, 23, 42, 0.18));
}

.eyebrow {
  margin: 0 0 0.5rem;
  color: var(--accent-primary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
}

.header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.header p:last-child {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0;
}

.brand-note {
  display: inline-block;
  margin-top: 0.75rem;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.turnstile-box {
  margin-top: 1rem;
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
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
