<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import CartDrawer from './components/CartDrawer.vue'
import { useCartStore } from './stores/cart'
import { useBrandingStore } from './stores/branding'
import { absoluteUrl, setFavicon, setStructuredData } from './lib/seo'
import { useConnectivity } from './composables/useConnectivity'
const cartStore = useCartStore()
const brandingStore = useBrandingStore()
const isCartOpen = ref(false)
const route = useRoute()
const { isOnline } = useConnectivity()

onMounted(() => {
  brandingStore.loadBranding()
})


const brandLogoSrc = computed(() => brandingStore.branding.brand_logo_url || '')
const storeName = computed(() => brandingStore.branding.store_name || 'BAP Shop')
const bannerImageUrl = computed(() =>
  brandingStore.branding.store_banner_media_type === 'image' ? brandingStore.branding.store_banner_image_url || '' : ''
)
const bannerVideoUrl = computed(() =>
  brandingStore.branding.store_banner_media_type === 'video' ? brandingStore.branding.store_banner_video_url || '' : ''
)
const socialLinks = computed(() => [
  { label: 'Facebook', url: brandingStore.branding.social_facebook_url },
  { label: 'TikTok', url: brandingStore.branding.social_tiktok_url },
  { label: 'Instagram', url: brandingStore.branding.social_instagram_url },
].filter((item) => item.url))
const fixedFooterContactUrl = 'https://wa.me/59167156258'
const fixedFooterPhone = '+591 67156258'

