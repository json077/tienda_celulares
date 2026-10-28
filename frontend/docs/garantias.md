# Garantías y reclamos

## Inspección y alcance

Estado inicial de `git status --short`: limpio. La navegación ya incluía `/garantias`, pero routes.js lo resolvía a ModulePlaceholder. No existían componentes, servicio ni pruebas parciales de Garantías.

Se revisaron warrantyRoutes, warrantyController, warrantyValidator, warrantyService y warrantyRepository; integración de app.js; autenticación/RBAC; consultas de ventas/facturas y vínculo detalle_venta_unidades; esquema SQL archivado; rutas, navegación y patrones CoreUI de los módulos validados. No se modificaron backend, BD, dependencias ni módulos validados. Las pruebas no acceden a MySQL ni realizan operaciones reales.

## Endpoints y permisos reales

Base existente: `http://localhost:3000/api`. Todas las rutas requieren JWT. ROOT conserva acceso universal en el middleware.

| Método y ruta | Permiso | Respuesta exitosa |
| --- | --- | --- |
| GET /garantias | GARANTIAS_VER | 200 `{ "ok": true, "message": "Garantías obtenidas correctamente", "data": [Garantia] }` |
| GET /garantias/:idGarantia | GARANTIAS_VER | 200 `{ "ok": true, "message": "Garantía obtenida correctamente", "data": Garantia }` |
| POST /garantias | GARANTIAS_CREAR | 201 `{ "ok": true, "message": "Garantía creada correctamente", "data": Garantia }` |
| GET /garantias/:idGarantia/reclamos | GARANTIAS_VER | 200 `{ "ok": true, "message": "Reclamos obtenidos correctamente", "data": [Reclamo] }` |
| GET /garantias/reclamos/:idReclamo | GARANTIAS_VER | 200 `{ "ok": true, "message": "Reclamo obtenido correctamente", "data": Reclamo }` |
| POST /garantias/:idGarantia/reclamos | GARANTIAS_RECLAMAR | 201 `{ "ok": true, "message": "Reclamo registrado correctamente", "data": Reclamo }` |
| POST /garantias/reclamos/:idReclamo/resolver | GARANTIAS_RESOLVER | 200 `{ "ok": true, "message": "Reclamo actualizado correctamente", "data": Reclamo }` |

Lecturas auxiliares existentes, sin modificarlas:

| Ruta | Permiso | Uso |
| --- | --- | --- |
| GET /ventas | VENTA_VER | Números de venta, clientes, artículos, sucursales conocidas y selección de venta |
| GET /ventas/:idVenta | VENTA_VER | Detalles y días históricos para registro y trazabilidad |
| GET /ventas/:idVenta/factura | FACTURA_IMPRIMIR | Dispositivos vinculados históricamente al detalle vendido, con IMEI/serie |

No hay endpoints de anular/editar garantías, extender fechas, borrar reclamos, volver a estados anteriores ni ejecutar reparaciones/reemplazos/reembolsos. No hay listado global de reclamos: se consulta por garantía.

Auth expone roles, no permisos efectivos. La UI deja autorizar al servidor y, después de un 403, deshabilita la operación durante la visita, exceptuando ROOT. Para registrar desde esta UI también se necesitan VENTA_VER y GARANTIAS_VER por las lecturas previas; para recibir/resolver reclamos se necesita GARANTIAS_VER por la reconsulta. La falta de VENTA_VER no impide consultar referencias de garantías/reclamos; la falta de FACTURA_IMPRIMIR impide seleccionar un dispositivo para crear una garantía serializada, pero no bloquea garantías por cantidad ni el procesamiento de reclamos existentes.

## Contrato de garantía

Solicitud de ejemplo (IDs ilustrativos, deben existir en el entorno):

```json
{ "id_venta": 4, "id_detalle_venta": 20, "id_unidad": 11 }
```

