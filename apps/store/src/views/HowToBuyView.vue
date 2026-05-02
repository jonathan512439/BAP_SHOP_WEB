<template>
  <section class="info-page">
    <header class="page-hero">
      <p class="eyebrow">Guia de compra</p>
      <h1>Como comprar en BAP Shop</h1>
      <p class="lead">
        El proceso es simple: eliges tus productos, envias tu solicitud y coordinas la confirmacion final con la
        tienda por WhatsApp desde Oruro - Bolivia.
      </p>
    </header>

    <div class="steps-timeline">
      <article class="glass-card timeline-card">
        <div class="timeline-icon">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div class="timeline-content">
          <h2>1. Explora el catalogo</h2>
          <p>Revisa modelos, tallas, fotos y estado del producto antes de agregarlo al carrito.</p>
        </div>
      </article>

      <article class="glass-card timeline-card">
        <div class="timeline-icon">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div class="timeline-content">
          <h2>2. Arma tu carrito</h2>
          <p>Selecciona los productos que te interesan y verifica el resumen antes de enviar tu solicitud.</p>
        </div>
      </article>

      <article class="glass-card timeline-card">
        <div class="timeline-icon">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="timeline-content">
          <h2>3. Confirma tu reserva</h2>
          <p>Completa tus datos, valida la solicitud y genera el mensaje de WhatsApp con el detalle del pedido.</p>
        </div>
      </article>

      <article class="glass-card timeline-card">
        <div class="timeline-icon">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div class="timeline-content">
          <h2>4. Coordina la compra</h2>
          <p>La tienda revisa disponibilidad, pago, entrega o retiro antes de cerrar la venta de forma definitiva.</p>
        </div>
      </article>
    </div>

    <div class="content-grid">
      <article class="glass-card detail-card">
        <h3>Que debes tener en cuenta</h3>
        <ul>
          <li>El carrito no equivale a una compra cerrada.</li>
          <li>La reserva es temporal y esta sujeta a confirmacion.</li>
          <li>Las condiciones finales de pago y entrega se coordinan directamente con la tienda.</li>
          <li>Las entregas en Oruro se coordinan previamente y tambien hay envios a nivel nacional.</li>
        </ul>
      </article>

      <article class="glass-card detail-card">
        <h3>Canales de atencion</h3>
        <p>
          Toda la coordinacion final se realiza por WhatsApp con el negocio. Si tienes dudas antes de reservar, tambien
          puedes revisar las preguntas frecuentes y las politicas comerciales de la tienda.
        </p>
        <div class="action-row">
          <router-link to="/preguntas-frecuentes" class="btn-primary">Ver preguntas frecuentes</router-link>
          <router-link to="/politicas" class="btn-secondary">Revisar politicas</router-link>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.info-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-hero {
  display: grid;
  gap: 0.75rem;
  max-width: 72ch;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.75rem;
  color: var(--accent-primary);
}

.page-hero h1 {
  font-size: clamp(2.4rem, 4vw, 4rem);
  letter-spacing: -0.04em;
}

.lead {
  color: var(--text-secondary);
  line-height: 1.7;
}

.steps-timeline,
.content-grid {
  display: grid;
  gap: 1.25rem;
}

.steps-timeline {
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .steps-timeline {
    grid-template-columns: repeat(2, 1fr);
  }
}

.timeline-card {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.timeline-icon {
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: rgba(34, 211, 238, 0.15);
  color: var(--accent-primary);
  box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.05);
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.timeline-content h2 {
  margin: 0;
  font-size: 1.15rem;
}

.timeline-content p {
  margin: 0;
}

.content-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.detail-card {
  display: grid;
  gap: 0.85rem;
}

.detail-card p,
.detail-card li,
.timeline-content p {
  color: var(--text-secondary);
  line-height: 1.7;
}

.detail-card ul {
  margin: 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.45rem;
}

.action-row {
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.btn-secondary {
  color: var(--text-secondary);
  font-weight: 600;
  transition: color var(--transition-fast);
}

.btn-secondary:hover {
  color: var(--text-primary);
}
</style>