watch(
  () => brandingStore.branding,
  (branding) => {
    const storeNameValue = branding.store_name || 'BAP Shop'
    const sameAs = [
      branding.social_facebook_url,
      branding.social_tiktok_url,
      branding.social_instagram_url,
    ].filter(Boolean)
    const logoUrl = branding.brand_logo_url || null

    setFavicon(logoUrl)

    setStructuredData('website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: storeNameValue,
      url: absoluteUrl('/'),
      description:
        'Tienda online de Oruro - Bolivia para explorar zapatillas y otros articulos con compra coordinada por WhatsApp.',
      inLanguage: 'es',
      areaServed: ['Oruro, Bolivia', 'Bolivia'],
    })

    setStructuredData('organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: storeNameValue,
      url: absoluteUrl('/'),
      description:
        'BAP Shop es una tienda online de Oruro - Bolivia con catalogo de zapatillas y articulos disponibles.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Oruro',
        addressCountry: 'BO',
      },
      areaServed: {
        '@type': 'Country',
        name: 'Bolivia',
      },
      sameAs,
      ...(logoUrl ? { logo: logoUrl, image: logoUrl } : {}),
    })
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div class="app-layout" :class="{ offline: !isOnline }">
    <a href="#main-content" class="skip-link">Ir al contenido principal</a>
    <div v-if="!isOnline" class="connection-banner" role="alert">
      Sin conexion a internet. Puedes revisar la pagina cargada, pero no podras enviar pedidos hasta reconectar.
    </div>

    <header class="glass-header" :class="{ 'with-banner': !!bannerImageUrl || !!bannerVideoUrl }">
      <div
        v-if="bannerImageUrl"
        class="header-banner"
        :style="{ backgroundImage: `url(${bannerImageUrl})` }"
        aria-hidden="true"
      />
      <video
        v-if="bannerVideoUrl"
        class="header-banner-video"
        :poster="bannerImageUrl || undefined"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        aria-hidden="true"
      >
        <source :src="bannerVideoUrl" type="video/mp4" />
      </video>
      <div v-if="bannerVideoUrl" class="header-banner-video-overlay" aria-hidden="true" />

      <nav class="nav-container" aria-label="Navegacion principal">
        <RouterLink class="logo" to="/zapatillas">
          <img v-if="brandLogoSrc" :src="brandLogoSrc" :alt="storeName" class="logo-image" />
          <div class="logo-copy">
            <strong>{{ storeName }}</strong>
            <span>Sneakers Originales | Oruro - Bolivia</span>
          </div>
        </RouterLink>

        <div class="nav-links">
          <RouterLink to="/zapatillas" :class="{ active: route.name === 'sneakers' }">Zapatillas</RouterLink>
          <RouterLink to="/otros" :class="{ active: route.name === 'others' }">Otros</RouterLink>
          <RouterLink to="/como-comprar" :class="{ active: route.name === 'how-to-buy' }">Como comprar</RouterLink>
          <button
            type="button"
            class="cart-btn"
            :aria-label="cartStore.count > 0 ? `Abrir carrito con ${cartStore.count} productos` : 'Abrir carrito'"
            @click="isCartOpen = true"
          >
            <span>Carrito</span>
            <span v-if="cartStore.count > 0" class="cart-badge">{{ cartStore.count }}</span>
          </button>
        </div>
      </nav>
    </header>

    <main id="main-content" class="main-content">
      <RouterView />
    </main>

    <footer id="como-comprar" class="footer" aria-label="Informacion institucional y contacto">
      <div class="footer-brand">
        <img v-if="brandLogoSrc" :src="brandLogoSrc" :alt="storeName" class="footer-logo" />
        <div>
          <strong>{{ storeName }}</strong>
          <p>Oruro - Bolivia</p>
          <p>Deuteronomio 15:10</p>
        </div>
      </div>

      <div class="footer-grid">
        <section class="footer-section">
          <span class="footer-label">Como comprar</span>
          <p>Agrega productos al carrito, envia tu solicitud y coordina la confirmacion final directamente con la tienda.</p>
          <RouterLink to="/como-comprar" class="footer-inline-link">Ver guia completa</RouterLink>
        </section>

        <section class="footer-section">
          <span class="footer-label">Institucional</span>
          <p>Conoce mejor la propuesta comercial, el funcionamiento del catalogo y las respuestas a dudas frecuentes.</p>
          <div class="footer-link-list">
            <RouterLink to="/nosotros" class="footer-inline-link">Nosotros</RouterLink>
            <RouterLink to="/preguntas-frecuentes" class="footer-inline-link">Preguntas frecuentes</RouterLink>
            <RouterLink to="/politicas" class="footer-inline-link">Politicas</RouterLink>
          </div>
        </section>

        <section class="footer-section">
          <span class="footer-label">Pagos y reservas</span>
          <p>No contamos con pasarela de pago integrada. Toda reserva es temporal y la venta final se confirma con la tienda.</p>
        </section>

        <section class="footer-section">
          <span class="footer-label">Entregas y contacto</span>
          <p>
            En Oruro, Bolivia, trabajamos con previa coordinacion. Tambien atendemos envios nacionales y consultas por redes.
          </p>
          <p v-if="socialLinks.length" class="footer-socials">
            <template v-for="(social, index) in socialLinks" :key="social.label">
              <a :href="social.url" target="_blank" rel="noreferrer" :aria-label="`Abrir ${social.label} de ${storeName}`">
                {{ social.label }}
              </a>
              <span v-if="index < socialLinks.length - 1"> | </span>
            </template>
          </p>
        </section>
      </div>

      <div class="footer-dev-card">
        <span class="footer-label-dev">Desarrollo web: JC-Dev</span>
        <p>
          Si deseas una pagina similar para tu negocio, puedes contactarme directamente por WhatsApp al
          <a :href="fixedFooterContactUrl" target="_blank" rel="noreferrer" aria-label="Contactar por WhatsApp a JC-Dev">
            {{ fixedFooterPhone }} (Haz click aqui)
          </a>.
        </p>
      </div>

      <p class="footer-note">
        &copy; 2026 {{ storeName }}. Tienda online con atencion y coordinacion directa por WhatsApp.
      </p>
    </footer>

    <CartDrawer :isOpen="isCartOpen" @click:close="isCartOpen = false" />
    <div v-if="isCartOpen" class="drawer-overlay" @click="isCartOpen = false"></div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.skip-link {
  position: absolute;
  left: 1rem;
  top: -3rem;
  z-index: 120;
  background: #ffffff;
  color: #111827;
  padding: 0.7rem 1rem;
  border-radius: 999px;
  font-weight: 700;
  transition: top 0.2s ease;
}

.skip-link:focus {
  top: 1rem;
}

