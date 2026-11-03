# Auditoría final para GitHub — 2026-11-03

Proyecto: Sistema de control de inventario y facturación de tienda de celulares.

**Conclusión: LISTO PARA PUBLICAR los cambios revisados en GitHub**, para la instalación local documentada en loopback. Las correcciones indispensables detectadas en esta auditoría quedaron aplicadas. No equivale a autorizar una exposición pública en Internet ni a certificar todos los procesos comerciales.

No se hizo commit, push, staging, inicialización, aprovisionamiento real, restauración, reinicio ni eliminación de contenedores o volúmenes. No se conectó a la base local ni se modificaron datos persistentes. La compilación actualiza únicamente el build local ignorado por Git; las pruebas usan fixtures y conexiones simuladas, con las opciones de MySQL/navegador desactivadas.

## Alcance y trazabilidad

Se revisaron `git status --short`, `git diff`, `git diff --cached --stat`, los archivos nuevos listados por `git ls-files --others --exclude-standard`, configuración, SQL, aprovisionador, servicios afectados, pruebas y documentos. No había cambios preparados en el índice.

Se inspeccionaron los archivos candidatos a publicación, incluidos los ya versionados, mediante búsqueda de claves privadas, formatos habituales de tokens, JWT serializados y asignaciones de contraseñas/claves. Las coincidencias revisadas corresponden a fixtures de pruebas, no a secretos operativos. La búsqueda estática no constituye una garantía universal de detección ni una auditoría completa del historial Git o de vulnerabilidades de dependencias.

Esta auditoría continúa las verificaciones de la misma sesión; no atribuye una nueva ejecución a resultados anteriores. El entorno de pruebas es Windows/PowerShell con Node v24.19.0.

## Archivos aptos para incluir

| Grupo | Archivos |
| --- | --- |
| Configuración raíz | `.gitignore`, `.dockerignore`, `.env.example`, `compose.yaml` |
| Backend Docker y administrador | `backend/Dockerfile`, `backend/docker/healthcheck.js`, `backend/src/utils/createRootUser.js`, `backend/tests/database-initialization.test.js` |
| Inicialización | `database/init/01_schema.sql`, `02_catalogs.sql`, `.env.example`, `README.md`, `RECONCILIATION.md` |
| Frontend Docker | `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/vite.config.mjs` |
| Servicios frontend | `frontend/src/services/api.js`, `backupService.js`, `reportService.js`, `transferService.js` |
| Pruebas frontend | `frontend/tests/cash-payments.test.mjs`, `clients.test.mjs`, `credit-plan.test.mjs`, `credits.test.mjs`, `inventory.test.mjs`, `permissions-render.test.mjs`, `products.test.mjs`, `profile.test.mjs`, `purchases.test.mjs`, `sale-availability.test.mjs`, `sales.test.mjs`, `suppliers.test.mjs`, `users.test.mjs`, `fixtures/profile-preview.jsx` |
| Evidencia y operación | `docs/docker.md`, `docker-validation-2026-11-03.md`, `docker-integration-2026-11-03.md`, `mysql-8.4-validation-2026-11-03.md`, `docker-final-audit-2026-11-03.md` |

Los nombres abreviados de una fila pertenecen al directorio de su primer archivo. Publicar los SQL nuevos junto con su prueba y documentación; no sustituirlos por el esquema histórico.

**Excluir:** `.env`, `.env.recovery`, `.env.integration-users`, `backend/.env`, cualquier `.env` completado de inicialización, `backend/private/`, fotografías privadas, archivos SQL de respaldo y la captura de recuperación externa. Ninguno de esos archivos aparece en el inventario candidato revisado. Las únicas imágenes versionadas encontradas son assets existentes de la plantilla; no hay fotografías nuevas o modificadas en los cambios auditados. Los archivos `.env.example` contienen valores de ejemplo y campos secretos vacíos.

## Hallazgos de seguridad por gravedad

