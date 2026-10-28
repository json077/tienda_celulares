# Transferencias entre sucursales

## Inspección y alcance

Estado inicial de `git status --short`: limpio. Solo existía el enlace `/transferencias` en `src/config/modules.js`; `routes.js` lo resolvía a ModulePlaceholder. No había servicio, componentes ni pruebas parciales de Transferencias.

Se revisaron `backend/src/app.js`, `server.js`, rutas, controlador, validador, servicio y repositorio de Transferencias; inventario, productos, unidades serializadas y autorización; rutas, navegación, autenticación y patrones de Compras/Inventario/Caja del frontend. El archivo duplicado `backend/src/repositories/transferRoutes.js` no es el router importado por app.js: la fuente efectiva es `backend/src/routes/transferRoutes.js`.

No se modificaron backend, BD, dependencias ni módulos validados. Se reutilizan formatos de fecha de Caja, validación de respuestas de Inventario y servicios existentes de lectura. No se ejecutaron solicitudes contra una API o BD real.

## Endpoints y permisos reales

Base de la aplicación: `http://localhost:3000/api`. Todos requieren JWT. ROOT omite la comprobación de permisos en el middleware.

| Método y ruta | Permiso | Respuesta exitosa |
| --- | --- | --- |
| GET /transferencias | TRANSFERENCIAS_VER | 200 `{ "ok": true, "data": [Encabezado] }` |
| GET /transferencias/:id | TRANSFERENCIAS_VER | 200 `{ "ok": true, "data": TransferenciaCompleta }` |
| POST /transferencias | TRANSFERENCIAS_CREAR | 201 `{ "ok": true, "message": "Transferencia creada correctamente", "data": TransferenciaCompleta }` |
| POST /transferencias/:id/confirmar | TRANSFERENCIAS_CONFIRMAR | 200 `{ "ok": true, "message": "Transferencia confirmada correctamente", "data": TransferenciaCompleta }` |
| POST /transferencias/:id/anular | TRANSFERENCIAS_ANULAR | 200 `{ "ok": true, "message": "Transferencia anulada correctamente", "data": TransferenciaCompleta }` |
| GET /productos | PRODUCTOS_VER | 200 `{ "ok": true, "data": [Producto] }` |
| GET /inventario | INVENTARIO_VER | 200 `{ "ok": true, "data": [Existencia] }` |
| GET /unidades | IMEI_GESTIONAR | 200 `{ "ok": true, "data": [Unidad] }` |

Confirmar/anular envían `{}`; el backend toma usuario del JWT, nunca del formulario. Cada `:id` es entero positivo. No hay rutas para editar, despachar, recibir, revertir una confirmación o reactivar una anulación. No hay endpoint público de sucursales.

El contexto Auth expone roles, no permisos efectivos. La UI deja que el servidor autorice, conserva mensajes 401/403 y deshabilita la acción de Transferencias tras un 403 durante esa visita, salvo ROOT. Consultar catálogo requiere PRODUCTOS_VER e INVENTARIO_VER. Si solo falla GET /unidades, se advierte y se permite crear por cantidad, sin selección de teléfonos. Confirmar o anular requiere además TRANSFERENCIAS_VER por la reconsulta previa del detalle en esta UI.

## Contrato de creación

Ejemplo ilustrativo: los IDs deben existir en el entorno donde se realice la prueba; no son datos precargados.

```json
{
  "numero_transferencia": "TR-PRUEBA-001",
  "id_sucursal_origen": 4,
  "id_sucursal_destino": 5,
  "observacion": "Prueba de traslado",
  "detalles": [
    { "id_producto": 1, "cantidad": 2 },
    { "id_producto": 2, "unidades": [11, 15] }
  ]
}
```

- `numero_transferencia`: obligatorio, texto recortado, no vacío, máximo 50 caracteres. Un duplicado SQL se transforma en conflicto 409.
- `id_sucursal_origen`, `id_sucursal_destino`: enteros positivos, distintos; ambas sucursales deben existir y estar activas al crear.
- `observacion`: opcional/null, máximo 500 caracteres; se guarda recortada o null.
- `detalles`: arreglo no vacío; admite varios productos, sin repetir `id_producto`. Cada producto debe existir y estar activo.
- CANTIDAD: `cantidad` entera positiva, no superior al stock de origen. La UI no envía `unidades` para esta modalidad.
- SERIALIZADO: `unidades` es un arreglo no vacío de **id_unidad**, no cadenas de IMEI ni objetos. No se repiten unidades en la transferencia. El backend deriva cantidad del número de unidades. Si el cliente envía `cantidad`, debe coincidir; esta UI la omite para serializados.
- Cada unidad debe existir, pertenecer al producto y estar `DISPONIBLE` en origen. No se crean dispositivos ni se escriben IMEI desde Transferencias.

