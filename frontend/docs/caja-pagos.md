# Caja y pagos

Implementación frontend en `/caja`, dentro de la entrada Caja existente. React + CoreUI, sin dependencias adicionales ni cambios al backend. Venta, factura y pago siguen siendo operaciones separadas.

## Contrato inspeccionado

Se revisaron `backend/src/routes/{cash,payment,exchangeRate,sale,credit}Routes.js`, los controllers, services, validators y repositories de caja, pagos y tipos de cambio, las consultas de ventas, las reglas de crédito y el middleware de permisos. Los códigos de permisos se contrastaron con la tabla `permisos` de `respaldo_descargado_prueba.sql`. No se ejecutaron consultas a la base de datos ni se usó el respaldo como datos de pantalla.

Todas las llamadas usan `api.js`, JWT de `localStorage` y la base `http://localhost:3000/api` existente.

| Operación                             | Endpoint real                                        | Permiso real                    |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| Catálogo de cajas                     | `GET /api/cajas`                                     | `CAJA_VER`                      |
| Apertura                              | `POST /api/cajas/abrir`                              | `CAJA_ABRIR`                    |
| Detalle de sesión                     | `GET /api/cajas/sesiones/:idSesionCaja`              | `CAJA_VER`                      |
| Cierre                                | `POST /api/cajas/sesiones/:idSesionCaja/cerrar`      | `CAJA_CERRAR`                   |
| Movimiento manual                     | `POST /api/cajas/sesiones/:idSesionCaja/movimientos` | `CAJA_MOVIMIENTO`               |
| Listado de ventas                     | `GET /api/ventas`                                    | `VENTA_VER`                     |
| Detalle de venta                      | `GET /api/ventas/:idVenta`                           | `VENTA_VER`                     |
| Pagos de una venta                    | `GET /api/pagos/venta/:idVenta`                      | `PAGO_REGISTRAR`                |
| Registro de pago                      | `POST /api/pagos`                                    | `PAGO_REGISTRAR`                |
| Última tasa activa / verificar moneda | `GET /api/tipos-cambio/moneda/:idMoneda`             | Solo JWT, sin permiso adicional |

Existen también `POST /api/pagos/:idPago/anular` (`PAGO_ANULAR`) y `POST /api/tipos-cambio` (`TIPO_CAMBIO_GESTIONAR`). No se invocan desde esta pantalla: el alcance implementado es registrar/consultar pagos y utilizar tasas existentes. No se inventó `PAGO_VER` ni un permiso para consultar tasas.

`/auth/me` y login exponen roles, no el catálogo efectivo de permisos del usuario. La interfaz no deduce permisos a partir de roles como VENDEDOR o ADMINISTRADOR: el servidor autoriza cada solicitud. Después de un 403 se deshabilita la acción correspondiente cuando se conoce su permiso. ROOT conserva acceso universal como establece el middleware. Los errores 401/403 se muestran con `apiErrorMessage`; la normalización de `api.js` admite tanto `errores[].msg` como `errors[].{campo,mensaje}`, conservando el contrato anterior.

## Apertura y consulta

1. Elegir una caja activa del catálogo y proporcionar monto inicial NIO mayor o igual a cero y observación opcional (máximo 500 caracteres).
2. Marcar la confirmación y abrir. Payload: `{ id_caja, monto_apertura, observacion }`, IDs/importes numéricos, texto recortado y observación vacía como `null`.
3. El backend toma el usuario del JWT, comprueba caja activa y ausencia de sesión abierta, crea sesión ABIERTA y movimiento APERTURA en una transacción.
4. La respuesta `data` es la sesión completa. Se muestra ID, caja, sucursal, usuario, fecha legible en `es-NI` / `America/Managua`, estado y monto inicial.
5. Se puede recuperar una sesión por su ID. Conservar el ID para recuperarla después de recargar o cambiar de módulo; no se persiste una supuesta sesión activa en el navegador.