- `id_venta`, `id_detalle_venta`: obligatorios, enteros positivos seguros. La venta debe existir y estar CONFIRMADA; el detalle debe pertenecerle.
- `id_unidad`: opcional/null para CANTIDAD y obligatorio para SERIALIZADO. El dispositivo debe estar vinculado a ese detalle/producto por detalle_venta_unidades. El servicio no exige que su estado actual sea VENDIDO ni impone un nuevo filtro por devolución del dispositivo.
- CANTIDAD crea una garantía del detalle completo, sin identificar piezas individuales; exige cantidad histórica válida y no acepta id_unidad.
- SERIALIZADO crea una garantía por dispositivo vendido. No se escriben IMEI nuevos ni se usa el catálogo general como sustituto del vínculo histórico.
- Los días vienen exclusivamente de detalle_ventas.dias_garantia, deben estar entre 1 y 65535. Cero significa sin cobertura. No se usan los días actuales del catálogo de Productos.
- `fecha_inicio` se obtiene como DATE de la fecha de venta en MySQL; `fecha_fin` es DATE_ADD(inicio, días históricos). No se envían fechas, estado, producto, cantidad, condiciones libres, usuario ni días desde React.
- Una venta antigua puede generar una garantía ya VENCIDA. No se bloquea su registro por el reloj del navegador.
- Duplicados: para CANTIDAD se busca la misma venta/detalle; para SERIALIZADO la misma venta/unidad. La consulta no excluye garantías VENCIDA o ANULADA, así que tampoco permiten registrar otra cobertura para esa referencia.
- La creación bloquea la venta y valida dentro de una transacción. El servicio de Ventas inspeccionado conserva los días históricos, pero no crea automáticamente estas garantías: el registro aquí es explícito.

Respuesta Garantia exacta seleccionada por el repositorio:

```json
{
  "id_garantia": 8,
  "id_venta": 4,
  "id_detalle_venta": 20,
  "id_producto": 2,
  "id_unidad": 11,
  "fecha_inicio": "2026-10-01",
  "fecha_fin": "2026-12-30",
  "dias_garantia": 90,
  "estado": "VIGENTE",
  "created_at": "2026-10-28 09:00:00",
  "updated_at": "2026-10-28 09:00:00"
}
```

Estados de garantía: VIGENTE, VENCIDA, ANULADA. La consulta presenta VENCIDA cuando el estado persistido es VIGENTE y fecha_fin < CURDATE(); esto no implica que el GET actualice la fila. No hay transición manual de garantía en estas rutas. ANULADA se puede consultar, pero no se agrega un botón ficticio para producirla.

Las fechas DATE permanecen como texto. La UI reutiliza creditDate para mostrarlas en Nicaragua sin desplazamiento UTC; el servidor decide la cobertura, no la fecha local del navegador.

## Recepción de reclamo

```json
{
  "id_sucursal": 2,
  "numero_reclamo": "R-PRUEBA-001",
  "motivo": "El dispositivo no enciende",
  "observacion": "Recibido con cargador"
}
```

Se envía a POST /garantias/8/reclamos:

- `id_sucursal`: obligatorio, entero positivo. Debe existir y estar activa. Puede ser cualquier sucursal activa; no se exige que coincida con la venta.
- `numero_reclamo`: obligatorio, texto recortado no vacío, hasta 50 caracteres; duplicado SQL se transforma en 409.
- `motivo`: obligatorio, texto libre recortado no vacío, hasta 500 caracteres. No existe catálogo de motivos.
- `observacion`: opcional/null, texto recortado de hasta 500 caracteres.
- `id_garantia` en body es opcional en API; si se envía debe coincidir con la ruta. La UI lo omite y usa la ruta.
- Usuario receptor viene del JWT, no se selecciona. El estado inicial es RECIBIDO.

Se bloquea la garantía y se exige estado persistido VIGENTE y CURDATE() BETWEEN fecha_inicio AND fecha_fin (extremos incluidos). La garantía debe estar dentro del intervalo incluso si el GET muestra VIGENTE para una fecha de inicio futura. La UI no intenta sustituir esa comprobación con el reloj del navegador.

Solo puede existir un reclamo abierto por garantía: RECIBIDO, EN_REVISION, APROBADO y RECHAZADO se consideran abiertos. Después de RESUELTO puede recibirse otro si la cobertura todavía lo permite. La UI reconsulta garantía y reclamos antes de escribir; el backend serializa la operación.

No existe catálogo público de sucursales. Se muestran las conocidas por ventas y se admite indicar un ID existente para otra sucursal; el servidor valida existencia y actividad. Se propone inicialmente la sucursal de venta cuando se pudo consultar, sin imponerla.

