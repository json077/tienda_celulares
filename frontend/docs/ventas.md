# Ventas

Implementación de `/ventas` con React/CoreUI, servicios centralizados y el Bearer JWT existente. No se modificó backend, autenticación ni otros módulos; no se instalaron dependencias.

## Contrato comprobado

Se revisaron rutas, controlador, servicio, repositorio y validadores de ventas; rutas/controladores/servicios relacionados de clientes, productos, inventario, unidades, pagos, caja, tipos de cambio y créditos, además de repositorios de inventario/unidades/pagos, middleware de permisos y esquema SQL.

Todas las rutas siguientes tienen prefijo `/api` y requieren JWT.

| Endpoint utilizado                | Permiso real       |
| --------------------------------- | ------------------ |
| GET `/ventas`                     | `VENTA_VER`        |
| GET `/ventas/:idVenta`            | `VENTA_VER`        |
| POST `/ventas`                    | `VENTA_CREAR`      |
| POST `/ventas/:idVenta/confirmar` | `VENTA_CONFIRMAR`  |
| POST `/ventas/:idVenta/anular`    | `VENTA_ANULAR`     |
| GET `/ventas/:idVenta/factura`    | `FACTURA_IMPRIMIR` |
| GET `/clientes`                   | `CLIENTES_VER`     |
| GET `/productos`                  | `PRODUCTOS_VER`    |
| GET `/inventario`                 | `INVENTARIO_VER`   |
| GET `/unidades`                   | `IMEI_GESTIONAR`   |
| GET `/pagos/venta/:idVenta`       | `PAGO_REGISTRAR`   |

ROOT tiene acceso total según el middleware. AuthContext proporciona identidad y roles, pero **no permisos efectivos**. No hay endpoint de consulta de permisos de ventas. La interfaz no atribuye permisos por nombres de rol: el backend autoriza cada solicitud; se presentan 403 y se deshabilitan acciones de escritura/factura rechazadas durante la sesión del componente. No se realizan POST para sondear permisos. Falta de acceso a unidades impide vender serializados, pero permite continuar con CANTIDAD. Falta de acceso a pagos/factura se muestra como advertencia y no se interpreta como ausencia de pagos/unidades.

El listado no admite filtros/paginación del servidor: búsqueda por ID, número, cliente, identificación, sucursal y vendedor, y filtros por estado/sucursal/condición se aplican al listado recibido.

### Creación

```json
{
  "id_cliente": 1,
  "id_sucursal": 1,
  "numero_venta": "NUMERO-INGRESADO-POR-USUARIO",
  "tipo_venta": "CONTADO",
  "observacion": null,
  "detalles": [{ "id_producto": 1, "cantidad": 2, "descuento": 0, "impuesto": 0 }]
}
```

Los IDs deben ser enteros positivos, número obligatorio de hasta 50 caracteres y único; observación opcional de hasta 500; tipo CONTADO/CREDITO; uno o más detalles, cantidad entera positiva y descuentos/impuestos no negativos. No se envían precio, costo, total, moneda, usuario ni IMEI en la creación. Backend valida cliente, sucursal y producto activos, obtiene `precio_venta`, fija garantía y calcula importes con redondeo a dos decimales.

Respuestas de lectura/escritura: `{ ok: true, data }`, con `message` en escrituras; crear retorna 201. Listado y detalle incluyen encabezado, datos de relaciones y `detalles`; el detalle no incluye IMEI ni pagos. Errores usan `message`; validación incluye `errores[].msg`. `api.js` conserva status y errores; se muestran 400/401/403/404/409/500 y errores de conexión.

### Flujo y estados

