# Consulta limitada de dispositivos para Ventas

## Estado y política de sucursales

Implementado `GET /api/unidades/disponibles?id_producto=10&id_sucursal=1`, con autenticación
y `IMEI_VER`. La migración está preparada y **no se ha ejecutado**. No se modificaron datos,
roles ni asignaciones de sucursales.

La inspección SELECT de `usuario_sucursales` confirmó dos columnas no nulas,
`id_usuario` e `id_sucursal`, con clave primaria compuesta según el esquema. En el estado
inspeccionado hay una asignación, correspondiente a un usuario; **Ocasco no tiene ninguna**.
En el código previo solo se escribía esta relación desde `utils/createRootUser.js`; no se
encontró una política general de sucursales aplicada a las consultas comerciales.

Se implementa para este nuevo endpoint la política restrictiva solicitada: debe existir una
fila explícita usuario/sucursal, el usuario y la sucursal deben seguir activos, y el producto
debe ser serializado y activo. Cero asignaciones significa cero acceso. ROOT conserva su
excepción de permiso existente, pero no omite la comprobación de sucursal. No se inventan
sucursales por rol, sucursales predeterminadas ni acceso global por ausencia de filas.

**Bloqueo operativo para Ocasco:** aplicar IMEI_VER no basta. Sin una asignación de sucursal
aprobada mediante un proceso administrativo independiente, la consulta devolverá 403. Esta
implementación no contiene SQL para asignar sucursales ni modifica las reglas de los demás
endpoints comerciales. La restricción de sucursal aquí descrita cubre la nueva consulta;
no constituye una revisión ni una ampliación de la autorización de escrituras de ventas.

## Contrato y separación de capacidades

- Filtros obligatorios, escalares, enteros positivos seguros: `id_producto`, `id_sucursal`.
  Parámetros adicionales o repetidos, listas y valores fuera de rango se rechazan con 400.
- Sin autenticación: 401. Sin IMEI_VER o sin acceso a la sucursal activa: 403.
- Producto inexistente, inactivo, no serializado o sin unidades disponibles: 200 con `[]`,
  siempre que la sucursal esté autorizada.
- Consulta parametrizada con SELECT; filtra `DISPONIBLE` y vuelve a unir la asignación de
  sucursal al seleccionar las unidades, evitando una lectura global entre comprobaciones.
- Cada elemento devuelve exclusivamente `id_unidad`, `id_producto`, `id_sucursal_actual`,
  `imei1`, `imei2`, `numero_serie`. No devuelve compras, costos, fechas, estado ni otros datos.
- El servicio proyecta expresamente esos seis campos, además de la selección SQL limitada.
- La consulta no usa `FOR UPDATE`, transacciones de escritura ni reservas de stock.
- GET `/api/unidades`, GET `/api/unidades/:idUnidad` y POST `/api/unidades` conservan
  `IMEI_GESTIONAR`. Este permiso no implica IMEI_VER para roles ordinarios, ni a la inversa.

Ventas utiliza la nueva consulta cuando se elige un producto serializado y una sucursal.
Al cambiar producto/sucursal se descartan selecciones; las consultas anteriores se cancelan
y sus respuestas tardías no restauran datos. No se consulta IMEI sin IMEI_VER. Los datos se
reconsultan antes de guardar un borrador serializado y al preparar la confirmación. Las
validaciones transaccionales de `saleService.js` permanecen intactas y siguen resolviendo
la disponibilidad definitiva al confirmar. La selección previa no garantiza ni reserva stock.

El frontend añade localmente `estado: 'DISPONIBLE'` a los resultados de este contrato limitado
para reutilizar las validaciones visuales existentes; ese campo no se obtiene de una consulta
global ni se envía para autorizar el backend.

## Aplicación posterior de la migración, exclusivamente manual

Archivo: `database/migrations/02_imei_ver.sql`. No se ejecuta desde la aplicación ni desde
las pruebas. Probar primero en una copia de pruebas y ejecutar una sola sesión de migración
a la vez. El script tiene su propio START TRANSACTION/COMMIT; no envolver SOURCE en una
transacción externa esperando poder deshacer su COMMIT. Ejecutar en modo batch sin `--force`
para detenerse ante errores antes de procesar las instrucciones posteriores.

1. Revisar el SQL y desplegar el código compatible. Registrar los resultados de las consultas
   previas para distinguir filas preexistentes de las creadas durante este despliegue.
2. Abrir el cliente MySQL con un operador autorizado. Sustituir HOST, PUERTO y OPERADOR; la
   contraseña se solicita interactivamente y no se incluye en el comando:

   ```powershell
   mysql --host=HOST --port=PUERTO --user=OPERADOR --password --database=tienda_celulares
   ```