| Gravedad | Hallazgo | Resultado |
| --- | --- | --- |
| Crítica / alta | No se identificaron secretos operativos ni datos de producción en los archivos candidatos revisados, ni publicación directa de MySQL/backend en Compose. | Sin bloqueo confirmado de esta gravedad dentro del alcance. |
| Media, corregida | `.gitignore` exceptuaba cualquier `database/*.sql`, permitiendo incorporar accidentalmente un dump en esa carpeta. | Se reemplazó por la excepción exacta del esquema histórico. Se conservan sólo las excepciones explícitas de inicialización/migraciones y se ignoran copias SQL comprimidas y `private-assets*.tar.gz`. |
| Media, corregida | Los comandos de recuperación no seleccionaban un archivo de entorno independiente; podían reutilizar por omisión el `.env` principal. | La guía exige preparar/conservar `.env.recovery`, secretos distintos y otro puerto; todos los comandos de ese procedimiento usan `--env-file .env.recovery`. No se ejecutaron. |
| Baja / operación | Node y Nginx usan etiquetas móviles; los paquetes APT del cliente MySQL no fijan parche exacto. | Los lockfiles fijan dependencias npm, pero una reconstrucción futura puede cambiar componentes base. Para reproducción binaria estricta, fijar digests/versiones en una actualización controlada. |
| Condicional, histórico | El aprovisionador de `HEAD` contenía una contraseña predeterminada; el cambio actual la elimina. El diff no elimina ese literal del historial. | El contenedor nuevo exige credenciales propias. Si alguna instalación antigua utilizó esa contraseña, debe rotarse allí; no se investigaron ni modificaron cuentas locales. |

`git check-ignore -v` confirmó la exclusión de `.env.integration-users`, `.env`, `.env.recovery`, `backend/.env`, `backend/.env.initialization` y una ruta de foto privada. También confirmó que un hipotético `database/backup.sql`, su variante `.sql.gz` y `private-assets.tar.gz` quedan ignorados después de la corrección. Las excepciones de SQL publicables se comprobaron con el listado de Git.

`.dockerignore` deniega todo por defecto y habilita sólo manifiestos, código y recursos necesarios. Excluye `.git`, entornos, datos, SQL, dependencias locales y carpetas privadas; vuelve a denegar `.env`, SQL y claves PEM/KEY incluso dentro de las rutas habilitadas. Los SQL de inicialización se montan al ejecutar, no se copian a las imágenes. Los árboles `src` y `public` son entradas de construcción: no deben usarse para almacenar fotos privadas o secretos futuros. Git ignore no impide una inclusión forzada ni retira archivos ya versionados; el inventario actual también se revisó.

## Dockerfiles, red, Nginx y almacenamiento

- Backend: Node 24 sobre Debian Bookworm, instalación `npm ci --omit=dev`, clientes Oracle MySQL, ejecución como `node`. No copia `.env` ni recibe la clave root SQL. Los directorios de los volúmenes nuevos se crean con propietario `node` antes de `USER node`.
- Frontend: compilación multietapa con `npm ci`; Nginx recibe sólo el build y su configuración. `EXPOSE` en los Dockerfiles documenta puertos internos y no los publica al host.
- Compose: sólo frontend contiene `ports`, con valor predeterminado `127.0.0.1:8080:80`. Backend/MySQL sólo están en la red `internal: true`; frontend comparte esa red y una red web. No hay red host ni dependencia de MySQL local.
- Secretos SQL/JWT: tres valores exigidos sin defaults; `.env.example` pide secretos aleatorios diferentes. Compose valida que no estén vacíos, pero no impone longitud/entropía. Los secretos del entorno pueden ser inspeccionados por administradores de Docker; no se imprime `compose config` completo.
- Nginx conserva `/api`, transmite Authorization por el comportamiento normal del proxy, admite cuerpos de hasta 3 MB y espera 1900 s frente al límite de 1800 s de las herramientas SQL. Mantiene SPA/HashRouter y no sirve los directorios privados. `/healthz` sólo confirma Nginx; no sustituye los otros healthchecks.
- MySQL comprueba TCP autenticado, 41 tablas y 74 FK; backend comprueba SQL y HTTP; frontend espera al backend saludable. El conteo fijo debe actualizarse con futuras migraciones. Un estado unhealthy no provoca por sí solo un reinicio.
- Los cuatro volúmenes están separados por proyecto. Las fotos de producto se montan fuera de `/app`, respetando la protección del servicio; perfiles/respaldos tienen destinos coherentes con el código. No hay bind mounts a fotos, datos de MySQL ni respaldos locales.
- No se endureció Nginx para ejecutar sin root ni se aplicaron límites de recursos/read-only filesystem en este cambio. Son mejoras de despliegue posteriores, sin bloqueo para el uso local documentado.

