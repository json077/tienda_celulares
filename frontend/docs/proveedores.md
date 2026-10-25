# Proveedores

## Contrato real inspeccionado

Se revisaron `backend/src/app.js`, rutas, controlador, validator, servicio y repositorio de proveedores, además de los middlewares JWT/permisos. En frontend se revisaron Suppliers, supplierService, ContactDirectory, ContactForm, routes, Clientes y el consumo de proveedores en Compras.

Base existente: `http://localhost:3000/api`. Se reutilizan `api.js`, almacenamiento de token y cabecera JWT actuales.

| Endpoint utilizado | Permiso real | Respuesta correcta |
| --- | --- | --- |
| GET /proveedores | PROVEEDORES_VER | 200 `{ ok: true, data: Proveedor[] }` |
| GET /proveedores/:idProveedor | PROVEEDORES_VER | 200 `{ ok: true, data: Proveedor }` |
| POST /proveedores | PROVEEDORES_CREAR | 201 `{ ok: true, message, data: Proveedor }` |
| PUT /proveedores/:idProveedor | PROVEEDORES_EDITAR | 200 `{ ok: true, message, data: Proveedor }` |
| DELETE /proveedores/:idProveedor | PROVEEDORES_ELIMINAR | 200 `{ ok: true, message, data: { id_proveedor } }` |

El listado incluye activos e inactivos y se ordena por nombre ascendente. Un proveedor devuelto contiene `id_proveedor`, `tipo_identificacion`, `identificacion`, `nombre`, `telefono`, `email`, `direccion`, `activo`, `created_at` y `updated_at`.

DELETE hace `UPDATE activo = 0`: conserva registro e historial. No existe eliminación física ni endpoint específico de reactivación. Reactivar usa PUT completo con `activo: true`, después de consultar el detalle vigente. El flujo compartido también consulta el detalle antes de desactivar y rechaza un estado diferente del mostrado en la confirmación.

## Campos y reglas

| Campo | Regla del backend |
| --- | --- |
| nombre | Único campo de texto obligatorio; no vacío tras trim; máximo 160 caracteres. No exige unicidad del nombre. |
| tipo_identificacion | Opcional/null, máximo 30 caracteres. Sin enum ni catálogo. |
| identificacion | Opcional/null, máximo 50 caracteres. Si se proporciona, debe ser única, incluyendo proveedores inactivos. |
| telefono | Opcional/null, máximo 30 caracteres; sin patrón ni prefijo obligatorio. |
| email | Opcional/null, correo válido mediante isEmail(), máximo 150 caracteres. |
| direccion | Opcional/null, máximo 255 caracteres. |
| activo | En PUT, booleano opcional en validator; si se omite, el servicio asume true. El INSERT crea siempre activo. |

Los textos se recortan y los opcionales vacíos se envían como null. La interfaz no agrega patrones de cédula/RUC/teléfono ni exige identificación o contacto. El correo se comprueba mediante formato básico y validación HTML; el backend mantiene la comprobación definitiva con isEmail().

POST envía exclusivamente los seis campos de texto aceptados y crea activo. PUT envía esos mismos campos y un booleano `activo` explícito para preservar el estado al editar. No se envían IDs propios, fechas, saldos ni campos ajenos al contrato. El estado se cambia desde el listado con confirmación.

Errores reales: 400 por validación/ID inválido o proveedor ya inactivo; 401 por JWT; 403 por permiso; 404 por proveedor inexistente; 409 por identificación duplicada; 500 por error interno. Se muestran el mensaje del servidor y los detalles `errores[].msg`, junto al contexto 401/403 de apiErrorMessage.

ROOT conserva acceso universal por el middleware existente. La sesión expone roles, no permisos efectivos; no se deducen permisos a partir de roles ni se inventa un catálogo. Las acciones visibles están sujetas a autorización definitiva del servidor. El botón Nuevo proveedor requiere PROVEEDORES_CREAR al enviar; editar/reactivar requieren PROVEEDORES_EDITAR y desactivar PROVEEDORES_ELIMINAR. La consulta previa de detalle requiere PROVEEDORES_VER.

## Funcionalidades

- Listado real, Actualizar y Nuevo proveedor; tabla CoreUI responsive con nombre, identificación y tipo, teléfono, correo, dirección y badges de estado; sin IDs técnicos visibles.
- Búsqueda local sin distinción de mayúsculas por los seis campos reales; filtro combinable Todos/Activos/Inactivos y Limpiar filtros.
- Creación y edición mediante modal, con validación de requeridos, límites y correo, consulta de detalle antes de editar y errores visibles sin perder el formulario.
- Desactivación lógica y reactivación con confirmación; bloqueo de botones durante proceso y referencia síncrona existente contra doble envío.
- Carga, mensaje de éxito, errores útiles, listado vacío y sin coincidencias. Se actualiza después de cada operación; un fallo de recarga conserva el último listado y muestra advertencia.
- Normalización exclusiva para la vista de Proveedores: convierte ID/estado a números y conserva ceros iniciales de identificación/teléfono, opcionales null y fechas; rechaza listados o detalles inválidos.
- Se reutilizan los componentes compartidos sin modificarlos y las clases semánticas de CoreUI para temas claro/oscuro.

## Relación con Compras

Compras utiliza `supplierService.list()` y espera `{ ok, data: Proveedor[] }` con `id_proveedor`, `nombre` y `activo`. Ese contrato se mantiene íntegro: el servicio no aplica normalización ni filtra la respuesta. El filtro de Compras sigue ofreciendo únicamente proveedores activos y su modelo valida esa condición.

Después de cambiar el estado de un proveedor, abrir una nueva compra recarga el catálogo. Desactivar un proveedor no elimina sus compras históricas. No se modifica ningún archivo de implementación de Compras ni se crean compras durante las pruebas.

