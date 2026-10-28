# Devoluciones

## Inspección y alcance

Estado inicial de `git status --short`: limpio. Existía el enlace `/devoluciones` en `src/config/modules.js`, resuelto por `routes.js` a ModulePlaceholder; no había frontend parcial que conservar.

Se inspeccionaron rutas, controlador, validadores, servicio y repositorio de Devoluciones; consultas de ventas/facturas y vínculo detalle_venta_unidades; inventario/unidades; servicios de pagos, caja y créditos; autorización y patrones CoreUI existentes. La implementación sigue el backend actual. No se modificaron backend, base de datos, dependencias ni módulos validados. No se ejecutaron devoluciones reales.

## Endpoints y permisos

Base existente: `http://localhost:3000/api`. Todos requieren JWT. ROOT tiene acceso universal en el middleware de permisos.

| Método y ruta | Permiso | Respuesta exitosa |
| --- | --- | --- |
| GET /devoluciones | DEVOLUCIONES_VER | 200 `{ "ok": true, "data": [Encabezado] }` |
| GET /devoluciones/:idDevolucion | DEVOLUCIONES_VER | 200 `{ "ok": true, "data": DevolucionCompleta }` |
| POST /devoluciones | DEVOLUCIONES_CREAR | 201 `{ "ok": true, "message": "Devolución creada correctamente", "data": DevolucionCompleta }` |
| POST /devoluciones/:idDevolucion/confirmar | DEVOLUCIONES_CONFIRMAR | 200 `{ "ok": true, "message": "Devolución confirmada correctamente", "data": DevolucionCompleta }` |
| POST /devoluciones/:idDevolucion/anular | DEVOLUCIONES_ANULAR | 200 `{ "ok": true, "message": "Devolución anulada correctamente", "data": DevolucionCompleta }` |
| GET /ventas | VENTA_VER | 200 `{ "ok": true, "data": [VentaConDetalles] }` |
| GET /ventas/:idVenta | VENTA_VER | 200 `{ "ok": true, "data": VentaConDetalles }` |
| GET /ventas/:idVenta/factura | FACTURA_IMPRIMIR | 200 `{ "ok": true, "data": FacturaConDetallesYUnidades }` |

Confirmar y anular envían `{}`. Los IDs de ruta son enteros positivos. No existen endpoints de aprobar/rechazar, reembolsar, editar borradores, revertir confirmadas o reactivar anuladas.

Auth expone roles, no permisos efectivos. Se intenta cada operación y se conserva su 403; la UI deshabilita la acción rechazada durante la visita salvo ROOT. Para crear desde esta interfaz también se necesitan VENTA_VER y DEVOLUCIONES_VER, porque se consulta la venta y su historial confirmado. Para confirmar/anular, la UI requiere DEVOLUCIONES_VER para reconsultar primero el detalle. FACTURA_IMPRIMIR solo es necesario para devolver teléfonos; si falla la factura, los accesorios siguen disponibles con advertencia.

## Estados y transiciones

```text
Crear → BORRADOR → Confirmar → CONFIRMADA
                → Anular    → ANULADA
```

Solo CONFIRMADA consume cantidades pendientes de devolver. BORRADOR no reserva cantidades, IMEI ni inventario. Varias solicitudes pendientes pueden competir por los mismos artículos: el backend revalida al confirmar. ANULADA no modifica inventario. Confirmada y anulada son terminales en esta API.

Crear y confirmar exigen venta CONFIRMADA; se rechazan BORRADOR y ANULADA. El servicio no limita por CONTADO/CREDITO, pagos realizados, antigüedad, usuario vendedor ni producto actualmente activo. No se agregaron esas restricciones en React. La sucursal se toma de la venta, no se selecciona otra para recibir.

## Contrato de creación

Ejemplo ilustrativo con dos artículos. Los IDs deben existir en el entorno de pruebas; no son datos precargados:

```json
{
  "numero_devolucion": "DEV-PRUEBA-001",
  "id_venta": 4,
  "motivo": "Devolución parcial de artículos",
  "observacion": "Inspección en mostrador",
  "detalles": [
    {
      "id_detalle_venta": 10,
      "cantidad": 1,
      "id_unidad": null,
      "condicion": "APTO",
      "reintegra_inventario": true,
      "motivo": "Accesorio sin uso"
    },
    {
      "id_detalle_venta": 20,
      "cantidad": 1,
      "id_unidad": 11,
      "condicion": "DEFECTUOSO",
      "reintegra_inventario": false,
      "motivo": "Falla técnica"
    }
  ]
}
```

