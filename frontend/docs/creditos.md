# Créditos

## Alcance y contrato inspeccionado

Se revisaron las rutas montadas en app.js, rutas/controlador/validator/servicio/repositorio de créditos, el flujo de confirmación de ventas y los servicios/rutas/repositorios de pagos, tipos de cambio y caja. El frontend reutiliza api.js y JWT existentes, así como consultas de saleService, paymentService y cashService sin modificarlos.

La pantalla permite crear un plan sobre una venta CREDITO CONFIRMADA, consultar créditos y cobrar por cuota. Confirmar la venta no invoca automáticamente crearCredito: el usuario crea el plan mediante la acción explícita Nuevo plan de crédito y el POST real.

## Endpoints reales utilizados

Base existente: `http://localhost:3000/api`. Todos requieren JWT.

| Método / endpoint | Permiso real | Uso y respuesta |
| --- | --- | --- |
| GET /creditos | CREDITOS_VER | Listado `{ ok: true, data: Credito[] }`, ordenado por ID descendente |
| POST /creditos | CREDITOS_CREAR | 201 `{ ok: true, message: 'Crédito creado correctamente', data: { ...Credito, cuotas: Cuota[] } }` |
| GET /ventas | VENTA_VER | Ventas con cliente, número, total, tipo y estado; se cruzan con GET /creditos para ofrecer ventas sin plan |
| GET /creditos/:idCredito | CREDITOS_VER | Detalle `{ ok: true, data: { ...Credito, cuotas: Cuota[] } }` |
| POST /creditos/cuotas/:idCuota/pagar | CREDITOS_PAGAR | 201 `{ ok: true, message, data: { pago, cuota, credito } }` |
| GET /pagos/venta/:idVenta | PAGO_REGISTRAR | Historial de pagos de la venta, `{ ok: true, data: Pago[] }` |
| GET /tipos-cambio/moneda/:idMoneda | Solo JWT | Moneda/tasa vigente, `{ ok: true, data: { id_moneda, moneda, tasa, activo, ... } }` |
| GET /ventas/:idVenta | VENTA_VER | Venta y sucursal para comprobar efectivo, `{ ok: true, data: Venta }` |
| GET /cajas/sesiones/:idSesionCaja | CAJA_VER | Sesión, caja, sucursal y estado, `{ ok: true, data: Sesion }` |

ROOT conserva acceso universal mediante el middleware existente. La sesión expone roles, no permisos efectivos; no se asignan permisos por nombres de roles. El servidor autoriza cada consulta/pago y apiErrorMessage muestra contexto 401/403, mensaje y detalles de validación.

Si falla la consulta de historial, el detalle de crédito sigue disponible y muestra el error, sin representar el historial como vacío. Si no se puede consultar la venta, no se habilita efectivo porque no se puede verificar la sucursal; tarjeta/transferencia pueden usarse con sus validaciones y permisos reales.

## Creación de planes

Body exacto enviado a POST /creditos:

```json
{
  "id_venta": 71,
  "tasa_interes": 0,
  "numero_cuotas": 2,
  "frecuencia": "MENSUAL",
  "fecha_inicio": "2026-11-01",
  "observacion": null
}
```

id_venta es entero positivo; tasa_interes es obligatoria, numérica entre 0 y 100; numero_cuotas es entero obligatorio entre 1 y 120; frecuencia admite exclusivamente SEMANAL, QUINCENAL o MENSUAL (validator normaliza a mayúsculas); fecha_inicio es obligatoria y el servicio exige YYYY-MM-DD, además de isISO8601 estricto del validator; observacion es opcional/null, recortada y de hasta 500 caracteres. No existe restricción para que la fecha sea hoy/futura ni un interés mínimo distinto de cero. El formulario no decide estos valores por el usuario.

Flujo de creación:

