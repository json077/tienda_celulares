# Ejecución con Docker

La configuración permite ejecutar el sistema completo de forma aislada. La primera validación integrada y sus resultados están documentados en `docker-integration-2026-11-03.md`; los comandos siguientes describen la operación, no se ejecutan automáticamente.

## Arquitectura y aislamiento

Tres servicios: Nginx sirve React/Vite y envía `/api` a Express; Express utiliza MySQL 8.4.13 LTS. HashRouter conserva las rutas `/#/...`: el fragmento no se envía al servidor. Las fotos siguen pasando por los endpoints autenticados; Nginx no publica los volúmenes privados.

Sólo se publica Nginx, por defecto en `http://127.0.0.1:8080`. Backend y MySQL no tienen puertos publicados. Ambos están exclusivamente en la red `internal: true`; el frontend también tiene una red web para recibir conexiones. No se usa `host.docker.internal`, red host, `.env` del backend, datos locales ni la base `tienda_celulares`.

El proyecto Compose se llama `tienda-celulares-docker`. Sus volúmenes se crean con ese prefijo, sin `external`, sin nombres globales y sin bind mounts a datos locales:

| Volumen | Destino | Contenido |
| --- | --- | --- |
| `mysql_data` | MySQL `/var/lib/mysql` | Base `tienda_contenedores` |
| `product_photos` | Backend `/data/product-photos` | Fotos de productos |
| `profile_photos` | Backend `/app/backend/private/profile-photos` | Fotos de perfiles |
| `sql_backups` | Backend `/app/backend/private/respaldos` | Copias SQL de la aplicación |

El backend ejecuta Node.js 24 como usuario `node`, instala dependencias con `npm ci --omit=dev` e incluye clientes **Oracle MySQL 8.4**, no MariaDB. Su usuario MySQL `tienda_app` tiene permisos sólo sobre la base del contenedor; necesita DDL para conservar la restauración existente. No recibe la contraseña root de MySQL.

El código vive en `/app/backend`, conservando la estructura del repositorio. Las fotos de producto se ubican en `/data`, fuera de `/app`: el servicio rechaza por diseño guardarlas dentro del repositorio. Los volúmenes conservan sus nombres al cambiar estos puntos de montaje.

## Preparación

Requisitos: Docker Desktop con contenedores Linux/WSL 2 y Docker Compose. La instalación probada es Windows 11 x64. El repositorio APT de Oracle utilizado por el backend requiere disponibilidad de paquetes para la arquitectura elegida; ARM no está validado.

Desde la raíz del repositorio, crear un `.env` nuevo sin copiar `backend/.env`:

```powershell
if (Test-Path .env) { throw 'Ya existe .env: conservarlo y revisarlo; no sobrescribir credenciales.' }
Copy-Item .env.example .env
```

Completar `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` y `JWT_SECRET` con tres secretos diferentes, aleatorios y de al menos 32 bytes. No tienen valores predeterminados: Compose rechaza valores vacíos. Para generar cada uno, en una terminal privada puede usarse `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. No compartir la salida ni guardarla en documentación. `.env` está ignorado por Git y excluido del contexto de construcción. La validación integrada creó uno con credenciales nuevas y acceso NTFS restringido al usuario: conservarlo para acceder a sus volúmenes.

Variables opcionales:

- `FRONTEND_PORT=8080`: elegir un puerto libre; no cambia el puerto local MySQL.
- `FRONTEND_BIND_ADDRESS=127.0.0.1`: acceso sólo desde este equipo. `0.0.0.0` habilita acceso de red y requiere revisar firewall y HTTPS.

Las credenciales de MySQL y JWT se inyectan al ejecutar, nunca como argumentos de construcción ni mediante `COPY`. Usuarios con acceso administrativo a Docker pueden inspeccionar el entorno de los contenedores: `.env` no es un almacén cifrado. No publicar la salida completa de `docker compose config`; usar `config --quiet` para validar sin mostrar secretos.

Si Docker no aparece en PATH en Windows:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin;$env:PATH"
docker version
docker compose version
```

Validar y construir sin iniciar servicios:

```powershell
docker compose config --quiet
docker compose build
```

La construcción sólo envía los archivos permitidos por `.dockerignore`. No incluye dependencias del host, `.git`, SQL, `.env`, respaldos, carpetas privadas ni builds locales. Los dos SQL se montan de sólo lectura al ejecutar MySQL, no se incorporan a las imágenes.

## Inicio e inicialización (después de la revisión)

```powershell
docker compose up -d --wait --wait-timeout 300
docker compose ps
```

MySQL crea `tienda_contenedores` y ejecuta `01_schema.sql` y `02_catalogs.sql` en orden **sólo si el volumen de datos está vacío**. Se conserva el comportamiento de la imagen oficial, sin importar SQL en cada arranque y sin ejecutar migraciones históricas. No se importa el respaldo local. Los archivos validados contienen 41 tablas, 74 FK y catálogos sin usuarios ni movimientos comerciales.