3. En el cliente, comprobar entorno, rol, metadatos y asignación actual:

   ```sql
   SELECT DATABASE(), VERSION();
   SELECT id_rol, nombre, activo FROM roles WHERE nombre = 'VENDEDOR';
   SELECT id_permiso, codigo, nombre, descripcion, modulo
     FROM permisos WHERE codigo IN ('IMEI_VER', 'IMEI_GESTIONAR');
   SELECT r.id_rol, r.nombre, p.id_permiso, p.codigo
     FROM roles r JOIN rol_permisos rp ON rp.id_rol = r.id_rol
     JOIN permisos p ON p.id_permiso = rp.id_permiso
     WHERE r.nombre = 'VENDEDOR' AND p.codigo IN ('IMEI_VER', 'IMEI_GESTIONAR');
   SELECT u.username, us.id_sucursal, s.activo AS sucursal_activa
     FROM usuarios u LEFT JOIN usuario_sucursales us ON us.id_usuario = u.id_usuario
     LEFT JOIN sucursales s ON s.id_sucursal = us.id_sucursal
     WHERE u.username = 'Ocasco';
   ```

   Continuar únicamente si DATABASE() es la base prevista y hay exactamente un VENDEDOR
   activo. Si IMEI_VER ya existe, verificar que su significado coincide; no sobrescribir un
   permiso de significado diferente. Las filas preexistentes no son propiedad de este cambio.

4. Salir del cliente con `QUIT;`. Tras aprobar la revisión, ejecutar desde PowerShell:

   ```powershell
   Get-Content -Raw -LiteralPath 'C:\Users\erfre\Documents\tienda-celulares\database\migrations\02_imei_ver.sql' |
     mysql --host=HOST --port=PUERTO --user=OPERADOR --password --database=tienda_celulares --batch
   $LASTEXITCODE
   ```

   El script inserta únicamente el permiso ausente y su relación ausente con VENDEDOR.
   No cambia IMEI_GESTIONAR ni otros roles. Las claves únicas y NOT EXISTS evitan duplicados
   al repetirlo. Si no hay VENDEDOR activo, no inserta nada; un resultado final vacío NO
   constituye un despliegue correcto. Exigir código de salida 0 y revisar la SELECT final.
   Ante un error, no usar `--force`: el cliente batch se detiene y el cierre de conexión revierte
   la transacción pendiente. Inspeccionar el estado antes de repetir; no improvisar mutaciones.

5. Confirmar que la SELECT final del script devuelve exactamente VENDEDOR activo / IMEI_VER
   y que la consulta previa de IMEI_GESTIONAR no ha cambiado. En pruebas, repetir el batch y
   verificar que sigue habiendo una única relación. Registrar los identificadores creados.
6. Resolver el bloqueo de sucursal mediante el proceso administrativo aprobado, fuera de
   esta migración. No asignar todas las sucursales para sortear la restricción.
7. Reiniciar el backend actualizado, recargar el frontend y actualizar el acceso de la sesión
   para que `/auth/me` entregue IMEI_VER. Comprobar la consulta con una sucursal autorizada
   y otra no autorizada; POST `/unidades` y los ajustes deben seguir denegados a VENDEDOR.

Si se necesita revertir, preparar una reversión revisada usando el registro previo: retirar
solo la relación creada por este despliegue y eliminar el catálogo solo si también fue creado
por él y no tiene otros usos/asignaciones. No hay una eliminación automática que pueda borrar
permisos o relaciones preexistentes. Puede mantenerse el código desplegado sin el permiso:
las ventas por cantidad siguen disponibles y los serializados quedan bloqueados.

## Archivos de este cambio y validación

```text
.gitignore (excepción exclusivamente para esta migración revisable)
database/migrations/02_imei_ver.sql (nuevo, sin ejecutar)
backend/src/routes/serializedUnitRoutes.js
backend/src/validators/serializedUnitValidator.js
backend/src/controllers/serializedUnitController.js
backend/src/services/serializedUnitService.js
backend/src/repositories/serializedUnitRepository.js
backend/tests/available-units.test.js (nuevo)
frontend/src/auth/permissions.js
frontend/src/services/inventoryService.js
frontend/src/views/sales/Sales.jsx
frontend/src/views/sales/SaleForm.jsx
frontend/src/views/sales/saleAvailability.js (nuevo)
frontend/src/views/sales/useSaleUnits.js (nuevo)
frontend/tests/sale-availability.test.mjs (nuevo)
docs/autorizacion-frontend.md
docs/unidades-disponibles-ventas.md (este documento)
```

Las pruebas inyectan repositorios/pool o fetch simulados y no ejecutan SQL real ni migraciones.
Cubren permiso vigente y revocado, ausencia de sucursales, sucursal ajena/inactiva, ROOT sin
asignación, filtros inválidos, respuesta limitada, GET generales/POST restringidos, consultas
canceladas, respuestas tardías, selección descartada y regresión del formulario por cantidad.
La prueba del mapa HTTP contrasta el nuevo guard con las rutas reales montadas.

Comandos de verificación desde la raíz del repositorio:

```powershell
node --test backend/tests/*.test.js
cd frontend
node --test --test-concurrency=1 tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
cd ..
git diff --check
```

La revisión visual con sesión real y la ejecución de la migración quedan pendientes de
aprobación y ejecución manual. Compras, Transferencias y las consultas generales de Inventario
no usan este nuevo permiso ni se modifican en este cambio.

Resultados de esta implementación: backend 73/73 y frontend 177/177; lint, build y
`git diff --check` correctos. El build conserva advertencias de configuración de Vite y tamaño
de chunks. La comprobación SELECT final en `tienda_celulares` confirmó 0 permisos IMEI_VER y
0 sucursales asignadas a Ocasco: la migración continúa sin ejecutar y el bloqueo sigue vigente.