1. Nueva venta consulta productos, clientes, inventario y unidades. Solo se seleccionan clientes/productos activos. Sucursales se deducen de filas reales de inventario, sin inventar catálogo ni stock; el backend comprueba actividad de sucursal.
2. Agregar productos, cantidades, descuentos por importe e impuesto por importe (no hay cálculo automático de tasas fiscales). Una línea por producto. Cambiar sucursal vacía el carrito.
3. Revisión muestra cliente, sucursal, productos, IMEI seleccionados, precios, ajustes e importes estimados NIO; exige aceptación explícita para guardar.
4. Antes de POST se vuelve a consultar disponibilidad. Se crea **BORRADOR**: no reserva stock, no asigna IMEI y no genera factura. Los precios pueden cambiar respecto al catálogo inicial; se muestran los importes definitivos retornados por servidor antes de confirmar.
5. Desde detalle, **Revisar y confirmar** vuelve a consultar venta, stock y unidades. Los IMEI se seleccionan nuevamente porque el borrador no los persiste ni reserva. La revisión exige una segunda aceptación explícita. POST confirmar envía `{ unidades: [{ id_detalle_venta, id_unidad }] }`, utilizando los IDs reales retornados por backend. Para CANTIDAD se envía arreglo vacío.
6. Confirmar produce **CONFIRMADA**, descuenta inventario y genera factura; no registra cobros, no abre caja y no crea un crédito.
7. Solo CONFIRMADA puede anularse. Produce **ANULADA** y revierte inventario/factura, sin eliminación física.

No existen endpoints para editar o eliminar borradores ni para cancelar un BORRADOR. La UI no ofrece esas operaciones.

## CANTIDAD, SERIALIZADO y stock

- CANTIDAD: entero positivo limitado a stock real de producto/sucursal. La validación agrega cantidades si recibe varias líneas del mismo producto. Confirmación bloquea venta/inventario con `FOR UPDATE`, vuelve a validar stock y descuenta; registra movimiento VENTA negativo. Costo histórico proviene de la última compra confirmada (0 si no hay costo).
- SERIALIZADO: unidades proceden de GET `/unidades`, filtradas por producto, sucursal actual y estado **DISPONIBLE**. Debe coincidir exactamente la cantidad; se rechazan IDs repetidos y unidades ajenas/no disponibles. Se muestran IMEI1/IMEI2/serie reales. No se crean unidades desde Ventas.
- Backend bloquea cada unidad, verifica que no esté asociada a otra venta CONFIRMADA, asigna por ID de detalle, marca **VENDIDO**, descuenta inventario por unidad y registra movimientos. El costo histórico es el promedio de costos de las unidades con respaldo de última compra confirmada.
- La disponibilidad consultada puede cambiar entre revisión y confirmación. El servidor es la autoridad final y revierte toda la transacción si falta stock o una unidad dejó de estar disponible; la UI muestra el error. Para renovar disponibilidad se vuelve al detalle y se abre nuevamente la revisión.

## Precios, descuentos, moneda

Precio no editable: el servidor toma `productos.precio_venta` al crear y lo guarda en el detalle. Descuento es **importe total de línea**, no porcentaje ni importe por unidad. Debe ser no negativo, no superar bruto, requerir `permite_descuento` y respetar `round(bruto * porcentaje_descuento_maximo / 100)`. Impuesto también es importe total de línea no negativo. Total = bruto − descuento + impuesto. No se agrega IVA ni información fiscal ficticia.

Ventas y facturas no tienen campo de moneda ni tipo de cambio. Se muestran importes en la moneda base **NIO**, respaldada por los servicios de pagos/cambio (conversión a `monto_base` y mensajes C$). No existe selección USD en POST ventas. Los pagos sí incluyen moneda, monto, tipo_cambio histórico y monto_base NIO; estos datos se muestran al consultar pagos y en la impresión si son accesibles.

## Pagos, caja y crédito: contratos relacionados

Se consultan pagos existentes; este módulo no registra/anula pagos, abre/cierra cajas ni crea/paga planes de crédito. Son operaciones independientes, no parte del payload de venta. No se aparenta que CONTADO ya esté pagado ni que CREDITO ya tenga cuotas.