Campos:

- `numero_devolucion`: obligatorio, texto recortado no vacío, hasta 50 caracteres; un duplicado SQL devuelve 409.
- `id_venta`: obligatorio, entero positivo; debe existir y estar CONFIRMADA.
- `motivo`: obligatorio, texto libre recortado no vacío, hasta 500 caracteres. **No existe catálogo ni enum de motivos**. Falla técnica es texto descriptivo, la condición DEFECTUOSO controla el tratamiento.
- `observacion`: opcional/null, texto de hasta 500 caracteres.
- `detalles`: arreglo no vacío de objetos. Admite varios artículos y devoluciones parciales/totales según cantidades pendientes. No hay campo de tipo PARCIAL/TOTAL.
- `id_detalle_venta`: obligatorio, entero positivo y perteneciente a esa venta. No se envía id_producto: lo determina el servidor.
- `cantidad`: obligatoria, entera positiva, máximo 4294967295; la suma de líneas de esta solicitud más devoluciones CONFIRMADA no puede superar lo vendido en ese detalle.
- `id_unidad`: opcional/null para CANTIDAD; obligatorio para SERIALIZADO, que exige cantidad 1 por línea. Es el ID del dispositivo vendido, no una cadena de IMEI ni un nuevo dispositivo.
- `condicion`: opcional en API, predeterminada APTO; admite APTO o DEFECTUOSO (el validador recorta y normaliza mayúsculas). La UI la solicita explícitamente.
- `reintegra_inventario`: booleano opcional, predeterminado true. El servidor lo normaliza según modalidad/condición; ver tabla siguiente. La UI envía un booleano explícito coherente.
- `detalles[].motivo`: opcional/null, texto de hasta 500 caracteres.

No se envían usuario, sucursal, fechas, estado, precio, subtotal, total ni datos de pagos/caja/créditos. El backend toma usuario del JWT y calcula valoración en centavos usando precio_unitario histórico × cantidad, sin aplicar nuevamente descuento/impuesto. El total se devuelve como `total_devuelto`; no significa dinero reembolsado.

Se permiten líneas repetidas del mismo detalle de venta (p. ej., un accesorio APTO y otro DEFECTUOSO), sumando cantidades para validar el máximo. Nunca se permite repetir el mismo id_unidad dentro de la solicitud.

## Respuestas exactas disponibles

El listado usa `SELECT d.*` y agrega `numero_venta`, `sucursal` y `usuario`; ordena por id_devolucion descendente. No agrega cliente ni detalles. No hay paginación ni filtros de servidor: la búsqueda por número, venta, motivo, sucursal/usuario y el filtro de estado trabajan sobre el listado recibido.

El detalle devuelve el encabezado `SELECT * FROM devoluciones` con `detalles`. Los campos que requiere/usa el repositorio actual son `id_devolucion`, `numero_devolucion`, `id_venta`, `id_sucursal`, `id_usuario`, `motivo`, `estado`, `total_devuelto`, `observacion`; la pantalla muestra `fecha` cuando está disponible. El repositorio no escribe usuario/fecha específica de confirmación o anulación. Los nombres de venta/sucursal/usuario se reutilizan del listado; si faltan, se muestran las referencias técnicas necesarias.

Cada detalle contiene los campos de detalle_devoluciones usados por el repositorio: `id_detalle_devolucion`, `id_devolucion`, `id_detalle_venta`, `id_producto`, `id_unidad`, `cantidad`, `precio_unitario`, `subtotal`, `condicion`, `reintegra_inventario`, `motivo`. El GET agrega `producto`, `tipo_control`, `imei1`, `imei2`, `numero_serie` mediante JOIN.

Ejemplo abreviado del GET:

```json
{
  "ok": true,
  "data": {
    "id_devolucion": 8,
    "numero_devolucion": "DEV-PRUEBA-001",
    "id_venta": 4,
    "id_sucursal": 2,
    "id_usuario": 7,
    "fecha": "2026-10-28 09:00:00",
    "motivo": "Falla técnica",
    "estado": "BORRADOR",
    "total_devuelto": "100.00",
    "observacion": null,
    "detalles": [
      {
        "id_detalle_devolucion": 9,
        "id_devolucion": 8,
        "id_detalle_venta": 20,
        "id_producto": 2,
        "producto": "Teléfono de prueba",
        "tipo_control": "SERIALIZADO",
        "id_unidad": 11,
        "imei1": "001234567890123",
        "imei2": null,
        "numero_serie": "SERIE-TEST",
        "cantidad": 1,
        "precio_unitario": "100.00",
        "subtotal": "100.00",
        "condicion": "DEFECTUOSO",
        "reintegra_inventario": 0,
        "motivo": "Falla técnica"
      }
    ]
  }
}
```

Los IMEI se conservan como texto con ceros iniciales. Este detalle no expone estado ni ubicación actuales del dispositivo; la condición es la recibida en la devolución. El estado real se comprueba en Inventario/Dispositivos.

Errores de validación: 400 `{ "ok": false, "message": "Datos de entrada inválidos", "errores": [{ "type": "field", "path": "detalles.0.cantidad", "msg": "...", "value": "...", "location": "body" }] }`. Se muestran mensajes `msg`, no valores internos de los objetos de error.

Errores de negocio: `{ "ok": false, "message": "..." }` con 400/404/409. El controlador de Devoluciones convierte errores no controlados a 500 con mensaje genérico. JWT/permisos usan 401/403. La API compartida conserva contexto y mensajes; el servicio local elimina detalles de 500 y nunca muestra HTML/SQL/stack.

## Reglas de accesorios, IMEI e inventario

| Modalidad y condición | Reintegro efectivo | Al confirmar |
| --- | --- | --- |
| CANTIDAD APTO | Según booleano solicitado | Si true, suma cantidad al stock y registra movimiento; si false, no cambia stock |
| CANTIDAD DEFECTUOSO | Siempre false | No suma stock ni crea movimiento de inventario |
| SERIALIZADO APTO | Siempre true | Pasa de VENDIDO a DISPONIBLE, suma 1 al stock y registra movimiento |
| SERIALIZADO DEFECTUOSO | Siempre false | Pasa de VENDIDO a DEFECTUOSO; no suma stock ni crea movimiento de inventario |

Crear valida y guarda BORRADOR/detalles dentro de una transacción, sin modificar stock, estados de dispositivos o movimientos.

Confirmar bloquea primero la venta y después la devolución; exige BORRADOR y misma sucursal que la venta. Revalida detalles, cantidades ya devueltas, vínculos históricos, precios, subtotales, total y reintegros guardados. Para cada IMEI exige:

1. Existencia y pertenencia a detalle_venta_unidades del detalle vendido.
2. Mismo producto y misma sucursal actual que la venta.
3. Estado VENDIDO.
4. Ausencia de otra devolución CONFIRMADA para ese id_unidad (la consulta es global, no solo de esa venta).

Si hay reintegro, crea fila de inventario con stock cero si falta, suma la cantidad y registra movimiento tipo DEVOLUCION, referencia DEVOLUCION/id_devolucion, usuario, id_unidad si corresponde y stock anterior/nuevo. No mueve la unidad a otra sucursal. Para DEFECTUOSO solo actualiza el estado del teléfono, conservando la trazabilidad en el detalle de devolución; no inventa un movimiento de stock.

Todo se confirma en una única transacción y cambia a CONFIRMADA. Repetir confirmación devuelve 409. Anular BORRADOR solo cambia a ANULADA y no afecta inventario. No se puede anular una devolución ya confirmada.

## Cálculo de pendientes y selección de venta en UI

La API no devuelve un saldo retornable directamente. Para seleccionar una venta se consultan GET /ventas/:id y el listado de devoluciones, luego cada detalle de devolución CONFIRMADA de esa venta. Se suman cantidades por id_detalle_venta y se restan de la cantidad histórica vendida. Una lectura incompleta bloquea el formulario: no se asume que hubo cero devoluciones. BORRADOR/ANULADA no consumen el saldo.

GET /ventas/:id no incluye IMEI. Para líneas SERIALIZADO se consulta la factura, cuyos detalles incluyen `unidades: [{ id_unidad, imei1, imei2, numero_serie }]`. Se comprueba vínculo por detalle y se excluyen unidades ya devueltas en esa venta. No se usa el catálogo general de IMEI como sustituto de ese vínculo histórico. Si no hay factura/permisos o no se pueden verificar sus unidades, no se habilita devolución de teléfonos; los accesorios pueden continuar.