El catálogo distingue caja activa/inactiva; eso no equivale a sesión ABIERTA/CERRADA. No existe un endpoint para listar sesiones ni buscar la sesión abierta de una caja. Solo se bloquea anticipadamente la duplicación de una sesión ya consultada; las demás las rechaza el servidor con 409. Una sesión CERRADA no habilita movimientos ni cierre ni pagos en efectivo.

## Consulta y registro de pagos

1. Seleccionar una venta del listado real y consultar su detalle y pagos. Se muestran número, cliente, sucursal, condición, estado y total NIO.
2. La tabla compartida con Ventas muestra monto original, moneda, tasa histórica, monto base NIO, método, referencia, estado, sesión, usuario y fecha legible. Los ANULADOS se conservan visibles pero no suman al importe aplicado.
3. El saldo informativo es `total de venta - suma de monto_base de pagos APLICADOS`. No se deduce de CONFIRMADA y no se muestra si no se pudieron consultar pagos o faltan importes válidos. Este cálculo permite orientar el cobro; el saldo definitivo siempre lo calcula el backend.
4. Se habilita registro para CONTADO CONFIRMADA con saldo positivo consultado. EFECTIVO requiere una sesión consultada ABIERTA de la misma sucursal de la venta. TARJETA y TRANSFERENCIA requieren referencia no vacía (máximo 150 caracteres) y no se asocian a una sesión.
5. Consultar el ID de moneda configurado. La respuesta de tipos de cambio debe identificar NIO o USD y estar activa, con tasa positiva. No se suponen IDs 1/2: esos IDs pueden variar por instalación. No existe endpoint de catálogo de monedas en las rutas actuales. Una moneda inexistente, inactiva o sin tasa se presenta como error, nunca como una tasa ficticia.
6. Introducir monto original positivo y confirmar venta, monto, moneda y método. Se bloquean importes que superen el saldo convertido con la tasa consultada. La equivalencia mostrada es orientativa y está rotulada como tal.
7. Antes de enviar, se vuelven a consultar venta, pagos, sesión (solo efectivo) y tasa. Si cambia la tasa, se exige revisar y confirmar de nuevo. El servidor vuelve a validar todas las reglas dentro de su transacción.
8. Payload exacto: `{ id_venta, id_moneda, metodo, monto, id_sesion_caja, referencia }`. Para pagos no efectivos `id_sesion_caja` es `null`. Nunca se envía `id_usuario`, tasa o monto base; el servidor los determina.
9. El resultado es `{ pago, total_venta, total_pagado, saldo_pendiente }` dentro de `data`. Se conserva ese comprobante con los totales del servidor y se vuelve a consultar el listado de pagos. Si falla esa consulta, se invalida el listado anterior y se impide cobrar con el saldo anterior.

El módulo ofrece enlace a Ventas con búsqueda por número de venta. Ventas reutiliza `PaymentsTable`, y `paymentService.listForSale` reutiliza `saleService.payments`, evitando otra implementación de consulta. No se cambia el flujo de confirmación ni la emisión de factura.

## Monedas y relación venta-pago-caja

Para NIO el backend fija tasa 1. Para USD obtiene la última tasa activa ordenada por `fecha DESC, id_tipo_cambio DESC` al registrar, y guarda `tipo_cambio` y `monto_base` en el pago. La consulta previa no bloquea la tasa: otra operación puede cambiarla antes del POST; la respuesta del servidor es la autoridad. El frontend no permite editar la tasa ni crear tasas históricas.

Un pago EFECTIVO crea en la misma transacción un movimiento de caja `VENTA`, referencia `PAGO`, `id_referencia = id_pago`, por el `monto_base` NIO. TARJETA/TRANSFERENCIA no generan ese movimiento ni requieren caja. El usuario procede del JWT; no se impone que sea el usuario de apertura porque el backend no exige esa restricción.

