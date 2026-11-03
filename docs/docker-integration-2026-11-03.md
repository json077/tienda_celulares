# Primera validación integrada de Docker — 2026-11-03

Revisión posterior: los fallos del harness descritos abajo se corrigieron exclusivamente en pruebas. Consultar [auditoría final](docker-final-audit-2026-11-03.md) para los resultados actuales. Los estados de contenedores de este informe corresponden a la ejecución integrada original y no certifican su disponibilidad en sesiones posteriores.

## Resultado

**Validación integrada completada.** Frontend, backend y MySQL 8.4.13 funcionan juntos. Se verificaron autenticación, permisos, módulos, imágenes, respaldos SQL, persistencia y recuperación en otro conjunto de volúmenes.

El conjunto principal queda funcionando en **http://127.0.0.1:18080/#/login**. El proyecto de recuperación quedó detenido después de pasar sus pruebas; conserva sus contenedores y volúmenes. No se hizo commit ni push.

## Revisión previa y aislamiento

Antes de arrancar se leyeron `compose.yaml`, `.env.example`, `docs/docker.md`, el aprovisionador ROOT y los cambios pendientes de Git. Se preservaron los cambios anteriores. Se comprobaron nombres libres, puertos libres, configuración resuelta en memoria y exclusión de secretos por Git.

Docker Engine: 29.9.2. Imagen MySQL: `mysql:8.4.13`; versión efectiva comprobada con SQL: 8.4.13.

- Base: `tienda_contenedores`, dentro del servicio Docker `mysql`.
- Usuario SQL de aplicación: `tienda_app`, con contraseña nueva y exclusiva de cada proyecto.
- Backend: `DB_HOST=mysql`, puerto interno 3306; sin puertos publicados.
- MySQL: sin puertos publicados; no se utilizó el puerto 3306 del host.
- No se leyó ni reutilizó `backend/.env`, no se conectó al MySQL local y no se accedió a `tienda_celulares`.
- Los únicos bind mounts son los dos SQL iniciales, de sólo lectura. Los datos y fotos viven en volúmenes nuevos de Docker.
- Las redes `internal` se inspeccionaron y tienen `Internal=true`. Backend/MySQL sólo pertenecen a esa red de su proyecto.
- Sólo Nginx publica un puerto, siempre en **127.0.0.1**. No se publicó el sistema en Internet.

### Recursos exactos

| Proyecto | Contenedor | Estado final |
| --- | --- | --- |
| Principal | `tienda-celulares-docker-mysql-1` | running / healthy |
| Principal | `tienda-celulares-docker-backend-1` | running / healthy |
| Principal | `tienda-celulares-docker-frontend-1` | running / healthy; 127.0.0.1:18080 → 80 |
| Recuperación | `tc-recuperacion-20261103-mysql-1` | exited; detenido voluntariamente |
| Recuperación | `tc-recuperacion-20261103-backend-1` | exited; detenido voluntariamente |
| Recuperación | `tc-recuperacion-20261103-frontend-1` | exited; detenido voluntariamente |

Los tres servicios de recuperación estuvieron **healthy** antes de detenerse. Después de `stop`, Docker conserva un indicador Health `unhealthy` en su estado detenido; no corresponde a un fallo del arranque ni de la restauración. Su estado operativo final es `exited`, sin puertos escuchando.

Redes conservadas:

- `tienda-celulares-docker_internal`
- `tienda-celulares-docker_web`
- `tc-recuperacion-20261103_internal`
- `tc-recuperacion-20261103_web`

Volúmenes conservados:

| Datos | Principal | Recuperación |
| --- | --- | --- |
| MySQL | `tienda-celulares-docker_mysql_data` | `tc-recuperacion-20261103_mysql_data` |
| Fotos de productos | `tienda-celulares-docker_product_photos` | `tc-recuperacion-20261103_product_photos` |
| Fotos de perfiles | `tienda-celulares-docker_profile_photos` | `tc-recuperacion-20261103_profile_photos` |
| Respaldos SQL | `tienda-celulares-docker_sql_backups` | `tc-recuperacion-20261103_sql_backups` |

