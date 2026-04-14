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

    <div class="steps-grid">
      <article class="glass-card step-card">
        <span class="step-number">1</span>
        <h2>Explora el catalogo</h2>
        <p>Revisa modelos, tallas, fotos y estado del producto antes de agregarlo al carrito.</p>
      </article>

      <article class="glass-card step-card">
        <span class="step-number">2</span>
        <h2>Arma tu carrito</h2>
        <p>Selecciona los productos que te interesan y verifica el resumen antes de enviar tu solicitud.</p>
      </article>

      <article class="glass-card step-card">
        <span class="step-number">3</span>
        <h2>Confirma tu reserva</h2>
        <p>Completa tus datos, valida la solicitud y genera el mensaje de WhatsApp con el detalle del pedido.</p>
      </article>

      <article class="glass-card step-card">
        <span class="step-number">4</span>
        <h2>Coordina la compra</h2>
        <p>La tienda revisa disponibilidad, pago, entrega o retiro antes de cerrar la venta de forma definitiva.</p>
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

.steps-grid,
.content-grid {
  display: grid;
  gap: 1.25rem;
}

.steps-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.content-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.step-card,
.detail-card {
  display: grid;
  gap: 0.85rem;
}

.step-number {
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.14);
  color: var(--accent-primary);
  font-weight: 700;
}

.detail-card p,
.detail-card li,
.step-card p {
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
