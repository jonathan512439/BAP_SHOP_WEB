<template>
  <div class="help-view">
    <div class="header-actions">
      <h2>Ayuda operativa</h2>
      <p class="header-copy">Guia resumida para usar el panel sin romper el flujo real del negocio.</p>
    </div>

    <div class="help-grid">
      <section class="admin-card">
        <h3>Estados del producto</h3>
        <table>
          <thead>
            <tr>
              <th>Estado</th>
              <th>Descripcion</th>
              <th>Siguiente paso</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Borrador</td>
              <td>No visible en tienda.</td>
              <td>Completar datos e imagen principal antes de activar.</td>
            </tr>
            <tr>
              <td>Activo</td>
              <td>Visible en snapshots publicos.</td>
              <td>Puede ocultarse, reservarse por pedido o venderse.</td>
            </tr>
            <tr>
              <td>Oculto</td>
              <td>No visible pero editable.</td>
              <td>Puede reactivarse o marcarse como vendido.</td>
            </tr>
            <tr>
              <td>Reservado</td>
              <td>Asociado a un pedido pendiente.</td>
              <td>Confirmar venta o cancelar/liberar desde pedidos.</td>
            </tr>
            <tr>
              <td>Vendido</td>
              <td>Estado final.</td>
              <td>Se conserva para historial y auditoria.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="admin-card">
        <h3>Flujo de un pedido</h3>
        <ol class="flow-list">
          <li>La tienda crea el pedido y reserva los productos.</li>
          <li>El cliente abre WhatsApp con el codigo generado.</li>
          <li>En el panel, revisar el detalle del pedido antes de actuar.</li>
          <li>Confirmar venta para pasar productos a `sold` o cancelar para liberarlos.</li>
        </ol>
      </section>

      <section class="admin-card">
        <h3>Gestion de imagenes</h3>
        <ul class="flat-list">
          <li>Formatos aceptados: JPG, PNG y WebP.</li>
          <li>Tamano maximo por imagen: 5MB.</li>
          <li>La activacion exige al menos una imagen principal.</li>
          <li>Si borras la primaria, el backend reasigna otra si existe.</li>
        </ul>
      </section>

      <section class="admin-card">
        <h3>Promociones</h3>
        <ul class="flat-list">
          <li>Solo puede existir una promocion por producto.</li>
          <li>El precio final se recalcula en snapshots y en el checkout.</li>
          <li>Desactivar una promo fuerza rebuild del catalogo.</li>
        </ul>
      </section>

      <section class="admin-card note-card">
        <h3>Nota importante</h3>
        <p>
          El mensaje de WhatsApp puede ser editado por el cliente antes de enviarlo.
          Siempre verifica el pedido por su codigo `BAP-XXXXXXXX` dentro de este panel.
          El panel es la fuente de verdad.
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  margin-bottom: 2rem;
}

.header-actions h2 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
}

.header-copy {
  color: var(--text-secondary);
  margin: 0;
}

.help-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.flow-list,
.flat-list {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--text-secondary);
}

.flow-list li,
.flat-list li {
  margin-bottom: 0.6rem;
}

.note-card {
  border-color: rgba(245, 158, 11, 0.35);
}

.note-card p {
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}
</style>
