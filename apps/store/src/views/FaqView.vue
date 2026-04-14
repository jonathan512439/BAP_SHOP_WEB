<script setup lang="ts">
const faqs = [
  {
    question: '¿Como funciona la compra?',
    answer:
      'Seleccionas los productos, los agregas al carrito y envias tu solicitud. Luego la coordinacion final se realiza por WhatsApp con la tienda.',
  },
  {
    question: '¿El carrito garantiza que el producto ya es mio?',
    answer:
      'No. El carrito solo prepara tu solicitud. La separacion y la confirmacion final dependen de la validacion de la tienda.',
  },
  {
    question: '¿Cuanto tiempo se aparta un producto?',
    answer:
      'La separacion se mantiene por un tiempo limitado definido por la tienda. Si no se confirma la compra, el producto puede volver a mostrarse como disponible.',
  },
  {
    question: '¿Puedo comprar un producto agotado?',
    answer:
      'No. Los productos agotados permanecen visibles para consulta, pero ya no pueden agregarse al carrito ni reservarse.',
  },
  {
    question: '¿Realizan envios?',
    answer: 'Si. Las entregas en Oruro, Bolivia, se coordinan previamente y tambien se realizan envios a nivel nacional.',
  },
  {
    question: '¿El pago se hace dentro del sitio?',
    answer:
      'No. La web no tiene pasarela de pago integrada. La forma de pago se acuerda directamente con la tienda durante la coordinacion final.',
  },
  {
    question: '¿Puedo coordinar la compra por otro medio que no sea WhatsApp?',
    answer:
      'No. Toda la coordinacion final se realiza por WhatsApp con el negocio. Si tienes dudas antes de reservar, tambien puedes revisar las preguntas frecuentes y las politicas comerciales de la tienda.',
  }
]
</script>

<template>
  <section class="info-page">
    <header class="page-hero">
      <p class="eyebrow">Ayuda</p>
      <h1>Preguntas frecuentes</h1>
      <p class="lead">
        Estas respuestas resumen el funcionamiento de la compra, la atencion y la coordinacion comercial de la tienda
        en Oruro - Bolivia.
      </p>
    </header>

    <div class="faq-list">
      <details v-for="item in faqs" :key="item.question" class="glass-card faq-item">
        <summary>{{ item.question }}</summary>
        <p>{{ item.answer }}</p>
      </details>
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
.faq-item p {
  color: var(--text-secondary);
  line-height: 1.7;
}

.faq-list {
  display: grid;
  gap: 1rem;
}

.faq-item {
  display: grid;
  gap: 0.9rem;
}

.faq-item summary {
  cursor: pointer;
  font-weight: 700;
  list-style: none;
}

.faq-item summary::-webkit-details-marker {
  display: none;
}
</style>