La UI muestra cantidad vendida, devuelta confirmada y pendiente por artículo. Admite agregar varias líneas, condiciones diferentes y uno o varios teléfonos (una línea por dispositivo). Impide exceder cantidades acumuladas o repetir una unidad. La disponibilidad actual VENDIDO/sucursal se valida en el backend: la factura no expone esos valores actuales.

Antes de crear se repiten estas lecturas y validaciones. Antes de confirmar/anular se reconsulta el detalle; el backend vuelve a aplicar validaciones transaccionales. Cambiar venta limpia el formulario. El botón Actualizar artículos también lo reinicia y lo advierte.

## Pagos, reembolsos, caja y créditos

El servicio de Devoluciones no llama a servicios/repositorios de pagos, caja o créditos. Crear/confirmar/anular no:

- Reembolsa dinero, anula pagos ni genera pagos negativos.
- Registra egresos ni otros movimientos de caja; no requiere sesión de caja abierta.
- Reduce total de venta/factura, saldo de crédito o cuotas pendientes.
- Genera una nota de crédito ni un reclamo de garantía.

Se permiten ventas CREDITO CONFIRMADA, pero sus obligaciones financieras permanecen sin ajuste. La interfaz lo explica antes de crear y en el detalle. No se agregaron controles ficticios de reembolso ni se tocaron los módulos financieros.

## Defectos y limitaciones encontrados (sin corregir backend)

- **SQL archivado incompatible:** database/01_schema_tienda_celulares.sql define motivo_general, estados REGISTRADA/PROCESADA/CANCELADA y otros campos de detalle (`condicion_producto`, `accion`), mientras el repositorio actual requiere numero_devolucion, motivo, total_devuelto, id_producto, precio_unitario, subtotal, condicion, reintegra_inventario y estados BORRADOR/CONFIRMADA/ANULADA. No se ejecutó ese SQL ni se comprobó la BD desplegada; una instalación basada solo en ese archivo necesita revisión del esquema por sus responsables. El frontend sigue el código actual del backend.
- **Interacción con anulación de ventas:** en saleService.anularVenta, tras comprobar que no haya pagos aplicados, los artículos CANTIDAD se reintegran por la cantidad completa vendida sin consultar devoluciones confirmadas. Por inspección del código, anular después una venta de accesorios ya devueltos puede duplicar ese reintegro. No se modificó Ventas ni se ejecutó ese escenario en BD; queda reportado para revisión del backend. En serializados la anulación exige VENDIDO y puede rechazar la unidad ya devuelta.
- **IMEI revendido:** unidadYaDevuelta consulta cualquier devolución CONFIRMADA de ese dispositivo. Un teléfono APTO revendido conserva esa devolución y el servicio puede rechazar una segunda devolución aunque corresponda a otra venta. Se respeta la restricción real; el historial local por venta no puede anticipar todos esos casos y se conserva el 409 del servidor.
- No existen reembolsos/ajustes financieros, recepción/aprobación separada, edición, reversión o idempotencia. No se guardan usuario/fecha específicos de confirmación/anulación por estas funciones.
- No hay endpoint de cantidades pendientes ni historial por venta: calcularlas requiere listado completo y una lectura por devolución confirmada relevante. Puede ser costoso con mucho historial. Las lecturas no forman una fotografía transaccional; el servidor resuelve cualquier cambio concurrente al escribir.
- El listado no proporciona cliente; solo se muestra donde la venta consultada lo aporta. No se inventan nombres ni estados desde otros módulos.
- Un movimiento DEFECTUOSO no suma inventario disponible y no genera movimiento de stock: se verifica el cambio del dispositivo y su devolución, no un movimiento ficticio.
- Si una respuesta de escritura se pierde, hay que buscar por número y consultar antes de repetir. Un error de red no demuestra que la operación no se ejecutó. La UI no reintenta POST y conserva el éxito si solo falla la actualización posterior.
- Pruebas de modelos/servicios, validadores reales, backend con repositorio simulado y SSR. Pendiente revisión visual/interactiva y validación del esquema real en un entorno de pruebas. No se certifica producción.

## Archivos y verificación

Creados:

- `src/services/returnService.js`.
- `src/views/returns/returnModel.js`.
- `src/views/returns/Returns.jsx`.
- `src/views/returns/ReturnForm.jsx`.
- `src/views/returns/ReturnDetail.jsx`.
- `tests/returns.test.mjs` y `tests/returns-render.test.mjs`.
- `docs/devoluciones.md`.

Modificado: `src/routes.js`, carga diferida de `/devoluciones`. La navegación ya tenía la entrada y no necesitó cambios. Se reutilizan api/JWT, formatos de Caja y moneda/listados de Ventas sin modificar esos módulos.

La pantalla usa CoreUI, tablas responsive, modales desplazables, formatos de Nicaragua y colores compatibles con claro/oscuro. Crear requiere revisión y casilla explícita; confirmar/anular requieren su propia confirmación. Una referencia síncrona más controles deshabilitados bloquean doble envío antes del siguiente render. Después de POST se cierra la confirmación, se muestra el detalle devuelto y se actualiza el listado. Un conflicto invalida la selección para exigir nueva consulta; una respuesta inválida no conserva un detalle anterior como vigente.

Desde `frontend`:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Los tests sustituyen fetch y ejecutan el servicio real del backend en un contexto aislado con un repositorio simulado. No importan config/database, no abren MySQL ni realizan devoluciones reales. Cubren listado/detalle, venta elegible, parciales, máximos, condiciones, vínculo de IMEI, duplicados, creación y relecturas, confirmación/anulación, concurrencia, permisos, validadores reales, HTML/500/red y doble envío. Verifican que crear no mueve stock; APTO reintegra según modalidad; DEFECTUOSO no suma stock y marca el teléfono correctamente.

Resultados finales: ESLint correcto (0 errores), build correcto y **114 pruebas aprobadas, 0 fallidas**, incluidas 17 específicas de Devoluciones. `git diff --check` correcto. El build conserva los avisos existentes de Vite sobre configLoader native/__dirname y bundle superior a 500 kB. Git final solo muestra routes.js y los archivos nuevos de Devoluciones; los módulos validados permanecen intactos.

## Prueba manual exacta: accesorio

Solo en un entorno con datos de prueba y esquema compatible con el backend actual. No usar producción ni anular posteriormente la venta como método para deshacer la devolución.

1. Reutilizar servidores existentes. Si están detenidos, ejecutar `npm.cmd start` desde backend con configuración de pruebas y `npm.cmd start -- --port 3001` desde frontend. Abrir `http://localhost:3001/#/devoluciones` e iniciar sesión.
2. Usar ROOT o DEVOLUCIONES_VER/CREAR/CONFIRMAR/ANULAR y VENTA_VER. Para este caso no hace falta FACTURA_IMPRIMIR si la venta solo tiene accesorios.
3. Elegir una venta CONFIRMADA de prueba con un accesorio CANTIDAD y al menos una unidad pendiente de devolver. Anotar número de venta, producto, cantidad vendida y stock actual S en la sucursal de la venta. Si existen devoluciones anteriores, anotarlas para comprobar el pendiente. No crear ni modificar ventas desde este módulo.
4. Pulsar Nueva devolución y seleccionar esa venta. Comprobar cliente/sucursal, artículos vendidos, cantidad devuelta confirmada y pendiente. Si alguna lectura falla, no debe habilitarse un formulario con saldo supuesto.
5. Escribir un número único, por ejemplo `DEV-ACC-` seguido de fecha/hora actual, motivo `Accesorio sin uso` y observación opcional. Elegir el artículo; probar cantidad 0, fraccionaria y mayor al pendiente: no debe agregarse. Introducir 1, condición APTO, marcar Reintegrar estas unidades aptas y pulsar Agregar artículo.
6. Pulsar Revisar devolución; verificar venta, motivo, cantidad 1, APTO y reintegro Sí. Marcar confirmación y pulsar Crear borrador una sola vez. Esperar 201/BORRADOR. Comprobar que el stock sigue S: crear no reintegra todavía.
7. Consultar detalle, revisar artículos y pulsar Confirmar devolución. Marcar la casilla explícita y pulsar Confirmar y procesar inventario una sola vez. Esperar 200/CONFIRMADA.
8. Actualizar Inventario: stock esperado S+1, sin otras operaciones concurrentes. Con MOVIMIENTO_VER, comprobar un movimiento tipo DEVOLUCION, cantidad +1 y referencia DEVOLUCION al ID mostrado en el detalle.
9. Actualizar Devoluciones y volver a consultar: no deben ofrecerse confirmar ni anular. Abrir otro formulario para la venta y comprobar que el pendiente bajó en 1. No enviar otra devolución si no queda saldo.
10. Verificar que pagos, caja y crédito/cuotas, si existían, no fueron ajustados. El total_devuelto mostrado es valoración histórica, no un recibo de reembolso.
11. Opcional: si hay saldo suficiente, crear otro borrador de prueba y anularlo con confirmación. Debe quedar ANULADA, sin cambiar stock ni pendiente confirmado. Para probar accesorio DEFECTUOSO, usar otra unidad pendiente: al confirmar no debe sumar stock ni movimiento.