Endpoints reales analizados, **no invocados como escrituras por este módulo**:

| Endpoints relacionados                            | Permisos                        |
| ------------------------------------------------- | ------------------------------- |
| POST `/pagos`; POST `/pagos/:idPago/anular`       | `PAGO_REGISTRAR`; `PAGO_ANULAR` |
| GET `/cajas`; GET `/cajas/sesiones/:idSesionCaja` | `CAJA_VER`                      |
| POST `/cajas/abrir`                               | `CAJA_ABRIR`                    |
| POST `/cajas/sesiones/:idSesionCaja/cerrar`       | `CAJA_CERRAR`                   |
| POST `/cajas/sesiones/:idSesionCaja/movimientos`  | `CAJA_MOVIMIENTO`               |
| GET `/tipos-cambio/moneda/:idMoneda`              | JWT sin permiso adicional       |
| POST `/tipos-cambio`                              | `TIPO_CAMBIO_GESTIONAR`         |
| GET `/creditos`; GET `/creditos/:idCredito`       | `CREDITOS_VER`                  |
| POST `/creditos`                                  | `CREDITOS_CREAR`                |
| POST `/creditos/cuotas/:idCuota/pagar`            | `CREDITOS_PAGAR`                |
| POST `/creditos/:idCredito/anular`                | `CREDITOS_ANULAR`               |

Pagos requieren venta CONFIRMADA, moneda activa, monto positivo y método EFECTIVO/TARJETA/TRANSFERENCIA. NIO usa tasa 1; otras monedas, incluida USD si existe activa, requieren último cambio activo. No se inventan IDs de moneda. Se impide sobrepago en monto base. EFECTIVO requiere sesión ABIERTA de caja activa de la misma sucursal y genera movimiento de caja; TARJETA/TRANSFERENCIA requieren referencia. Anulación de efectivo requiere sesión abierta y revierte caja; un pago de cuota no puede anularse desde pagos generales.

Caja impide dos sesiones abiertas para una caja; cierre compara monto real con sistema; egreso manual exige saldo suficiente. No tiene relación directa con confirmar una venta.

Crédito se crea aparte para venta CONFIRMADA de tipo CREDITO y sin crédito previo. Financia total menos pagos aplicados; interés entre 0 y 100%, 1–120 cuotas, frecuencia SEMANAL/QUINCENAL/MENSUAL y fecha de inicio. Cuotas ajustan último importe por redondeo. Crear venta CREDITO no solicita esos campos porque no pertenecen a su contrato. Anulación de crédito exige ACTIVO y ausencia de pagos de crédito.

## Anulación

Acción visible para CONFIRMADA y sin pagos aplicados conocidos. Si no se pudieron consultar pagos, se advierte que se desconoce esa información y el backend aplica la restricción. Exige revisión y casilla de autorización. Backend rechaza con 409 si existen pagos APLICADO, repone cantidades y unidades VENDIDO de la sucursal original, registra movimientos ANULACION y anula factura/venta. Se refrescan listado y detalle. No se borra ninguna venta.

**Inconsistencia existente:** `saleService.anularVenta` no consulta créditos ni anula su plan. Puede quedar un crédito activo vinculado a una venta ANULADA sin pagos. Se advierte antes de anular; requiere tratamiento de negocio en backend en un trabajo separado. No se cambió automáticamente.

## Factura y detalle

Al confirmar se genera `FAC-` + ID de venta a ocho dígitos, serie A, dentro de la misma transacción. GET factura solo admite venta CONFIRMADA y permiso FACTURA_IMPRIMIR. Devuelve identificación/nombre/dirección de cliente capturados en factura, sucursal/dirección/teléfono, vendedor, importes y detalles con unidades vendidas. No hay razón social fiscal, RUC ni numeración fiscal adicional expuesta.

