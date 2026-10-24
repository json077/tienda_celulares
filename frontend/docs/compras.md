# Compras: contrato y demostración

Contrato inspeccionado en `backend/src/{routes,controllers,services,repositories,validators}/purchase*.js`, proveedores, productos, inventario, unidades serializadas, autenticación, permisos, auditoría, montaje de rutas y `database/01_schema_tienda_celulares.sql`. El frontend usa exclusivamente rutas existentes. No se modifica backend.

## Endpoints y permisos

Todas las rutas protegidas requieren JWT Bearer. El middleware consulta los permisos del usuario; ROOT tiene acceso total.

| Método y ruta                           | Permiso             | Comportamiento                                                   |
| --------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| `GET /api/compras`                      | `COMPRAS_VER`       | Todas las compras, cada una con `detalles`                       |
| `GET /api/compras/:idCompra`            | `COMPRAS_VER`       | Cabecera y detalles; 404 si no existe                            |
| `POST /api/compras`                     | `COMPRAS_CREAR`     | Guarda BORRADOR; no ingresa existencias                          |
| `POST /api/compras/:idCompra/confirmar` | `COMPRAS_CONFIRMAR` | BORRADOR → CONFIRMADA; ingreso transaccional                     |
| `POST /api/compras/:idCompra/anular`    | `COMPRAS_ANULAR`    | BORRADOR → ANULADA; sin afectar inventario                       |
| `GET /api/proveedores`                  | `PROVEEDORES_VER`   | Selección de proveedor activo                                    |
| `GET /api/productos`                    | `PRODUCTOS_VER`     | Selección de productos activos y su tipo de control              |
| `GET /api/inventario`                   | `INVENTARIO_VER`    | Opcional: sucursales conocidas a partir de existencias           |
| `GET /api/unidades`                     | `IMEI_GESTIONAR`    | Opcional: seriales de compras confirmadas, filtrados por detalle |

No hay endpoint de sucursales ni de edición de compras. Se reutilizan `productService`, `supplierService`, `inventoryService` y `apiErrorMessage`. No se agrega RBAC visual al sidebar.

## Respuestas y payloads

Respuestas: `{ ok: true, data }`; las escrituras también incluyen `message`. Listado: `data` es un arreglo; detalle: un objeto. Fallos: `{ ok: false, message, errores? }`. El cliente conserva los códigos HTTP y los detalles de validación a través de `api.js`.

Cabecera: `id_compra`, `id_proveedor`, `proveedor`, `id_sucursal`, `codigo_sucursal`, `sucursal`, `id_usuario`, `usuario`, `numero_documento`, `fecha`, `subtotal`, `descuento`, `impuesto`, `total`, `estado`, `observacion`, `created_at`, `updated_at`, `detalles`.

Detalle: `id_detalle_compra`, `id_compra`, `id_producto`, `sku`, `producto`, `tipo_control`, `cantidad`, `costo_unitario`, `descuento`, `impuesto`, `subtotal`.

Crear:

```json
{
  "id_proveedor": 5,
  "id_sucursal": 8,
  "numero_documento": "DOCUMENTO-DEL-PROVEEDOR",
  "observacion": null,
  "detalles": [
    { "id_producto": 2, "cantidad": 1, "costo_unitario": 100, "descuento": 0, "impuesto": 0 }
  ]
}
```

Los IDs del ejemplo son ilustrativos; deben seleccionarse datos reales existentes. No se envían fecha, usuario, estado, totales ni IMEI al crear. El usuario proviene del JWT y el servidor calcula los importes. Número de documento: obligatorio, máximo 80; observación: opcional, máximo 500. Proveedor, sucursal y productos deben existir y estar activos al crear.

Confirmar (IDs de detalle obtenidos del servidor):

```json
{
  "unidades": [
    {
      "id_detalle_compra": 11,
      "imei1": "IMEI_REAL_DE_15_DIGITOS",
      "imei2": null,
      "numero_serie": null
    }
  ]
}
```

El texto de IMEI del ejemplo indica el campo que debe completarse; no es un IMEI válido ni se genera ninguno automáticamente. Para una compra solo por cantidad se envía `{ "unidades": [] }`. Anular envía `{}`.

## Cantidad, importes y serializados

- Ambos controles requieren cantidad entera positiva y costo unitario finito mayor o igual a cero.
- Descuento e impuesto son importes opcionales no negativos, por línea, no porcentajes. Descuento no puede superar cantidad × costo. No se aplican las reglas de descuentos de ventas.
- El backend redondea el costo a dos decimales antes de multiplicar; también redondea descuento, impuesto, subtotales y acumulados. La previsualización sigue ese orden y es solo orientativa.
- CANTIDAD: no recibe unidades ni IMEI. Cada detalle produce una entrada por la cantidad completa al confirmar.
- SERIALIZADO: se requieren exactamente N unidades por `id_detalle_compra`, no por producto. IMEI1 obligatorio de exactamente 15 dígitos; IMEI2 opcional de exactamente 15, distinto de IMEI1. Se conservan ceros iniciales al tratar ambos como texto.
- No se admiten IMEI repetidos entre IMEI1/IMEI2 de ninguna unidad o línea. Las series no vacías tampoco pueden repetirse. El backend comprueba además si ya existen en la base de datos y responde 409.
- **Discrepancia existente:** el validador de confirmación permite `numero_serie` de 100 caracteres, pero la columna SQL es `VARCHAR(80)`. La interfaz limita a 80 para evitar un fallo de almacenamiento. El endpoint independiente de registro de unidades tiene reglas distintas y no se utiliza para registrar compras.

