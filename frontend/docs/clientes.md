# Clientes

## Contrato real y permisos

Inspección previa: `backend/src/app.js`, `routes/clientRoutes.js`, `controllers/clientController.js`, `validators/clientValidator.js`, `services/clientService.js`, `repositories/clientRepository.js`, middlewares JWT/permisos y el contrato de sesión existente. Se revisaron también Customers, customerService, ContactDirectory, ContactForm y los patrones de Productos, Compras y Ventas.

Base existente en `api.js`: `http://localhost:3000/api`. Todas las peticiones utilizan el JWT del mecanismo actual.

| Método y endpoint usado | Permiso real | Respuesta correcta |
| --- | --- | --- |
| GET /clientes | CLIENTES_VER | 200, `{ ok: true, data: Cliente[] }` |
| GET /clientes/:idCliente | CLIENTES_VER | 200, `{ ok: true, data: Cliente }` |
| POST /clientes | CLIENTES_CREAR | 201, `{ ok: true, message, data: Cliente }` |
| PUT /clientes/:idCliente | CLIENTES_EDITAR | 200, `{ ok: true, message, data: Cliente }` |
| DELETE /clientes/:idCliente | CLIENTES_ELIMINAR | 200, `{ ok: true, message, data: Cliente }` |

DELETE hace un `UPDATE activo = 0`, conservando registro e historial. No hay eliminación física ni endpoint independiente de reactivación. Para reactivar se consulta GET del detalle actual y se envía PUT completo con `activo: true`. Desactivación y reactivación verifican primero que el estado no haya cambiado desde el listado y requieren confirmación.

El middleware concede acceso universal a ROOT. El frontend actual conoce roles, no permisos efectivos; no deduce autorizaciones por nombres de roles ni inventa permisos. El backend decide cada operación. Se mantienen los mensajes 401/403 de `apiErrorMessage`, el mensaje del servidor y los detalles `errores[].msg`.

## Campos y validaciones

| Campo | Contrato de entrada |
| --- | --- |
| tipo_identificacion | Obligatorio, texto recortado, máximo 30 caracteres. No existe enum ni catálogo de tipos. |
| identificacion | Obligatorio, texto recortado, máximo 50 caracteres, único incluso entre clientes inactivos. No hay patrón específico de cédula. |
| nombres | Obligatorio, texto recortado, máximo 100 caracteres. |
| apellidos | Opcional, máximo 100 caracteres; vacío se envía como null. |
| telefono | Opcional, máximo 30 caracteres; vacío se envía como null. No existe patrón numérico ni prefijo obligatorio. |
| email | Opcional, correo válido según `isEmail()` del backend, máximo 150 caracteres; vacío se envía como null. |
| direccion | Opcional, máximo 255 caracteres; vacío se envía como null. |
| activo | Booleano opcional en POST (predeterminado 1), obligatorio en PUT. |

La interfaz crea clientes activos omitiendo `activo` en POST. En edición conserva el estado y lo cambia únicamente desde las acciones confirmadas del listado. El formulario aplica límites, rechaza obligatorios en blanco y comprueba formato básico del correo, además de la validación HTML; el servidor mantiene la validación definitiva con `isEmail()`.

Cliente devuelto: los campos anteriores más `id_cliente`, `created_at` y `updated_at`. Se normalizan ID y estado solamente en la vista de Clientes; identificación y teléfono conservan ceros iniciales, formato y tipo texto. Se preservan nulos y fechas. Se rechazan respuestas de listado/detalle inválidas sin reemplazar el último listado correcto.

Errores reales: 400 por validación o ID inválido; 401 por JWT; 403 por permiso; 404 si no existe; 409 por identificación duplicada, desactivación repetida o actualización de estado sin fila afectada; 500 por error interno.

## Funcionalidades y archivos

- Ruta `/clientes` ya integrada: se reutiliza sin modificar rutas ni navegación.
- Tabla CoreUI responsive con nombre completo, identificación y tipo, teléfono, correo, dirección, badges de estado y acciones. Se ocultan IDs técnicos solo en Clientes.
- Búsqueda local por nombre completo, identificación, tipo, teléfono, correo o dirección; filtro combinable de activos/inactivos y botón Limpiar filtros.
- Crear y editar mediante modal; consulta del detalle vigente antes de editar; errores visibles sin perder los datos del formulario.
- Activar/desactivar con confirmación, bloqueo durante proceso y referencia síncrona contra doble envío en las mutaciones.
- Carga, éxito, error, mensajes para listados vacíos y sin coincidencias, recarga posterior a cada cambio. Si falla la recarga, conserva los últimos datos y advierte que deben actualizarse.
- Componentes CoreUI y clases semánticas compatibles con tema claro/oscuro; sin rediseño global.

Archivos creados:

- `src/views/customers/clientModel.js`
- `tests/clients.test.mjs`
- `tests/clients-render.test.mjs`
- `docs/clientes.md`

Archivos modificados:

- `src/views/customers/Customers.jsx`: conecta las opciones y reglas específicas de Clientes.
- `src/services/customerService.js`: exporta el constructor de payload existente para verificarlo; conserva métodos, rutas, forma de respuesta y comportamiento.
- `src/components/contacts/ContactDirectory.jsx`: añade opciones para filtros/mapeo/IDs y separa la tabla como componente del mismo archivo para verificar filas reales por SSR. Proveedores conserva sus opciones predeterminadas.
- `src/components/contacts/ContactForm.jsx`: permite usar la validación específica configurada, conservando la validación predeterminada de Proveedores.

