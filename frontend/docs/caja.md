# Caja

## Inspección y alcance

Se revisaron app.js, cashRoutes, cashController, cashValidator, cashService y cashRepository del backend; integración de paymentService/paymentRepository y creditService; SQL archivado de sesiones/movimientos; routes.js, cashService.js y todos los componentes existentes de Caja/Pagos del frontend. Se reutilizaron la pantalla ya funcional, api.js/JWT, formatos y validaciones existentes, sin modificar autenticación, Créditos, Ventas ni otros módulos.

La API permite catálogo de cajas físicas, apertura, consulta individual de sesión, movimiento manual y cierre. No expone un historial de sesiones, movimientos por sesión ni efectivo esperado en una sesión abierta. Estas limitaciones se muestran en pantalla y no se simulan consultas inexistentes.

## Endpoints de Caja y contratos JSON

Base existente: http://localhost:3000/api. Todos requieren JWT.

| Endpoint | Permiso | Respuesta correcta |
| --- | --- | --- |
| GET /cajas | CAJA_VER | 200 `{ ok: true, data: Caja[] }` |
| POST /cajas/abrir | CAJA_ABRIR | 201 `{ ok: true, message: 'Caja abierta correctamente', data: Sesion }` |
| GET /cajas/sesiones/:idSesionCaja | CAJA_VER | 200 `{ ok: true, data: Sesion }` |
| POST /cajas/sesiones/:idSesionCaja/movimientos | CAJA_MOVIMIENTO | 201 `{ ok: true, message: 'Movimiento de caja registrado correctamente', data: { movimiento, saldo_anterior, saldo_actual } }` |
| POST /cajas/sesiones/:idSesionCaja/cerrar | CAJA_CERRAR | 200 `{ ok: true, message: 'Caja cerrada correctamente', data: { sesion, resumen: { monto_sistema, monto_real, diferencia, resultado } } }` |

Caja contiene id_caja, id_sucursal, codigo_sucursal, sucursal, codigo, nombre, activo, created_at y updated_at. El listado ordena por id_caja y no contiene estado de sesión.

Sesion contiene id_sesion_caja, id_caja, codigo_caja, caja, id_sucursal, codigo_sucursal, sucursal, id_usuario_apertura, usuario_apertura, id_usuario_cierre, usuario_cierre, fecha_apertura, fecha_cierre, monto_apertura, monto_cierre_sistema, monto_cierre_real, diferencia, estado, observacion_apertura y observacion_cierre. No incluye movimientos ni saldo abierto calculado.

Movimiento contiene id_movimiento_caja, id_sesion_caja, id_usuario, usuario, tipo, monto, tipo_referencia, id_referencia, concepto y fecha. Solo se recibe el movimiento manual recién registrado; obtenerMovimientoPorId es una función interna del repositorio y no una ruta HTTP pública.

Errores de validación: 400 `{ ok: false, message: 'Datos de entrada inválidos', errors: [{ campo, mensaje }] }`. Errores de negocio: `{ ok: false, message }`. El frontend reutiliza apiErrorMessage, que transforma también errors y mantiene contexto 401/403. Los 500 de Caja muestran el mensaje genérico seguro del controlador. ROOT conserva acceso universal. La sesión de autenticación expone roles, no permisos efectivos: se intenta cada acción y, después de un 403, se deshabilita coherentemente en esta visita, exceptuando ROOT; el servidor siempre autoriza.

## Apertura: request y reglas

```json
{ "id_caja": 3, "monto_apertura": 100, "observacion": "Prueba manual" }
```

id_caja es obligatorio, entero positivo. monto_apertura es opcional en API, numérico >=0, predeterminado 0. observacion es opcional/null, texto de hasta 500 caracteres. La UI muestra monto inicial con 0 por defecto y observación opcional. No envía sucursal, usuario ni estado.

La sucursal se obtiene de la caja seleccionada. id_usuario_apertura se obtiene del JWT; no se elige cajero en el formulario. La caja debe existir (404) y estar activa (400). Si ya tiene sesión ABIERTA, devuelve 409 y el mensaje incluye el ID existente; no se analiza ese texto para inventar una consulta automática.

El servicio limita una sesión ABIERTA por caja física. No limita por usuario ni sucursal: un usuario o una sucursal pueden tener más de una sesión abierta si pertenecen a cajas distintas. No impone que cierre o registre movimientos el mismo usuario que abrió; exige el permiso correspondiente.