El frontend de recuperación usó temporalmente 127.0.0.1:18081. Ambos proyectos tienen UUID MySQL diferentes, credenciales SQL/JWT diferentes y volúmenes independientes, aunque el nombre lógico de la base sea el mismo.

## Credenciales y ROOT de prueba

Se crearon secretos con `crypto.randomBytes(32)`: 256 bits de entropía, representados como 64 caracteres hexadecimales. No se mostraron en consola ni se incluyeron en este informe, Git, argumentos de construcción o imágenes.

Archivos locales ignorados por Git, con herencia NTFS retirada y acceso explícito sólo para el usuario del equipo:

- `.env`: claves SQL/JWT y puerto 18080 del conjunto principal.
- `.env.recovery`: claves SQL/JWT diferentes y puerto 18081 del proyecto de recuperación.
- `.env.integration-users`: credenciales sintéticas de las cuentas `docker_root_test` y `docker_vendor_test`.

Para acceder manualmente, consultar **localmente** `.env.integration-users`; no copiar sus valores a informes o chats. Conservar los archivos `.env` para seguir accediendo a los volúmenes creados. No reemplazarlos por `.env.example`.

El aprovisionador exige usuario, correo y contraseña externos; la contraseña debe tener al menos 12 caracteres y hasta 72 bytes UTF-8. No tiene una contraseña predeterminada. También exige `--provision-new --database` coincidente con `DB_NAME`, bloquea `tienda_celulares` y comprueba que no existan usuarios antes de insertar.

Se ejecutó el aprovisionador documentado con credenciales nuevas transmitidas al proceso hijo por su entorno privado, sin incluirlas en argv ni imprimirlas. Se comprobó la asignación ROOT y SUC-001. Un segundo intento fue rechazado y no modificó las cuentas existentes.

## Arranque, esquema y healthchecks

El primer arranque creó la base y ejecutó automáticamente los dos SQL validados. Antes del aprovisionamiento había **cero usuarios**.

Resultados:

- **41 tablas**, **74 claves foráneas** y `foreign_key_checks=1`.
- **4 roles**, **60 permisos**, **143 asignaciones**.
- ROOT: 60 permisos; ADMINISTRADOR: 44; VENDEDOR: 22; INVENTARIO: 17.
- Monedas NIO y USD, sucursal SUC-001 y caja CAJA-001.
- MySQL, backend y frontend pasaron sus healthchecks, tanto en el arranque como después del cambio de imagen y del reinicio controlado.
- `/api/health` a través de Nginx respondió 200.
- HTML y assets compilados del frontend respondieron 200.

Los SQL no se modificaron. Conservan los hashes previamente validados:

- `01_schema.sql`: `5673E3E3831CAF57F0FEF45FEFD75A7AB9F2AFE7CFCAA90C2E3086F9C2856B6E`.
- `02_catalogs.sql`: `06BA62B7EB6480357EB0E2C04B52CC9FB384B89D04D5ACADCB73ADD7BD550B09`.

## Pruebas funcionales

Las peticiones se hicieron a Nginx en loopback, sin abrir directamente backend/MySQL al host.

- Login ROOT correcto y `/api/auth/me` correcto; respuestas sin `password_hash`.
- Contraseña incorrecta, ausencia de token y token inválido: HTTP 401.
- Creación de VENDEDOR sintético mediante la API: HTTP 201; login correcto.
- VENDEDOR consulta productos; administración de usuarios, respaldos y creación de productos son rechazadas con 403.
- HTTP 200 en 18 rutas: categorías, marcas, productos, inventario, clientes, proveedores, compras, ventas, cajas, créditos, transferencias, devoluciones, garantías, usuarios, roles, reportes, respaldos y perfil.
- Los 10 reportes configurados respondieron 200; exportación de ventas devolvió XLSX válido, con firma ZIP y tipo MIME correcto.
- Creación de producto, cliente y venta **en borrador**, y entrada de 5 unidades de inventario, todos sintéticos.
- Carga y lectura autenticadas de un PNG sintético de perfil y una foto de producto normalizada a WebP. Lecturas sin token: 401.
- Creación real de respaldo con `mysqldump` desde la aplicación y descarga vía Nginx: SQL válido de **65 852 bytes**.

