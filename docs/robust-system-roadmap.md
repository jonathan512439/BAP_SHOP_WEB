# Roadmap para convertir BAP Shop en un sistema robusto

## Objetivo

Convertir el sistema actual de BAP Shop en una plataforma de venta estable, mantenible y facil de operar en produccion, sin convertirlo todavia en un SaaS multi-tienda.

El foco de este roadmap es reducir fallas, facilitar diagnostico, evitar mantenimientos innecesarios y mantener el codigo limpio, ordenado y sin redundancias.

## Estado actual del software

El proyecto es un monorepo con tres aplicaciones principales:

- `apps/store`: tienda publica hecha con Vue 3, Vite y TypeScript.
- `apps/admin`: panel administrativo hecho con Vue 3, Vite y TypeScript.
- `worker`: backend sobre Cloudflare Workers, usando Hono como framework HTTP.

La infraestructura principal usa servicios de Cloudflare:

- Cloudflare Pages para publicar `store` y `admin`.
- Cloudflare Workers para el API.
- Cloudflare D1 para datos estructurados.
- Cloudflare R2 para archivos, imagenes, snapshots publicos y backups.
- Cloudflare KV para rate limiting.
- Cloudflare Turnstile para proteccion contra bots.

La base de datos no almacena imagenes. D1 guarda datos y rutas/keys. R2 guarda los archivos reales.

## Decisiones tecnicas ya definidas

- No guardar imagenes originales pesadas de forma permanente.
- Procesar imagenes subidas desde el admin y conservar solo variantes optimizadas.
- Usar R2 para imagenes, snapshots y backups.
- Usar D1 solo para datos estructurados.
- No usar Cloudflare Images por ahora.
- Mantener Cloudflare Images como opcion futura si el volumen o la complejidad lo justifican.
- Los backups deben tener politica de retencion para evitar crecimiento innecesario.
- Todo script critico debe ser idempotente y soportar `--dry-run` cuando aplique.
- No tocar produccion sin backup previo o rollback claro.
- No mezclar refactors grandes con cambios funcionales sensibles.

## Politica de imagenes

Escenario objetivo inicial:

- 300 productos.
- 5 imagenes promedio por producto.
- 1500 imagenes aproximadas.
- Cada imagen original puede venir desde iPhone y pesar entre 2 MB y 8 MB.

Politica definida:

- El admin puede subir imagenes pesadas.
- El sistema debe generar variantes optimizadas.
- Las variantes esperadas son:
  - `thumb.webp`
  - `card.webp`
  - `detail.webp`
  - `full.webp`
- El cliente no debe cargar originales pesados.
- El catalogo debe usar `card.webp`.
- Carrito y elementos pequenos deben usar `thumb.webp`.
- La pagina de detalle debe usar `detail.webp`.
- El visor ampliado debe usar `full.webp`.
- El original pesado debe descartarse despues de generar variantes, salvo que exista una razon tecnica futura para conservarlo.
- Durante la migracion de imagenes antiguas pueden quedar originales pesados no referenciados en R2. No deben borrarse hasta verificar `pending = 0`, confirmar snapshots correctos y tener backup/rollback claro.
- Cuando la migracion quede estable, se debe crear un script seguro con `--dry-run` para detectar y eventualmente limpiar originales antiguos huerfanos.

Cloudflare Images no es necesario para este volumen porque R2 mas variantes WebP propias cubre el caso actual. Se reevaluara si el catalogo crece fuertemente, si se necesitan muchos tamanos dinamicos o si el mantenimiento de la optimizacion propia deja de ser conveniente.

## Politica de backups

Los backups no deben duplicarse dentro de D1.

Destino correcto:

- R2 para backups automaticos.
- Export local solo para emergencias o migraciones manuales.

Retencion sugerida:

- Backups diarios: conservar 7 dias.
- Backups semanales: conservar 4 semanas.
- Backups mensuales: opcional, solo si el negocio lo requiere.

Los backups deben incluir:

- Productos.
- Marcas.
- Modelos.
- Pedidos.
- Ajustes.
- Promociones.
- Auditoria.
- Datos necesarios para reconstruir snapshots.

Las imagenes viven en R2. No deben duplicarse innecesariamente en cada backup de D1.

## Reglas generales de implementacion

- Cada fase debe tener pruebas manuales claras.
- Cada cambio debe poder revertirse o repararse.
- Cada migracion de D1 debe ser versionada.
- No ejecutar scripts destructivos sin backup previo.
- No almacenar secretos en el repositorio.
- No dejar codigo muerto, duplicado o temporal.
- No introducir dependencias grandes sin justificacion.
- Mantener funciones pequenas y responsabilidades separadas.
- Centralizar helpers reutilizables para evitar redundancia.
- Documentar comandos operativos importantes.

