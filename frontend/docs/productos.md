# Productos

## Contrato inspeccionado

Se revisaron app.js; rutas, controlador, servicio, repositorio y validator de productos; rutas/controladores/servicios/repositorios de categorías y marcas; middlewares JWT y permisos; autenticación y módulos existentes del frontend.

Base existente: http://localhost:3000/api. Todas las solicitudes reutilizan productService y api.js con JWT almacenado por la autenticación actual.

| Endpoint utilizado | Permiso | Contrato |
| --- | --- | --- |
| GET /productos | PRODUCTOS_VER | { ok: true, data: Producto[] }; incluye activos e inactivos, ordenados por nombre |
| GET /productos/:id | PRODUCTOS_VER | { ok: true, data: Producto }; 404 si no existe |
| POST /productos | PRODUCTOS_CREAR | Producto completo sin estado; 201 con data y message |
| PUT /productos/:id | PRODUCTOS_EDITAR | Producto completo con activo booleano; 200 con data y message |
| DELETE /productos/:id | PRODUCTOS_ELIMINAR | Desactivación lógica: UPDATE activo=0; 200 con message, sin data |
| GET /categorias | PRODUCTOS_VER | data: [{ id_categoria, nombre, descripcion, activo }] |
| GET /marcas | PRODUCTOS_VER | data: [{ id_marca, nombre, descripcion, activo }] |

No se usan las otras operaciones de catálogos. No hay endpoint específico de reactivación: se consulta el detalle vigente y se envía PUT completo con activo=true. Desactivar también consulta el detalle para comprobar el estado antes de ejecutar DELETE. Ambas operaciones requieren confirmación. No se elimina físicamente ningún registro.

ROOT conserva acceso universal por el middleware existente. Login y /auth/me exponen roles, no permisos efectivos. Por ello no se deducen permisos a partir de nombres de roles: el backend decide cada operación y apiErrorMessage muestra los errores 401/403 y los detalles de validación.

## Campos y reglas reales

Obligatorios en POST y PUT: id_categoria (entero positivo, categoría activa), sku (1–50 caracteres), nombre (2–160), tipo_control (CANTIDAD o SERIALIZADO), precio_venta (número >=0), permite_descuento (booleano). PUT exige además activo booleano.

Opcionales: id_marca (entero positivo de marca activa o null), descripcion (texto o null, sin límite declarado en validator), porcentaje_descuento_maximo (0–100, predeterminado 0), dias_garantia (entero 0–65535, predeterminado 0). El servicio convierte SKU a mayúsculas, recorta textos y fuerza descuento máximo a cero cuando no se permite descuento. SKU duplicado produce 409. Un producto se crea siempre activo por el INSERT real, independientemente de cualquier activo enviado.

Producto devuelto incluye id_producto y nombres categoria/marca, además de los campos anteriores. El frontend solo envía los campos aceptados, nunca IDs propios o nombres de relaciones. No hay costo, stock, IMEI ni fechas en este contrato. No se modifica inventario.

## Funcionalidad

Ruta /productos previamente integrada, listado CoreUI adaptable al tema, búsqueda combinada por nombre/SKU sin distinguir mayúsculas y filtros combinables por categoría, marca (incluye sin marca), estado y control, con limpieza. Los filtros son locales porque GET no implementa parámetros de filtrado ni paginación. Categorías y marcas del filtro representan las relaciones presentes en el listado; los selectores del formulario consultan los endpoints reales y muestran las relaciones inactivas deshabilitadas.

Creación y edición con validación HTML y validación explícita compatible con backend; información de descripción, garantía y descuentos en tabla. Carga, éxito, error, confirmación de estado, conservación del último listado si falla actualización y bloqueo con referencia síncrona contra doble envío. Formulario sin stock ni IMEI, con explicación diferente para cada control.

## Archivos

Creados: src/views/products/productModel.js, tests/products.test.mjs, tests/products-render.test.mjs, docs/productos.md.

