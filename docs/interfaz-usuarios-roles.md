# Interfaz de usuarios y roles

`/usuarios-roles` conserva menú y ruta y reemplaza el placeholder por CoreUI Free.
Incluye búsqueda, filtros, paginación del servidor, detalle, creación, edición de
perfil, confirmación de estado y revisión/confirmación de roles. No administra
el catálogo de permisos, contraseñas existentes ni sucursales.

Se consume el contrato documentado en `api-administracion-usuarios.md`. Como el
listado no contiene roles, se leen los detalles de la página visible en grupos
de hasta cuatro solicitudes simultáneas. Fallos de detalle no se interpretan
como ausencia de roles. Este costo adicional queda pendiente de optimización
si en una etapa futura se amplía el contrato del listado.

La pantalla consulta `/auth/me` al cargar, actualizar y antes de las operaciones.
Requiere USUARIO_VER para consultar. Crear requiere USUARIO_CREAR, USUARIO_ROLES
y ROL_VER para seleccionar del catálogo; editar/estado, USUARIO_EDITAR; roles,
USUARIO_ROLES y ROL_VER. ROOT vigente conserva el acceso total. No ROOT no puede
modificar usuarios con ROOT asignado. Se oculta la autodesactivación.

No se amplía AuthContext: el módulo mantiene una lectura local de permisos
vigentes. El backend vuelve a autorizarlos y preserva al último administrador.
Roles y estado se releen antes de escribir para advertir cambios concurrentes;
esto no reemplaza los bloqueos ni las validaciones del backend.

Los formularios solo envían los campos permitidos. Contraseña y confirmación
se limpian antes de esperar la respuesta; confirmación nunca se envía. No se
guardan en localStorage, contexto ni listado. Las respuestas se proyectan sobre
campos públicos. La validación cliente orienta; la API valida definitivamente.

El transporte compartido añade únicamente `api.patch`, sin modificar los métodos
existentes. El módulo adapta los errores administrativos `campo/mensaje` y
presenta 400/422, 401, 403 y 409. Después de una escritura confirmada se recarga
el listado; un fallo posterior de lectura no vuelve a ejecutar la escritura.

El catálogo permite filtrar por roles activos que el actor puede consultar.
Roles asignados inactivos se muestran en detalle/listado y se retiran si se
confirma su reemplazo por roles disponibles. No ROOT no ve ROOT en el catálogo,
según el contrato actual de la API.

Las pruebas usan fetch simulado, validadores backend cargados sin MySQL y
renderizado estático de componentes CoreUI. No se ejercitan clics en un navegador
real ni se envían solicitudes al backend en ejecución.