## Inicialización, ROOT y recuperación

La imagen MySQL importa el esquema y catálogos sólo con volumen vacío. Los SQL no seleccionan una base local ni incluyen usuarios, hashes, transacciones comerciales o fotos. La prueba estática valida orden de dependencias, claves y ausencia de sentencias peligrosas en el esquema. El seed contiene únicamente catálogos/configuración sintética y sus permisos.

El aprovisionador requiere `--provision-new --database`, igualdad con `DB_NAME`, nombre permitido y base sin usuarios. Verifica `SELECT DATABASE()`, ROOT/sucursal activos, longitud de contraseña compatible con bcrypt y asigna usuario/rol/sucursal dentro de una transacción. No imprime credenciales ni se ejecuta al importar el módulo. Usar una sola instancia, según la guía; no es un endpoint de registro concurrente. La protección por nombre no sustituye el aislamiento del servidor.

El usuario SQL de aplicación tiene permisos DDL sobre su propia base porque la restauración los necesita. Los procesos usan `spawn` sin shell y contraseña en entorno, no argv; el SQL se transfiere como stream. Se restringen nombres/rutas y enlaces de los archivos de respaldo. Una restauración puede quedar parcial y el bloqueo del servicio sólo serializa operaciones de respaldo/restauración, no todas las escrituras de negocio: requiere ventana sin escritores.

La guía describe copia SQL y de fotos/respaldos como una captura coordinada, permisos privados, comprobación de salida y recuperación en otro proyecto. Un dump SQL no contiene fotos. Deben conservarse las claves, la revisión de código y copias fuera del disco de Docker. Los archivos de ensayo en `%TEMP%` no son una política de respaldo permanente.

Los pasos son trasladables a otra computadora Windows x64 con Docker Desktop Linux/WSL2, Compose compatible, puertos libres y acceso a las imágenes/repositorio APT. Las rutas privadas de ejemplo se sustituyen por rutas del operador. ARM y una instalación limpia en un segundo equipo físico no se probaron en esta auditoría. La reproducción exacta de imágenes sigue limitada por las etiquetas/paquetes móviles.

## Corrección de los tres resultados fallidos frontend

Eran dos subpruebas y su prueba padre, no tres defectos funcionales independientes:

1. El formulario de VENDEDOR alcanzaba un `CIcon` importado como objeto namespace CommonJS por SSR. Se añadió exclusivamente al servidor Vite del test `ssr.noExternal: ['@coreui/icons-react']`, para resolver la entrada ESM usada por el build. No se sustituyó el componente por un mock ni se quitaron aserciones.
2. El fixture del detalle de Sales escribía el documento en el estado 12 (`catalog`); el documento real está en el 13 (`sale`). Se corrigieron las dos inyecciones, borrador y venta confirmada. Se mantienen las comprobaciones de botones deshabilitados, invocación del handler, ausencia de apertura y cero solicitudes reales para una sesión de sólo consulta.
3. El resultado padre ahora pasa al aprobar sus subpruebas.

No se alteraron vistas, servicios funcionales ni lógica de autorización para conseguir estos resultados. El harness continúa dependiendo del orden de hooks y requerirá mantenimiento si cambia Sales. La evidencia anterior del navegador Docker sigue siendo complementaria; no se repitió en esta revisión.

## Pruebas actuales y evidencia anterior

