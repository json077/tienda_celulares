# Autorización del frontend

El backend sigue siendo la autoridad definitiva. Se conservan las rutas HTTP, las reglas
comerciales y las asignaciones de MySQL. Los guards de consulta de productos y clientes usan
los códigos canónicos `PRODUCTO_VER` y `CLIENTE_VER`, sin equivalencias generales en `can()`.

## Sesión y visibilidad

- `AuthContext.can(codigo)` utiliza el usuario efectivo recibido de `/auth/me`.
  El login también valida `/auth/me` antes de mostrar la aplicación protegida.
- ROOT tiene la misma excepción que el middleware del backend, exclusivamente cuando el rol
  figura en la sesión vigente consultada al servidor. Nunca se decodifican claims del JWT.
- La sesión se revalida al recuperar el foco, mediante **Actualizar acceso** y después de un
  HTTP 403 real. Los 403 simultáneos comparten una revalidación. Mientras esta revalidación
  por denegación está pendiente, o si falla, las capacidades quedan bloqueadas.
- Los cambios de identidad, roles o permisos descartan las vistas y formularios abiertos.
  Una revocación de consulta muestra acceso denegado sin montar la vista ni cargar datos.
- No hay notificaciones push ni sondeo continuo: una revocación externa se detecta al
  recuperar el foco, actualizar el acceso o recibir una denegación del backend.
- `modules.js` declara el permiso de consulta. Menú y rutas comparten esa declaración;
  crear, editar, activar/desactivar, confirmar, anular y otras acciones tienen controles
  independientes. Un usuario puede consultar sin disponer de permisos de escritura.
- `services/api.js` aplica una política vinculada por `AuthContext` antes de `fetch`, también
  a las lecturas auxiliares. Una consulta conocida como no autorizada se rechaza localmente
  con estado 403, sin petición HTTP. No se reintentan escrituras automáticamente.
- El cliente especializado de transferencias usa la misma política y notificación de 403,
  conservando su tratamiento de errores y la protección frente a respuestas HTML/SQL.
- `auth/permissions.js` refleja los guards existentes, incluidos permisos múltiples para
  crear usuarios y consultas que solo requieren autenticación, como tipos de cambio.
  Una prueba contrasta este mapa contra todas las rutas montadas del backend.

## Módulos sin permiso de consulta identificable

| Módulo | Decisión |
| --- | --- |
| Dashboard | Página estática de inicio para cualquier sesión autenticada. No consulta una API; no se aplica el código histórico `DASHBOARD_VER`. |
| Reportes | Oculto y bloqueado por URL, incluido ROOT. No hay endpoint montado de consulta que justifique `REPORTE_VER`. |
| Configuración | Oculta y bloqueada por URL, incluido ROOT. No existe un guard general de consulta identificable. |
| Respaldos | Usa `BACKUP_CREAR`, exactamente como GET `/api/respaldos`. La página continúa siendo un placeholder. No se inventó `BACKUP_VER`. |

## Limitaciones de la matriz actual

- Productos, marcas y categorías se consultan con `PRODUCTO_VER`; Clientes con `CLIENTE_VER`.
  Los permisos de escritura permanecen como `PRODUCTOS_CREAR/EDITAR/ELIMINAR` y
  `CLIENTES_CREAR/EDITAR/ELIMINAR`. Sus inconsistencias de catálogo/asignación no se corrigen
  en esta etapa; disponer de consulta no concede esas operaciones.
- Compras y Proveedores conservan los códigos plurales de sus endpoints; no se tradujeron
  los códigos históricos singulares.
- Con los permisos auditados, INVENTARIO ve Dashboard, Inventario, Transferencias,
  Productos, Devoluciones y Garantías. No ve módulos administrativos, Ventas ni Clientes.
- Crear una transferencia requiere consultar productos y existencias además del permiso
  de creación. INVENTARIO ya cumple estas consultas con sus códigos efectivos actuales.
- Crear ventas requiere los catálogos de productos, clientes y existencias. Crear compras
  requiere productos y proveedores. Esas dependencias no bloquean las consultas del módulo.
- Las consultas auxiliares de ventas, factura, pagos, IMEI y movimientos se rechazan antes
  de la red cuando faltan sus permisos. Las vistas conservan sus advertencias y alternativas
  existentes; no se amplía el acceso comercial para completar postventa.
- Los GET generales de IMEI siguen exigiendo `IMEI_GESTIONAR`; Ventas usa ahora la consulta
  limitada `/unidades/disponibles`, protegida por `IMEI_VER` y sucursal asignada. Su migración
  está preparada, sin ejecutar. Consultar pagos conserva `PAGO_REGISTRAR`.

## Validación automatizada y revisión manual

Pruebas sin MySQL ni API comercial real:

```powershell
cd frontend
node --test --test-concurrency=1 tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
cd ../backend
node --test tests/*.test.js
cd ..
git diff --check
```

Las pruebas nuevas simulan ROOT, ADMINISTRADOR, VENDEDOR e INVENTARIO; verifican menú,
rutas directas, botones y handlers invocados incluso cuando el botón está deshabilitado.
Comprueban que estos handlers no abren formularios restringidos ni envían solicitudes.
Se incluyen revocación de ROOT, permisos retirados con sesión abierta, fallos de revalidación,
respuestas tardías tras logout y permisos exactos frente a códigos históricos.

