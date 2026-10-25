# Inventario

El repositorio ya tenía `/inventario` conectado a `Inventory.jsx` y un servicio utilizado también por Ventas. Se completó esa implementación, conservando sus pestañas, diseño CoreUI, operaciones válidas y firmas públicas. No fue necesario modificar `routes.js`, navegación ni backend. No se instalaron dependencias.

## Contrato real inspeccionado

Se revisaron rutas, controllers, services, repositories y validators de inventario y unidades serializadas, el montaje en `backend/src/app.js`, el middleware de permisos y las operaciones de compras, ventas, devoluciones y transferencias. Los permisos y estados se contrastaron con el respaldo SQL del repositorio; no se consultó ni modificó la base real.

| Método / endpoint                                          | Permiso              | Contrato utilizado                                                                                                                       |
| ---------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/inventario`                                      | `INVENTARIO_VER`     | `{ ok, data: [...] }` con sucursal, producto, SKU, control, stock actual, mínimo e indicador `stock_bajo`                                |
| `GET /api/unidades`                                        | `IMEI_GESTIONAR`     | `{ ok, data: [...] }` con IMEI1/2, serie, producto/SKU, sucursal actual, estado y detalle de compra de origen                            |
| `GET /api/inventario/movimientos`                          | `MOVIMIENTO_VER`     | `{ ok, data: [...] }` con fecha, sucursal, producto/SKU, tipo, cantidad, stock anterior/nuevo, referencia, unidad, usuario y observación |
| `POST /api/inventario/ajustes`                             | `INVENTARIO_AJUSTAR` | `{ id_sucursal, id_producto, tipo: 'ENTRADA' o 'SALIDA', cantidad, observacion }`                                                        |
| `PUT /api/inventario/:idSucursal/:idProducto/stock-minimo` | `INVENTARIO_AJUSTAR` | `{ stock_minimo }`                                                                                                                       |

Todas las llamadas reutilizan `api.js`, JWT y manejo de errores existentes. Los GET aceptan `AbortSignal`. ROOT conserva el acceso universal definido por backend. La autenticación entrega roles, no permisos efectivos: no se deducen permisos de VENDEDOR/ADMINISTRADOR. Se muestran los 401/403 y los mensajes del servidor; tras un 403 de escritura se bloquean nuevos ajustes durante la instancia de la pantalla. Los permisos de lectura son independientes: una pestaña sin permiso no impide consultar las demás. Los errores de pestañas inactivas se señalan también arriba de la pantalla. Ante 401/403 se retiran los registros anteriormente cargados en la sección afectada.

## Existencias

- Muestra producto/SKU, sucursal, tipo de control, `stock_actual`, `stock_minimo` y nivel.
- El nivel usa `stock_bajo` del servidor. El repository define stock bajo como `stock_actual <= stock_minimo`, incluyendo igualdad y stock cero. Si falta el indicador, se muestra «No disponible», sin suponer mínimo cero.
- Filtros combinables por texto de producto/SKU, sucursal, producto y nivel, con acción Limpiar filtros. Los filtros se mantienen por pestaña.
- Los productos CANTIDAD conservan el ajuste válido del backend; los SERIALIZADO no ofrecen ese botón. Configurar mínimo es válido para ambos controles.
- No se envía ni edita un stock absoluto, usuario o identificador de movimiento. El backend determina el resultado.

## Unidades / IMEI

Consulta de todas las unidades devueltas, incluyendo estados distintos de DISPONIBLE. Muestra producto/SKU, ID de unidad, IMEI1/2, serie, sucursal actual, estado y detalle de compra de origen. Los identificadores IMEI se mantienen como texto, incluidos sus ceros iniciales. Los valores opcionales vacíos se representan con un guion.

Búsqueda por producto/SKU, IMEI1, IMEI2 y serie; filtros por producto, sucursal actual (`id_sucursal_actual`) y estado. Los estados del respaldo son DISPONIBLE, RESERVADO, VENDIDO, DEFECTUOSO, DEVUELTO y EN_TRANSFERENCIA, con colores y etiquetas diferenciadas. El selector utiliza los valores efectivamente recibidos; un estado desconocido se conserva visible con estilo neutro.

No se permiten ediciones de IMEI ni cambios manuales de estado. Existe un POST de alta de unidades en backend, pero este módulo conserva el alcance de consulta; las entradas habituales se registran desde Compras. No se añade un segundo flujo de ingreso de equipos.

## Movimientos

La lectura **sí existe**: `GET /api/inventario/movimientos`. La tabla muestra fecha legible para Nicaragua, producto/SKU, sucursal, tipo, cantidad con signo, stock anterior/nuevo, usuario y referencia/origen. Ver detalle muestra además unidad y observación. No se inventa una ruta de detalle: el modal utiliza la fila del listado real.

Filtros combinables por producto, sucursal, tipo y búsqueda de producto/SKU, tipo de referencia, ID de referencia u observación. Se conservan cantidades negativas y referencias nulas. Las fechas reutilizan la utilidad de Caja/Pagos, con `es-NI` y zona `America/Managua`; una fecha inválida no se imprime como texto ISO crudo.

## Actualización y operaciones

Las tres secciones se consultan al entrar, de forma independiente. Actualizar recarga la pestaña activa desde el servidor, sin calcular existencias localmente. Los botones se deshabilitan durante la carga correspondiente y las consultas repetidas de una misma sección tienen un guard síncrono. Se cancelan consultas al desmontar.

Los ajustes y mínimos conservan el paso de revisión/confirmación y el guard síncrono contra doble envío. Se validan IDs y cantidades enteras, mínimo no negativo, motivo de 1 a 500 caracteres y salida no superior al stock consultado. La validación se repite antes del envío; la validación definitiva y el bloqueo del stock pertenecen al backend. Los ajustes no se habilitan mientras hay lecturas pendientes o el stock mostrado tiene un error. Tras una escritura exitosa se actualizan existencias y movimientos. No se reintentan escrituras automáticamente; si se interrumpe la respuesta, se indica consultar el resultado antes de repetir.

Ante un error de red o servidor durante una actualización pueden conservarse los últimos registros, con error visible y aviso de que son datos anteriores. No se permite ajustar esos datos hasta recuperar una lectura correcta. Un error en refrescar después de una escritura no convierte esa escritura ya confirmada en fallida.

## Relación con otros flujos

- **Compra confirmada:** backend incrementa stock y registra COMPRA; para serializados crea las unidades DISPONIBLE y conserva el detalle de compra de origen.
- **Venta confirmada:** backend reduce existencias y cambia sus unidades a VENDIDO; los movimientos VENTA se muestran con los datos y referencias recibidos.
- **Anulación de venta confirmada:** cuando las reglas backend la permiten, restaura stock/unidades y registra ANULACION.
- **Compra anulada:** el backend solo permite anular BORRADOR; no hay que simular una salida por una compra que no había ingresado inventario.
- **Devolución confirmada:** backend reintegra únicamente detalles aptos para inventario y registra sus movimientos. Una unidad devuelta DEFECTUOSA puede cambiar de estado sin reintegrar stock ni generar el movimiento de reintegro. La pantalla muestra lo que devuelve cada API; no intenta reconstruir faltantes por su cuenta.
- **Transferencia confirmada:** se consultan la sucursal actual y los movimientos TRANSFERENCIA_SALIDA / TRANSFERENCIA_ENTRADA persistidos por servidor. No se aplica una transferencia localmente ni se duplica su stock.

Después de ejecutar esos flujos en otros módulos, entrar a Inventario o pulsar Actualizar en las secciones que se quieran comprobar. No hay sincronización en tiempo real.

## Limitaciones de API y alcance

- Los GET actuales devuelven listados completos; no reciben filtros ni paginación en estos controllers. Los filtros se aplican sobre el listado recibido. Grandes volúmenes dependerán del rendimiento de esos endpoints.
- El stock corresponde a registros existentes en `inventario_sucursal`; no hay filas sintéticas para cada combinación producto/sucursal sin inventario.
- La cantidad se muestra como `stock_actual` del backend; no se recalcula contando unidades ni se descuentan estados por reglas inventadas.
- No existe endpoint para editar IMEI/estado ni un endpoint de detalle de movimiento. No se ofrecen esas operaciones.
- No se conoce anticipadamente el catálogo efectivo de permisos en frontend; el servidor siempre decide y sus errores son visibles.
- No se prueban operaciones reales ni se garantiza un snapshot transaccional entre los tres GET independientes. La prueba manual operativa queda pendiente.

## Archivos

Creados:

- `src/views/inventory/InventoryMovementDetail.jsx`
- `src/views/inventory/InventoryStatus.jsx`
- `src/views/inventory/inventoryOperation.js`
- `tests/inventory.test.mjs`
- `tests/inventory-render.test.mjs`
- `docs/inventario.md`

Modificados:

- `src/services/inventoryService.js`: extrae constructores de payload manteniendo endpoints y firmas.
- `src/views/inventory/Inventory.jsx`: filtros, referencias, estados, permisos tras denegación, validación de respuestas, actualización y ciclo de solicitudes.
- `src/views/inventory/inventoryView.js`: respuestas, filtros, niveles, colores y reutilización de fechas.
- `src/views/inventory/InventoryOperationModal.jsx`: utiliza validaciones independientes y admite mínimo no disponible sin suponer cero.

Se reutiliza `InventoryTable.jsx` sin cambios. `routes.js` ya apuntaba al módulo y se conserva intacto. Compras, Ventas y Caja/Pagos no se modifican.

## Pruebas

Las pruebas nuevas verifican respuestas reales, registros inválidos, IMEI con ceros iniciales, filtros combinados, stock bajo/cero/igualdad, seis estados de unidades y estados desconocidos, referencias de movimientos, payloads frente a validators backend, JWT, señales, errores HTTP 400/401/403/404/409/500, fallos de red/JSON, cancelación, nuevas lecturas de datos y renderizado CoreUI (tabla responsive, badges, detalle, vacíos y carga inicial).

Se utilizan fetch simulado, fixtures y validators sin conexión a la base de datos. El renderizado es estático, como las pruebas existentes; no sustituye una prueba de navegador con sesión real.

Verificación desde `frontend`:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Resultado: ESLint correcto, build de producción correcto, **37 pruebas aprobadas** (10 nuevas de inventario y 27 existentes de Compras, Ventas y Caja/Pagos), sin fallos, y `git diff --check` sin errores. El build mantiene avisos por `__dirname` en la configuración Vite y un chunk principal superior a 500 kB; no impiden la compilación.

## Prueba manual

1. Iniciar sesión con ROOT o los permisos de lectura anteriores y abrir `/inventario`.
2. En Existencias, buscar nombre/SKU, combinar sucursal y producto y probar Stock bajo. Revisar casos igual al mínimo, stock cero y sobre el mínimo. Limpiar filtros y Actualizar.
3. En Dispositivos / IMEI, buscar ambos IMEI y serie; combinar producto, sucursal actual y estados disponibles. Comprobar que no hay edición de IMEI ni estado.
4. En Movimientos, filtrar producto/sucursal/tipo, buscar referencia y abrir detalle. Revisar cantidades negativas, stock anterior/nuevo, fecha local y origen.
5. En datos de prueba, confirmar una compra y volver a Inventario; actualizar Existencias, Dispositivos y Movimientos para revisar el ingreso.
6. Confirmar una venta de prueba y comprobar reducción de stock, unidades VENDIDO y movimiento VENTA. Anularla cuando las reglas lo permitan y comprobar restauración y ANULACION.
7. Si se dispone de los flujos de devolución/transferencia, confirmar operaciones de prueba y consultar reintegros aptos, unidades defectuosas, sucursal actual y movimientos de entrada/salida.
8. Opcionalmente, con `INVENTARIO_AJUSTAR`, revisar y confirmar un ajuste pequeño CANTIDAD y un cambio de mínimo en datos de prueba. Comprobar actualización y rechazo de salida superior al stock; no se ofrece ajuste de serializados.
9. Con un usuario sin `IMEI_GESTIONAR` o sin `MOVIMIENTO_VER`, comprobar el 403 visible de esa sección y que las demás siguen accesibles. Una sesión expirada debe mostrar el 401. No es necesario retirar permisos de usuarios reales para probarlo: usar cuentas de prueba existentes.

No se hizo commit ni push. No se modificó backend ni se alteraron datos reales en las pruebas automatizadas.