| Verificación | Resultado y alcance |
| --- | --- |
| Backend, ejecución previa de esta sesión | 110 resultados: **107 aprobados, 0 fallidos, 3 omitidos**. No se repitió porque el backend no cambió después. |
| Frontend completo, después de corregir el harness | 208 resultados: **206 aprobados, 0 fallidos, 2 omitidos**; salida del proceso 0. |
| Harness de permisos, ejecución enfocada | **19/19 aprobados**; salida 0. |
| Compilación frontend, ejecución previa de esta sesión | `npm.cmd run build`: aprobada; avisos de tamaño de chunks, sin error de compilación. No cambió código productivo después. |
| Sintaxis | `node --check` del healthcheck y aprovisionador: aprobado. |
| Compose, comprobación actual fuera del sandbox | `docker compose config --quiet`: salida 0, sin imprimir secretos. |
| Motor Docker, comprobación actual | No disponible: falta el pipe `dockerDesktopLinuxEngine`, también fuera del sandbox. No fue posible certificar salud, bindings, permisos efectivos ni reinicios actuales. No se intentó arrancar el motor ni alterar recursos. |
| Git | `git diff --check`: sin errores; exclusiones y candidatos revisados. |
| SQL | SHA-256 coincide con la evidencia aislada/integrada anterior; 41 tablas/74 FK validados por pruebas estáticas y previamente en MySQL real. |
| Integración Docker anterior | Aprobada según `docker-integration-2026-11-03.md`: login/permisos, fotos, Excel, persistencia y recuperación en proyecto independiente. Es evidencia histórica, no una repetición actual. |

Hashes preservados:

- `01_schema.sql`: `5673E3E3831CAF57F0FEF45FEFD75A7AB9F2AFE7CFCAA90C2E3086F9C2856B6E`.
- `02_catalogs.sql`: `06BA62B7EB6480357EB0E2C04B52CC9FB384B89D04D5ACADCB73ADD7BD550B09`.

Comandos reproducibles desde la raíz, sin habilitar pruebas de base local:

```powershell
$env:INITIAL_SCHEMA_READONLY='0'
$env:REPORTS_MYSQL_READONLY='0'
$env:SIDEBAR_BROWSER='0'
node --test backend/tests/*.test.js
node --test frontend/tests/permissions-render.test.mjs
node --test frontend/tests/*.test.mjs
node --check backend/docker/healthcheck.js
node --check backend/src/utils/createRootUser.js
git diff --check
docker compose config --quiet
```

Para compilar, desde `frontend`: `npm.cmd run build`. Se usó `npm.cmd` porque la política PowerShell bloquea `npm.ps1`; no se cambió la política del equipo. Los logs de pruebas y compilación quedaron en archivos temporales locales, sin incorporarlos a Git. Hubo avisos de puerto HMR compartido durante la suite concurrente; no provocaron fallos. No se ejecutó un análisis actualizado de CVE ni una nueva construcción de imágenes.

Omisiones deliberadas: backend (comparación del esquema local y dos pruebas MySQL de reportes/antigüedad); frontend (dashboard MySQL y navegador optativo). Sus flags permanecieron en 0 para preservar el aislamiento. La evidencia integrada anterior cubre navegador en Docker por separado.

## Evidencia de grado, riesgos y pendientes

Los informes separan inicialización aislada, construcción y prueba integrada. Incluyen versiones, comandos, hashes SQL, recursos, conteos, permisos, incidencia encontrada y corregida, persistencia y recuperación. Se añadieron referencias para que los pendientes históricos no se interpreten como el estado actual. Esta evidencia es adecuada para justificar la dockerización y sus límites; los runners temporales anteriores no están versionados y no deben presentarse como scripts reproducibles entregados con el proyecto.

Para una defensa funcional exhaustiva quedan por ensayar en Docker, con datos sintéticos, los ciclos completos de compra/confirmación, venta/factura, pago/cierre de caja y crédito. La integración anterior sólo creó una venta en borrador y no prueba todos esos ciclos. La matriz de roles ordinarios necesita revisión explícita para operaciones de escritura: el seed conserva códigos efectivos y no inventa equivalencias históricas; ROOT sí permite administrar. No se debe confundir esa política con un fallo de Docker.

Antes de la defensa, comprobar con el motor disponible los tres servicios saludables y el acceso loopback. No requiere borrar ni restaurar datos. No es un requisito para publicar el código revisado en GitHub, pero sí para afirmar disponibilidad de la demostración ese día. Para acceso por red, preparar TLS, firewall y una revisión específica de exposición.

**Correcciones indispensables antes del commit: completadas**: excepción SQL restringida, entorno de recuperación explícito, harness corregido y documentación de estados actualizada. No quedan fallos conocidos en las suites ejecutadas. Mantener fuera del commit todos los archivos privados y revisar el diff del índice cuando se prepare el commit; esta auditoría no autoriza ni ejecuta su publicación automáticamente.