1. Nuevo plan de crédito consulta GET /ventas y GET /creditos. Se excluyen ventas CONTADO, BORRADOR/ANULADA, sin cliente, sin total positivo o con cualquier crédito existente, incluido PAGADO/ANULADO. Si alguna consulta falla, no se ofrece un catálogo parcialmente verificado.
2. El selector puede buscarse por número o cliente. Muestra numero_venta, cliente, total, CREDITO y CONFIRMADA; un resumen conserva visibles los datos de la selección.
3. Solicita exclusivamente interés, cuotas, periodicidad, fecha y observación, además de la venta seleccionada. No calcula importes financieros ni calendario definitivo.
4. El usuario confirma los datos mediante casilla; cambiar los datos o actualizar ventas elegibles desmarca esa confirmación. Hay bloqueo visual y la misma exclusión síncrona utilizada por abonos.
5. Antes de POST se vuelve a consultar GET /ventas/:id y GET /creditos. Si la venta cambió de condición/estado o ya tiene plan, no se escribe. Esta comprobación no sustituye la transacción ni la autorización backend.
6. El servicio backend bloquea la venta y exige CONFIRMADA, CREDITO, cliente y ausencia de otro crédito para id_venta. Un duplicado devuelve 409, también si el plan existente está anulado. Financia el total de venta menos pagos APLICADO y rechaza saldo financiable <=0. React no consulta ni calcula ese saldo previo.
7. El backend calcula interés global sobre el monto financiado, suma monto_total y establece saldo_pendiente. Genera exactamente numero_cuotas, redondea importes a dos decimales y ajusta la última cuota con el remanente. Para vencimientos usa 7 días por SEMANAL, 15 por QUINCENAL y suma de meses de JavaScript para MENSUAL, contados desde fecha_inicio por número de cuota. No es una tasa anual ni un cálculo de interés compuesto en el código inspeccionado.
8. Crea crédito ACTIVO y cuotas PENDIENTE dentro de la transacción. La respuesta 201 devuelve el detalle completo con cuotas. Se cierra el formulario, muestra el mensaje real, limpian filtros y recarga el listado. Se conserva además la fila devuelta si falla la recarga. Ver detalle permite consultar las cuotas generadas y posteriormente abonar por el flujo existente.

Errores: 400 por validación; 401/403 por sesión/permisos; 404 por venta inexistente; 409 por venta no elegible, plan duplicado o venta completamente pagada. Ante error se mantienen los datos; ante pérdida de conexión se pide actualizar créditos antes de reenviar porque la respuesta puede haberse perdido después del commit. No hay reintento automático.

## Otras operaciones encontradas, no expuestas

- POST /creditos/:idCredito/anular, permiso CREDITOS_ANULAR: solo crédito ACTIVO sin pagos aplicados de cuotas; anula cuotas pendientes/vencidas y crédito. No elimina ni perdona deuda. No se añadió botón porque el alcance implementado es consulta y cobro de créditos existentes.
- No existen PUT ni DELETE de créditos en las rutas inspeccionadas. No se ofrecen eliminación, cambios de interés/estado, perdón de saldo ni reversión de abonos.

## Datos reales mostrados

Listado: cliente, identificación, numero_venta, monto_financiado, tasa_interes, monto_interes, monto_total, saldo_pendiente, numero_cuotas, frecuencia, fecha_inicio y estado. También se preservan id_credito/id_venta/id_cliente, observacion, created_at y updated_at cuando vienen del servidor, sin usar IDs como información principal.

El detalle añade tipo_venta, total_venta, estado_venta y cuotas. Cada cuota contiene id_cuota/id_credito, numero_cuota, fecha_vencimiento, monto_cuota, monto_pagado, saldo_cuota y estado, además de fechas de registro/actualización.

Estados utilizados por el servicio backend inspeccionado: crédito ACTIVO/PAGADO/ANULADO; cuota PENDIENTE/PARCIAL/PAGADA/VENCIDA/ANULADA. No se calculan estados vencidos según el reloj del navegador.

El historial de la venta muestra fecha, método/referencia, moneda e importe original, tipo de cambio histórico, monto_base, estado y usuario. Ese endpoint no entrega id_cuota ni la aplicación pago_cuotas: no se atribuyen pagos a una cuota ni se deriva el saldo del crédito sumando estos pagos. Puede incluir pagos anteriores a la financiación. No se solicita factura: la referencia disponible en el crédito es numero_venta.

## Registro de abonos