Datos finales del conjunto principal: 2 usuarios, 1 producto, 1 cliente, 1 venta en borrador y 1 respaldo registrado. No se confirmó la venta ni se registraron cobros reales.

### Navegador real y URL de API

Chrome headless, con un perfil temporal, abrió el frontend compilado servido por Nginx. Se verificaron:

- Login real de ROOT y VENDEDOR mediante el formulario.
- Renderizado de productos, inventario, clientes, ventas, reportes y respaldos.
- Venta sintética: detalle y botón **“Revisar y confirmar”** presentes.
- VENDEDOR abre el formulario real **“Nueva venta”**.
- Navegación a usuarios sin permiso muestra **“Acceso denegado”**.
- **28 peticiones API**, todas al mismo origen `http://127.0.0.1:18080/api/...`.
- Ninguna petición a `localhost:3000` y **cero excepciones JavaScript** en la ejecución exitosa.

Se mantuvo HashRouter. Las sesiones del navegador de prueba se limpiaron al cerrar. No se almacenaron tokens en este informe.

## Persistencia

Se obtuvo `CHECKSUM TABLE ... EXTENDED` de las 41 tablas, se ejecutó un reinicio controlado de los tres servicios y se esperó nuevamente a sus healthchecks.

Después del reinicio:

- Coincidieron **todos los checksums de las 41 tablas**, antes de efectuar un nuevo login que actualizara el último acceso.
- El usuario ROOT pudo iniciar sesión y el producto seguía disponible.
- Coincidieron los SHA-256 de la foto de producto, foto de perfil y SQL descargado.
- Se preservaron los cuatro volúmenes y los catálogos no se duplicaron.

No se ejecutó `down -v`, `prune` ni se borró ningún volumen.

## Respaldo y recuperación aislada

Se detuvo el frontend principal para impedir nuevas solicitudes, se capturaron las tres carpetas privadas sin operaciones de negocio en curso y se detuvo el backend antes de exportar SQL. MySQL permaneció funcionando. Después se reanudaron frontend/backend y se comprobó su salud.

Copia consistente conservada fuera del repositorio, con acceso NTFS restringido al usuario:

`C:\Users\erfre\AppData\Local\Temp\tc-docker-recovery-KSAGZm`

- `database.sql`: **67 472 bytes**, incluye datos y metadatos de respaldos de la captura completa.
- `private-assets.tar.gz`: **9 182 bytes**, incluye fotos de producto/perfil y archivos SQL de la aplicación.

La captura se hizo con buffers binarios y copia de archivos, sin canalizar el SQL como texto de PowerShell. Los SQL incluyen hashes de contraseñas y deben seguir siendo privados. No se copiaron datos de ninguna base local.

Procedimiento ensayado:

1. Crear MySQL/backend de `tc-recuperacion-20261103` con credenciales nuevas.
2. Verificar cero usuarios, UUID MySQL diferente y volumen MySQL exclusivo.
3. Detener ese backend antes de importar.
4. Copiar el SQL al contenedor MySQL de recuperación e importarlo únicamente en su base `tienda_contenedores`.
5. Comparar los checksums de **las 41 tablas** con la captura del origen: coincidencia exacta.
6. Iniciar el backend y extraer las tres carpetas privadas en sus volúmenes nuevos.
7. Iniciar el frontend de recuperación y verificar tres servicios saludables.
8. Verificar login con la cuenta recuperada y hashes idénticos de las dos fotos y el SQL de la aplicación.
9. Confirmar que un JWT del conjunto principal recibe 401 en recuperación, por tener secretos JWT distintos.
10. Crear otro respaldo **en recuperación**, modificar allí el nombre del producto sintético y restaurar ese respaldo mediante `/api/respaldos/:id/restaurar`.
11. Comprobar que se recuperó el nombre original, el registro quedó `RESTAURADO`, las fotos siguieron accesibles y el producto del origen no cambió.
12. Detener los tres servicios de recuperación, conservando contenedores, redes y los cuatro volúmenes.