Revisión manual pendiente en navegador:

1. Iniciar sesión con `lidial` y comprobar los seis módulos indicados y las existencias.
2. Abrir directamente `#/usuarios-roles`, `#/ventas` y `#/clientes`:
   deben mostrar acceso denegado sin consultas a esos endpoints. `#/productos` permite consultar.
3. Revisar los formularios con roles de solo consulta y operaciones independientes.
4. En un entorno de pruebas, revocar un permiso durante una sesión y recuperar el foco:
   debe desaparecer la acción o bloquearse la ruta y descartarse el formulario anterior.
5. Simular una denegación del servidor y comprobar el aviso y **Actualizar acceso**.

La corrección de la matriz, los permisos de consulta limitados para postventa y la revisión
visual en navegador quedan para una etapa posterior. No se requiere guardar en GitHub
para realizar esta revisión.

## Corrección mínima de Nueva venta para VENDEDOR

La apertura exige `VENTA_CREAR`, `PRODUCTO_VER`, `CLIENTE_VER` e `INVENTARIO_VER`.
El POST de ventas sigue exigiendo exclusivamente `VENTA_CREAR` como permiso de esa ruta;
las consultas adicionales preparan los catálogos del formulario.

Se alinearon los listados y detalles GET de productos, clientes, marcas y categorías en
backend y en el mapa HTTP del frontend. También se actualizaron los permisos de módulo
y las dependencias de consulta en Ventas, Compras y Transferencias. No se modificaron
`AuthContext.can()`, los guards de escritura ni la matriz o las asignaciones de MySQL.

Las pruebas usan los permisos efectivos de VENDEDOR confirmados en la auditoría. Comprueban
que el botón está habilitado, su handler carga productos/clientes/existencias y abre el
formulario real, sin llamar a IMEI ni enviar escrituras. Los guards reales del backend se
prueban con repositorio y controladores simulados: autorizan las consultas y `VENTA_CREAR`,
pero deniegan modificar los catálogos, ajustar inventario y consultar/registrar IMEI.

El formulario por cantidad sigue disponible sin `IMEI_GESTIONAR`. Para serializados se añadió
la consulta limitada con `IMEI_VER`; el permiso y su asignación requieren aplicar manualmente
la migración preparada, además de una sucursal explícitamente autorizada. Véase
[unidades-disponibles-ventas.md](unidades-disponibles-ventas.md) para política, bloqueo actual
de Ocasco, archivos e instrucciones de aplicación. No se concede registro de dispositivos.

Archivos de esta corrección (además de este documento):

```text
backend/src/routes/productRoutes.js
backend/src/routes/clientRoutes.js
backend/src/routes/brandRoutes.js
backend/src/routes/categoryRoutes.js
backend/tests/catalog-read-authorization.test.js (nuevo)
frontend/src/auth/permissions.js
frontend/src/config/modules.js
frontend/src/views/sales/Sales.jsx
frontend/src/views/purchases/Purchases.jsx
frontend/src/views/transfers/Transfers.jsx
frontend/tests/permissions.test.mjs
frontend/tests/permissions-render.test.mjs
```

Revisión manual pendiente: reiniciar el backend con los guards actualizados y recargar el
frontend; iniciar sesión con `Ocasco` y abrir **Nueva venta**. Deben cargarse los tres catálogos
y permanecer restringidas las operaciones de modificación no concedidas.

## Archivos modificados en esta implementación

Todos los paths siguientes son relativos a `frontend/`, salvo este documento:

```text
src/auth/permissions.js (nuevo)
src/contexts/AuthContext.jsx
src/config/modules.js
src/_nav.jsx
src/routes.js
src/components/AppSidebar.jsx
src/components/AppContent.jsx
src/components/auth/ProtectedRoute.jsx
src/components/contacts/ContactDirectory.jsx
src/services/api.js
src/services/transferService.js
src/views/products/Products.jsx
src/views/customers/Customers.jsx
src/views/suppliers/Suppliers.jsx
src/views/purchases/Purchases.jsx
src/views/sales/Sales.jsx
src/views/inventory/Inventory.jsx
src/views/credits/Credits.jsx
src/views/credits/CreditDetail.jsx
src/views/cash/Cash.jsx
src/views/transfers/Transfers.jsx
src/views/returns/Returns.jsx
src/views/warranties/Warranties.jsx
src/views/users/userModel.js
tests/auth-session.test.mjs (nuevo)
tests/permissions.test.mjs (nuevo)
tests/permissions-render.test.mjs (nuevo)
tests/clients-render.test.mjs
tests/suppliers-render.test.mjs
tests/products-render.test.mjs
tests/purchases-render.test.mjs
tests/credits-render.test.mjs
tests/credit-plan-render.test.mjs
tests/inventory-render.test.mjs
tests/users.test.mjs
```

Se conservaron los cambios que ya existían en rutas, API y Usuarios y roles. El archivo
`userModel.js` y su prueba ya estaban sin seguimiento en Git al comenzar; se adaptaron para
compartir la comprobación central. Los demás archivos previos de ese módulo no se reemplazaron.