No se envían usuario, fechas, estado, sucursal actual del dispositivo, stock ni movimientos. La sucursal de destino puede no tener todavía una fila de inventario para el producto; el backend la crea al confirmar.

## Respuestas y campos

Encabezado: `id_transferencia`, `numero_transferencia`, `id_sucursal_origen`, `codigo_sucursal_origen`, `sucursal_origen`, `id_sucursal_destino`, `codigo_sucursal_destino`, `sucursal_destino`, `id_usuario_solicita`, `usuario_solicita`, `id_usuario_confirma`, `usuario_confirma`, `fecha_solicitud`, `fecha_confirmacion`, `estado`, `observacion`, `created_at`, `updated_at`.

El listado devuelve solo encabezados, ordenados por fecha de solicitud descendente e ID descendente. No informa cantidad de productos/dispositivos. Los filtros de búsqueda, estado, origen y destino son locales sobre ese listado completo, sin paginación ni parámetros de filtro inventados.

El detalle agrega `detalles`:

```json
{
  "ok": true,
  "data": {
    "id_transferencia": 8,
    "numero_transferencia": "TR-PRUEBA-001",
    "id_sucursal_origen": 4,
    "sucursal_origen": "Centro",
    "id_sucursal_destino": 5,
    "sucursal_destino": "Norte",
    "estado": "BORRADOR",
    "usuario_solicita": "operador",
    "fecha_solicitud": "2026-10-28 09:00:00",
    "detalles": [
      {
        "id_detalle_transferencia": 9,
        "id_transferencia": 8,
        "id_producto": 2,
        "sku": "TEL-TEST",
        "producto": "Teléfono de prueba",
        "tipo_control": "SERIALIZADO",
        "cantidad": 1,
        "created_at": "2026-10-28 09:00:00",
        "unidades": [
          {
            "id_transferencia_unidad": 3,
            "id_detalle_transferencia": 9,
            "id_unidad": 11,
            "imei1": "001234567890123",
            "imei2": null,
            "numero_serie": "SERIE-TEST",
            "estado": "DISPONIBLE",
            "id_sucursal_actual": 4
          }
        ]
      }
    ]
  }
}
```

Se abrevia el encabezado en este ejemplo. Para CANTIDAD, `unidades` es `[]`. Los IMEI son texto, conservan ceros iniciales. El estado y sucursal de unidades se obtienen por JOIN a sus valores **actuales**, no a una fotografía histórica del traslado. El detalle permite conocer cantidad de productos y suma de unidades sin hacer consultas adicionales por fila del listado.

Los catálogos usados por el formulario aportan:

- Producto: `id_producto`, `sku`, `nombre`, `tipo_control`, `activo` (y otros campos del módulo Productos).
- Existencia: `id_sucursal`, `codigo_sucursal`, `sucursal`, `id_producto`, `sku`, `producto`, `tipo_control`, `stock_actual`, `stock_minimo`, `stock_bajo`, `updated_at`.
- Unidad: `id_unidad`, `id_producto`, `sku`, `producto`, `id_sucursal_actual`, `codigo_sucursal`, `sucursal`, `id_detalle_compra`, `imei1`, `imei2`, `numero_serie`, `estado`, `created_at`, `updated_at`.

## Estados, inventario e IMEI

```text
crear → BORRADOR → confirmar → CONFIRMADA
                → anular    → ANULADA
```

Crear valida stock/dispositivos y guarda encabezado, detalles y asociaciones de unidades dentro de una transacción. **No reserva ni descuenta** stock, no cambia ubicación ni crea movimientos. Varias transferencias BORRADOR pueden referirse al mismo dispositivo; la confirmación posterior vuelve a comprobar disponibilidad. No se ofrece una exclusión global ficticia en React.

Confirmar exige BORRADOR, detalles no vacíos y productos activos. Bloquea transferencia, inventarios y unidades seleccionadas; vuelve a comprobar existencias. Para serializados exige que el número de unidades coincida con cantidad, pertenezcan al producto, sigan en origen y estén DISPONIBLE. Vendidos, defectuosos, reservados y cualquier otro estado no DISPONIBLE se rechazan. Los cambios se confirman en una sola transacción:

1. Crea inventario de destino con stock cero si no existe.
2. Resta cantidad a origen y suma a destino, sin admitir stock negativo por insuficiencia.
3. Para cada serializado cambia `id_sucursal_actual` al destino y mantiene estado DISPONIBLE. No cambia IMEI ni serie.
4. Inserta `TRANSFERENCIA_SALIDA` y `TRANSFERENCIA_ENTRADA` en movimientos_inventario con cantidades firmadas, stock anterior/nuevo, usuario y referencia `TRANSFERENCIA`/id_transferencia. En CANTIDAD es un par por producto; en SERIALIZADO un par por dispositivo, con `id_unidad`.
5. Guarda CONFIRMADA, usuario confirma y fecha de confirmación NOW().

Anular solo admite BORRADOR: guarda ANULADA, sin mover ni revertir inventario. El backend no registra usuario ni fecha específica de anulación. Confirmada y anulada son terminales en esta API. No hay paso de recepción, estado en tránsito ni reversión de una confirmación.

La UI filtra productos activos con stock consultado en origen; serializados además requieren unidades DISPONIBLE en esa sucursal. Impide duplicar productos, IDs de unidad e IMEI seleccionados y cantidades inválidas. Cambiar origen limpia las líneas. Antes de crear vuelve a leer productos/stock/unidades y valida el borrador. Antes de confirmar/anular vuelve a consultar el detalle; el servidor sigue siendo la autoridad transaccional.

## UX, permisos y errores

CoreUI: tabla responsive, filtros locales, formulario en modal desplazable, selección de IMEI con búsqueda, resumen de artículos, revisión y casilla explícita para crear. Confirmar/anular requieren otra casilla explícita que identifica la transferencia. Formularios y botones se bloquean mientras opera; una referencia síncrona impide doble escritura incluso antes del siguiente render. Fechas en español de Nicaragua/America/Managua, reutilizando la utilidad existente. Colores semánticos y estilos de CoreUI compatibles con ambos temas.

La selección de sucursales reúne nombres e IDs de inventario y transferencias consultadas; no asegura que estén activas, porque esos catálogos no lo informan. Se ofrece entrada de un ID existente para sucursales conocidas por el operador que todavía no aparezcan (especialmente destinos sin inventario). El servidor valida existencia/actividad al crear. No se inventa una sucursal ni se ejecuta SQL para completar opciones.

Errores esperados: 400 datos/sucursales inválidos o producto inactivo; 401 JWT ausente/expirado; 403 permiso insuficiente; 404 transferencia/unidad inexistente; 409 número duplicado, stock insuficiente, unidad no disponible/en otra sucursal o transferencia ya procesada. Se preservan mensajes JSON útiles y los `errors[].msg` reales del validador. Se utiliza apiErrorMessage para el contexto de autenticación/permisos.

Después de escribir se cierra la confirmación, se muestra el detalle devuelto y se actualiza el listado. Un fallo posterior de lectura conserva el éxito; no reenvía la escritura. Una respuesta inválida no conserva el detalle anterior como si estuviera vigente. Tras conflicto al procesar se invalida la selección y se actualiza el listado para exigir nueva consulta. No existen claves de idempotencia: ante pérdida de respuesta, buscar el número y consultar antes de repetir.

## Defectos y limitaciones del backend (sin modificar)

- **Manejo de errores de Transferencias:** el controlador llama `next(error)` pero app.js no instala middleware de errores JSON. Express devuelve HTML por defecto para errores del servicio (incluidos 400/404/409); en desarrollo puede contener stack. El servicio del frontend descarta ese cuerpo y muestra un mensaje seguro según status. No puede recuperar con seguridad el mensaje concreto de stock/IMEI que solo venga en HTML. Con un JSON válido conserva el mensaje. Para 500 siempre muestra texto genérico, sin SQL/stack.
- El validador de Transferencias devuelve errores crudos de express-validator (`path`, `msg`, etc.). La utilidad API compartida espera `campo`/`mensaje`, por lo que el adaptador de Transferencias los normaliza localmente, sin alterar otros módulos. Mantiene la base URL fija utilizada por la aplicación actual.
- No hay catálogo público de sucursales, paginación/filtros de servidor, edición de borradores, reserva de stock, recepción, reversión ni auditoría específica de anulación en el encabezado.
- La actividad de ambas sucursales se comprueba al crear, pero confirmar no vuelve a consultar su actividad. Se reporta esta diferencia, sin imponer una regla que el servicio no aplica.
- El listado no devuelve cantidades; solo se muestran en el detalle. El detalle de IMEI muestra ubicación/estado actual, no histórico.
- Las lecturas de detalle después de commit pueden fallar aunque la transacción ya haya terminado. No es seguro interpretar una respuesta perdida como escritura fallida ni repetir automáticamente.
- La verificación automatizada usa mocks y SSR; no certifica el esquema de una BD desplegada ni reemplaza la revisión visual/interactiva en navegador. No se efectuó una transferencia real durante esta implementación.