Esta prueba también verificó el caso en que el dump todavía no contiene el registro de su propio archivo: el código existente recuperó sus metadatos después de restaurar.

## Incidencia encontrada y corregida

La primera carga de foto de producto devolvió HTTP 500. La imagen original ubicaba el código directamente en `/app/src`; el servicio calcula la raíz del repositorio con `../../..`, que en ese diseño resultaba ser `/`. Su protección contra almacenar fotos dentro del repositorio rechazaba cualquier ruta absoluta del contenedor.

Se corrigió la **distribución de la imagen**, sin debilitar esa protección ni modificar la lógica de negocio:

- Código en `/app/backend` para mantener la estructura relativa.
- Fotos de productos en `/data/product-photos`, fuera de la raíz de código `/app`.
- Perfiles en `/app/backend/private/profile-photos`.
- Respaldos en `/app/backend/private/respaldos`.
- Se ajustaron los mounts y variables de Compose y la guía de respaldo/extracción.

Se reconstruyó el backend y se recreó el servicio conservando los mismos volúmenes. Las cargas de ambas fotos, respaldos, reinicios y recuperación pasaron después de la corrección. No se borró el producto ni el usuario sintético creados antes del error.

Los scripts temporales de verificación también requirieron ajustar la expectativa del ajuste de inventario a HTTP 200 y corregir la recarga de sesión/serialización de selectores DOM en CDP. Esos cambios fueron del instrumento de prueba; no se modificó la aplicación para ocultarlos.

## Pruebas automatizadas y tres resultados frontend fallidos

Backend: **110 pruebas; 107 aprobadas, 0 fallidas, 3 omitidas**. Las opcionales que usan MySQL local estuvieron desactivadas explícitamente.

Frontend: **208 pruebas; 203 aprobadas, 3 fallidas, 2 omitidas**. Se omitieron las pruebas optativas MySQL/navegador del runner local; la comprobación del navegador Docker se ejecutó por separado.

Los tres resultados fallidos pertenecen a `frontend/tests/permissions-render.test.mjs`:

| Resultado | Causa observada / evidencia | Impacto observado en Docker |
| --- | --- | --- |
| VENDEDOR abre Nueva venta | El entorno de renderizado SSR recibe un tipo de elemento React objeto. | No se reprodujo: VENDEDOR abrió el formulario real del build en Chrome. |
| Consultar documentos no permite confirmar/anular | El harness no encuentra “Revisar y confirmar”; inyecta `sale` en el índice 12, pero el estado actual de Sales tiene `catalog` en 12 y `sale` en 13. | El detalle real del borrador y su botón se renderizaron. La prueba sintética debe actualizar sus estados. |
| Autorización visual y handlers (padre) | Falla porque contiene las dos subpruebas anteriores. No es un tercer defecto independiente. | No bloqueó arranque, login, navegación ni las pruebas de permisos realizadas. |

Son preexistentes a la dockerización: en la etapa anterior se ejecutó el test original y los cuatro servicios de API originales obtenidos con `git show HEAD:...`, mediante una copia temporal y transformaciones Vite, y se reprodujeron los mismos resultados (19 pruebas, 16 aprobadas y 3 fallidas contando el padre). En esta etapa se repitió la suite actual y persistieron exactamente esos fallos. Véase `docker-validation-2026-11-03.md`.

La suite frontend **no está completamente aprobada**. La comprobación en Chrome demuestra que los escenarios de renderizado probados funcionan en el build servido por Docker; no sustituye corregir el harness ni probar todas las combinaciones de permisos y transacciones de negocio.

