# Rendimiento y Core Web Vitals

## Objetivo

Medir el rendimiento real del store y evitar regresiones antes de publicar cambios.

Esta fase no depende solo del peso del codigo. El punto critico del sistema son las imagenes de productos servidas desde R2, por eso se revisa:

- Bundles estaticos de store y admin.
- Peso real descargado en catalogo, detalle, carrito y checkout.
- Core Web Vitals en movil.
- Que el cliente reciba variantes optimizadas y no originales pesados.

## Reporte local de bundles

Antes de subir cambios:

```powershell
pnpm build:store
pnpm build:admin
pnpm perf:report
```

Para usarlo como validacion estricta:

```powershell
pnpm perf:report:strict
```

Presupuestos actuales:

- Store JS total: maximo 220 KiB sin gzip.
- Store CSS total: maximo 80 KiB sin gzip.
- Store asset individual: maximo 180 KiB.
- Store dist total: maximo 650 KiB.
- Admin JS total: maximo 350 KiB sin gzip.
- Admin CSS total: maximo 120 KiB sin gzip.
- Admin asset individual: maximo 220 KiB.
- Admin dist total: maximo 900 KiB.

Estos presupuestos miden el build estatico. No incluyen imagenes de productos, video del banner ni respuestas dinamicas de R2.

## Medicion manual en produccion o staging

Usar Chrome DevTools en una ventana limpia:

1. Abrir DevTools.
2. Ir a `Network`.
3. Activar `Disable cache`.
4. Elegir throttling `Fast 4G` o `Slow 4G` para simular movil.
5. Recargar con `Ctrl + F5`.
6. Revisar peso total, imagenes mas pesadas y archivos duplicados.

Rutas a medir:

- `https://bab-shop.com/`
- `https://bab-shop.com/zapatillas`
- Una pagina de detalle de producto real.
- `https://bab-shop.com/checkout` con productos en carrito.
- Equivalentes en staging cuando se pruebe antes de produccion.

## Criterios aceptables

Catalogo:

- No debe descargar imagenes originales de 2 MB a 8 MB.
- Las tarjetas deben usar `card.webp`.
- Cada imagen de tarjeta deberia estar normalmente por debajo de 250 KB.
- El catalogo inicial con 10 productos deberia mantenerse razonablemente por debajo de 3 MB, salvo video/banner o cache fria.

Detalle:

- La imagen principal debe usar `detail.webp`.
- La vista ampliada debe usar `full.webp` solo cuando el usuario abre el visor.
- No deben descargarse todas las imagenes full al entrar al detalle.

Carrito y checkout:

- Deben usar `thumb.webp`.
- No deben volver a descargar imagenes pesadas si ya estan en cache.
- No debe existir doble envio del pedido.

Admin:

- El panel puede ser mas pesado que el store, pero no debe cargar FFmpeg ni optimizadores pesados en pantallas donde no se usan.
- La subida de imagenes puede consumir CPU local del navegador, pero debe terminar generando variantes livianas.

## Lighthouse

Medir con Lighthouse en modo movil:

- Performance.
- Accessibility.
- Best Practices.
- SEO.

Objetivos iniciales:

- Performance movil: 80 o mas.
- Accessibility: 90 o mas.
- Best Practices: 90 o mas.
- SEO: 90 o mas.

Si Performance baja de 80, revisar en este orden:

1. Imagen LCP demasiado pesada.
2. Video del banner cargando demasiado pronto.
3. Catalogo descargando mas de 10 productos visibles.
4. Imagenes `full.webp` cargadas antes de abrir el visor.
5. JavaScript inicial innecesario.
6. Fuentes externas bloqueando render.

## Indicadores de problema

Investigar si DevTools muestra:

- Imagenes de producto mayores a 500 KB en catalogo.
- Imagenes originales `.jpg`, `.jpeg`, `.png` o `.webp` antiguas de varios MB.
- Las mismas imagenes descargadas muchas veces sin cache.
- `full.webp` descargado sin abrir el visor.
- Respuestas 404 desde `/public/catalog`.
- LCP mayor a 2.5 segundos en movil.
- CLS mayor a 0.1.
- INP mayor a 200 ms.

## Acciones correctivas

Si aparecen imagenes pesadas:

1. Confirmar que el producto tenga `thumb_r2_key`, `card_r2_key`, `detail_r2_key` y `full_r2_key`.
2. Regenerar snapshot del producto.
3. Volver a subir la imagen desde admin si el archivo quedo corrupto o perdido.
4. Ejecutar reparadores operativos si el problema es de catalogo o snapshot.

Si el JS crece demasiado:

1. Revisar el reporte `pnpm perf:report`.
2. Identificar el archivo mas pesado.
3. Confirmar que rutas pesadas esten cargadas por lazy loading.
4. Evitar importar librerias pesadas en el entrypoint.

Si el video afecta carga:

1. Mantenerlo sin audio.
2. Usar MP4 optimizado.
3. No usarlo como LCP principal si degrada el primer render.
4. Considerar imagen poster o banner imagen en conexiones lentas.