## Archivos

Creados:

- `src/services/transferService.js`: payload, JWT, endpoints, normalización de errores y protección ante HTML/500.
- `src/views/transfers/transferModel.js`: contratos, filtros, sucursales conocidas, disponibilidad, validación y flujo de transición.
- `src/views/transfers/Transfers.jsx`: listado, permisos, cargas, modales, operaciones y actualización.
- `src/views/transfers/TransferForm.jsx`: formulario mixto, selección IMEI y revisión de borrador.
- `src/views/transfers/TransferDetail.jsx`: encabezado, cantidades y dispositivos sin repetir IMEI por separado.
- `tests/transfers.test.mjs`, `tests/transfers-render.test.mjs`.
- `docs/transferencias.md`.

Modificado: `src/routes.js`, para sustituir el placeholder por la carga diferida del módulo. La navegación ya incluía Transferencias; no necesitó cambios.

## Verificación automatizada

Desde `frontend`:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Las pruebas cubren render SSR, catálogo/origen/destino, cantidades, disponibilidad, IMEI duplicados y no disponibles, payload mixto contra validadores reales, listado/detalle, HTTP/JWT, creación, confirmación, anulación, estados concurrentes, aborto, doble envío, errores 400/401/403/404/409/500, HTML, red y lectura posterior. Una prueba ejecuta el servicio real de Transferencias con un repositorio totalmente simulado en un contexto aislado: no importa config/database, no abre conexiones y comprueba los cambios de stock/ubicación y movimientos esperados. No existe ni se prueba una recepción ficticia.

Resultados finales: ESLint correcto (0 errores); build correcto; **97 pruebas aprobadas, 0 fallidas**, de las cuales 13 corresponden a Transferencias; `git diff --check` correcto. Avisos existentes de Vite sobre configLoader native/__dirname y chunks superiores a 500 kB no impiden el build. Git final solo muestra la integración de routes.js y archivos nuevos de Transferencias.

## Procedimiento manual exacto: accesorio por cantidad

Realizar estas escrituras solo en un entorno de pruebas, con inventario de prueba; no en producción. No se ejecutó este procedimiento automáticamente.

1. Usar servidores existentes. Si están detenidos, desde `backend` ejecutar `npm.cmd start` con configuración de pruebas; desde `frontend`, `npm.cmd start -- --port 3001`. Abrir `http://localhost:3001/#/transferencias` e iniciar sesión.
2. Usar ROOT o usuario con TRANSFERENCIAS_VER/CREAR/CONFIRMAR/ANULAR, PRODUCTOS_VER e INVENTARIO_VER. IMEI_GESTIONAR es opcional para este caso.
3. En Inventario, identificar un accesorio activo CANTIDAD con stock de al menos 2 en origen. Anotar SKU, sucursal, stock origen O y stock destino D (si no existe fila, considerar D=0). Elegir un destino existente y activo distinto. Anotar sus nombres e IDs solo si hace falta el campo alternativo.
4. En Transferencias pulsar Nueva transferencia. Escribir un número único de hasta 50 caracteres, por ejemplo `TR-ACC-` seguido de fecha/hora actual. Seleccionar origen y destino; si destino no aparece, introducir su ID existente en el campo alternativo. Escribir observación `Prueba manual accesorio`.
5. Comprobar que origen igual a destino no permite agregar/revisar. Corregir destino. Seleccionar el accesorio, probar cantidad 0, fraccionaria y superior a O: ninguna debe agregarse. Introducir 2 y pulsar Agregar artículo.
6. Pulsar Revisar transferencia, comprobar número, sucursales y línea con cantidad 2. Marcar la casilla y pulsar Crear borrador una vez. Esperar 201 y BORRADOR; localizar la fila o el detalle devuelto. Confirmar en Inventario que stock sigue O y D (crear no mueve ni reserva).
7. Consultar detalle desde la fila. Revisar accesorio, cantidad 2 y ausencia de IMEI. Pulsar Confirmar transferencia, revisar advertencia y marcar la casilla. Pulsar Confirmar y mover inventario una vez. Esperar 200, CONFIRMADA, usuario y fecha de confirmación.
8. Actualizar Inventario: comprobar O−2 en origen y D+2 en destino. Con MOVIMIENTO_VER, consultar movimientos y comprobar salida −2/entrada +2, referencia TRANSFERENCIA con el ID mostrado en el detalle. No volver a registrar movimientos manuales.
9. Volver a Transferencias, actualizar y abrir detalle: no deben ofrecerse confirmar ni anular. Probar búsqueda por número y filtros de estado/origen/destino; limpiar filtros. Revisar móvil y temas claro/oscuro.
10. Para probar anulación, crear **otro** borrador con un número diferente y una unidad disponible. Consultar detalle, pulsar Anular borrador, marcar confirmación y confirmar anulación. Verificar ANULADA, stock sin cambios y ausencia de nuevas acciones. No intentar anular la confirmada del paso 7.

