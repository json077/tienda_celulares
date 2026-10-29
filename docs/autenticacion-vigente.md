# Vigencia de autenticación y autorización

Cada solicitud protegida valida firma y expiración JWT y consulta el usuario,
sus roles activos y sus permisos actuales en una sola consulta parametrizada.
Los roles incluidos en tokens antiguos se conservan por compatibilidad, pero
no participan en la autorización. ROOT requiere una asignación activa actual;
su lista de permisos efectivos incluye todo el catálogo de permisos.

El middleware de permisos debe ejecutarse después de `verificarToken`, como
ocurre en las rutas actuales. Utiliza el estado obtenido para esa solicitud.
Las revocaciones y desactivaciones se aplican desde la siguiente consulta de
autenticación; no cancelan operaciones que ya superaron esa comprobación.

## Contratos

- Login conserva `ok`, `message`, `token` y `usuario`, con los campos de perfil
  existentes. Añade `usuario.permisos` como lista de códigos efectivos.
- `GET /api/auth/me` conserva `ok`, `message` y `usuario`. Ahora entrega
  `id_usuario`, `username`, `email`, `nombres`, `apellidos`, `roles` y `permisos`
  vigentes. Ya no entrega `iat` y `exp`, que eran metadatos del token.
- Token ausente, inválido, expirado o usuario inexistente: HTTP 401.
- Usuario inactivo o permiso insuficiente: HTTP 403.
- Fallo de consulta: HTTP 500 genérico, sin permitir acceso.
- Ninguna respuesta incluye contraseñas ni hashes.

El frontend actual consume `usuario` y no depende de `iat` ni `exp`; no requiere
cambios. Sus menús y guardas siguen basándose en sesión, no en permisos; esa
mejora queda fuera de esta etapa. Cada solicitud protegida añade una consulta a
la BD y depende de su disponibilidad, sin caché de privilegios entre solicitudes.

## Validación sin MySQL

`node --test tests/*.test.js` desde `backend` incluye pruebas HTTP de las rutas
reales de autenticación con repositorio simulado, JWT y bcrypt reales, además
de pruebas del repositorio con `pool` simulado. No se importa la configuración
de base de datos. La consulta SQL se verifica sin ejecutarla en MySQL.