## Transacciones y movimientos

Crear valida y guarda cabecera/detalles dentro de una transacción, estado BORRADOR, sin modificar inventario.

Confirmar bloquea la compra (`FOR UPDATE`), exige BORRADOR y productos activos, valida pertenencia y cantidad de unidades, formato y duplicados. Obtiene/bloquea inventario por sucursal/producto y lo crea a cero si falta. Para CANTIDAD incrementa el stock en N y genera un movimiento por detalle. Para SERIALIZADO crea cada unidad DISPONIBLE vinculada al detalle, incrementa en uno y genera un movimiento por unidad. Los movimientos tienen `tipo = COMPRA`, `tipo_referencia = COMPRA`, `id_referencia = id_compra`, usuario que confirma, cantidad positiva y stocks anterior/nuevo. Finalmente actualiza a CONFIRMADA y confirma toda la transacción; los fallos ejecutan rollback. El frontend solo llama al endpoint de compras, nunca registra unidades ni ajusta stock por separado.

Anular bloquea la compra y solo cambia BORRADOR a ANULADA, sin movimientos ni reversión de stock. Confirmadas y anuladas producen 409. La interfaz exige escribir ANULAR y explica el efecto. No existe anulación de compras confirmadas ni edición de borradores mediante HTTP. La auditoría tiene eventos para crear, confirmar y anular.

Después de escribir, se refresca el listado y se usa la compra devuelta por el servidor para el detalle. Tras confirmar serializados, se consultan sus unidades. Inventario vuelve a consultar sus datos al abrir su módulo; no hay una copia de stock actualizada manualmente desde Compras.

## Sucursales y limitaciones

- Sin catálogo HTTP: el selector combina sucursales devueltas por compras e inventario. Para sucursales sin registros o sin permiso de inventario se permite introducir un ID existente. No se deduce su estado activo; lo valida el backend al guardar.
- GET de compra no devuelve IMEI. Se consulta GET de unidades y se filtra por los IDs de detalle, incluso si el dispositivo cambió después de sucursal o estado. Si falta `IMEI_GESTIONAR`, la cabecera y los detalles siguen visibles y se informa el fallo de consulta de dispositivos.
- No se hace reintento automático de escrituras. Se bloquean envíos simultáneos y se relee el estado antes de confirmar/anular. Ante respuesta interrumpida se pide consultar el registro antes de reintentar. El backend no tiene clave de idempotencia.
- La base de datos exige documento único por proveedor; crear no traduce `ER_DUP_ENTRY` a 409, por lo que ese conflicto puede llegar como 500 genérico. No se altera esa conducta del backend.
- Confirmar vuelve a verificar productos activos, pero el servicio existente no vuelve a validar actividad de proveedor/sucursal. La autoridad sigue siendo el backend.
- No se inventa moneda: los importes se muestran con dos decimales sin asignar un símbolo monetario que la API no proporciona.

## Demostración manual

1. Abrir `/compras`, buscar documentos y filtrar por estado/sucursal.
2. Nueva compra: seleccionar proveedor, sucursal existente y número de documento único; agregar líneas CANTIDAD y SERIALIZADO, cantidades, costos e importes opcionales. Quitar una línea si corresponde.
3. Revisar compra y guardar borrador: comprobar que no ingresó existencias y que aparecen los importes definitivos del servidor.
4. Preparar recepción: completar exactamente N unidades por detalle serializado. Las páginas muestran cinco unidades y conservan lo escrito. El contador indica faltantes; se detectan duplicados de toda la compra.
5. Revisar la advertencia, marcar recepción y confirmar explícitamente. Ver CONFIRMADA y los dispositivos consultados del backend. Abrir Inventario para ver existencias y movimientos COMPRA.
6. Para demostrar anulación, usar otro borrador, elegir Anular y escribir ANULAR. Ver ANULADA sin cambios de stock.

Estos pasos requieren autorización del operador para registrar datos; las pruebas automatizadas no los ejecutan contra la API real.

## Validación reproducible

Desde `frontend`:

```text
node --test tests/purchases.test.mjs tests/purchases-render.test.mjs
npm.cmd run lint
npm.cmd run build
```

Desde la raíz: `git diff --check` (y comprobación de whitespace de los archivos nuevos sin agregarlos al índice).

Los tests usan `node:test`, sin dependencias nuevas: validaciones, cálculo/orden de redondeo, unidades exactas por detalle, duplicados cruzados, campos opcionales, sucursales conocidas, filtros, respuestas inválidas, payloads, autenticación, abort signal y errores 400/401/403/404/409/500 con fetch simulado. Se comprueba que las escrituras del servicio solo se dirijan a compras. También se renderizan los componentes React/CoreUI con las herramientas ya instaladas para verificar captura paginada, contador, campos por control, advertencias, catálogos vacíos, detalle y carga inicial. No sustituye una prueba interactiva en navegador.

GET reales seguros ejecutados: `/api/health` respondió 200; `/api/compras`, `/api/productos`, `/api/proveedores`, `/api/inventario` y `/api/unidades` respondieron 401 sin token. No se dispone de una sesión autenticada en la consola; no se registraron compras, unidades ni ajustes. La demostración interactiva autenticada queda para el operador.