1. Consultar un crédito y seleccionar Abonar en una cuota con saldo, de crédito ACTIVO y venta CONFIRMADA. Solo se habilitan cuotas PENDIENTE/PARCIAL/VENCIDA.
2. Elegir EFECTIVO, TARJETA o TRANSFERENCIA. Consultar el ID configurado de la moneda con el endpoint real; no se asume que NIO/USD tengan un ID determinado ni se restringen otras monedas que acepte el backend.
3. Para efectivo, indicar y consultar el ID de una sesión ABIERTA cuya sucursal coincida con la venta. La API no ofrece un listado de sesiones para construir un selector. La validación de caja activa vuelve a hacerla el servidor.
4. Indicar monto positivo y referencia opcional para efectivo, obligatoria para tarjeta/transferencia y máximo 100 caracteres. El formulario ofrece importes con dos decimales. Para NIO se impide superar el saldo consultado de cuota/crédito; para otra moneda, conversión y sobrepago se resuelven exclusivamente en el backend.
5. Revisar la confirmación que identifica cliente, venta, cuota, monto, moneda y método. Marcar la casilla y pulsar Confirmar y registrar abono. Cambiar datos o consultar moneda/sesión borra la confirmación.
6. Se envía únicamente `{ id_moneda, metodo, monto, id_sesion_caja, referencia }`. id_sesion_caja se envía null si no es efectivo. No se envían tasa, saldo, interés, usuario ni venta: el backend los obtiene de la cuota y del JWT.
7. El backend bloquea la cuota, valida crédito/venta/moneda, consulta tasa vigente (NIO=1), calcula monto_base y rechaza sobrepago de cuota o crédito. Para efectivo comprueba sesión abierta, caja activa y sucursal; crea pago APLICADO, relación pago-cuota, actualiza saldo/estado de ambos y registra movimiento de caja tipo VENTA/referencia PAGO en la misma transacción.
8. El frontend muestra el mensaje y monto_base devueltos por el servidor y vuelve a consultar detalle, historial y listado. Una lectura posterior fallida no se trata como pago fallido ni vuelve a enviar el POST; el formulario se cierra tras escritura confirmada.

Hay bloqueo visual y exclusión síncrona probada contra dos envíos antes del siguiente render. No hay reintento automático. Si se pierde la respuesta del POST, el mensaje pide consultar detalle/pagos antes de reenviar: el backend no ofrece una clave de idempotencia y el cliente no puede determinar si un fallo de red ocurrió antes o después del commit.

## UX y limitaciones

- Listado responsive, Actualizar, búsqueda por cliente/identificación/referencia de venta, estado y Limpiar filtros. Filtros locales porque GET no implementa filtros ni paginación.
- Modal lg con scroll interno. El formulario sustituye al detalle dentro del mismo modal, evitando modales apilados. Se usan componentes y colores semánticos CoreUI para tema claro/oscuro.
- Importes NIO con Intl es-NI; fechas con America/Managua, preservando fechas calendario YYYY-MM-DD. Se muestran los importes del servidor, sin calcular financiación, interés, saldo o equivalencias.
- Carga, vacío, error, éxito, actualización de detalle/historial y conservación del último listado correcto si falla Actualizar.
- No hay catálogo de monedas ni listado de sesiones; sus IDs son necesarios únicamente como entradas de consulta verificadas.
- El historial por cuota no está expuesto: se muestran cuotas con sus acumulados y pagos de la venta claramente separados.
- La creación ya está integrada. La anulación sigue fuera de la interfaz; no es una limitación del backend.
- No existe endpoint directo de ventas elegibles: se cruzan los listados completos. Para creación se necesitan VENTA_VER y CREDITOS_VER además de CREDITOS_CREAR. El servidor decide definitivamente elegibilidad, pagos previos y duplicados concurrentes.
- No existe reversión de pago de cuota en este módulo; el backend bloquea su anulación desde el endpoint general de pagos. No se agrega ningún botón para hacerlo.
- El SQL inicial guardado en database tiene una estructura de créditos diferente del repositorio/servicio actual (por ejemplo saldo en lugar de saldo_pendiente); esta implementación sigue el backend actual. No se alteró ni consultó la BD para reconciliar ese archivo histórico.
- No se promete idempotencia entre reintentos después de una desconexión ni exclusión de pagos desde otros clientes. El backend valida transaccionalmente el saldo.

## Archivos