## Fase 0: cerrar optimizacion de imagenes

Estado: completada funcionalmente.

Prioridad: necesaria.

Objetivo:

Terminar la migracion de imagenes existentes y asegurar que las futuras imagenes se suban optimizadas.

Tareas de codigo:

- Confirmar que todas las imagenes existentes tienen `thumb_r2_key`, `card_r2_key`, `detail_r2_key` y `full_r2_key`.
- Confirmar que el store usa la variante correcta por contexto.
- Confirmar que el admin genera variantes antes de subir nuevas imagenes.
- Confirmar que el Worker rechaza uploads invalidos o incompletos.
- Revisar o retirar el flujo legacy de subida directa sin variantes para evitar que futuras imagenes queden como originales pesados.
- Mantener script de migracion/reparacion de imagenes.
- Mantener opcion para refrescar snapshots de un producto especifico.
- El script debe mostrar el total real de imagenes pendientes y el tamano del lote actual por separado.
- Las subidas a R2 y descargas de assets deben tener reintentos automaticos para tolerar fallas temporales de red.

Pasos Cloudflare:

- Revisar en R2 que existan rutas `public/products/{productId}/{imageId}/thumb.webp`.
- Revisar en R2 que existan rutas `card.webp`, `detail.webp` y `full.webp`.
- Ejecutar consulta en D1 para confirmar pendientes.

Consulta:

```sql
SELECT COUNT(*) AS pending
FROM product_images
WHERE thumb_r2_key IS NULL
   OR card_r2_key IS NULL
   OR detail_r2_key IS NULL
   OR full_r2_key IS NULL;
```

Criterio de cierre:

- `pending = 0`.
- DevTools ya no muestra imagenes de 3 MB a 8 MB en catalogo.
- Nuevas subidas desde admin quedan optimizadas.
- Las imagenes rotas puntuales se repararan volviendolas a subir desde admin; no bloquean el cierre de la fase si `pending = 0` y la subida nueva genera variantes.




## Fase 1: backups y recuperacion

Estado: completada funcionalmente.

Prioridad: necesaria.

Objetivo:

Poder recuperar el sistema si una migracion, despliegue o accion admin genera un problema.

Tareas de codigo:

- Crear o documentar script de export de D1.
- Crear o documentar script de backup hacia R2.
- Crear script o procedimiento de limpieza de backups antiguos.
- Documentar restauracion basica.
- Probar al menos una restauracion en staging cuando exista.

Pasos Cloudflare:

- Revisar D1 Time Travel si el plan lo permite.
- Crear carpeta `backups/` en R2.
- Confirmar que R2 no tiene escritura publica.
- Definir retencion de backups.

Criterio de cierre:

- Existe backup recuperable.
- Existe politica de retencion.
- Existe procedimiento documentado de restauracion.

Resultado implementado:

- Backup automatico semanal mejorado en `worker/src/cron.ts`.
- Logica reusable de backup y retencion en `worker/src/lib/backups.ts`.
- Backup manual disponible con `pnpm --filter worker backup:d1`.
- Documentacion operativa creada en `docs/operations/backups.md`.
- Los backups se guardan en `backups/d1/`.
- El backup no duplica imagenes reales; solo conserva rutas/keys.
- Los hashes de contrasena de admins se omiten del backup operativo.
- Backup real verificado en R2: `backups/d1/2026-04-19T09-10-32-559Z.json`.

Planning de implementacion:

1. Revisar backup semanal existente en `worker/src/cron.ts`.
2. Mantener backups en R2 bajo una ruta clara, por ejemplo `backups/d1/YYYY-MM-DD.json`.
3. Agregar metadata minima al backup: version, fecha, entorno, tablas incluidas y conteo de filas por tabla.
4. Evitar duplicar imagenes en el backup de D1; solo se guardan rutas/keys.
5. Definir si `admins` se incluye completo o si se enmascara. Si se incluye, R2 debe mantenerse privado estrictamente.
6. Agregar limpieza por retencion:
   - diarios: 7 dias.
   - semanales: 4 semanas.
   - mensuales: opcional.
7. Crear script manual para generar backup bajo demanda antes de despliegues importantes.
8. Crear script o comando de verificacion para listar backups disponibles.
9. Documentar restauracion basica en `docs/operations/backups.md`.
10. Probar al menos un backup generado y verificar que el JSON sea valido.

## Fase 2: seguridad de Pages y dominios

Prioridad: necesaria.

Objetivo:

Aplicar seguridad no solo al Worker, sino tambien a los sitios publicados en Cloudflare Pages.

