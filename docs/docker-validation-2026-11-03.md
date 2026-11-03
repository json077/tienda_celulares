# Revisión de dockerización — 2026-11-03

Este informe registra la etapa previa al arranque. Sus pendientes de integración fueron resueltos después en [docker-integration-2026-11-03.md](docker-integration-2026-11-03.md); el resultado vigente de la revisión para GitHub y del harness está en [docker-final-audit-2026-11-03.md](docker-final-audit-2026-11-03.md). Se conserva la evidencia original sin atribuirle pruebas ejecutadas posteriormente.

## Resultado y límites

La configuración está lista para revisión. Se construyeron las imágenes, se comprobó Nginx y se verificaron los clientes MySQL y módulos nativos del backend. **No se ejecutó `docker compose up`, no se inició la aplicación ni MySQL y no se crearon los volúmenes/redes del sistema.** `docker compose ps --all` terminó sin contenedores del proyecto.

No se leyeron credenciales del backend local, no se importaron datos reales ni se ejecutaron migraciones, commit, push o limpiezas generales de Docker. Los contenedores efímeros de comprobación usaron `--network none`, sin montajes ni secretos, y se retiraron con `--rm`. Las imágenes construidas y sus cachés permanecen disponibles.

## Archivos creados

- `backend/Dockerfile`: Node 24 sobre Debian Bookworm, instalación reproducible por lockfile, dependencias de producción, usuario sin privilegios, clientes Oracle MySQL 8.4.
- `backend/docker/healthcheck.js`: comprueba SQL y HTTP sin cargar `.env`.
- `frontend/Dockerfile`: compilación Vite y etapa final Nginx.
- `frontend/nginx.conf`: SPA/HashRouter, proxy que conserva `/api`, límite de cuerpo de 3 MB para imágenes de hasta 2 MB y espera suficiente para respaldos/restauraciones.
- `compose.yaml`: tres servicios, único puerto frontend configurable, redes separadas, cuatro volúmenes, healthchecks y dependencias.
- `.env.example`: variables requeridas sin valores secretos.
- `.dockerignore`: lista de archivos permitidos; excluye por defecto datos, respaldos, dependencias y secretos del contexto.
- `docs/docker.md`: configuración, operación, aprovisionamiento inicial, respaldo completo y recuperación en otro proyecto Compose.
- Este informe.

## Archivos modificados en esta etapa

- `frontend/src/services/api.js`, `backupService.js`, `reportService.js`, `transferService.js`: una sola base relativa `/api`, usada también para SQL y Excel.
- `frontend/vite.config.mjs`: frontend local en 3001 con proxy `/api` al backend local en 3000. No modifica el backend ni su conexión local.
- Pruebas frontend adaptadas a URLs relativas: `cash-payments`, `clients`, `credit-plan`, `credits`, `inventory`, `permissions-render`, `products`, `profile`, `purchases`, `sale-availability`, `sales`, `suppliers`, `users`; además `tests/fixtures/profile-preview.jsx`. Los mocks que interpretan URLs ahora usan una base ficticia `http://test.invalid`. No realizan solicitudes de red reales.

Los cambios anteriores en `.gitignore`, `backend/src/utils/createRootUser.js`, la prueba `database-initialization.test.js`, los SQL iniciales y el informe de MySQL se conservaron. Se verificaron hashes de los archivos previos. Los dos SQL mantienen los SHA-256 del informe anterior:

- Esquema: `5673E3E3831CAF57F0FEF45FEFD75A7AB9F2AFE7CFCAA90C2E3086F9C2856B6E`.
- Catálogos: `06BA62B7EB6480357EB0E2C04B52CC9FB384B89D04D5ACADCB73ADD7BD550B09`.

## Decisiones técnicas

MySQL se fija en **8.4.13**, la versión ya validada. La base se llama `tienda_contenedores`, el host es el servicio `mysql` y el usuario `tienda_app`; estos valores están fijados en Compose para evitar reutilizar configuración local por accidente. No existe `env_file: backend/.env`. Las tres claves se exigen mediante interpolación de Compose y sólo se inyectan al ejecutar.

Nginx publica `127.0.0.1:8080` por defecto. Backend y MySQL sólo pertenecen a una red Docker interna. Las fotos y respaldos se guardan en volúmenes exclusivos, con directorios escribibles por el usuario `node`. No se montan datos del host; los únicos bind mounts son los dos SQL, de sólo lectura.

La imagen oficial MySQL ejecuta la inicialización sólo con datos vacíos. No se añadieron scripts que importen SQL en cada arranque. El healthcheck exige 41 tablas/74 FK y conexión TCP autenticada, para esperar al servidor definitivo después de la inicialización. No depende de que los permisos o usuarios sigan iguales a los catálogos iniciales durante la operación normal.