## Archivos

Creados:

- `src/views/suppliers/supplierModel.js`
- `tests/suppliers.test.mjs`
- `tests/suppliers-render.test.mjs`
- `docs/proveedores.md`

Modificados:

- `src/views/suppliers/Suppliers.jsx`: conecta las opciones específicas ya disponibles en ContactDirectory.
- `src/services/supplierService.js`: exporta el constructor existente como supplierPayload para verificarlo, conservando métodos, endpoints y respuestas.
- `tests/clients-render.test.mjs`: actualiza exclusivamente las dos expectativas de Proveedores que describían la ausencia de filtro y la columna ID. No cambia las comprobaciones de Clientes ni su implementación.

No se modifican backend, BD, autenticación, componentes compartidos, rutas, dependencias ni implementación de módulos terminados. No se hace commit ni push.

## Limitaciones reales

- No hay paginación ni búsqueda/filtros en servidor; GET devuelve el catálogo completo y se filtra en memoria.
- No hay catálogo de tipos de identificación, historial de compras dentro de este módulo, datos bancarios, saldos ni crédito en este contrato. No se simulan.
- PUT no es una edición parcial: los opcionales omitidos se limpian y activo omitido pasa a true. La interfaz siempre envía el formulario completo y el estado explícito.
- No existe control de versión ni operación condicional de estado: la consulta previa reduce datos obsoletos, pero no evita totalmente una carrera concurrente entre consulta y escritura. DELETE tampoco comprueba filas afectadas.
- No se pueden ocultar acciones anticipadamente por permisos efectivos porque la sesión no los expone; se conserva la autoridad y respuesta 401/403 del backend.
- Las pruebas verifican modelos, contrato HTTP, validators reales sin BD y renderizado SSR. La revisión interactiva/visual en navegador queda pendiente del procedimiento manual.

## Verificación automatizada

Desde frontend, sin instalar dependencias:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Resultados: ESLint sin errores; build correcto; 56 pruebas aprobadas, cero fallos; git diff --check correcto. El build conserva avisos existentes sobre __dirname/configLoader native y bundle mayor de 500 kB.

Las pruebas específicas cubren normalización/no mutación, búsqueda/estado, vacíos, límites, opcionales, payloads POST/PUT comprobados contra validators reales, respuesta de DELETE, JWT/señales, errores HTTP/red/cancelación y renderizado de datos/formulario/bloqueo. Se prueba la selección de proveedores activos en Compras y se ejecutan todas las pruebas existentes de Clientes, Productos, Inventario, Compras, Ventas y Caja/Pagos. Se utiliza fetch simulado; no se accede a API ni base de datos reales.

## Prueba manual en navegador

Utilizar el entorno de pruebas y credenciales existentes. Las acciones manuales sí persisten, por lo que se deben usar proveedores de prueba y conservarlos por desactivación.

1. Si los servidores ya funcionan, reutilizarlos. En caso contrario, ejecutar `npm.cmd start` desde backend con su configuración existente para API en puerto 3000 y `npm.cmd start -- --port 3001` desde frontend en otra terminal. Abrir la URL mostrada por Vite y `/#/proveedores`, por ejemplo `http://localhost:3001/#/proveedores`; iniciar sesión.
2. Comprobar título, descripción, carga, Actualizar y Nuevo proveedor; tabla sin ID, temas claro/oscuro y ancho móvil.
3. Crear `Distribuidora Prueba AAAAMMDD` proporcionando solo nombre. Comprobar éxito y fila activa; identificación/contacto vacíos deben representarse con un guion, nunca null/undefined.
4. Editar el proveedor con tipo `PRUEBA`, identificación única `PROV-TEST-AAAAMMDD-01`, teléfono `+505 8888-0000`, correo `proveedor.prueba@example.com` y dirección `Managua`. Guardar y Actualizar; comprobar persistencia. Vaciar un opcional y verificar que se limpia correctamente.
5. Buscar fragmentos de nombre, identificación, teléfono, correo y dirección; combinar estado; probar sin coincidencias y Limpiar filtros. Comprobar que se pueden consultar activos e inactivos.
6. Intentar guardar nombre vacío/espacios, correo inválido y límites excedidos. Probar identificación duplicada en otro proveedor con nombre válido y comprobar el error del servidor manteniendo datos en el modal. Guardar rápidamente varias veces y revisar en Network que se realiza una sola escritura.
7. Desactivar el proveedor: cancelar primero y comprobar que no cambia; repetir y confirmar. Comprobar badge Inactivo y filtro Inactivos. Editar ese proveedor sin cambiar estado y verificar que continúa inactivo. Reactivar mediante confirmación y comprobar conservación de datos e identificación.
8. Abrir Compras > Nueva compra: comprobar que el proveedor activo aparece en el selector. Cancelar sin guardar, desactivarlo en Proveedores y abrir una nueva compra para recargar el catálogo: ya no debe aparecer. Reactivarlo y repetir. No confirmar compras durante esta verificación.
9. Con un usuario existente sin permiso de escritura, intentar la operación restringida y comprobar 403 y mensaje. Probar ROOT. Para 401, invalidar temporalmente el token en DevTools de la sesión de prueba y pulsar Actualizar; comprobar mensaje y volver a iniciar sesión. No cambiar permisos ni datos de usuarios en BD.
10. Simular Offline con DevTools y Actualizar sobre un listado ya cargado: comprobar error y conservación de datos; restaurar conexión y reintentar. Comprobar también un fallo al guardar sin perder el formulario. Revisar Clientes para confirmar que conserva su comportamiento.

La prueba interactiva de navegador no se ejecutó automáticamente.