## Procedimiento manual exacto: teléfono por IMEI

1. En el mismo entorno de pruebas, usar ROOT o los permisos del caso anterior más IMEI_GESTIONAR. En Inventario/Dispositivos identificar un producto SERIALIZADO activo, una unidad DISPONIBLE y su IMEI 1, IMEI 2/serie si existen, sucursal origen y stock O≥1. Elegir otra sucursal activa y anotar stock D (o cero si no tiene inventario).
2. Ir a Transferencias → Nueva transferencia. Introducir número único `TR-IMEI-` seguido de fecha/hora actual, seleccionar origen y destino distintos y observación `Prueba manual teléfono`.
3. Seleccionar el producto serializado. Buscar por el IMEI anotado; marcar su casilla una vez. La selección debe contar 1 dispositivo; desmarcar y marcar no lo duplica. No deben ofrecerse unidades VENDIDO, DEFECTUOSO ni de otra sucursal. No escribir IMEI nuevos ni pegar IDs de unidades en un campo libre.
4. Pulsar Agregar artículo y revisar IMEI/serie. Pulsar Revisar transferencia, verificar sucursales y dispositivo exacto, marcar confirmación y Crear borrador. Comprobar BORRADOR. El teléfono debe seguir DISPONIBLE en origen y el stock no debe cambiar todavía.
5. Consultar detalle y pulsar Confirmar transferencia. Revisar IMEI y destino, marcar confirmación y pulsar Confirmar y mover inventario. Esperar CONFIRMADA.
6. Actualizar Inventario/Dispositivos: el mismo IMEI y serie deben mantenerse, estado DISPONIBLE y sucursal destino. Stock esperado: O−1 y D+1, sin operaciones concurrentes.
7. Con MOVIMIENTO_VER verificar un movimiento TRANSFERENCIA_SALIDA de −1 en origen y TRANSFERENCIA_ENTRADA de +1 en destino, ambos con ese id_unidad y referencia a la transferencia.
8. Consultar de nuevo el detalle: debe mostrar ubicación actual destino y el mismo dispositivo una sola vez; no debe permitir confirmar ni anular. No hay botón Recibir porque el traslado se completó al confirmar.

## Comprobaciones adicionales en navegador

- Permisos: con usuarios ya configurados, observar 403 al intentar una acción no autorizada; ROOT mantiene acceso. No editar roles ni BD como parte de esta prueba. Sin IMEI_GESTIONAR se debe advertir la falta de consulta y permitir únicamente CANTIDAD.
- Concurrencia: en dos pestañas abrir el mismo borrador de prueba, confirmar o anular en una y tratar de procesar en la otra: reconsulta/409 impide repetir. Para stock/IMEI ya consumido por otra operación, el servidor rechaza y la UI pide actualizar/consultar; no descuenta localmente.
- Doble clic: en Network comprobar que solo existe un POST de creación/confirmación/anulación por confirmación explícita.
- Red: usar Offline antes de una consulta y verificar error seguro. Si se pierde una respuesta de escritura, restablecer red, buscar el número y consultar estado antes de repetir. Un fallo al actualizar el listado después de POST exitoso debe mantener el mensaje de éxito.
- 401: en una sesión de pruebas invalidar temporalmente el token desde DevTools, consultar y volver a iniciar sesión. No exponer JWT en capturas o registros compartidos.

No se hizo commit ni push. Pendiente de validación manual antes de guardar en GitHub.