No se modificaron Ventas, Compras, Caja/Pagos, Inventario, Productos, autenticación, backend, base de datos, rutas o dependencias. Ventas sigue consumiendo `customerService.list()` con el mismo contrato y seleccionando solo clientes activos.

## Limitaciones reales

- GET devuelve todos los clientes, activos e inactivos, ordenados por ID descendente. No implementa paginación ni filtros/búsqueda en servidor; se filtra en memoria.
- No existe catálogo de tipos de identificación, validación nacional de cédula/teléfono ni endpoint de historial, saldo, crédito o eliminación física en este módulo. No se simulan estas funciones.
- PUT requiere campos obligatorios completos y estado; no admite edición parcial. No hay control de versión: consultar antes de reactivar reduce datos obsoletos, pero no garantiza exclusión frente a otra edición concurrente.
- No se puede conocer de antemano el permiso efectivo con el contrato de sesión actual. Las acciones se intentan y se muestra la respuesta autoritativa del backend.
- Las pruebas son de modelo, contrato HTTP con mocks, validators reales sin BD y renderizado SSR. No son pruebas E2E de navegador; la comprobación visual y el flujo interactivo quedan para el procedimiento manual siguiente.

## Verificación automatizada

Desde `frontend`, sin instalar paquetes:

```powershell
npm.cmd run lint
npm.cmd run build
node --test --test-concurrency=1 tests/*.test.mjs
git diff --check
```

Resultado: ESLint sin errores; build correcto; 49 pruebas aprobadas, cero fallos; `git diff --check` correcto. El build muestra avisos existentes sobre `__dirname` con configLoader native y un bundle mayor de 500 kB.

Cobertura de Clientes: normalización/no mutación, opcionales/nulos/ceros, respuestas vacías e inválidas, filtros combinados, límites y validaciones, payloads POST/PUT verificados contra validators reales, estados, JWT, señales, endpoints y errores HTTP/red/cancelación. Renderizado de tabla, vacíos, formulario y bloqueo. Se prueba que Proveedores conserva sus opciones y que Ventas muestra solo clientes activos. Se ejecutan todas las pruebas previas de Productos, Compras, Ventas, Caja/Pagos e Inventario. Ninguna prueba de Clientes accede a API real ni BD.

## Procedimiento manual en navegador

Usar el entorno de pruebas con credenciales existentes. Las operaciones manuales sí persisten; utilizar identificaciones de prueba únicas y conservar los registros mediante desactivación.

1. Si los servidores ya funcionan, utilizarlos. De lo contrario ejecutar `npm.cmd start` desde `backend` con su configuración existente para API en puerto 3000 y, en otra terminal desde `frontend`, `npm.cmd start -- --port 3001`. No cambiar configuración ni iniciar copias si ya están corriendo. Abrir la URL mostrada por Vite y añadir `/#/clientes` (por ejemplo `http://localhost:3001/#/clientes`); iniciar sesión si corresponde.
2. Comprobar título Clientes, carga, listado, Actualizar y Nuevo cliente. Revisar tema claro/oscuro y ancho móvil. Confirmar ausencia de columna ID.
3. Crear cliente con tipo `PRUEBA`, identificación única `CLIENTE-TEST-AAAAMMDD-01`, nombres `Ana Prueba`, apellidos `López`, teléfono `+505 8888-0000`, correo `ana.prueba@example.com` y dirección `Managua`. Guardar: verificar un POST, éxito, cierre del modal y fila activa tras la recarga.
4. Buscar `Ana Prueba López`, parte de la identificación, teléfono y correo; combinar Estado Activos/Inactivos. Probar texto sin coincidencias y Limpiar filtros. Crear otro cliente dejando opcionales vacíos y verificar que no aparecen textos null/undefined en tabla.
5. Abrir Nuevo cliente; comprobar obligatorios, espacios, correo inválido y límites máximos. Probar identificación duplicada usando la del paso 3 con datos válidos: verificar error del servidor y que el formulario conserva los datos. No debe enviarse formulario inválido.
6. Editar el cliente de prueba, cambiar teléfono/dirección y vaciar apellidos o correo; guardar y pulsar Actualizar. Verificar persistencia y conservación del estado. Pulsar Guardar rápidamente varias veces y comprobar en Network una sola petición de escritura.
7. Desactivar: cancelar primero y confirmar que no cambia; repetir y confirmar. Verificar mensaje, badge Inactivo y filtro Inactivos. Volver a activar con confirmación y comprobar mismos datos/identificación. No se elimina historial.
8. Abrir Ventas > Nueva venta y comprobar que el cliente activo aparece. Cancelar sin guardar una venta, desactivar el cliente en Clientes y abrir otra vez Nueva venta para recargar el catálogo: ya no debe ofrecerlo. Reactivarlo y repetir. No confirmar ventas para esta comprobación.
9. Con un usuario existente sin permiso de escritura, intentar la acción restringida y verificar 403 y mensaje. Con ROOT, comprobar acceso universal. Para 401, invalidar temporalmente el token de la sesión de prueba desde DevTools y pulsar Actualizar; verificar mensaje y volver a iniciar sesión. No cambiar permisos ni usuarios en la base de datos.
10. Con listado ya cargado, simular Offline en DevTools y pulsar Actualizar: comprobar error y conservación del último listado; restaurar conexión y reintentar. Simular fallo al guardar y comprobar datos conservados. Revisar Proveedores y los flujos manuales existentes de los demás módulos.

La prueba interactiva en navegador no se ejecutó automáticamente. No se hicieron commit ni push.