.connection-banner {
  position: sticky;
  top: 0;
  z-index: 80;
  padding: 0.75rem 1rem;
  text-align: center;
  background: #7f1d1d;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
}

.glass-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-light);
  transition: all 0.3s ease;
}

.app-layout.offline .glass-header {
  top: 2.75rem;
}

.glass-header.with-banner {
  background: linear-gradient(110deg, rgba(9, 14, 25, 0.84), rgba(9, 14, 25, 0.68));
}

.header-banner {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  filter: blur(3px) saturate(0.9);
  transform: scale(1.04);
  opacity: 0.48;
}

.header-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(5, 8, 15, 0.76), rgba(5, 8, 15, 0.52)),
    linear-gradient(90deg, rgba(7, 10, 18, 0.56), rgba(7, 10, 18, 0.2));
}

.header-banner-video,
.header-banner-video-overlay {
  position: absolute;
  inset: 0;
}

.header-banner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.9) brightness(0.56);
  transform: scale(1.03);
}

.header-banner-video-overlay {
  background:
    linear-gradient(180deg, rgba(5, 8, 15, 0.62), rgba(5, 8, 15, 0.48)),
    linear-gradient(90deg, rgba(7, 10, 18, 0.45), rgba(7, 10, 18, 0.12));
}

.nav-container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  font-family: var(--font-heading);
  color: var(--text-primary);
}

.logo-image {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border-radius: 16px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14);
}

.logo-copy {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.logo-copy strong {
  font-size: 1.2rem;
  line-height: 1;
  letter-spacing: -0.02em;
}

.logo-copy span {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.82);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.nav-links a {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.86);
  transition: color 0.2s ease;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

.nav-links a.active,
.nav-links a:hover {
  color: #fff;
}

.cart-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.22);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

.cart-btn:hover {
  background: rgba(255, 255, 255, 0.24);
  color: #fff;
}

.cart-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--accent-primary);
  color: var(--bg-main);
  font-size: 0.75rem;
  font-weight: 700;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.main-content {
  flex: 1;
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.footer {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem;
  color: var(--text-tertiary);
  font-size: 0.875rem;
  border-top: 1px solid var(--border-light);
  margin-top: 4rem;
  scroll-margin-top: 6rem;
}

.footer-brand {
  display: inline-flex;
  margin: 0 auto 0.5rem;
  align-items: center;
  gap: 0.85rem;
  text-align: left;
}

.footer-brand p {
  margin: 0.2rem 0 0;
  color: var(--text-tertiary);
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 280px));
  justify-content: center;
  gap: 1rem;
  text-align: center;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.footer-section {
  padding: 1rem;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-light);
  min-height: 152px;
}

.footer-inline-link {
  display: inline-flex;
  margin-top: 0.75rem;
  color: #86efac;
  font-weight: 600;
}

.footer-link-list {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.75rem;
  justify-items: center;
}

.footer-socials {
  margin-top: 0.75rem !important;
}

.footer-dev-card {
  display: inline-flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0 auto;
  padding: 1rem 1.1rem;
  text-align: center;
  border-radius: var(--radius-md);
  background: rgba(134, 239, 172, 0.06);
  border: 1px solid rgba(134, 239, 172, 0.18);
  align-items: center;
}

.footer-label {
  display: inline-flex;
  margin-bottom: 0.55rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}
.footer-label-dev {
  display: inline-flex;
  margin-bottom: 0.55rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #bbf7d0;
}

.footer-section p,
.footer-dev-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.footer-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  border-radius: 14px;
}

.footer a {
  color: #86efac;
  font-weight: 600;
}

.footer a:hover {
  color: #bbf7d0;
}

.footer-note {
  margin: 0;
  text-align: center;
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 90;
}

@media (max-width: 720px) {
  .nav-container {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-banner {
    opacity: 0.4;
  }

  .logo-image {
    width: 48px;
    height: 48px;
  }

  .logo-copy strong {
    font-size: 1.05rem;
  }

  .footer-brand {
    flex-direction: column;
    text-align: center;
  }

  .footer-grid {
    text-align: center;
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