Los clientes Oracle `mysql` y `mysqldump` resultaron ser **8.4.13**. Se eligieron para conservar `--no-login-paths`, `--set-gtid-purged=OFF` y las demás opciones existentes. No se alteró la función de restauración ni se probó una restauración sobre datos de usuario.

## Comandos y verificaciones

1. `git status --short`, `git diff --stat`, lecturas de configuración/código mediante `Get-Content` y `rg`, revisión de rutas de archivos, API y clientes SQL.
2. `node --check backend/docker/healthcheck.js`: correcto.
3. `node --test backend/tests/*.test.js`, con `INITIAL_SCHEMA_READONLY=0` y `REPORTS_MYSQL_READONLY=0`: **110 pruebas, 107 aprobadas, 0 fallidas, 3 omitidas**.
4. `node --test frontend/tests/*.test.mjs`, con las pruebas MySQL y navegador optativas desactivadas: **208 pruebas, 203 aprobadas, 3 fallidas, 2 omitidas**. Los tres fallos contabilizados son dos subpruebas y su prueba padre, descritos abajo.
5. `npm.cmd run build` en frontend: correcto. Aviso de chunk mayor de 500 kB, sin error.
6. `npm.cmd run lint -- --no-fix`: correcto tras ajustar con Prettier dos fragmentos de pruebas que se acortaron al usar `/api`.
7. `docker compose --env-file .env.example config --quiet`: correcto, usando exclusivamente valores ficticios en el entorno del proceso. No se creó `.env` ni se mostraron secretos.
8. `docker compose --env-file .env.example build`: ambas imágenes construidas correctamente. No arranca los servicios.
9. Análisis del JSON de `docker compose config --format json`, mantenido en memoria: backend/MySQL sin puertos, host SQL `mysql`, red interna y un puerto frontend. No se imprimió el JSON resuelto.
10. `docker run --rm --network none --add-host backend:127.0.0.1 --entrypoint nginx tienda-celulares-docker-frontend -t`: sintaxis Nginx correcta. Sólo ejecutó el validador, sin servidor escuchando.
11. `docker run --rm -i --network none --entrypoint node tienda-celulares-docker-backend`, con un programa de comprobación por stdin: versiones MySQL correctas, bcrypt genera/verifica hash sintético, sharp genera WebP sintético, UID distinto de root, tres directorios privados escribibles y ausencia de `/app/.env`. No se inició Express ni se conectó a una base.
12. `docker compose --env-file .env.example ps --all`: sin contenedores del proyecto.
13. `git diff --check`: sin errores de espacios. Búsqueda en `frontend/src`: sin referencias a `localhost:3000`.

En Windows, `npm` intentó ejecutar `npm.ps1`, bloqueado por la política existente. Se usó `npm.cmd`; no se cambió la política del equipo. Docker se invocó desde el directorio de instalación del usuario, añadido sólo al PATH del proceso.

## Fallos frontend previos, reproducidos

`permissions-render.test.mjs` falla en:

- “VENDEDOR abre Nueva venta con catalogos de lectura, sin permisos adicionales”: React recibe un tipo de elemento objeto durante el renderizado del formulario.
- “consultar documentos no permite abrir confirmación ni anulación”: el harness no encuentra el botón de Sales “Revisar y confirmar” con sus estados simulados.

Para distinguirlos del cambio de URL, se ejecutó una copia temporal del test original obtenido con `git show HEAD:...`, con un transformador Vite que cargaba también el contenido original de los cuatro servicios modificados. Reprodujo exactamente ambos fallos: **19 pruebas, 16 aprobadas y 3 fallidas contando la prueba padre**. La copia se eliminó y no se sobrescribió ningún archivo existente. No se cambiaron las vistas de ventas ni se ocultaron/omitieron esos fallos.

## Pendiente después de la revisión

- Crear secretos privados y aprobar el primer arranque del conjunto; aprovisionar un administrador de aplicación.
- Verificar en ejecución integrada login, proxy, healthchecks, persistencia de fotos y respaldo/restauración con datos sintéticos. La construcción y las comprobaciones aisladas no sustituyen esa prueba.
- Corregir los dos fallos previos del harness de renderizado frontend en una tarea aparte.
- Ensayar la recuperación de SQL y fotos como un conjunto consistente; las copias SQL por sí solas no contienen imágenes.
- Si se publica fuera del equipo: dominio, HTTPS y revisión de firewall. Por defecto sólo escucha en loopback.
- Node y Nginx usan etiquetas de actualización dentro de su línea; APT resuelve el parche disponible de clientes 8.4. Para reproducibilidad binaria estricta, fijar digests y versiones de paquetes tras revisar las actualizaciones.
- Una futura migración que cambie el número de tablas/FK requiere actualizar el healthcheck MySQL. No se realizaron migraciones en esta etapa.

La guía de operación contiene las fuentes oficiales consultadas para el orden de arranque, inicialización MySQL y repositorio APT.