## Comandos y herramientas

Las operaciones se orquestaron desde el script local temporal `%TEMP%\tc-docker-integrated.cjs`. Recibe sólo el nombre de una fase; las credenciales se leen de los archivos privados y no se imprimen. Fases ejecutadas:

```powershell
node "$env:TEMP\tc-docker-integrated.cjs" preflight
node "$env:TEMP\tc-docker-integrated.cjs" start
node "$env:TEMP\tc-docker-integrated.cjs" provision
node "$env:TEMP\tc-docker-integrated.cjs" functional
node "$env:TEMP\tc-docker-integrated.cjs" rebuild
node "$env:TEMP\tc-docker-integrated.cjs" functional
node "$env:TEMP\tc-docker-integrated.cjs" sales
node "$env:TEMP\tc-docker-integrated.cjs" browser
node "$env:TEMP\tc-docker-integrated.cjs" persist
node "$env:TEMP\tc-docker-integrated.cjs" snapshot
node "$env:TEMP\tc-docker-integrated.cjs" recoveryStart
node "$env:TEMP\tc-docker-integrated.cjs" recoveryRestore
node "$env:TEMP\tc-docker-integrated.cjs" recoveryVerify
node "$env:TEMP\tc-docker-integrated.cjs" finalAudit
```

El runner es un instrumento de esta prueba, no un comando de operación general. `preflight` rechaza archivos de credenciales o recursos ya existentes; no debe volver a ejecutarse sobre esta instalación esperando reinicializarla.

Comandos principales de Docker usados, además de `version`, listados e inspecciones de sólo lectura:

```powershell
docker compose --project-name tienda-celulares-docker --env-file .env -f compose.yaml config --format json
docker compose --project-name tienda-celulares-docker --env-file .env -f compose.yaml up -d --no-build --wait --wait-timeout 300
docker compose --project-name tienda-celulares-docker --env-file .env -f compose.yaml build backend
docker compose --project-name tienda-celulares-docker --env-file .env -f compose.yaml restart
```

El JSON de configuración se analizó únicamente en memoria y **no se mostró**, pues contiene secretos. Para validación manual sin mostrarlos, usar `docker compose config --quiet`.

Para recuperación se usaron los mismos comandos con `--project-name tc-recuperacion-20261103 --env-file .env.recovery`, añadiendo un override temporal que reutiliza las imágenes ya construidas. Se ejecutaron `stop` y `start --wait` de servicios concretos, `docker exec` para SQL/tar/aprovisionador y `docker cp` del SQL hacia el MySQL de recuperación. La importación y restauración sólo apuntaron a ese proyecto.

Las peticiones HTTP se hicieron con `fetch` de Node; el navegador se manejó mediante CDP en Chrome headless. Las pruebas Node se ejecutaron con `INITIAL_SCHEMA_READONLY=0`, `REPORTS_MYSQL_READONLY=0` y `SIDEBAR_BROWSER=0` según correspondía. `git diff --check` terminó sin errores.

## Archivos y pendientes

Modificados en esta etapa:

- `backend/Dockerfile`.
- `compose.yaml`.
- `docs/docker.md`.

Creado en el repositorio: este informe. Creados sólo de forma local y excluidos de Git: los tres archivos de credenciales, scripts auxiliares en `%TEMP%` y la captura privada de recuperación.

Se conservaron los archivos pendientes anteriores y los SQL iniciales; se verificaron sus hashes. No se modificó código de negocio, pruebas existentes, datos locales, contenedores ajenos ni imágenes ajenas.

Pendientes: corregir los dos fallos previos del harness SSR frontend y ampliar la cobertura a procesos completos de compra, facturación, caja y crédito si se requiere una aceptación funcional exhaustiva. La venta de esta prueba permaneció en borrador. La captura en `%TEMP%` es un artefacto de ensayo, no sustituye una política de respaldo fuera del equipo.
