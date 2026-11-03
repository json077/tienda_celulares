# Validación aislada de inicialización MySQL 8.4 — 2026-11-03

## Alcance y estado inicial

Se revisaron `git status --short`, `git diff --stat` y el diff de los archivos ya modificados antes de operar. Estado previo preservado:

- M `.gitignore`
- M `backend/src/utils/createRootUser.js`
- ?? `backend/tests/database-initialization.test.js`
- ?? `database/init/` (`01_schema.sql`, `02_catalogs.sql`)

No se usó `backend/.env`, la base local `tienda_celulares`, credenciales locales, puertos del host ni archivos de datos locales. No se ejecutaron commit, push, Dockerfiles ni Compose de producción.

## Entorno y aislamiento

- Docker Engine 29.9.2; Compose v5.6.1; contexto `desktop-linux`.
- Imagen oficial `mysql:8.4`, versión efectiva **8.4.13**.
- Digest: `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902`.
- Contenedor: `tc-init-20261103-8e9741fc`.
- Volumen exclusivo: `tc-init-20261103-8e9741fc-data`, montado en `/var/lib/mysql`.
- Base exclusiva: `tc_init_validation`.
- Usuario MySQL `root` interno del contenedor; contraseña aleatoria exclusiva de 64 caracteres, nunca mostrada ni tomada de la instalación local.
- `--network none`, ningún `-p`, `PortBindings={}`; conexiones por socket mediante `docker exec`.
- `foreign_key_checks=1`, `restrict_fk_on_non_standard_key=1` y modo SQL estricto predeterminado.

## Comandos ejecutados

Comandos de lectura: `git status --short`, `git diff --stat`, `git diff -- .gitignore backend/src/utils/createRootUser.js`, `rg --files`, `rg -n`, `Get-Content`, `Get-FileHash`, `Get-Command`, `Get-Item` y `Get-ChildItem` para localizar herramientas, revisar SQL y pruebas. `node --version`: v24.19.0.

Se intentaron `docker version` y `docker compose version`; luego se usó el ejecutable de la instalación del usuario:

```powershell
$dockerTest = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
& $dockerTest version
& $dockerTest compose version
$env:PATH = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin;$env:PATH"
```

Creación (credencial generada en memoria, omitida de este informe):

```powershell
docker volume create --label purpose=tc-init-validation tc-init-20261103-8e9741fc-data
docker run -d --name tc-init-20261103-8e9741fc --label purpose=tc-init-validation --network none --mount type=volume,source=tc-init-20261103-8e9741fc-data,target=/var/lib/mysql -e MYSQL_ROOT_PASSWORD -e MYSQL_DATABASE=tc_init_validation mysql:8.4
Remove-Item Env:MYSQL_ROOT_PASSWORD
```

El primer `run` falló antes de crear el contenedor porque no encontraba el gestor de credenciales. Se repitió con el PATH corregido y una contraseña nueva.

Importación y validaciones automatizadas mediante un script temporal fuera del repositorio:

```powershell
node --check "$env:TEMP\tc-mysql-init-validation.cjs"
node "$env:TEMP\tc-mysql-init-validation.cjs"
node "$env:TEMP\tc-mysql-init-validation.cjs" --verify-only
```

El script envió el contenido UTF-8 de ambos SQL, en orden y en sesiones independientes, a la entrada estándar de:

```text
docker exec -i tc-init-20261103-8e9741fc sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --database=tc_init_validation --batch --raw --skip-column-names --default-character-set=utf8mb4 --show-warnings'
```

No se utilizó `--force`: cualquier error SQL detuvo esa ejecución. Las repeticiones `--verify-only` no reimportaron los SQL.

Consultas realizadas: versión y variables; `SHOW CREATE TABLE` de las 41 tablas; `information_schema.tables` y `key_column_usage`; conteo exacto de cada tabla; búsqueda de huérfanos en cada FK; códigos de permisos y asignaciones por rol; monedas, categoría y relación sucursal/caja. Pruebas negativas dentro de transacciones: FK inválida (1452), borrado restringido (1451), moneda duplicada (1062) y precio negativo (3819). Una inserción sintética de rol y permiso comprobó `ON DELETE CASCADE` y se revirtió.

```powershell
$env:INITIAL_SCHEMA_READONLY='0'
$env:REPORTS_MYSQL_READONLY='0'
node --test backend/tests/*.test.js
```

Inspección final: `docker inspect --format` limitado a nombre/red/puertos/montajes; `docker image inspect mysql:8.4 --format '{{json .RepoDigests}}'`; `docker logs --tail 12 tc-init-20261103-8e9741fc`. No se imprimieron variables de entorno del contenedor.