La apertura inserta sesión ABIERTA y movimiento automático APERTURA, con referencia SESION_CAJA, importe inicial y concepto Monto inicial de apertura de caja, dentro de la transacción. El detalle retornado ya permite consultar la sesión por su ID, usar efectivo o cerrar. No se crea una caja física desde este módulo.

## Movimientos manuales

```json
{ "tipo": "INGRESO", "monto": 20, "concepto": "Entrada de prueba" }
```

tipo solo admite INGRESO o EGRESO. monto debe ser >0; el servicio redondea a dos decimales y vuelve a exigir que sea positivo. concepto debe ser texto no vacío, entre 1 y 255 caracteres; el servicio rechaza espacios en blanco. No hay observacion separada para movimientos. La UI identifica ENTRADA (INGRESO) y SALIDA (EGRESO), importe NIO, concepto y confirmación explícita.

La sesión debe existir (404), estar ABIERTA (409) y se bloquea en la transacción. EGRESO no puede superar el efectivo actual calculado por el servidor (409). La referencia es MOVIMIENTO_MANUAL, sin id_referencia, y el usuario viene del JWT. No se agregan restricciones por propietario ni por caja activa que no estén en este servicio.

La respuesta entrega movimiento, saldo_anterior y saldo_actual. Se muestran fecha, tipo/sentido, concepto, referencia, monto y usuario en una tabla responsive, además de esos saldos. Se rotula como último movimiento manual registrado y como saldo correspondiente al instante de esa operación: no es historial completo ni saldo vigente. Después se reconsulta la sesión. Si falla ese GET, el movimiento sigue confirmado y no se reenvía el POST; se pide consultar la sesión antes de operar de nuevo.

## Cierre: request, cálculo y resultado

```json
{ "monto_cierre_real": 115, "observacion": "Conteo de prueba" }
```

monto_cierre_real es obligatorio, numérico >=0; observacion es opcional/null, texto de hasta 500 caracteres. No se envían esperado, diferencia, usuario, estado ni fechas. La UI identifica caja, sucursal, sesión, cajero/fecha de apertura y monto inicial; solicita efectivo contado NIO y confirmación. Como el backend no expone el esperado abierto, no se inventa una vista previa financiera.

El servidor bloquea la sesión, exige ABIERTA (cerrada ->409), calcula efectivo esperado como suma de APERTURA + VENTA + INGRESO menos EGRESO + ANULACION. Otros tipos no afectan esa consulta SQL. No suma otra vez monto_apertura porque ya existe movimiento APERTURA. Se redondea el esperado y el contado a dos decimales.

diferencia = contado - esperado: 0 -> CUADRADA; positiva -> SOBRANTE; negativa -> FALTANTE. Se guardan monto_cierre_sistema, monto_cierre_real, diferencia, observacion_cierre, fecha_cierre NOW(), id_usuario_cierre del JWT y estado CERRADA. No se crea movimiento CIERRE ni se reinicia/elimina historial.

El frontend muestra el resumen real devuelto y los campos de sesión cerrada, sin calcular montos financieros. Después quedan deshabilitados ingreso/egreso, cierre y cobros que requieran esa sesión ABIERTA. Se puede volver a consultar por ID cualquier sesión cerrada; no existe reapertura de esa misma sesión. Abrir otra vez una caja crea una sesión nueva.

## Sesiones consultadas y estados

Solo existen ABIERTA y CERRADA en este flujo. Se añade una tabla de sesiones abiertas o consultadas durante esta visita, con estado, caja/sucursal, apertura/cajero, inicial, cierre/cajero y esperado/contado/diferencia reales cuando están disponibles. Tiene búsqueda y filtro sobre esos datos, sin paginación ficticia. Consultar detalle hace GET, no abre una copia local sin actualización.

Esta tabla es una colección de las respuestas recibidas durante la visita; no un listado del backend. Se pierde al recargar y puede contener estados antiguos de otras sesiones hasta volver a consultarlas. El mismo ID se actualiza sin duplicarse. El usuario debe conservar los IDs necesarios para volver a consultar una sesión: se muestran como referencia secundaria porque la única consulta disponible los exige. No se persiste ni se deduce una sesión actual del usuario.

## Integración con pagos y ventas/créditos

El flujo existente de pagos por venta permanece disponible y no se reimplementó. Sus consultas usan GET /ventas y /ventas/:id (VENTA_VER), GET /pagos/venta/:id (PAGO_REGISTRAR), GET /tipos-cambio/moneda/:id (JWT). POST /pagos requiere PAGO_REGISTRAR. Caja registra pagos CONTADO; abonos de CREDITO se mantienen en Créditos por cuota.