El healthcheck MySQL exige conexión autenticada por TCP y las 41 tablas/74 FK; el servidor temporal de inicialización no escucha TCP. El backend espera a MySQL saludable y verifica tanto HTTP como conexión SQL; el frontend espera al backend saludable. Se usa `restart: unless-stopped`. Un estado `unhealthy` no reinicia por sí solo un contenedor: revisar logs y causa. Una operación explícita de Compose sobre una dependencia también reinicia sus dependientes. `depends_on` no sustituye recuperación ante fallos durante la operación.

Si una inicialización falla, detenerse y revisar `docker compose logs mysql`: DDL MySQL no es una transacción global y un volumen parcialmente inicializado no se reimporta automáticamente. No ejecutar scripts otra vez sobre ese volumen ni usar `down -v` como reparación. Para una prueba nueva, un nombre Compose diferente (`docker compose -p tienda-celulares-prueba-nueva ...`) crea recursos nuevos; conservar el volumen fallido para diagnóstico. Mantener siempre el mismo `-p` durante el ciclo de esa prueba.

### Administrador inicial

Los catálogos no crean usuarios de aplicación. Después del primer arranque, abrir una consola en el backend:

```powershell
docker compose exec backend sh
```

Dentro del contenedor, elegir nombre y correo propios y pedir la contraseña sin mostrarla:

```sh
export ROOT_USERNAME=administrador_inicial
export ROOT_EMAIL=administrador@example.invalid
printf 'Contraseña inicial: '
stty -echo
IFS= read -r ROOT_PASSWORD
stty echo
printf '\n'
export ROOT_PASSWORD
node src/utils/createRootUser.js --provision-new --database tienda_contenedores
unset ROOT_PASSWORD ROOT_USERNAME ROOT_EMAIL
exit
```

La contraseña requiere al menos 12 caracteres y hasta 72 bytes UTF-8. El aprovisionador exige una base nueva sin usuarios, valida el destino y asigna ROOT/SUC-001 dentro de una transacción. No restablece cuentas existentes. Si se interrumpe la lectura con eco desactivado, ejecutar `stty echo` antes de seguir. Sustituir el correo de ejemplo antes de ejecutar.

Abrir `http://127.0.0.1:8080/#/login` (o el puerto configurado). Configurar nombres de sucursal/caja y un tipo de cambio real antes de operar en USD. Para acceso fuera del equipo, quedan pendientes dominio, TLS y revisión de exposición; esta configuración usa HTTP por defecto.

## Operación y detención

```powershell
docker compose ps
docker compose logs --tail 100 backend
docker compose logs --tail 100 mysql
docker compose stop
docker compose start --wait
```

`stop` conserva contenedores y volúmenes. `docker compose down` retira únicamente los contenedores/redes del proyecto y conserva volúmenes; para volver a crearlos usar `up -d --wait`. **No añadir `-v`** a `down` para operaciones normales. No usar `prune`. No cambiar el nombre de proyecto esperando conservar automáticamente los mismos datos.

Para actualizar código, construir de nuevo y ejecutar `up -d --wait` después de respaldar. Esto no aplica migraciones SQL. Los cambios a variables de contraseña no cambian contraseñas de un volumen MySQL existente: deben rotarse de forma coordinada mediante MySQL, sin borrar el volumen. Rotar JWT invalida las sesiones existentes.

## Respaldos y recuperación

La aplicación conserva las rutas `/api/respaldos` y sus permisos `BACKUP_CREAR`/`BACKUP_RESTAURAR`. El backend incluye `mysql` y `mysqldump` con las opciones usadas por el código existente. Nginx permite respuestas de larga duración para esas operaciones. Una restauración SQL puede quedar parcial si falla: realizarla sin otros usuarios escribiendo y con una copia previa.

Una copia SQL **no contiene fotos**. Los cuatro volúmenes deben incluirse en la estrategia de recuperación; guardar copias fuera de Docker y fuera del repositorio. El volumen de respaldos por sí solo no protege frente a pérdida del disco de Docker Desktop.

### Copia consistente del sistema del contenedor

Los comandos siguientes describen una copia controlada; la validación integrada ensayó este procedimiento con datos sintéticos. Bloquear acceso y esperar que terminen operaciones; detener frontend evita nuevas solicitudes, pero comprobar que no haya trabajos en curso antes de copiar. En este sistema de una sola instancia, se puede detener el proceso backend después de preparar el archivo privado y antes del dump para congelar las escrituras. Para copias estrictamente coordinadas, mantener toda la aplicación sin escrituras durante ambas capturas.

```powershell
docker compose stop frontend
docker compose exec backend sh
```

Dentro del backend (una vez sin operaciones en curso):

```sh
umask 077
tar -czf /tmp/private-assets.tar.gz -C /data product-photos -C /app/backend/private profile-photos respaldos
exit
```