## Resolución y transiciones

```text
RECIBIDO → EN_REVISION → APROBADO  → RESUELTO
                       → RECHAZADO → RESUELTO
```

No se permite repetir un estado, saltarlo, reabrir ni procesar RESUELTO. Resolver no exige cobertura actual: un reclamo recibido a tiempo puede completarse después del vencimiento.

Ejemplo POST /garantias/reclamos/9/resolver:

```json
{
  "estado": "APROBADO",
  "diagnostico": "Falla de fabricación cubierta",
  "solucion": "REPARACION",
  "observacion": "Pendiente de intervención técnica"
}
```

- `estado`: obligatorio; el validador admite los cinco estados conocidos, pero el servicio permite únicamente la siguiente transición válida.
- `diagnostico`: opcional/null, texto hasta 1000 caracteres. Es obligatorio para APROBADO, RECHAZADO y RESUELTO; EN_REVISION permite omitirlo.
- `solucion`: opcional/null. Valores REPARACION, REEMPLAZO, DEVOLUCION, SIN_COBERTURA.
- `observacion`: opcional/null, texto hasta 500 caracteres.
- Omitir un campo conserva su valor anterior; enviarlo null lo borra, sujeto a validación del estado. El servicio frontend conserva esa diferencia; el formulario carga los valores existentes y advierte que reemplaza observación.
- EN_REVISION no admite solución.
- APROBADO no admite SIN_COBERTURA; puede aprobarse sin solución todavía, pero al resolver deberá existir una.
- RECHAZADO fuerza SIN_COBERTURA; no admite otra solución. Al pasar de RECHAZADO a RESUELTO debe conservarse SIN_COBERTURA.
- RESUELTO exige diagnóstico y solución, conservando los ya registrados si no se envían otros. Guarda id_usuario_resuelve del JWT y fecha_resolucion NOW(). Las transiciones intermedias no registran ese usuario/fecha de resolución.

La UI vuelve a obtener el reclamo antes de enviar y exige que mantenga el estado revisado por el usuario. El backend bloquea el reclamo y hace UPDATE condicionado al estado anterior; si cambió devuelve 409. Después de RESUELTO no se muestra formulario de transición.

Los textos se validan por puntos de código Unicode como el servicio; no se truncan silenciosamente. IDs rechazan notación científica, decimales y enteros no seguros como el servicio.

## Respuesta de reclamo y trazabilidad

GET de reclamo y listado por garantía devuelven SELECT * FROM reclamos_garantia. Los campos utilizados/escritos por el backend actual son:

```json
{
  "id_reclamo": 9,
  "numero_reclamo": "R-PRUEBA-001",
  "id_garantia": 8,
  "id_sucursal": 2,
  "id_usuario_recibe": 7,
  "fecha_recepcion": "2026-10-28 09:00:00",
  "motivo": "El dispositivo no enciende",
  "diagnostico": null,
  "solucion": null,
  "observacion": "Recibido con cargador",
  "estado": "RECIBIDO",
  "id_usuario_resuelve": null,
  "fecha_resolucion": null
}
```

El esquema desplegado puede tener columnas adicionales porque se selecciona *. No se inventan nombres de usuarios o sucursales que la respuesta no proporciona: se conservan referencias útiles para trazabilidad. El listado se ordena por id_reclamo descendente.

El listado de garantías tampoco devuelve nombres, clientes ni IMEI. Se consulta GET /ventas de forma auxiliar para números/clientes/productos. Si falla, se mantienen las referencias técnicas de garantía/venta/producto/dispositivo y una advertencia; no se bloquea la consulta principal.

Al abrir una garantía se consulta la venta y, para serializados, la factura: sus detalles aportan unidades vendidas (`id_unidad`, `imei1`, `imei2`, `numero_serie`) vinculadas por id_detalle_venta. Se muestra una sola vez el dispositivo asociado, conservando los ceros iniciales del IMEI. Sin factura se muestra el id_unidad como referencia, no un IMEI supuesto. Los días son históricos; nombres/tipo_control/IMEI consultados mediante JOIN reflejan los valores disponibles actualmente en esos registros, no una copia local inventada.