Un pago EFECTIVO requiere id_sesion_caja, sesión ABIERTA, caja activa y misma sucursal que la venta. El servidor fija tipo de cambio y monto_base NIO e inserta automáticamente movimiento tipo VENTA, referencia PAGO y concepto de la venta o cuota. Esto sucede en la misma transacción que el pago. TARJETA y TRANSFERENCIA no crean entrada de efectivo en caja.

Si un pago general en efectivo se anula mediante el flujo backend correspondiente, se registra ANULACION por monto_base con referencia PAGO. El servicio exige sesión abierta/caja activa. Los pagos de cuotas están protegidos frente a anulación desde pagos generales. No se añadió anulación de pagos en esta entrega.

Los movimientos automáticos afectan el cierre aunque no se puedan listar mediante la API actual. Se puede comprobar el pago en su venta y la sesión mediante id_sesion_caja, y verificar el efecto en monto_cierre_sistema al cerrar una sesión de prueba. No se presentan pagos consultados como sustituto del historial de movimientos: no incluirían todas las entradas/salidas ni garantizarían integridad del saldo.

## Restricciones, conflictos y limitaciones

- 400 por datos inválidos, caja inactiva o concepto/monto inválido; 401/403 por JWT/permisos; 404 por caja/sesión inexistente; 409 por sesión ya abierta, sesión cerrada o egreso mayor al saldo disponible.
- No hay GET de sesiones, sesión actual, movimientos por sesión ni saldo de sesión abierta. No es posible construir historial completo ni mostrar movimientos automáticos individualmente en Caja sin una ampliación backend. No se crearon endpoints, campos o datos locales que simulen esas capacidades.
- La única verificación anticipada de sesión duplicada usa la sesión consultada; el servidor comprueba la caja elegida al abrir.
- No hay clave de idempotencia. Bloqueo síncrono y botones deshabilitados evitan doble envío en esta pantalla, pero tras perder la respuesta hay que consultar el resultado antes de repetir. No hay reintento automático de escrituras.
- El SQL inicial archivado en database no refleja todos los nombres del repositorio actual (p. ej., id_usuario frente a id_usuario_apertura/cierre y monto_esperado frente a monto_cierre_sistema). Se siguió el backend actual probado, sin ejecutar SQL ni modificar BD. No se constató un defecto de ejecución que impida apertura, cierre o movimiento; no se cambió backend.
- Las pruebas son de modelos, validators, servicios/flujo con mocks y SSR; la prueba visual/interactiva queda pendiente del usuario.

## Archivos y verificación

Creados: src/views/cash/cashSessionModel.js, CashSessions.jsx, CashMovementResult.jsx; tests/cash-sessions.test.mjs; tests/cash-sessions-render.test.mjs; docs/caja.md.

Modificados: src/views/cash/Cash.jsx y CashOperation.jsx; src/services/cashService.js (apertura omitida usa 0 como el backend). routes.js ya integra /caja y no necesitó cambios. Se reutilizan cashModel, CashDetail, formatos y servicios existentes. No se modificaron PaymentForm, PaymentsTable, Créditos, Ventas ni los demás módulos.

Comandos desde frontend:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Pruebas nuevas: catálogo/sesión, montos/nulos, sesiones consultadas/filtros, payloads contra validators reales, apertura-consulta-movimiento-cierre, confirmaciones SSR, doble envío con el mismo bloqueo de la UI, aborto antes de escritura, GET fallido después de POST confirmado, errores 400/401/403/404/409 y red. No se accede a API real ni a BD; no se abren/cierran sesiones ni se registran pagos reales.

Revisión de continuación: se conservó todo el trabajo existente. Se corrigió la respuesta ilegible después de un POST confirmado: invalida la sesión seleccionada y exige reconsulta, sin repetir escritura. Se limpian recibos anteriores al confirmar otra operación y se registra CAJA_VER cuando la lectura posterior devuelve 403. Una prueba de regresión cubre apertura, movimiento y cierre con respuesta inválida.

Resultado final: ESLint correcto; build correcto; 84 pruebas aprobadas y 0 fallidas (9 específicas de sesiones); git diff --check correcto. El build conserva avisos existentes de Vite sobre __dirname/configLoader native y bundle mayor de 500 kB. La verificación usa mocks y SSR; no certifica la configuración ni el esquema de una base de datos desplegada.

## Prueba manual exacta en navegador