Estado actual:

- Completada y validada en produccion.
- Store, admin, API, Turnstile, imagenes, logo y branding funcionan con CSP activa.

Tareas de codigo:

- Agregar `_headers` para `apps/store`.
- Agregar `_headers` para `apps/admin`.
- Configurar CSP para store.
- Configurar CSP para admin.
- Configurar HSTS, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`.
- Validar que Turnstile, API e imagenes sigan funcionando.

Pasos Cloudflare:

- Desplegar store.
- Verificar headers en `https://bab-shop.com`.
- Desplegar admin.
- Verificar headers en `https://admin.bab-shop.com`.
- Revisar consola para errores CSP.

Criterio de cierre:

- Store funciona sin errores CSP.
- Admin funciona sin errores CSP.
- Login admin funciona.
- Turnstile funciona.
- Imagenes cargan correctamente.

## Fase 3: WAF y rate limiting

Prioridad: necesaria para produccion publica.

Objetivo:

Reducir abuso, fuerza bruta y trafico automatizado antes de que llegue al Worker.

Estado actual:

- Completada.
- Implementada en codigo mediante presets centralizados de rate limiting.
- En Cloudflare Free se configuro la regla WAF externa disponible para proteger el login admin.
- Las rutas restantes quedan protegidas por rate limiting interno del Worker, Turnstile, CSRF y autenticacion por sesion.
- Procedimiento documentado en `docs/security-waf-rate-limiting.md`.

Tareas de codigo:

- Revisar rate limits existentes.
- Agregar rate limit a mutaciones admin sensibles.
- Centralizar configuraciones de rate limit.
- Evitar duplicar reglas por ruta.

Pasos Cloudflare:

- Crear regla WAF para `/auth/login`.
- En plan Free, si Cloudflare no permite mas reglas, mantener solo `/auth/login` como regla externa prioritaria.
- Las protecciones para `/orders` y `/admin` se mantienen desde el Worker con rate limiting interno.
- Usar challenge o rate limit moderado.
- No bloquear usuarios reales.

Criterio de cierre:

- Login normal funciona.
- Checkout normal funciona.
- Mutaciones admin funcionan.
- Trafico sospechoso queda limitado o desafiado.

## Fase 4: observabilidad y logs

Prioridad: necesaria.

Objetivo:

Hacer que los errores sean faciles de encontrar, entender y corregir.

Estado actual:

- Completada.
- Implementada en codigo y validada en produccion desde Cloudflare Workers Logs/Analytics.
- El Worker agrega `X-Request-Id` a las respuestas.
- Los errores 404 y 500 devuelven `requestId` para diagnostico.
- Las peticiones relevantes se registran con logs JSON estructurados.
- Los crons importantes registran eventos estructurados.
- No se registran cuerpos de requests, cookies, tokens, secretos ni contrasenas.

Tareas de codigo:

- Mejorar logs estructurados.
- Incluir `requestId`, metodo, ruta, estado, duracion y tipo de error.
- No loguear secretos ni datos sensibles.
- Normalizar errores conocidos.
- Mantener auditoria admin completa.

Pasos Cloudflare:

- Revisar logs del Worker.
- Revisar analytics de Workers.
- Revisar errores 5xx.
- Revisar uso de D1, R2 y KV.
- Configurar alertas si el plan lo permite.

Criterio de cierre:

- Cada error importante tiene `requestId`.
- Los logs permiten ubicar ruta y causa probable.
- No se exponen datos sensibles.

## Fase 5: CI/CD

Prioridad: necesaria para robustez real.

Objetivo:

Evitar que codigo roto llegue a produccion.

Estado actual:

- Completada.
- Implementada en codigo y validada en GitHub Actions.
- Proteccion de rama `main` configurada con validacion obligatoria.
- Secretos de GitHub configurados para despliegue manual del Worker.
- Procedimiento documentado en `docs/deployment/ci-cd.md`.
- Workflow `CI` valida typecheck, tests y builds de store, admin y worker.
- Workflow `Deploy Worker` permite despliegue manual validado hacia produccion.

Tareas de codigo:

- Crear workflow de CI.
- Ejecutar typecheck.
- Ejecutar tests.
- Ejecutar build de store.
- Ejecutar build de admin.
- Ejecutar typecheck/build de worker.
- Bloquear deploy si falla la validacion.

Comandos base:

```powershell
pnpm --filter worker exec tsc --noEmit
pnpm --filter admin build
pnpm --filter store build
pnpm --filter worker test
```

Pasos Cloudflare:

- Conectar Pages al repositorio si aplica.
- Configurar variables de entorno de Pages.
- Confirmar branch de produccion.
- Evitar despliegues automaticos desde ramas incorrectas.

Criterio de cierre:

- Un commit roto no despliega.
- El build es repetible.
- Produccion depende de validacion exitosa.

## Fase 6: staging

Prioridad: muy recomendable; necesaria para cambios grandes.

Objetivo:

Probar cambios importantes fuera de produccion.

Estado actual:

- Completada.
- Recursos reales de Cloudflare staging creados y validados.
- `env.staging` configurado en `worker/wrangler.jsonc` con D1, R2 y KV propios.
- Procedimiento documentado en `docs/deployment/staging.md`.
- CORS y cookies ya diferencian `development`, `staging` y `production`.
- CSP de store/admin ya permite `https://api-staging.bab-shop.com`.
- `api-staging.bab-shop.com`, `staging.bab-shop.com` y `admin-staging.bab-shop.com` funcionan.
- Staging no usa cron triggers automaticos por limite del plan Free; se valida manualmente o mediante acciones admin.

Tareas de codigo:

- Agregar entorno `staging` en `wrangler.jsonc`.
- Evitar dominios hardcodeados.
- Documentar variables de entorno.
- Preparar configuracion de store/admin para API staging.

Pasos Cloudflare:

- Crear D1 staging.
- Crear R2 staging.
- Crear KV staging.
- Crear secretos staging.
- Crear dominios o subdominios staging.
- Ejecutar migraciones en staging.
- Cargar datos de prueba.

Criterio de cierre:

- Store staging carga.
- Admin staging permite login.
- Se puede crear producto de prueba.
- Se puede hacer checkout de prueba.
- Nada toca produccion.

## Fase 7: auditoria y consistencia de backend

Prioridad: necesaria.

Objetivo:

Evitar estados inconsistentes y acciones admin invisibles.

Tareas de codigo:

- Auditar todas las rutas `POST`, `PATCH`, `PUT` y `DELETE`.
- Confirmar auth en rutas admin.
- Confirmar CSRF en mutaciones admin.
- Confirmar validacion estricta.
- Confirmar auditoria en acciones importantes.
- Revisar flujo `active`, `reserved`, `sold`, `hidden`.
- Revisar cancelacion, expiracion y confirmacion de pedidos.

Criterio de cierre:

- No hay mutaciones admin sin auth.
- No hay mutaciones admin sin CSRF.
- No hay mutaciones importantes sin auditoria.
- Los errores de negocio son claros.

Estado: completada en codigo y validada con tests locales.

Cambios aplicados:

- Se bloqueo la subida directa legacy de imagenes sin variantes optimizadas.
- Se agrego auditoria para orden de productos, cambio de imagen principal y orden de imagenes.
- Se valido que el ordenamiento de imagenes no reciba duplicados ni imagenes ajenas al producto.
- Se reforzo la transicion de pedidos usando `VALID_ORDER_TRANSITIONS`.
- Se bloqueo cancelar pedidos confirmados para no reactivar productos vendidos.
- Al confirmar o cancelar pedidos, solo se actualizan productos reservados por ese mismo pedido.

Validaciones:

- `pnpm --filter worker exec tsc --noEmit`: OK.
- `pnpm --filter worker test`: OK, 53 tests.

## Fase 8: reparadores operativos

Prioridad: muy recomendable.

Objetivo:

Corregir problemas futuros sin editar manualmente D1 o R2.

Scripts o acciones sugeridas:

- Verificar imagenes faltantes.
- Verificar snapshots desactualizados.
- Regenerar snapshot de un producto.
- Regenerar catalogo completo.
- Liberar reservas expiradas.
- Verificar pedidos inconsistentes.
- Exportar estado de salud.

Reglas:

- Soportar `--dry-run` cuando aplique.
- Ser idempotentes.
- No borrar datos sin confirmacion.
- Imprimir resultados claros.

Criterio de cierre:

- Se puede reparar catalogo sin tocar R2 manualmente.
- Se puede diagnosticar inconsistencia sin editar D1 directamente.

Estado: completada en codigo y documentada.

Cambios aplicados:

- Se agrego `pnpm --filter worker ops:health` para diagnostico read-only de D1/R2.
- Se agrego `pnpm --filter worker ops:repair` para reparaciones controladas con `--dry-run`.
- El diagnostico revisa imagenes con variantes faltantes, productos visibles sin imagen principal, pedidos vencidos, reservas inconsistentes, items de pedidos pendientes mal reservados y snapshots publicos faltantes.
- El reparador puede expirar reservas vencidas, liberar reservas inconsistentes, marcar catalogo como pendiente y reconstruir snapshots publicos.
- Se documento el procedimiento en `docs/operations/repair-tools.md`.