Modificados: src/views/products/Products.jsx y src/views/products/ProductForm.jsx.

Reutilizados sin modificación: src/services/productService.js, src/services/api.js, src/routes.js. No se modificaron backend, base de datos, autenticación ni módulos terminados; no se instalaron dependencias.

## Limitaciones reales

- Reactivación y edición requieren relaciones activas. Si la categoría o marca actual está inactiva, primero editar y seleccionar relaciones válidas; la marca puede quedar vacía. Se muestra el error del backend si falla la reactivación.
- El backend permite cambiar tipo_control sin comprobar historial o existencias. El formulario advierte al cambiarlo; no añade reglas inexistentes. Verificar historial antes de hacerlo.
- PUT reemplaza todos los campos; no hay control de versión ni actualización atómica condicional. Consultar detalle antes de activar reduce datos obsoletos pero no elimina una carrera concurrente.
- No hay paginación ni búsqueda en servidor, ni endpoint de costo o stock dentro de Productos.
- Las pruebas automatizadas cubren renderizado SSR, modelo de filtros/validación, contratos HTTP con fetch simulado, errores y validators reales. No sustituyen la revisión interactiva en navegador.

## Verificación

Desde frontend, sin instalar paquetes:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

La ejecución secuencial evita conflictos entre puertos HMR de las pruebas SSR existentes. Se prueban Productos, Compras, Ventas, Caja/Pagos e Inventario. Ninguna prueba de Productos consulta la API real o la base de datos.

## Prueba manual exacta

Usar entorno de pruebas y datos propios para esta verificación; las operaciones manuales sí persisten en la API.

1. Con backend y frontend iniciados mediante sus scripts existentes, iniciar sesión y abrir /productos. Comprobar carga, listado y botón Actualizar en temas claro y oscuro y pantalla estrecha.
2. Buscar nombre parcial y SKU; combinar categoría, marca, estado y control; verificar contador, resultado vacío y Limpiar filtros.
3. Crear producto de prueba con SKU único, nombre Cargador USB-C 20W Premium, categoría activa, marca opcional, CANTIDAD, precio 200, descuento habilitado 10%, garantía 30. Verificar éxito y fila activa. No debe aparecer entrada de stock o IMEI.
4. Crear otro producto de prueba Samsung Galaxy A55 128GB con SKU distinto y SERIALIZADO. Verificar explicación de IMEI en Compras/Inventario y ausencia de campos de unidades.
5. Intentar nombre de un carácter, precio negativo, garantía fraccionaria o >65535 y descuento >100. Corregirlos y comprobar que solo el formulario válido se envía. Probar SKU duplicado y comprobar error del servidor sin cerrar formulario.
6. Editar descripción, precio y garantía de un producto de prueba; guardar y actualizar. Verificar persistencia y conservación del estado. Cambiar control solo sobre un producto de prueba sin historial y observar advertencia.
7. Desactivar el producto de prueba: cancelar primero y comprobar que no cambia; repetir y confirmar. Filtrar inactivos, activar y confirmar. Verificar que el producto mantiene ID y datos. Pulsar rápidamente Guardar/confirmación y comprobar un solo envío en Network.
8. Probar usuario sin permiso de escritura, comprobar 403 del servidor; probar sesión expirada y comprobar 401. Verificar acceso de ROOT. No inferir permisos por rol.
9. Simular API desconectada y actualizar: comprobar error, conservar último listado y reintentar. Revisar que un error del formulario deja sus datos disponibles.
10. Revisar Compras, Ventas, Caja/Pagos e Inventario con sus flujos manuales existentes. Productos no debe alterar stock o unidades.

Resultado de esta entrega: ESLint sin errores; build correcto (avisos de Vite sobre configLoader y bundle >500 kB); 42 pruebas aprobadas, cero fallos; git diff --check correcto. La prueba manual en navegador queda pendiente de ejecución por el usuario con su entorno y credenciales.