Volver a PowerShell y detener backend antes de exportar SQL:

```powershell
docker compose stop backend
docker compose exec mysql sh
```

Dentro de MySQL (no se expone la contraseña en los argumentos):

```sh
umask 077
MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --no-defaults --no-login-paths --protocol=TCP -h 127.0.0.1 -u "$MYSQL_USER" --single-transaction --quick --skip-lock-tables --skip-add-locks --no-tablespaces --set-gtid-purged=OFF --hex-blob "$MYSQL_DATABASE" > /tmp/database.sql
# Continuar sólo si el comando terminó con código 0 y el archivo no está vacío.
test -s /tmp/database.sql
exit
```

En PowerShell, elegir una carpeta privada nueva fuera del repositorio y copiar los archivos sin canalizar SQL por PowerShell (evita conversiones de codificación):

```powershell
# Ejemplo: crear antes una carpeta privada y usar aquí su ruta.
docker compose cp mysql:/tmp/database.sql C:\ruta-privada\copia-nueva\database.sql
docker compose cp backend:/tmp/private-assets.tar.gz C:\ruta-privada\copia-nueva\private-assets.tar.gz
docker compose start --wait backend frontend
```

Guardar también el `.env` en un almacén privado y la revisión del código usada. Los archivos SQL contienen información sensible. La copia de la carpeta de respaldos conserva archivos y el dump conserva sus metadatos; el dump generado por la aplicación puede no incluir el registro del propio respaldo, porque ese registro se inserta después del dump.

### Recuperación en un proyecto nuevo y aislado

Primero ensayar con copias **sintéticas**. No restaurar sobre datos locales ni sobre un proyecto en uso. Usar otro nombre Compose y otro puerto en su `.env`. Crear sólo la base y el backend de ese proyecto para disponer de sus volúmenes, sin frontend público:

Para estos comandos, preparar **`.env.recovery`** en la raíz, ignorado por Git: copiar `.env.example` únicamente si ese archivo privado todavía no existe, completar tres secretos nuevos y diferentes de los del origen y configurar `FRONTEND_PORT=18081` (o un puerto libre) y `FRONTEND_BIND_ADDRESS=127.0.0.1`. Si ya existe, conservarlo y comprobar a qué proyecto pertenece; no sobrescribir sus claves. Todos los comandos de recuperación siguientes seleccionan ese archivo explícitamente. Validar antes de crear recursos:

```powershell
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion config --quiet
```

```powershell
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion up -d --wait mysql backend
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion stop backend
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion cp C:\ruta-privada\copia-nueva\database.sql mysql:/tmp/recovery.sql
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion exec mysql sh
```

Dentro de MySQL, **sólo sobre la base nueva del proyecto de recuperación**:

```sh
MYSQL_PWD="$MYSQL_PASSWORD" mysql --no-defaults --no-login-paths --protocol=TCP -h 127.0.0.1 -u "$MYSQL_USER" --binary-mode=1 --database="$MYSQL_DATABASE" < /tmp/recovery.sql
exit
```

El dump reemplaza tablas de la base objetivo; comprobar el código de salida antes de seguir. No importar dumps no confiables o de otros sistemas. Restaurar después los archivos en los volúmenes nuevos:

```powershell
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion cp C:\ruta-privada\copia-nueva\private-assets.tar.gz backend:/tmp/private-assets.tar.gz
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion start --wait backend
docker compose --env-file .env.recovery -p tienda-celulares-recuperacion exec backend sh
```

Dentro del backend nuevo, con frontend aún detenido:

```sh
tar -xzf /tmp/private-assets.tar.gz -C /data product-photos
tar -xzf /tmp/private-assets.tar.gz -C /app/backend/private profile-photos respaldos
exit
```

Verificar conteos, usuarios, login, imágenes y capacidad de generar otro respaldo antes de habilitar frontend con `docker compose --env-file .env.recovery -p tienda-celulares-recuperacion up -d --wait`. Las fotos y SQL deben pertenecer a la misma captura. No copiar `/var/lib/mysql` en caliente entre versiones.

## Desarrollo local

El frontend usa una única constante `API_URL='/api'`. Los servicios JSON, descargas SQL, Excel, transferencias y fotografías usan esa base. En desarrollo, Vite escucha en 3001 y reenvía `/api` al backend local existente en 3000; no cambia la configuración MySQL del backend local. No usar el proxy Vite como servidor de producción.

## Fuentes técnicas

- [Orden de inicio y dependencias saludables en Compose](https://docs.docker.com/compose/how-tos/startup-order/).
- [Inicialización de la imagen oficial MySQL](https://github.com/docker-library/docs/blob/master/mysql/content.md).
- [Repositorio APT oficial de MySQL](https://dev.mysql.com/doc/mysql-apt-repo-quick-guide/en/).