Vista HTML/CSS imprimible con **Tienda Celulares**, número/serie, estado, fecha, cliente, identificación, sucursal, vendedor, detalle/SKU/IMEI, cantidades, precios históricos, descuentos, impuesto, total NIO y condición. Botón **Imprimir factura** usa `window.print()`; CSS oculta el resto de la aplicación. No instala PDF. Pagos se rotulan como consultados, mostrando moneda/tasa/método/estado cuando están disponibles; no se inventa un método para ventas sin pagos.

Detalle incluye encabezado completo, productos, garantía/costo histórico, datos de factura y pagos accesibles. Los IMEI vendidos se obtienen exclusivamente de GET factura: no se deducen del estado VENDIDO en inventario, pues no identifica la venta. Ventas ANULADAS y usuarios sin FACTURA_IMPRIMIR no pueden recuperar esos IMEI con los endpoints de venta existentes. El backend une nombre/SKU/tipo de producto, sucursal y usuario actuales: no hay historial de esos textos; los precios/descuentos/impuestos/garantías sí están guardados en detalle y el cliente de factura tiene snapshot.

## Transacciones y seguridad

Creación, confirmación y anulación usan transacciones propias, commit/rollback y liberación de conexión. Confirmación incluye stock, unidades, costo, movimientos, estado y factura; anulación incluye stock, unidades, movimientos y factura/venta. Pagos, créditos y operaciones de caja tienen transacciones separadas: no hay transacción global venta+pago+crédito.

Las respuestas se obtienen después del commit. Si se interrumpe una respuesta, puede haberse aplicado la escritura: se pide comprobar listado/detalle antes de repetir. No hay idempotency key ni reintentos automáticos. Un guard con ref impide doble envío y se deshabilitan botones/cierre durante operaciones. Las consultas iniciales se abortan al desmontar; se mantiene infraestructura de JWT y manejo de sesión existente.

## Archivos

Creados:

- `src/services/saleService.js`
- `src/views/sales/Sales.jsx`
- `src/views/sales/SaleForm.jsx`
- `src/views/sales/SaleSummary.jsx`
- `src/views/sales/SaleDetail.jsx`
- `src/views/sales/SaleConfirmation.jsx`
- `src/views/sales/saleModel.js`
- `src/views/sales/sales.css`
- `tests/sales.test.mjs`
- `tests/sales-render.test.mjs`
- `docs/ventas.md`

Modificado: `src/routes.js` para sustituir el placeholder de `/ventas`.

## Verificación sin datos reales

Resultado final: ESLint sin errores; build exitoso; 19 pruebas aprobadas (Ventas y regresión de Compras); `git diff --check` sin errores. Build conserva advertencias sobre `__dirname` en configuración Vite y bundle principal mayor a 500 kB, sin cambios de alcance para corregirlas.

- `npm.cmd run lint`.
- `npm.cmd run build`.
- `git diff --check`.
- `node --test --test-concurrency=1 tests/sales.test.mjs tests/sales-render.test.mjs tests/purchases.test.mjs tests/purchases-render.test.mjs`.
- Pruebas de reglas de stock, descuentos y serializados; servicios con fetch simulado y JWT; errores HTTP 400/401/403/404/409/500; payload de creación ejecutado contra validadores reales de backend, sin llamadas a base de datos.
- Renderizado estático React/CoreUI con Vite SSR de listado (AuthProvider), formulario, revisión, confirmación, detalle, IMEI y pagos. No equivale a prueba interactiva en navegador ni impresión física/PDF.
- No se registraron, confirmaron o anularon ventas reales, ni se modificó inventario. No se ejecutaron escrituras de caja/pagos/créditos ni commit/push.

Limitaciones adicionales: no catálogo de sucursales ni permisos efectivos, monedas o métodos expuesto como catálogo de Ventas; borradores no editables/cancelables; IMEI iniciales deben reseleccionarse en confirmación; facturas anuladas no consultables por esta API; filtros locales sin paginación del servidor. Son restricciones del contrato existente, no endpoints simulados.