Creados en el módulo: src/services/creditService.js; src/views/credits/creditModel.js, Credits.jsx, CreditDetail.jsx y CreditPaymentForm.jsx; tests/credits.test.mjs; tests/credits-render.test.mjs; docs/creditos.md.

Ampliación de creación: nuevos src/views/credits/CreditPlanForm.jsx y creditPlanModel.js, tests/credit-plan.test.mjs y tests/credit-plan-render.test.mjs. Modificados Credits.jsx, creditService.js y este documento. No se modificó ningún archivo de Ventas ni de otros módulos para integrar la creación.

Modificado: src/routes.js, únicamente para asignar la pantalla al módulo /creditos ya existente en navegación.

Reutilizados sin modificación: api.js, saleService, cashService y paymentService. Sin cambios en backend, BD, autenticación ni módulos terminados. Sin instalaciones, commit o push.

## Verificación automatizada

Desde frontend:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Las pruebas de Créditos verifican normalización sin modificar datos, listados/detalles/vacíos inválidos, búsqueda y estados, elegibilidad de cuotas, validación de abonos/referencias/moneda/sesión/sucursal, payload contra validator real, historial, exclusión contra doble envío y liberación tras error, HTTP/JWT, errores, formatos y renderizado CoreUI. Usan fetch simulado y validators sin conexión a BD. No se escriben datos reales. Se ejecutan también todas las pruebas existentes de los otros módulos.

Las pruebas de render son SSR y no sustituyen la prueba interactiva de navegador.

La ampliación añade pruebas de elegibilidad/selección, validaciones y payload contra validator real, carga de APIs, prevalidación antes de escritura, creación y recarga, duplicados, 400/401/403/409, red, exclusión síncrona y renderizado. Todos sus datos son ficticios, sin utilizar la venta real preparada para la prueba manual.

Resultado de la ampliación: ESLint correcto; build correcto; 75 pruebas aprobadas, 0 fallidas (9 nuevas para creación de planes); git diff --check correcto. Se mantienen los avisos existentes de Vite sobre __dirname/configLoader native y bundle mayor de 500 kB.

## Prueba manual exacta

Usar datos de prueba para los abonos. Ahora se pueden preparar planes desde Nuevo plan de crédito. La venta #205 se reserva para la prueba manual indicada abajo y no fue consultada ni modificada automáticamente.

1. Reutilizar servidores existentes. Si están detenidos, `npm.cmd start` desde backend con su configuración existente para API en puerto 3000 y `npm.cmd start -- --port 3001` desde frontend. Abrir la URL de Vite y `/#/creditos`, por ejemplo http://localhost:3001/#/creditos. Iniciar sesión con credenciales existentes.
2. Comprobar listado, carga y Actualizar; buscar cliente, identificación o numero_venta; combinar estados ACTIVO/PAGADO/ANULADO, probar sin coincidencias y Limpiar filtros. Revisar en tema claro/oscuro y ancho móvil.
3. Abrir Ver detalle de un crédito de prueba. Comparar importes, interés, cuotas y saldo con la respuesta Network GET /creditos/:id. Revisar fechas y observación. Comprobar Actualizar detalle e historial. El historial debe estar rotulado como pagos de la venta; un 403 de pagos no debe ocultar cuotas ni mostrarse como lista vacía.
4. Elegir una cuota pendiente/parcial. Pulsar Abonar, indicar el ID configurado de NIO y Consultar moneda y tasa: debe mostrar código NIO y tasa 1. Para efectivo, indicar una sesión abierta de esa sucursal y Consultar sesión. Si falta permiso VENTA_VER/CAJA_VER, comprobar mensaje y bloqueo de efectivo; puede probarse transferencia con referencia y permisos de pago.
5. Probar monto vacío/cero/negativo, monto NIO superior al saldo, referencia no indicada para tarjeta/transferencia, referencia demasiado larga, moneda sin consultar, sesión cerrada y sucursal incorrecta. No debe poder confirmarse con datos inválidos; los errores definitivos del backend deben permanecer visibles.
6. Registrar un abono parcial pequeño SOLO en un crédito de prueba: revisar cliente/venta/cuota/monto/moneda/método, marcar confirmación y enviar. Cambiar monto antes de enviar debe desmarcar la confirmación. Pulsar rápidamente dos veces: Network debe mostrar un solo POST. Verificar mensaje y monto aplicado reales, cuota PARCIAL, saldo actualizado y pago en historial de venta tras recarga.
7. Para efectivo, consultar esa sesión en Caja y comprobar el movimiento PAGO generado por backend sin ingreso manual adicional. En Ventas, consultar pagos de esa venta y verificar el mismo pago. No repetir el pago desde Caja/Pagos.
8. Probar moneda no NIO configurada y activa con referencia en entorno de prueba: el servidor debe devolver tipo_cambio y monto_base históricos. No esperar que la tasa consultada quede congelada. Un sobrepago convertido debe mostrar 409 sin modificar los saldos.
9. Con una cuota/plan de prueba ya pagado o anulado, comprobar que no aparece Abonar. Si se completa un crédito de prueba, comprobar estado PAGADO devuelto por el servidor y ausencia de acciones de cobro. No deben existir botones de eliminación, perdón de deuda, cambio de interés o estado.
10. Con usuarios existentes restringidos comprobar 403 en consulta/pago y funcionamiento universal de ROOT. Para 401, invalidar temporalmente el token de la sesión de prueba en DevTools y Actualizar; verificar mensaje y volver a iniciar sesión, sin cambiar usuarios/permisos en BD.
11. Simular Offline antes de consultas: mostrar error y conservar último listado. Si se pierde una respuesta de pago, restaurar conexión y consultar detalle/historial antes de reenviar. Tras un POST exitoso, simular fallo de recarga: debe conservarse el éxito y cerrarse el formulario, permitiendo reconsultar sin volver a cobrar.