## Resultados

- Importación de ambos SQL correcta.
- 41 tablas: coincidencia exacta con `SHOW CREATE TABLE`, normalizando únicamente el contador AUTO_INCREMENT. Incluye columnas, índices, claves, CHECK, reglas referenciales, InnoDB y collation `utf8mb4_0900_ai_ci`.
- 74 claves foráneas creadas con las comprobaciones activadas y referencias estándar habilitadas; cero huérfanos.
- Roles activos: ROOT, ADMINISTRADOR, VENDEDOR, INVENTARIO.
- 60 permisos; 143 asignaciones exactas: ROOT 60, ADMINISTRADOR 44, VENDEDOR 22, INVENTARIO 17. Se compararon los códigos de cada rol, no sólo los conteos.
- Monedas: NIO y USD activas. Sucursal SUC-001 y caja CAJA-001 activas y relacionadas. Categoría General activa.
- Las otras 34 tablas están vacías, incluidas usuarios y todas las tablas comerciales. No se inventó tipo de cambio ni se aprovisionó administrador de aplicación.
- Suite backend: **110 pruebas, 107 aprobadas, 0 fallidas, 3 omitidas**. Las omitidas requieren MySQL local y se deshabilitaron explícitamente; la validación real se hizo exclusivamente por Docker. El análisis estático verificó 1242 referencias a columnas.

## Incidencias y compatibilidad

- Docker no figuraba en el PATH heredado por esta terminal. Se localizó en la instalación del usuario y se añadió su directorio sólo al proceso de ejecución.
- El sandbox denegó acceso a configuración y pipe de Docker; se ejecutó la prueba con autorización fuera del sandbox.
- El gestor `docker-credential-desktop` tampoco se encontraba hasta corregir el PATH; el primer intento dejó únicamente el volumen exclusivo vacío.
- El comparador temporal ordenaba códigos con JavaScript de forma distinta a la collation MySQL. Se corrigió ordenando ambos conjuntos en JavaScript; no era un error de los catálogos.
- La primera prueba sintética de CHECK omitió la categoría obligatoria y recibió 1364 antes de evaluar el precio. Se corrigió el dato de prueba temporal; no era un defecto del esquema.
- MySQL emitió **14 avisos 1681** por anchura de visualización de enteros (`tinyint(1)`): sintaxis aceptada en 8.4.13 pero obsoleta. No se modificó, pues no impide inicializar ni altera la semántica y coincide con los metadatos existentes.
- Logs de la imagen: CA autofirmada y ubicación del pid-file accesible a otros usuarios del contenedor. Son avisos de la imagen temporal, no errores de los SQL; la prueba no valida la configuración de seguridad de producción.
- No se encontraron incompatibilidades que impidan inicializar en MySQL 8.4.13. Esta validación no equivale a una prueba integral de todos los flujos de aplicación contra MySQL.

## Archivos

No se modificaron los SQL ni ningún archivo pendiente anterior. Se añadió únicamente este informe al repositorio. El comparador auxiliar quedó en `%TEMP%\tc-mysql-init-validation.cjs`, fuera del repositorio y sin credenciales.

SHA-256 de los SQL validados:

- `01_schema.sql`: `5673E3E3831CAF57F0FEF45FEFD75A7AB9F2AFE7CFCAA90C2E3086F9C2856B6E`
- `02_catalogs.sql`: `06BA62B7EB6480357EB0E2C04B52CC9FB384B89D04D5ACADCB73ADD7BD550B09`

## Cierre y limpieza

La ejecución final del comparador terminó con código 0, incluyendo `PASS CHECK enforced`.

Se verificaron primero las etiquetas `purpose=tc-init-validation` del contenedor y volumen con `docker inspect --format '{{json .Config.Labels}}'` y `docker volume inspect --format '{{json .Labels}}'`, leyendo el JSON en PowerShell. Un primer formato Go con `index` falló por las comillas al pasar por PowerShell; la protección detuvo la limpieza antes de cualquier modificación. Se corrigió sólo el comando.

Luego se ejecutaron satisfactoriamente:

```powershell
docker stop tc-init-20261103-8e9741fc
docker rm tc-init-20261103-8e9741fc
docker volume rm tc-init-20261103-8e9741fc-data
```

El contenedor y volumen exclusivos quedaron eliminados. La imagen descargada permanece en la caché Docker. No se ejecutó prune ni se operó sobre recursos ajenos.