## Efectos reales y límites

- Garantía y reclamos solo registran cobertura y gestión. Ninguno de estos endpoints cambia stock, ubicación/estado de dispositivos, pagos, caja, créditos o cuotas.
- REPARACION, REEMPLAZO y DEVOLUCION son etiquetas de solución. No ejecutan reparación, sustitución, devolución comercial ni reembolso. La pantalla lo indica antes de registrar/decidir y en el detalle.
- No hay historial completo de cada transición: el reclamo expone estado y textos actuales, receptor y responsable/fecha al resolver. No se muestra una cronología ficticia.
- La cobertura no se extiende al registrar tarde, recibir un reclamo o resolverlo.
- El servicio permite registrar garantía de un dispositivo históricamente vendido sin comprobar su estado actual. Recibir reclamo tampoco revalida estado actual de venta/dispositivo ni devoluciones; se respeta la regla real sin añadir restricciones de otros módulos.
- Los listados no tienen paginación ni filtros de servidor. Búsqueda/estado actúan sobre los registros recibidos; el IMEI se consulta en el detalle y no se promete búsqueda global por IMEI.
- No hay idempotencia. Ante respuesta perdida, consultar garantía/reclamos antes de repetir; no hay reintentos automáticos de POST. Un fallo de lectura posterior conserva el éxito y no autoriza repetir.

## Defectos y limitaciones de integración detectados

**Esquema SQL archivado distinto del backend actual:** database/01_schema_tienda_celulares.sql no incluye id_venta, id_producto, dias_garantia, created_at y updated_at de garantía requeridos por warrantyRepository. El reclamo archivado usa id_usuario/problema_reportado y estados REPARADO/REEMPLAZADO/CERRADO, mientras el repositorio actual usa numero_reclamo, motivo, id_usuario_recibe/id_usuario_resuelve y estados APROBADO/RESUELTO, entre otros campos. No se modificó ni ejecutó SQL y no se verificó el esquema de MySQL desplegado. Una BD creada solo con ese archivo puede devolver 500: sus responsables deben comprobar que existe la versión compatible antes de la prueba manual.

No hay API pública de sucursales ni JOIN de metadatos en garantías/reclamos. La UI usa solo lecturas disponibles y referencias cuando falta información. La validación final de cobertura depende del calendario/zona de MySQL, no de la zona del navegador. El GET no incluye en_cobertura; esa comprobación solo existe dentro de la recepción transaccional.

El controlador de Garantías convierte errores internos a 500 genérico y usa statusCode para negocio. La API compartida descarta cuerpos HTML y conserva errores[].msg; el adaptador local además elimina detalles de 500. No se muestran SQL, HTML o stack al usuario.

## Archivos implementados

Creados:

- `src/services/warrantyService.js`: endpoints, JWT, payloads exactos y protección de errores internos.
- `src/views/warranties/warrantyModel.js`: contratos, filtros, fuentes históricas, validaciones y flujos con relectura.
- `src/views/warranties/Warranties.jsx`: listado, permisos, carga, detalle y operaciones.
- `src/views/warranties/WarrantyForms.jsx`: registro de garantía, recepción y resolución con confirmación común.
- `src/views/warranties/WarrantyDetail.jsx`: cobertura, IMEI y reclamos.
- `tests/warranties.test.mjs`, `tests/warranties-render.test.mjs`.
- `docs/garantias.md`.

Modificado: `src/routes.js` para cargar el módulo en `/garantias`. La navegación ya tenía la entrada y no requirió cambios. No se modificaron servicios o vistas validados de Ventas, Créditos, Caja, Inventario, Transferencias o Devoluciones.

CoreUI: tablas responsive, modales desplazables, cargas y errores, temas claro/oscuro. Cada escritura requiere casilla de confirmación y se desmarca al cambiar campos o enviar. Una referencia síncrona y botones deshabilitados previenen doble envío antes del siguiente render. Se reconsulta antes de escribir y se actualizan listado, detalle y reclamos tras el éxito. Si una respuesta no se puede validar, no se reutiliza una selección anterior como resultado confirmado.

## Verificación automatizada