La prueba interactiva en navegador queda pendiente de ejecución con el entorno y credenciales del usuario.

## Prueba manual de creación con venta #205 / 001202

Datos proporcionados por el usuario, sin verificación automática contra producción: venta 205, número 001202, cliente Jeison Melendez, CREDITO, CONFIRMADA, total C$700.00 NIO.

1. Abrir `/#/creditos` e iniciar sesión con ROOT o usuario con CREDITOS_VER, CREDITOS_CREAR y VENTA_VER. No volver a confirmar ni modificar la venta.
2. Pulsar Nuevo plan de crédito y esperar ambas consultas. Buscar `001202` y seleccionarla. Si ya no aparece, actualizar ventas elegibles y revisar si ya tiene un plan; no intentar recrearla por otro endpoint.
3. Comprobar en selector/resumen: número 001202, Jeison Melendez, total C$700.00, CREDITO y CONFIRMADA. Si no coincide, cancelar y revisar antes de continuar.
4. Para una prueba funcional explícita del formulario, introducir tasa 0%, 2 cuotas, MENSUAL y fecha 2026-11-01, observación `Prueba manual de creación de plan`. Estos son valores de ejemplo para que el usuario revise y acepte antes de crear el plan real; pueden reemplazarse por las condiciones acordadas.
5. Marcar Confirmo la venta seleccionada, interés, cuotas, periodicidad y fecha de inicio. Pulsar Crear plan de crédito una sola vez. En Network comprobar un POST /api/creditos cuyo id_venta sea 205 y cuyos demás campos coincidan con lo introducido. No se debe enviar monto_financiado, saldo, id_cliente ni cuotas calculadas.
6. Esperar respuesta 201 y mensaje Crédito creado correctamente; el formulario debe cerrarse y la fila aparecer automáticamente con venta 001202, cliente y estado ACTIVO, sin recargar la página del navegador.
7. Abrir Ver detalle. Verificar monto_financiado, monto_interes, monto_total, saldo_pendiente y cuotas contra la respuesta del servidor, sin asumir que el saldo financiado sea 700 si existieran pagos previos. Con los valores de ejemplo deben generarse dos cuotas PENDIENTE; revisar fechas e importes que entregue el backend.
8. Abrir nuevamente Nuevo plan de crédito: 001202 ya no debe estar disponible. No probar duplicados con POST manual sobre esa venta; la protección automática se verifica con mocks.
9. Comprobar que el detalle ofrece Abonar en las cuotas elegibles, pero no registrar ningún pago sobre esta venta durante la prueba de creación. Terminar aquí y comunicar el resultado.

No se creó ningún plan ni se registró pago real durante la implementación. No se hicieron commit ni push.