## Prueba manual exacta: teléfono por falla técnica

1. En el mismo entorno de pruebas usar ROOT, o los permisos anteriores más FACTURA_IMPRIMIR. Para verificar después dispositivos se necesita IMEI_GESTIONAR. Identificar una venta CONFIRMADA de prueba con factura y teléfono SERIALIZADO pendiente, IMEI vendido, estado actual VENDIDO y sucursal actual igual a la de la venta. Anotar IMEI 1/2, serie y stock disponible actual S.
2. Ir a Nueva devolución y seleccionar la venta. Verificar que el artículo tiene pendiente 1 y la factura permite identificar su dispositivo exacto. Si falta factura/permisos, el teléfono debe quedar bloqueado con advertencia; no introducir otro IMEI a mano.
3. Introducir número único `DEV-FALLA-` seguido de fecha/hora actual, motivo `Falla técnica` y observación descriptiva. Seleccionar teléfono e IMEI exacto; condición DEFECTUOSO y motivo de artículo, por ejemplo `No enciende`. La cantidad debe ser 1 y el reintegro No.
4. Pulsar Agregar artículo. El mismo dispositivo no debe poder agregarse otra vez; quitar y volver a seleccionar no lo duplica. Pulsar Revisar devolución, verificar venta/IMEI/condición, marcar confirmación y Crear borrador. Esperar BORRADOR. El dispositivo debe seguir VENDIDO y el stock S.
5. Consultar detalle; verificar IMEI exacto, DEFECTUOSO y reintegro No. Pulsar Confirmar devolución, revisar la advertencia financiera y de inventario, marcar confirmación y Confirmar y procesar inventario. Esperar CONFIRMADA.
6. Actualizar Inventario/Dispositivos: el mismo IMEI/serie debe aparecer DEFECTUOSO en la misma sucursal y no estar disponible para venta. El stock disponible debe seguir S. No se espera un movimiento de stock por este detalle defectuoso: el backend solo cambia el estado de la unidad y confirma la devolución.
7. Consultar la devolución y venta otra vez: no se ofrecen transiciones de esa devolución y ese IMEI no debe quedar retornable para esa venta. No reembolsar/anular pagos ni modificar cuotas para simular una integración inexistente.
8. Para probar un teléfono APTO, usar otro dispositivo VENDIDO pendiente y un número nuevo: APTO fuerza reintegro Sí y, al confirmar, lo deja DISPONIBLE y suma 1. No cambiar la condición de una devolución ya confirmada.

## Comprobaciones adicionales

- Probar búsqueda por número/venta/motivo y filtro de estado, limpiar filtros y actualizar. Revisar móvil y temas claro/oscuro.
- Con usuarios de prueba ya configurados comprobar 403 y bloqueo de la acción, ROOT universal y aviso si falta FACTURA_IMPRIMIR. No cambiar roles ni BD como parte de esta prueba.
- En dos pestañas abrir el mismo borrador. Confirmar/anular en una y tratar de procesar en otra: reconsulta o 409 debe impedir repetir. Dos borradores sobre una misma unidad/cantidad compiten al confirmar; no hay reserva local.
- En Network hacer doble clic rápido tras marcar confirmación: debe haber un solo POST. No repetir una escritura cuyo resultado se desconoce.
- Simular Offline antes de una lectura: error seguro, sin asumir saldo cero. Si falla la actualización posterior a un POST exitoso, conservar el éxito y consultar al restablecer conexión.
- Para 401 invalidar temporalmente el token en una sesión de pruebas, consultar y volver a iniciar sesión; no compartir JWT en capturas/registros.

No se hicieron commit ni push. Pendiente validación manual antes de guardar en GitHub.
