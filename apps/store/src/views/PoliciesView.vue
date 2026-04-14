<template>
  <section class="info-page">
    <header class="page-hero">
      <p class="eyebrow">Politicas</p>
      <h1>Politicas y condiciones comerciales</h1>
      <p class="lead">
        Estas condiciones resumen como funciona la compra, la separacion temporal de productos y la coordinacion
        comercial de la tienda en Oruro - Bolivia.
      </p>
    </header>

    <div class="policy-grid">
      <article class="glass-card policy-card">
        <h2>Disponibilidad</h2>
        <p>
          La tienda muestra productos disponibles y ya vendidos. La disponibilidad final siempre se valida al momento
          de confirmar la compra con el negocio.
        </p>
      </article>

      <article class="glass-card policy-card">
        <h2>Reserva temporal</h2>
        <p>
          Cuando un cliente envia su solicitud, el producto puede apartarse por un tiempo limitado. Si la compra no se
          confirma, vuelve a aparecer como disponible.
        </p>
      </article>

      <article class="glass-card policy-card">
        <h2>Pagos</h2>
        <p>
          El sitio no cobra en linea. La forma de pago se acuerda directamente con la tienda durante la coordinacion
          final del pedido.
        </p>
      </article>

      <article class="glass-card policy-card">
        <h2>Entregas y envios</h2>
        <p>
          Las entregas en la ciudad de Oruro, Bolivia, se realizan con previa coordinacion. Tambien se atienden envios
          a nivel nacional segun la coordinacion con el cliente.
        </p>
      </article>

      <article class="glass-card policy-card">
        <h2>Informacion del producto</h2>
        <p>
          Las fotos, tallas, condiciones y descripciones buscan representar cada articulo con la mayor claridad posible
          antes de la compra. Por eso, es importante revisar cada detalle antes de reservar y coordinar con la tienda cualquier duda que pueda surgir.
        </p>
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

.lead,
.policy-card p {
  color: var(--text-secondary);
  line-height: 1.7;
}

.policy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.policy-card {
  display: grid;
  gap: 0.8rem;
}
</style>
