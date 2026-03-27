<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import CartDrawer from './components/CartDrawer.vue'
import { useCartStore } from './stores/cart'

const cartStore = useCartStore()
const isCartOpen = ref(false)
const route = useRoute()

const storeWhatsappUrl = computed(() => {
  const number = import.meta.env.VITE_STORE_WHATSAPP_NUMBER
  return number ? `https://wa.me/${String(number).replace(/\D/g, '')}` : null
})
</script>

<template>
  <div class="app-layout">
    <header class="glass-header">
      <nav class="nav-container">
        <RouterLink class="logo" to="/zapatillas">BAP Shop</RouterLink>
        <div class="nav-links">
          <RouterLink to="/zapatillas" :class="{ active: route.name === 'sneakers' }">Zapatillas</RouterLink>
          <RouterLink to="/otros" :class="{ active: route.name === 'others' }">Otros</RouterLink>
          <button type="button" class="cart-btn" @click="isCartOpen = true">
            <span>Carrito</span>
            <span v-if="cartStore.count > 0" class="cart-badge">{{ cartStore.count }}</span>
          </button>
        </div>
      </nav>
    </header>

    <main class="main-content">
      <RouterView />
    </main>

    <footer class="footer">
      <p>&copy; 2026 BAP Shop. Catalogo y reservas sincronizados con stock real.</p>
      <a v-if="storeWhatsappUrl" :href="storeWhatsappUrl" target="_blank" rel="noreferrer">Contacto por WhatsApp</a>
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

.nav-container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.logo {
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 1.5rem;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.nav-links a {
  font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.2s ease;
}

.nav-links a.active,
.nav-links a:hover {
  color: var(--text-primary);
}

.cart-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.cart-btn:hover {
  background: var(--text-primary);
  color: var(--bg-main);
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
  gap: 0.5rem;
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary);
  font-size: 0.875rem;
  border-top: 1px solid var(--border-light);
  margin-top: 4rem;
}

.footer a:hover {
  color: var(--text-primary);
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
}
</style>