Validaciones:

- `node --check worker/scripts/ops-health-check.mjs`: OK.
- `node --check worker/scripts/ops-repair.mjs`: OK.
- `pnpm --filter worker exec tsc --noEmit`: OK.
- `pnpm --filter worker test`: OK, 53 tests.

## Fase 9: UX de fallos y conectividad

Prioridad: necesaria en flujos criticos.

Objetivo:

Evitar confusion del cliente y del admin cuando algo falla.

Tareas de codigo:

- Bloquear botones criticos durante envios.
- Mostrar loaders claros.
- Evitar doble envio de checkout.
- Evitar doble guardado admin.
- Detectar conexion offline.
- Mostrar errores entendibles.
- Agregar reintento donde tenga sentido.

Criterio de cierre:

- No se crean pedidos duplicados por doble click.
- El admin sabe si una accion fallo.
- El cliente sabe si debe reintentar.

Estado: completada en codigo y validada localmente.

Cambios aplicados:

- Se agrego deteccion de conectividad en store y admin.
- Se agrego aviso global cuando el usuario pierde conexion.
- El checkout bloquea el envio del pedido si ya esta enviando o si el cliente esta offline.
- El formulario de productos bloquea guardado y subida de imagenes cuando el admin esta offline.
- El cliente API del admin traduce fallos de red a mensajes entendibles, sin exponer errores tecnicos.
- Se reforzo `useOrder` para evitar doble envio y mostrar errores claros ante perdida de conexion.

Validaciones:

- `pnpm typecheck:store`: OK.
- `pnpm typecheck:admin`: OK.
- `pnpm test:store`: OK, 17 tests.
- `pnpm test:admin`: OK, 6 tests.
- `pnpm build:store`: OK.
- `pnpm build:admin`: OK.

## Fase 10: rendimiento medido

Prioridad: necesaria despues de cerrar imagenes.

Objetivo:

Validar rendimiento real en produccion.

Tareas:

- Medir Lighthouse movil.
- Medir DevTools Network.
- Revisar LCP.
- Revisar CLS.
- Revisar INP.
- Revisar peso total del catalogo.
- Revisar comportamiento en detalle, carrito y checkout.

Criterio de cierre:

- Catalogo no descarga imagenes pesadas.
- LCP movil es aceptable.
- No hay saltos visuales graves.
- El sitio se siente fluido en movil.

Estado: completada como control local de rendimiento; pendiente repetir Lighthouse/DevTools en staging o produccion despues de desplegar.

Cambios aplicados:

- Se agrego reporte estatico de rendimiento con `pnpm perf:report`.
- Se agrego modo estricto con `pnpm perf:report:strict`.
- Se documentaron presupuestos de bundles para store y admin.
- Se documento el procedimiento manual para medir catalogo, detalle, carrito y checkout con DevTools.
- Se documento como revisar LCP, CLS, INP e imagenes pesadas.

Resultado local actual:

- Store dist total: 218.8 KiB raw / 76.6 KiB gzip estimado.
- Store JS total: 158.9 KiB raw / 62.1 KiB gzip estimado.
- Store CSS total: 35.4 KiB raw / 10.2 KiB gzip estimado.
- Admin dist total: 249.8 KiB raw / 94.1 KiB gzip estimado.
- Admin JS total: 211.1 KiB raw / 81.1 KiB gzip estimado.
- Admin CSS total: 35.3 KiB raw / 11.4 KiB gzip estimado.

Validaciones:

- `node --check scripts/performance-report.mjs`: OK.
- `pnpm perf:report`: OK, presupuestos estaticos sin advertencias.
- `pnpm perf:report:strict`: OK.

## Fase 11: documentacion operativa

Prioridad: necesaria para mantenimiento bajo.

Documentos sugeridos:

- `docs/architecture.md`
- `docs/deployment/cloudflare.md`
- `docs/deployment/staging.md`
- `docs/operations/backups.md`
- `docs/operations/image-migration.md`
- `docs/operations/catalog-rebuild.md`
- `docs/security.md`
- `docs/troubleshooting.md`

Criterio de cierre:

- Otra persona tecnica puede entender como desplegar, diagnosticar y reparar el sistema.

Estado: completada.

Documentos disponibles:

- `docs/architecture.md`: arquitectura general, componentes, entornos, D1, R2, snapshots y seguridad base.
- `docs/deployment/cloudflare.md`: despliegue de Worker, Pages, variables, secretos, migraciones, rollback y validacion.
- `docs/deployment/ci-cd.md`: workflows, secretos GitHub, proteccion de rama y despliegue manual.
- `docs/deployment/staging.md`: configuracion completa de staging.
- `docs/operations/backups.md`: backups, retencion y restauracion basica.
- `docs/operations/image-migration.md`: migracion, reintentos, refresco de snapshots e imagenes rotas.
- `docs/operations/catalog-rebuild.md`: reconstruccion de catalogo publico y validacion de snapshots.
- `docs/operations/repair-tools.md`: reparadores operativos.
- `docs/operations/performance.md`: presupuestos, Lighthouse, DevTools y Core Web Vitals.
- `docs/security.md`: autenticacion, CSRF, CORS, cookies, headers, rate limiting y reglas operativas.
- `docs/security-waf-rate-limiting.md`: reglas WAF y rate limiting.
- `docs/troubleshooting.md`: diagnostico de fallos frecuentes.

## Fase 12: hardening final post-auditoria externa

Prioridad: necesaria antes de cerrar robustez en produccion.

Objetivo:

Corregir los puntos criticos reales detectados en la revision externa, descartando falsos positivos y cerrando brechas de seguridad, resiliencia y UX sin introducir regresiones.

Tareas de codigo:

- Reducir sensibilidad de sesion admin por IP en `authMiddleware` para evitar cierres de sesion legitimos en redes moviles/Apple.
- Agregar rate limiting a `GET /auth/me`.
- Validar firma/magic-bytes real de archivos subidos (no solo MIME declarado) para variantes WebP y branding.
- Agregar timeout con `AbortController` en cliente admin/store para requests criticos.
- Reemplazar `alert()` por modales/toasts consistentes en admin.
- Agregar validacion estricta de URLs sociales/banner en settings (https y formato URL valido).
- Agregar endpoint de salud de dependencias (`/health/deps`) con chequeo basico de D1, R2 y KV.
- Mejorar observabilidad de Turnstile: log de causa cuando falle validacion.
- Agregar paginacion backend para `GET /admin/brands` y `GET /admin/models`.
- Preparar idempotencia para `POST /orders` (header `Idempotency-Key` + almacenamiento temporal).

Tareas de arquitectura y operacion:

- Definir politica de binding de IP de sesion por entorno (`strict`/`subnet`/`off`) y documentarla.
- Mantener fallback de assets en staging solo para pruebas; en produccion no debe existir fallback cruzado.
- Validar limites efectivos de rate limit por endpoint y ajustarlos con trafico real.

Criterio de cierre:

- Login/admin no pierde sesion por cambios normales de red.
- `auth/me`, login, mutaciones y checkout tienen limite de abuso consistente.
- Uploads rechazan archivos con contenido invalido aunque el MIME sea correcto.
- Admin/store muestran errores de red con timeout controlado y sin bloqueos por `alert()`.
- Settings no aceptan URLs invalidas en campos de branding/redes.
- Existe chequeo de salud de dependencias y se puede diagnosticar degradacion real.
- Brands/models soportan crecimiento sin cargar listados completos en una sola respuesta.
- Checkout soporta clave de idempotencia para evitar duplicados por reintento de red.

Notas de alcance:

- Se mantienen fuera de esta fase los puntos clasificados como falsos positivos o no aplicables:
  - SQL injection por `LIKE` con placeholders.
  - Cache-Control ausente en assets publicos.
  - Falta de redaccion de secretos en logs.
  - Riesgo de stock negativo (modelo actual: 1 producto = 1 unidad).

Estado: completada en codigo y validada localmente.

Cambios aplicados:

- Sesiones admin con politica de IP configurable (`SESSION_IP_MODE`) y modo recomendado `subnet` para evitar cierres por cambios legitimos de red.
- `GET /auth/me` protegido con rate limiting dedicado.
- Validacion por firma real de archivo para uploads de variantes WebP y branding (no solo MIME declarado).
- Checkout con idempotencia por `Idempotency-Key` para evitar pedidos duplicados por reintentos de red.
- `POST /orders` conserva replay seguro cuando ya existe resultado exitoso para la misma clave.
- Cliente admin y store con timeout de requests usando `AbortController`.
- Reemplazo de `alert()` por modales consistentes en auditoria y promociones.
- Validacion estricta de URLs HTTPS en ajustes sociales/branding.
- Nuevo endpoint `GET /health/deps` con chequeo de D1, KV y R2.
- Logging de fallas de Turnstile con `requestId` y causa.
- Soporte de paginacion backend en `GET /admin/brands` y `GET /admin/models` mediante `page` y `limit`.

Validaciones ejecutadas:

- `pnpm typecheck`: OK.
- `pnpm test:worker`: OK, 53 tests.
- `pnpm test:admin`: OK, 6 tests.
- `pnpm test:store`: OK, 17 tests.
- `pnpm build:admin`: OK.
- `pnpm build:store`: OK (con aviso esperado del generador SEO cuando no responde el fetch dinamico).

## Cloudflare Images: decision actual

No se usara Cloudflare Images por ahora.

Motivos:

- El volumen objetivo inicial es manejable con R2.
- Ya existe generacion propia de variantes WebP.
- R2 es adecuado para almacenar archivos optimizados.
- El cliente solo debe recibir variantes livianas.
- Cloudflare Images puede agregarse en el futuro si el volumen o la complejidad lo justifican.

Reevaluar Cloudflare Images si:

- El catalogo supera ampliamente 1000 a 2000 productos.
- La app movil requiere muchos tamanos adicionales.
- Se necesita AVIF/format auto sin mantener logica propia.
- El mantenimiento de scripts de imagenes empieza a ser costoso.
- El negocio ya justifica infraestructura de pago adicional.

## Orden de implementacion recomendado

1. Cerrar imagenes.
2. Backups y retencion.
3. Headers de seguridad en Pages.
4. Observabilidad y logs.
5. CI/CD.
6. Staging.
7. Auditoria y consistencia backend.
8. Reparadores operativos.
9. UX de fallos.
10. Rendimiento medido.
11. Documentacion operativa.
12. Hardening final post-auditoria externa.

## Estado de avance

- [x] Fase 0: cerrar optimizacion de imagenes.
- [x] Fase 1: backups y recuperacion.
- [x] Fase 2: seguridad de Pages y dominios.
- [x] Fase 3: WAF y rate limiting.
- [x] Fase 4: observabilidad y logs.
- [x] Fase 5: CI/CD.
- [x] Fase 6: staging.
- [x] Fase 7: auditoria y consistencia backend.
- [x] Fase 8: reparadores operativos.
- [x] Fase 9: UX de fallos y conectividad.
- [x] Fase 10: rendimiento medido.
- [x] Fase 11: documentacion operativa.
- [x] Fase 12: hardening final post-auditoria externa.

## Revision de cambios locales antes de produccion - 2026-04-19

Esta revision resume el estado de los cambios locales detectados antes de subirlos a produccion.

Validaciones ejecutadas:

- `pnpm --filter worker exec tsc --noEmit`: OK.
- `pnpm --filter admin build`: OK.
- `pnpm --filter store build`: OK.

### Puntos ya cubiertos o avanzados

- Fase 0: la migracion de imagenes ya soporta variantes `thumb`, `card`, `detail` y `full`.
- Fase 0: el admin genera variantes optimizadas antes de subir nuevas imagenes.
- Fase 0: el Worker valida que las variantes WebP existan y no excedan limites definidos.
- Fase 0: el script de migracion muestra total pendiente real, lote actual y reintentos.
- Fase 0: el store usa variantes por contexto en catalogo, detalle, carrito y checkout.
- Fase 0: se agrego paginacion numerica en store y admin.
- Fase 1: el cron de backup fue ampliado para incluir mas tablas.
- Fase 2: existen `_headers` para store y admin con headers basicos de seguridad y CSP restrictiva.
- Fase 3: se agregaron presets centralizados de rate limiting para login, pedidos, cambio de contrasena y mutaciones admin; en Cloudflare Free se priorizo WAF externo para login admin.
- Fase 4: se centralizo Turnstile en `worker/src/lib/turnstile.ts`.
- Fase 4: se centralizo acceso a settings en `worker/src/lib/settings.ts`.
- Fase 4: se agrego handler global de errores Vue en admin.
- Fase 7: se agrego validacion de parametros UUID en rutas admin.
- Fase 7: se bloqueo la subida directa legacy sin variantes y se reforzo auditoria/consistencia en productos, imagenes y pedidos.
- Fase 8: se agrego `markCatalogDirty()` para diferir rebuilds de catalogo.
- Limpieza: se eliminaron archivos temporales o sensibles que no deben vivir en el repo.

### Riesgos detectados antes de desplegar

