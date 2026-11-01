# Mi perfil

Configuración exclusivamente personal, accesible en el menú de cuenta → **Mi perfil** (`/mi-perfil`). No agrega opciones al sidebar ni permite editar datos de empresa, roles, permisos, sucursales o cuentas ajenas.

## Auditoría e implementación

- `usuarios` ya contiene `nombres`, `apellidos`, `username`, `email` y `password_hash`.
- `/api/auth/me` y el middleware de autenticación ya consultan la identidad vigente, roles y permisos. No se amplió su contrato.
- Las sucursales reales se consultan mediante `usuario_sucursales` y `sucursales`, exclusivamente para el ID validado por el middleware.
- No existían fotografía ni cambio de contraseña propia. Se agregaron endpoints independientes, sin IDs en la URL ni en el cuerpo. No requieren permisos administrativos.
- **No se necesita ni se ejecutó una migración de MySQL.** La única escritura SQL nueva es el cambio del hash de la contraseña del usuario autenticado.

## Endpoints

Todos requieren `Authorization: Bearer …`, comprueban que la cuenta continúe activa y rechazan parámetros de consulta.

| Método y ruta | Comportamiento |
| --- | --- |
| `GET /api/auth/profile` | Datos personales de solo lectura, roles y sucursales asignadas. Nunca devuelve hashes. |
| `GET /api/auth/profile/photo` | PNG privado, `Cache-Control: private, no-store` y `nosniff`; 404 si no existe. |
| `PUT /api/auth/profile/photo` | Cuerpo binario `image/png`, máximo 2 MiB. Valida PNG completo antes de reemplazar la foto. |
| `DELETE /api/auth/profile/photo` | Elimina exclusivamente la foto propia; no admite selección de usuario. |
| `POST /api/auth/profile/password` | Solo admite `actual`, `nueva` y `confirmacion`. Verifica la contraseña actual con bcrypt y actualiza con costo 12, igual que el módulo de usuarios. |

La nueva contraseña exige al menos 12 caracteres Unicode y un máximo de 72 bytes UTF-8, sin caracteres nulos y diferente de la actual. La actualización compara también el hash anterior y la cuenta activa para evitar sobrescribir un cambio concurrente. Se limitan a cinco verificaciones por cuenta en 15 minutos; este límite es local a cada proceso del backend.

Los mensajes y respuestas de error no incluyen contraseñas, hashes, parámetros SQL ni rutas del almacenamiento.

## Fotografías y almacenamiento

El selector permite JPEG o PNG de hasta 5 MiB y 16 megapíxeles (máximo 8192 píxeles por lado). El navegador comprueba dimensiones y decodifica la imagen, la reduce a un máximo de 512 px y produce un PNG. El servidor no confía en esa conversión: comprueba firma, estructura completa, checksums CRC, dimensiones, profundidad, compresión, longitud de píxeles descomprimidos y filtros válidos. Rechaza archivos falsificados, contenido sobrante y expansiones excesivas, y elimina metadatos antes de guardar.

Las fotos se guardan por ID de usuario en `backend/private/profile-photos`, directorio ya excluido de Git y sin exposición estática. Se usa un archivo temporal de nombre aleatorio y reemplazo mediante rename. Opcionalmente, `PROFILE_PHOTO_DIR` permite configurar un directorio privado persistente; no es una URL pública. El proceso del backend necesita acceso de lectura y escritura a ese directorio.

El encabezado y la página comparten la misma fotografía mediante URLs de objeto temporales. Se revocan al reemplazarlas o abandonar la sesión; no se almacenan fotos ni credenciales nuevas en localStorage. Las respuestas tardías de otra cuenta se descartan. Ante ausencia o error de imagen se muestra el avatar predeterminado.

## Validación y límites operativos

Archivos de implementación nuevos o modificados:

- Backend: `src/app.js`, `src/routes/profileRoutes.js`, `src/controllers/profileController.js`, `src/repositories/profileRepository.js`, `src/services/profilePhoto.js`.
- Frontend: `src/routes.js`, `src/layout/DefaultLayout.jsx`, `src/services/api.js`, `src/services/profileService.js`, `src/contexts/ProfileContext.jsx`, `src/components/ProfileAvatar.jsx`, `src/components/header/AppHeaderDropdown.jsx`, `src/views/profile/MyProfile.jsx`, `src/views/profile/profileModel.js`, `src/views/profile/profile.css`.
- Pruebas: `backend/tests/profile.test.js`; en frontend, `tests/profile.test.mjs`, `tests/profile-photo-context.test.mjs`, `tests/permissions.test.mjs`, `tests/sidebar-browser.test.mjs`, `tests/fixtures/profile-preview.jsx` y `tests/helpers/profileAudit.mjs`.

- Backend: HTTP autenticado con repositorio simulado y almacenamiento temporal real; aislamiento entre usuarios, cambio y borrado de fotografía, archivos maliciosos, límites, bcrypt real, concurrencia y errores seguros. No requiere acceso a MySQL.
- Frontend: validación de contraseñas, dimensiones por contenido, contratos HTTP, renderizado CoreUI, rutas y ciclo de vida del avatar entre cuentas.
- Navegador: `SIDEBAR_BROWSER=1 PROFILE_BROWSER=1 node --test tests/sidebar-browser.test.mjs` desde `frontend`. Usa datos aislados; revisa claro/oscuro a 1440, 1024, 768 y 390 px, subida JPEG/PNG, cambio y eliminación de avatar compartido, errores y exclusión de doble envío de contraseña.
- Las fotos necesitan un volumen/directorio persistente en despliegues con disco efímero. Los respaldos SQL existentes no incluyen fotografías; el directorio debe respaldarse por separado.
- Se conserva la política existente de JWT de hasta ocho horas. No se agregó revocación global de tokens ya emitidos; requeriría un diseño separado de sesiones.
- No se probaron escrituras sobre cuentas reales ni se ejecutaron migraciones, commits o push.