La caja representa los importes base NIO según el modelo actual del backend. No hay desglose de efectivo físico por moneda. No se reconstruyen movimientos ni ingresos/egresos de sesión sumando pagos de ventas: sería incompleto y podría omitir movimientos manuales, anulaciones o cuotas.

## Cierre

1. Seleccionar una sesión ABIERTA. Introducir monto contado NIO obligatorio, mayor o igual a cero, y observación opcional hasta 500 caracteres.
2. Confirmar la operación. Antes del POST se consulta otra vez el estado de sesión.
3. Enviar `{ monto_cierre_real, observacion }` a la ruta real de cierre.
4. El servidor bloquea la sesión, suma APERTURA/VENTA/INGRESO y resta EGRESO/ANULACION, calcula diferencia `real - sistema` y cierra la sesión.
5. La respuesta contiene `data.sesion` y `data.resumen` (`monto_sistema`, `monto_real`, `diferencia`, `resultado`: CUADRADA/SOBRANTE/FALTANTE). La pantalla muestra los campos equivalentes persistidos en la sesión: `monto_cierre_sistema`, `monto_cierre_real`, `diferencia`, usuario y fecha de cierre. Nunca se calcula el monto esperado o la diferencia en el frontend.

El formulario exige confirmación explícita y se deshabilita durante solicitudes. Un guard síncrono con `useRef` impide dobles envíos, además del estado visual. No se reintentan POST automáticamente; si se pierde una respuesta, hay que consultar antes de repetir.

## Movimientos manuales

Con sesión ABIERTA, el formulario permite INGRESO/EGRESO con monto positivo NIO y concepto obligatorio hasta 255 caracteres. Payload `{ tipo, monto, concepto }`. La respuesta real muestra `movimiento`, `saldo_anterior` y `saldo_actual` del instante de la operación. No se presenta ese saldo histórico como total actual después de otros cobros. Los egresos que exceden el saldo los rechaza el backend; no existe una consulta de saldo de sesión abierta para anticiparlo con exactitud.

## Riesgos y límites reales

- **Movimientos no consultables:** no existe GET de movimientos de caja, listado de sesiones ni totales de sesión abierta. El detalle de sesión tampoco contiene movimientos. Por tanto, la pantalla no puede demostrar individualmente el movimiento automático de un pago, aunque sí muestra pago/sesión y los totales de cierre calculados por servidor. Esto limita ese paso de la prueba manual, sin impedir abrir, cobrar y cerrar. No se modificó backend ni se inventó un endpoint.
- **Crédito:** `paymentService.registrarPago` del backend consulta `tipo_venta` pero no comprueba crédito activo ni aplica el pago a cuotas. Un POST genérico sobre una venta CREDITO con crédito activo puede reducir el saldo de venta sin actualizar cuotas. Se documenta como riesgo del backend. El frontend permite consultar esas ventas pero bloquea todo registro genérico sobre CREDITO, sin distinguir por supuestos ni crear planes. El flujo independiente real utiliza `POST /api/creditos` (`CREDITOS_CREAR`) y `POST /api/creditos/cuotas/:idCuota/pagar` (`CREDITOS_PAGAR`), fuera de este módulo. La protección backend de anulación de pagos de cuotas no subsana ese riesgo de registro.
- **Sin catálogo de monedas:** se necesita conocer el ID configurado; el código, actividad y tasa se verifican por API antes de cobrar. La UI no carga monedas del respaldo SQL.
- **Saldos y concurrencia:** los listados no entregan saldo agregado por venta. Se calcula solo al consultar pagos de una venta, sin disparar una petición por cada fila. No existe garantía de tasa/saldo inmutable entre GET y POST; el servidor valida el estado definitivo.
- **Permisos:** al no recibirse permisos efectivos en autenticación, las acciones se autorizan en servidor y sus errores son visibles; no se promete ocultación anticipada por permiso.
- **Anulación de pagos y edición de tasas:** no implementadas, aunque existen endpoints independientes. No forman parte del flujo solicitado abrir/pagar/cerrar.
- **Cobertura:** las pruebas usan fetch simulado, validadores y renderizado estático, no una sesión real de navegador ni una base real. La prueba manual operativa queda pendiente del usuario.