Datos necesarios: credenciales ROOT o permisos CAJA_VER/ABRIR/MOVIMIENTO/CERRAR; caja activa de prueba sin sesión abierta, perteneciente a una sucursal conocida; opcional ID de una sesión cerrada para consulta histórica. Para la integración opcional con pagos, una venta CONTADO CONFIRMADA de prueba con saldo, ID real de moneda NIO, permisos VENTA_VER/PAGO_REGISTRAR y la misma sucursal. No utilizar ventas o créditos reales pendientes, incluida la venta 205 preparada anteriormente.

1. Reutilizar los servidores existentes. Si están detenidos, ejecutar npm.cmd start desde backend con su configuración existente para API en puerto 3000, y npm.cmd start -- --port 3001 desde frontend. Abrir la URL de Vite y /#/caja (por ejemplo http://localhost:3001/#/caja), iniciar sesión.
2. Comprobar catálogo, estados activa/inactiva y Actualizar. Verificar el aviso de que el catálogo no informa sesiones abiertas y la tabla inicialmente vacía de sesiones consultadas. Revisar tema claro/oscuro y ancho móvil.
3. Pulsar Abrir caja, seleccionar caja/sucursal de prueba, dejar monto 100 NIO y observación Prueba manual Caja. Probar primero monto negativo y observar bloqueo. Introducir 100, revisar, marcar confirmación y abrir una sola vez. Verificar 201, detalle ABIERTA, caja/sucursal/cajero correctos e ID de sesión devuelto; anotarlo. La fila debe aparecer en sesiones consultadas.
4. Cambiar un dato tras confirmar en cualquier formulario debe desmarcar la casilla. Abrir el formulario de ingreso/egreso y verificar que identifica la sesión correcta.
5. Registrar ENTRADA (INGRESO), 20 NIO, concepto Entrada de prueba; confirmar. Comprobar 201 y tabla del último movimiento con usuario, fecha y referencia MOVIMIENTO_MANUAL. Saldo posterior devuelto esperado para esta prueba aislada: 120. El detalle se reconsulta sin repetir POST.
6. Registrar SALIDA (EGRESO), 5 NIO, concepto Salida de prueba; confirmar. Comprobar respuesta y saldo posterior 115 si no hubo otros movimientos. Probar previamente concepto vacío, monto cero y egreso superior al saldo: debe bloquearse localmente lo inválido y mostrarse 409 para saldo insuficiente. No debe existir un saldo actual inventado antes de recibir la respuesta.
7. Consultar por ID una sesión cerrada de prueba, si se dispone de ella; verificar campos de cierre y acciones deshabilitadas. Buscar/filtrar en las sesiones consultadas y volver a consultar el ID anotado de la sesión abierta. No debe confundirse el listado local con historial completo del servidor.
8. Integración opcional: sobre la venta CONTADO de prueba, consultar venta/pagos y moneda, registrar manualmente un pago EFECTIVO pequeño con la sesión abierta. Verificar pago APLICADO con ese id_sesion_caja. No hacer un ingreso manual adicional: el backend ya registra VENTA. El movimiento automático no puede listarse en Caja con la API actual; se comprobará su efecto en el cierre. No hacer abonos sobre créditos reales.
9. Cerrar caja: revisar caja, sucursal, sesión y cajero; contar efectivo. Sin el paso opcional ni otros movimientos, introducir 115 NIO y observación Conteo de prueba, confirmar y cerrar. Esperar 200, estado CERRADA y resumen del servidor: esperado 115, contado 115, diferencia 0/CUADRADA. Si se hizo el paso opcional, utilizar el conteo real e incluir el efectivo recibido; no reutilizar 115 automáticamente.
10. Comprobar que ingreso/egreso y cierre quedan deshabilitados; el formulario de pago debe impedir confirmar EFECTIVO con esa sesión cerrada (el botón general Registrar pago puede seguir disponible para otros métodos). Consultar nuevamente por ID, incluso después de recargar navegador: debe devolver el cierre histórico. La tabla local se vacía al recargar y vuelve a llenarse al consultar.
11. Comprobar permisos con usuarios existentes: 403 visible y acciones deshabilitadas tras rechazo, ROOT conserva acceso. Para 401 invalidar temporalmente el token de la sesión de prueba en DevTools y consultar; volver a iniciar sesión. No cambiar roles ni datos en BD.
12. Simular Offline en DevTools antes de una consulta: mostrar error sin presentar una sesión no verificada como vigente. Si falla lectura después de movimiento registrado, conservar éxito y recibo, e indicar reconsulta. Si se pierde respuesta de escritura, no reenviar a ciegas: confirmar resultado antes de repetir. Revisar Network al pulsar rápidamente dos veces: debe existir una sola escritura.

No se ejecutó esta prueba manual durante la implementación. No se hicieron commit ni push.
