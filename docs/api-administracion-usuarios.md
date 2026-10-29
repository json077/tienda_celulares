# API administrativa de usuarios

Todas las rutas requieren JWT válido, usuario activo y autorización vigente.
No se crean tablas ni se modifican permisos comerciales. No existe eliminación
física, cambio de contraseña ni modificación de sucursales en esta etapa.

## Endpoints

| Método y ruta | Permiso | Entrada |
| --- | --- | --- |
| GET /api/usuarios | USUARIO_VER | buscar, activo=0/1, id_rol, pagina, limite |
| GET /api/usuarios/:idUsuario | USUARIO_VER | ID positivo |
| GET /api/usuarios/roles | ROL_VER | Catálogo activo; ROOT visible solo a ROOT |
| POST /api/usuarios | USUARIO_CREAR + USUARIO_ROLES | username, email, nombres, apellidos, password, roles |
| PUT /api/usuarios/:idUsuario | USUARIO_EDITAR | username, email, nombres, apellidos (perfil completo) |
| PATCH /api/usuarios/:idUsuario/estado | USUARIO_EDITAR | activo: boolean |
| PUT /api/usuarios/:idUsuario/roles | USUARIO_ROLES | roles: lista de IDs que reemplaza la asignación |

Crear devuelve HTTP 201; las demás operaciones exitosas, 200. Se mantiene
`{ ok: true, data }`. El listado devuelve `data.registros` y `data.paginacion`
con pagina, limite, total y total_paginas. Página por defecto 1, límite 20,
máximo 100 registros y página máxima 1.000.000. Búsqueda LIKE sobre username,
email, nombres y apellidos; `%` y `_` conservan su significado de comodines.
Detalle incluye roles asignados, incluso inactivos, para permitir su diagnóstico.
Las respuestas públicas nunca seleccionan password_hash.

Errores: 400 por validación o rol inválido, 401 por autenticación, 403 por falta
de permisos, 404 por usuario inexistente, 409 por duplicados o protección
administrativa y 500 genérico por fallos internos. Validación omite los valores
recibidos para evitar reflejar contraseñas. No se imprimen errores de BD.

## Permisos y política

Los códigos USUARIO_VER, USUARIO_CREAR, USUARIO_EDITAR, USUARIO_ROLES y ROL_VER
ya aparecen en el respaldo SQL local del proyecto. El esquema versionado define
las tablas, pero no sus datos iniciales. No se ejecutó SQL ni se comprobó el
catálogo de una base real. No se necesitan nuevos códigos: USUARIO_EDITAR cubre
estado y perfil; USUARIO_ROLES cubre asignación y revocación. ROOT conserva su
excepción vigente de acceso total. Si faltan códigos o asignaciones en un entorno,
deben provisionarse expresamente con esos nombres; nunca se conceden por defecto.

Para esta API, capacidad administrativa significa usuario activo con ROOT activo
o con la unión de los cinco permisos anteriores mediante roles activos. No basta
el nombre ADMINISTRADOR. Debe quedar al menos uno después de cambiar estado o
roles. Esta definición también exige poder consultar el catálogo para asignar.

- No se permite autodesactivación, ni siquiera a ROOT.
- Solo ROOT vigente puede añadir o quitar la asignación ROOT, incluso inactiva.
- Solo ROOT puede editar perfil o estado de un usuario que tenga asignado ROOT.
  Esto evita neutralizarlo por una vía alternativa.
- Un autorizado con USUARIO_ROLES puede asignar cualquier rol activo distinto
  de ROOT, incluidos roles administrativos. Es una delegación explícita.
- La creación exige al menos un rol y crea el usuario activo. Reemplazar roles
  admite lista vacía, sujeto a preservar capacidad administrativa.
- Roles inexistentes, inactivos, duplicados o listas mayores de 100 se rechazan.
- Contraseñas: mínimo 12 caracteres y máximo 72 bytes UTF-8, sin NUL; no se
  recortan ni normalizan. bcrypt usa costo 12. Perfil no admite password,
  password_hash, activo ni roles: cada operación tiene su ruta y autorización.
- No se asignan sucursales automáticamente. Su administración queda pendiente.

## Consistencia y auditoría

Toda mutación usa una transacción. Se bloquean en orden roles, permisos,
rol_permisos, usuarios y usuario_roles mediante SELECT FOR UPDATE, sin hashes.
Esto serializa las mutaciones de esta API y permite volver a validar al actor y
comprobar el último administrador con lecturas actuales. La protección frente a
concurrencia aplica a escritores que respetan este protocolo; futuros editores
de roles/permisos deberán reutilizarlo. Cambios SQL externos quedan fuera de él.
El bloqueo es amplio y apropiado para un catálogo pequeño; se debe revisar su
costo si crece el número de usuarios. bcrypt se calcula antes de tomar bloqueos.

El evento se inserta en auditoria antes de commit. Si falla, también se revierten
usuario y roles. Se guarda actor, usuario afectado, acción, IP, estado y IDs de
roles anteriores/posteriores; nunca cuerpos HTTP, nombres, correos, contraseñas
ni hashes. Los eventos están declarados en auditEvents para aparecer en los
filtros, pero se excluyen del registro posterior a la respuesta para no duplicar.
La edición de perfil registra la acción sin conservar sus textos.

## Verificación sin datos reales

Las pruebas cargan las capas reales con repositorios simulados y un servidor HTTP
local. JWT, bcrypt y validadores son reales. El repositorio SQL se prueba aparte
con pool/conexión simulados, incluidos commit, rollback, liberación y parámetros.
La concurrencia usa un bloqueo simulado: no sustituye una prueba de integración
MySQL, que no se ejecuta por la restricción de no acceder a datos reales.
