<template>
  <section class="info-page">
    <header class="page-hero">
      <p class="eyebrow">Institucional</p>
      <h1>Nosotros</h1>
      <p class="lead">
        BAP Shop es una tienda con ventas en linea. Nuestro catalogo se actualiza regularmente con nuevos productos disponibles. 
        Cada articulo incluye fotos, detalles y referencias para que el cliente conozca mejor cada pieza antes de comprar.
      </p>
      <p class="lead">
        Hacemos entregas personales previa coordinacion de encuentro. Envios, pagos y la entrega se coordinan directamente con la tienda.
      </p>
    </header>

    <div class="content-grid">
      <article class="glass-card content-card">
        <h2>Que ofrecemos</h2>
        <p>
          Publicamos productos con detalles visuales, estado del articulo e informacion para que el cliente
          conozca mejor cada articulo antes de comprar.
        </p>
      </article>

      <article class="glass-card content-card">
        <h2>Como trabajamos</h2>
        <p>
          El sitio funciona como un catalogo de venta con solicitud de compra. La confirmacion final del pedido, el
          pago y la entrega se coordinan directamente con la tienda.
        </p>
      </article>

      <article class="glass-card content-card">
        <h2>Cobertura</h2>
        <p>
          Las entregas personales son en la ciudad de Oruro, Bolivia. Se coordinan previamente y la tienda tambien realiza envios a
          nivel nacional.
        </p>
        <p class="support-copy">
          Para envios nacionales, el cliente coordina con la tienda el pago del producto y el costo de envio. La tienda se encarga de
          realizar el envio a traves de una empresa de transporte confiable.
        </p>
      </article>
    </div>

    <article class="glass-card principles-card">
      <h2>Nuestro enfoque</h2>
      <div class="principles-grid">
        <div>
          <strong>Claridad</strong>
          <p>Mostrar productos disponibles y detalles importantes para evitar expectativas equivocadas.</p>
        </div>
        <div>
          <strong>Atencion directa</strong>
          <p>Coordinar cada venta por WhatsApp permite confirmar disponibilidad, entrega y forma de pago antes cerrar la compra.</p>
        </div>
        <div>
          <strong>Presentacion</strong>
          <p>El catalogo esta pensado para que el cliente revise fotos, tallas, condiciones y precios con facilidad.</p>
        </div>
      </div>
    </article>
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

.lead,
.content-card p,
.principles-card p {
  color: var(--text-secondary);
  line-height: 1.7;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.content-card,
.principles-card {
  display: grid;
  gap: 0.85rem;
}

.principles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.principles-grid strong {
  display: inline-block;
  margin-bottom: 0.4rem;
}
</style>