Desde frontend:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Pruebas con fetch simulado, SSR, validadores reales y servicio backend real aislado mediante un repositorio simulado. No se importa config/database ni se conecta a MySQL. Cubren listado/detalle, vínculos históricos, días, duplicados, cantidad/serializados, ausencia de factura/permisos, recepción, cobertura fuera del intervalo, reclamo abierto, todas las transiciones/soluciones, límites de texto, concurrencia, doble envío, 400/401/403/404/409/500, HTML, red, aborto y fallo de lectura tras POST confirmado. No se ejecutan garantías ni reclamos reales automáticamente.

Resultados finales: ESLint correcto (0 errores), build correcto y **132 pruebas aprobadas, 0 fallidas**, incluidas 18 específicas de Garantías. `git diff --check` correcto. El build conserva avisos existentes de Vite sobre configLoader native/__dirname y bundle superior a 500 kB. Git final solo muestra routes.js y los archivos nuevos de Garantías. Pendiente revisión visual/interactiva en navegador y validación del esquema real; las pruebas con mocks no certifican la BD desplegada.

## Procedimiento manual breve contra MySQL real

Usar una base MySQL de pruebas con datos existentes y esquema compatible con el repositorio actual. No ejecutar el SQL archivado ni modificar producción como parte de esta validación.

1. Reutilizar servidores existentes. Si están detenidos, ejecutar `npm.cmd start` desde backend configurado para esa MySQL de pruebas y `npm.cmd start -- --port 3001` desde frontend. Abrir `http://localhost:3001/#/garantias` e iniciar sesión con ROOT, o GARANTIAS_VER/CREAR/RECLAMAR/RESOLVER, VENTA_VER y FACTURA_IMPRIMIR para serializados.
2. Identificar una venta CONFIRMADA existente, artículo con dias_garantia histórico >0 y sin garantía registrada. Para teléfono, anotar el IMEI exacto de su factura. Para recibir un reclamo, la fecha de venta más días debe cubrir el calendario actual de MySQL; no modificar fechas desde el formulario.
3. Pulsar Registrar garantía, seleccionar venta/artículo y, si es SERIALIZADO, dispositivo exacto. Revisar días históricos y alcance (CANTIDAD cubre todo el detalle), marcar confirmación y registrar una vez. Esperar 201 y comprobar inicio/fin/estado devueltos. Consultar detalle, nombres e IMEI; probar búsqueda, filtro y Actualizar. Una venta antigua puede dar VENCIDA correctamente.
4. Para garantía VIGENTE dentro del intervalo, pulsar Registrar reclamo. Elegir sucursal activa conocida o su ID existente, número único (por ejemplo `R-` seguido de fecha/hora actual), motivo y observación opcional. Revisar y confirmar. Esperar 201/RECIBIDO. Intentar otro mientras está abierto debe bloquearse o devolver 409.
5. Consultar el reclamo. Marcar confirmación y guardar EN_REVISION. Después elegir APROBADO, indicar diagnóstico y solución REPARACION; confirmar. Por último pasar a RESUELTO conservando diagnóstico/solución y confirmar. Verificar responsable y fecha de resolución y ausencia de nuevas transiciones. Para probar rechazo usar otro reclamo permitido: EN_REVISION → RECHAZADO fuerza SIN_COBERTURA y luego RESUELTO la conserva.
6. Comprobar en Inventario, dispositivos y módulos financieros que esas operaciones no cambiaron stock, estado/ubicación, pagos, caja o crédito. Las etiquetas de solución no ejecutan esas acciones. No realizar reemplazos/reembolsos manuales para simular efectos inexistentes.
7. Revisar ancho móvil y temas claro/oscuro. Probar permisos con usuarios ya configurados: sin VENTA_VER deben verse referencias; sin FACTURA_IMPRIMIR no debe poder registrarse garantía serializada; con solo GARANTIAS_VER se permite lectura. No cambiar roles ni datos para fabricar casos.
8. En dos pestañas procesar el mismo reclamo: una transición ya realizada debe impedir repetición por relectura/409. En Network verificar un solo POST ante doble clic tras confirmar. Simular Offline en lecturas: error seguro; ante pérdida de respuesta de escritura, restablecer conexión y consultar antes de repetir.

No se realizaron commit ni push. Pendiente validación manual antes de guardar en GitHub.