## Archivos

Creados:

- `src/services/cashService.js`
- `src/services/paymentService.js`
- `src/views/cash/Cash.jsx`
- `src/views/cash/CashDetail.jsx`
- `src/views/cash/CashOperation.jsx`
- `src/views/cash/PaymentForm.jsx`
- `src/views/cash/PaymentsTable.jsx`
- `src/views/cash/cashModel.js`
- `tests/cash-payments.test.mjs`
- `tests/cash-payments-render.test.mjs`
- `docs/caja-pagos.md`

Modificados:

- `src/routes.js`: reemplaza únicamente el placeholder de `/caja`.
- `src/services/api.js`: normalización aditiva de errores de validación de caja/pagos, preservando `errores[].msg`.
- `src/views/sales/SaleDetail.jsx`: tabla compartida de pagos, saldo informativo y fechas de pagos legibles.
- `src/views/sales/Sales.jsx`: búsqueda inicial opcional recibida del enlace desde Caja.

## Verificación automatizada

Desde `frontend`, sin instalar dependencias:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Las pruebas nuevas cubren transformación exacta de payloads, validadores reales, apertura/cierre/movimientos, saldos con pagos aplicados/anulados, estados y sucursal, restricciones de crédito, NIO/USD, tasa inválida, referencia, sobrepago, JWT, señales, errores HTTP 400/401/403/404/409/500, fallo de red, fechas de Nicaragua y renderizado CoreUI. El flujo de servicios abrir → pagar → consultar pago → movimiento manual → cerrar usa únicamente fetch simulado. La ejecución secuencial evita que los servidores Vite de pruebas de renderizado compitan por el puerto HMR.

Resultados: ESLint sin errores; build de producción correcto; 27 pruebas aprobadas (8 nuevas y 19 existentes de Compras/Ventas), sin fallos; `git diff --check` sin errores. Vite emite avisos por el uso existente de `__dirname` en su configuración y por un chunk principal superior a 500 kB; no impiden compilar y no se cambió la configuración para ocultarlos.

## Prueba manual propuesta

1. Entrar con ROOT o permisos suficientes. En Caja, abrir caja activa con monto inicial conocido. Anotar el ID de sesión.
2. Seleccionar una venta CONTADO CONFIRMADA con saldo; pulsar Consultar venta y pagos y revisar el total y los pagos anteriores.
3. Registrar EFECTIVO usando la sesión de la misma sucursal. Consultar el ID configurado de NIO (o USD con tasa activa), indicar un monto dentro del saldo y confirmar.
4. Comprobar el pago APLICADO, sesión, usuario, moneda, tasa histórica y nuevo saldo. Usar Actualizar o consultar de nuevo. Revisarlo también desde el enlace a Ventas.
5. **Comprobar movimiento automático fuera de la UI:** mediante consulta de solo lectura a `movimientos_caja`, filtrar por sesión, `tipo_referencia = 'PAGO'` e `id_referencia = id_pago`; verificar `tipo = 'VENTA'` y monto igual al `monto_base` del pago. Este paso no tiene API pública de lectura.
6. Cerrar la sesión con el monto contado. Revisar ABIERTA → CERRADA y los importes esperado/contado/diferencia devueltos por servidor. Confirmar que ya no se habilitan cierre, movimientos ni cobros en efectivo con esa sesión.
7. Probar tarjeta/transferencia con referencia y sin sesión; rechazo de monto superior al saldo, otra sucursal, sesión cerrada y venta CREDITO. No confirmar operaciones sobre datos reales que no se quieran modificar.

No se realizó commit ni push. No se cambiaron datos reales durante las verificaciones automatizadas.