- Riesgo alto: el `authMiddleware` valida la IP de la sesion admin. Esto puede romper sesiones legitimas en Apple Private Relay, redes moviles, VPN, Wi-Fi con IP cambiante o navegadores con privacidad agresiva. No desplegar asi sin hacerlo opcional o menos estricto.
- Riesgo alto: `markCatalogDirty()` difiere el rebuild del catalogo hasta el cron `*/5`. Para cambios admin puede ser aceptable, pero para checkout/reserva puede dejar el catalogo publico stale hasta 5 minutos. Esto puede confundir clientes y permitir que vean productos ya reservados como disponibles.
- Riesgo medio-alto: el comentario de `catalog-dirty.ts` indica cron cada 2 minutos, pero `wrangler.jsonc` ejecuta `*/5`. Hay inconsistencia documental/operativa.
- Riesgo medio: los backups incluyen usuarios admin, pero omiten hashes de contrasena. El bucket R2 de backups debe mantenerse privado y con retencion definida.
- Riesgo medio: la CSP de Pages ya fue agregada, pero todavia debe validarse en produccion con Turnstile, API, imagenes, video y FFmpeg del admin.
- Riesgo resuelto: el flujo legacy de subida directa sin variantes quedo bloqueado en el backend.
- Riesgo medio: el sitemap contiene muchas URLs de productos generadas estaticamente. Hay que asegurar que no incluya productos ocultos, eliminados o no publicos.
- Riesgo medio: `VALID_STATUS_TRANSITIONS.sold = []` vuelve `sold` terminal. Esto protege historial, pero impide ocultar un producto vendido si el negocio necesita retirarlo del catalogo sin borrarlo.
- Riesgo bajo: se importo `validateUuidParams` en `worker/src/index.ts`, pero no se usa ahi. No rompe build, pero conviene limpiar imports no usados si se activa `noUnusedLocals`.

### Planning actualizado antes de subir estos cambios

1. Mantener los cambios de imagenes, paginacion, validacion de variantes y script de migracion.
2. Ajustar o revertir la validacion estricta por IP en sesiones admin. Recomendado: convertirla en auditoria/log de sospecha o hacerla configurable por variable de entorno.
3. No diferir el rebuild del catalogo en checkout/pedidos, o reducir el tiempo de actualizacion. Recomendado: mantener rebuild inmediato para reservas/pedidos y usar dirty flag solo para cambios admin no urgentes.
4. Corregir inconsistencia del cron: documentar `*/5` o cambiar a una frecuencia definida conscientemente.
5. Completar `_headers` con CSP real para store y admin, probando Turnstile, API e imagenes.
6. Definir si `sold` debe ser terminal absoluto o si se permite `sold -> hidden` para quitar vendidos del catalogo manteniendo historial.
7. Validar en staging que el panel admin siga subiendo imagenes mediante variantes WebP optimizadas.
8. Asegurar que backups de R2 sean privados y tengan retencion. Evaluar si `admins` debe exportarse completo o si debe omitirse/enmascararse.
9. Revisar sitemap generado y confirmar que solo incluya rutas publicas validas.
10. Ejecutar pruebas manuales completas en local o staging antes de produccion: login admin, subida de imagen, activar producto, catalogo, detalle, carrito, checkout, reserva, confirmacion/cancelacion.
11. Repetir validaciones: worker typecheck, admin build, store build y tests criticos del worker.
12. Solo despues de estos ajustes, desplegar primero Worker, luego admin/store, y verificar produccion con DevTools.

## Cierre operativo final - 2026-04-24

Estado general:

- Roadmap de robustez completado hasta Fase 12.
- Validacion tecnica local completa en verde:
  - `pnpm validate`
  - `pnpm build:store`
  - `pnpm build:admin`
  - `pnpm build:worker`

Acciones ejecutadas:

- Backup previo de produccion creado en R2:
  - `backups/d1/2026-04-24T02-39-57-376Z.json`
- Deploy Worker staging:
  - Version ID: `f09105f5-d629-494a-8d4d-557233dc291f`
- Deploy Worker produccion:
  - Version ID: `6bdd3bf8-610a-4b72-9b51-52936f93a247`

Smoke tests HTTP realizados:

- Staging:
  - `https://api-staging.bab-shop.com/health` -> 200
  - `https://api-staging.bab-shop.com/health/deps` -> 200
  - `https://api-staging.bab-shop.com/settings/public` -> 200
  - `https://api-staging.bab-shop.com/public/catalog/index.json` -> 200
  - `https://staging.bab-shop.com` -> 200
  - `https://admin-staging.bab-shop.com` -> 200
- Produccion:
  - `https://api.bab-shop.com/health` -> 200
  - `https://api.bab-shop.com/health/deps` -> 200
  - `https://api.bab-shop.com/settings/public` -> 200
  - `https://api.bab-shop.com/public/catalog/index.json` -> 200
  - `https://bab-shop.com` -> 200
  - `https://bab-shop.com/zapatillas` -> 200
  - `https://bab-shop.com/checkout` -> 200
  - `https://admin.bab-shop.com` -> 200

Observacion final:

- El warning SEO de `generate-seo-assets.mjs` en build de store no bloquea compilacion ni despliegue.
