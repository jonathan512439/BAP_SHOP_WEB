# Planning UX/UI frontend para staging

## Objetivo

Consolidar mejoras visuales y de usabilidad de bajo riesgo en `store` y `admin`, dejando fuera cambios que aumenten complejidad operativa o que requieran rediseño de flujos.

## Estado actual

### Implementado

- `store`: transiciones base y visual mas oscuro.
- `store`: boton flotante de WhatsApp.
- `store`: animacion del carrito al agregar items.
- `store`: buscador en catalogo.
- `store`: skeleton loading en catalogo.
- `store`: timeline en `HowToBuyView`.
- `store`: spotlight de promociones.
- `admin`: busqueda global en topbar.
- `admin`: drag and drop para subida de imagenes.
- `admin`: dashboard con mejor contraste y barras simples.

### Ajustado respecto al plan original

- `Marca` y `Talla` se mantienen como desplegables.
- No se agrega `chart.js`.
- No se agregan acciones en lote ni checkboxes en productos en esta etapa.

## Cambios simples aplicados para prueba en staging

### Store

- Transicion real entre rutas con `transition` en `apps/store/src/App.vue`.
- Accion visual rapida en cards de producto para reforzar acceso al detalle.
- Selects de filtros con estilo mas pulido en tema oscuro.

### Admin

- Seccion ligera de actividad reciente en dashboard con barras CSS puras.
- Correccion de texto roto visible en auditoria reciente.

## Diferido

- Bulk actions en `ProductsView`.
- Checkboxes de seleccion multiple.
- Graficos con dependencia externa.
- Filtros por botones visuales para `Marca` y `Talla`.

## Validacion recomendada en staging

1. Verificar animacion suave al cambiar entre rutas del store.
2. Confirmar que el acceso rapido visual de cada card no rompe navegacion ni carrito.
3. Verificar que los filtros `Marca` y `Talla` siguen funcionando como selects.
4. Revisar dashboard admin en desktop y movil para asegurar legibilidad.
5. Confirmar que no hubo regresion con `pnpm --filter store build` y `pnpm --filter admin build`.
