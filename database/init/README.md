# Inicialización de una base nueva

Estado posterior a la revisión estática aquí descrita: la importación aislada en MySQL 8.4.13 y la integración completa ya se comprobaron. Consultar [validación MySQL](../../docs/mysql-8.4-validation-2026-11-03.md), [integración Docker](../../docs/docker-integration-2026-11-03.md) y [auditoría final](../../docs/docker-final-audit-2026-11-03.md). Los pendientes históricos de esta etapa se conservan como trazabilidad; la guía operativa actual es [docker.md](../../docs/docker.md).

Esta carpeta es la línea base actual para **instalaciones nuevas**, separada del
esquema histórico `database/01_schema_tienda_celulares.sql`. No es una migración.
No ejecutar estos SQL sobre `tienda_celulares`, ni sobre una base que contenga datos.

## Versión y alcance

Objetivo: **MySQL Community Server 8.4 LTS**, con InnoDB y
`utf8mb4_0900_ai_ci`. Elegir un parche oficial 8.4.x y fijarlo al preparar Docker.
No se asume que la versión local 26.7.0 sea una etiqueta de imagen oficial.
La versión local y su comentario Community Server se consultaron como metadatos;
no se utilizará su directorio de datos para iniciar un servidor de otra versión.

`01_schema.sql` contiene los 41 `SHOW CREATE TABLE` de la base activa, obtenidos
en una transacción READ ONLY. Conserva tipos, ENUM, nulabilidad, valores
predeterminados, índices, claves primarias/únicas, foráneas, acciones referenciales
y CHECK. Omite únicamente los contadores AUTO_INCREMENT de los registros existentes.
No contiene filas ni CREATE DATABASE/USE que seleccionen implícitamente la base activa.
Las tablas están ordenadas por dependencia, con las claves foráneas habilitadas.
No se encontraron vistas, triggers, rutinas o eventos adicionales.

La revisión estática comprueba que cada FK referencia una clave completa primaria
o única; no depende de claves no estándar restringidas en MySQL 8.4. La colación
está soportada por esa versión. Referencias oficiales:
[claves foráneas](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html)
y [colaciones](https://dev.mysql.com/doc/refman/8.4/en/charset-mysql.html).

**Pendiente:** importar y ejecutar operaciones sobre un servidor oficial 8.4 aislado.
No se encontró una instancia de pruebas independiente configurada. No se crearon
contenedores ni bases, ni se ejecutó DDL/DML en la base activa. La compatibilidad
estática no equivale a una instalación certificada ni a una prueba funcional completa.

## Orden de instalación (solo entorno nuevo y aislado)

1. Preparar un servidor MySQL 8.4 independiente y una cuenta de instalación con
   permisos únicamente sobre la base nueva. Conservar la base actual intacta.
2. Conectar con el cliente `mysql --host=HOST_AISLADO --user=INSTALADOR --password`.
   La contraseña se solicita; no pasarla en argumentos. Comprobar servidor y destino.
3. Desde la raíz del repositorio, en el cliente interactivo:

   ```sql
   SELECT VERSION(), @@hostname, @@port;
   CREATE DATABASE tienda_celulares_nueva
     CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   USE tienda_celulares_nueva;
   SELECT DATABASE();
   SHOW TABLES;
   QUIT;
   ```

   La base debe estar vacía antes de importar. Desde la raíz, en **Bash o cmd.exe**
   (la redirección `<` no funciona directamente en PowerShell):

   ```text
   mysql --host=HOST_AISLADO --user=INSTALADOR --password --database=tienda_celulares_nueva --default-character-set=utf8mb4 --batch < database/init/01_schema.sql
   ```

   Comprobar que el cliente termina con código 0 antes de continuar. Solo entonces:

   ```text
   mysql --host=HOST_AISLADO --user=INSTALADOR --password --database=tienda_celulares_nueva --default-character-set=utf8mb4 --batch < database/init/02_catalogs.sql
   ```

   No usar `--force`. Si falla un archivo, detenerse y no ejecutar el siguiente.
   El DDL hace commits implícitos:
   una importación fallida puede dejar tablas creadas parcialmente. No reintentar
   encima ni eliminar una base sin verificar primero el destino aislado.
4. Crear el administrador con el procedimiento siguiente.
5. Configurar dirección de la sucursal, categorías, marcas y datos de operación.
   Registrar un tipo de cambio real antes de usar USD; no se precarga una tasa ficticia.

No ejecutar además el esquema histórico ni las migraciones `02_imei_ver.sql` y
`03_product_photos.sql`: IMEI_VER y `productos.imagen_ruta` ya están incorporados.
Estos archivos históricos permanecen sin cambios para instalaciones anteriores.
No hay un sistema de ejecución automática de migraciones.

## Catálogos y permisos

`02_catalogs.sql` se ejecuta una sola vez, después del esquema. Inserta en una
transacción cuatro roles (ROOT, ADMINISTRADOR, VENDEDOR, INVENTARIO), 60 permisos
usados por los guards actuales y el dashboard, monedas NIO/USD, una sucursal
SUC-001, una caja CAJA-001 y una categoría General. Sucursal, dirección, caja y
categoría son configuración sintética, no copias de registros de la tienda.
No incluye usuarios, clientes, proveedores, productos, IMEI, stock, ventas, compras,
pagos, sesiones de caja ni tipos de cambio reales. Tampoco incluye fotografías.

ROOT tiene todos los permisos del catálogo nuevo y conserva la excepción del
middleware. Para los otros tres roles se incluyen únicamente asignaciones
rol/código observadas y utilizadas actualmente; no asignaciones de usuarios ni
sucursales reales. No se transforman códigos antiguos en permisos nuevos por
parecido de nombre. Por ejemplo, `PRODUCTO_CREAR` no autoriza automáticamente
`PRODUCTOS_CREAR`, ni `COMPRA_CREAR` equivale a `COMPRAS_CREAR`.

Por esa discrepancia histórica, ADMINISTRADOR e INVENTARIO no reciben por
suposición permisos de escritura de productos/compras/proveedores; los permisos
de escritura de clientes tampoco se deducen de CLIENTE_GESTIONAR. Su matriz debe
revisarse explícitamente antes de incorporar usuarios ordinarios. Esta parte de la
política queda pendiente, no se inventa una equivalencia. El administrador ROOT
inicial sí permite operar y administrar. Las cuentas ordinarias necesitan además
asignación explícita de sucursal donde el módulo lo exige; el seed no las crea.

Los INSERT no son upserts y no actualizan permisos existentes. No son apropiados
para migrar ni para reparar una base en uso. No hay datos de demostración comercial;
un seed de demostración futuro deberá ser sintético y separado de esta inicialización.

## Administrador sin contraseña fija

El script `backend/src/utils/createRootUser.js` ya no tiene credenciales fijas.
Requiere ROOT_USERNAME, ROOT_EMAIL y ROOT_PASSWORD; ROOT_BRANCH_CODE es opcional
y usa SUC-001. La contraseña exige al menos 12 caracteres y hasta 72 bytes UTF-8,
sin caracteres nulos, acorde al límite bcrypt. Se almacena solamente su hash bcrypt
con costo 12 y nunca se imprime la contraseña ni el hash.

Copiar `.env.example` de esta carpeta a `backend/.env.initialization`, ignorado por
Git, y completar con el servidor aislado y la base nueva. No copiar la configuración
de conexión activa. El archivo debe ser privado, con acceso restringido al operador;
eliminarlo al terminar. Dejar ROOT_PASSWORD fuera del archivo y proporcionarla como
variable temporal desde una entrada oculta también es válido. No escribir secretos
en comandos que queden en el historial. No usar `set -x` ni imprimir el entorno.

Desde `backend`, con Node 24 (o una versión compatible con `--env-file`):

```text
node --env-file=.env.initialization src/utils/createRootUser.js --provision-new --database tienda_celulares_nueva
```

Las variables ya presentes en el entorno tienen prioridad sobre `--env-file`:
limpiar o revisar DB_* y ROOT_* de la sesión antes de ejecutar. La comprobación
de DB_NAME, argumento y SELECT DATABASE() debe coincidir con la base nueva.
El script rechaza por nombre `tienda_celulares` (también en mayúsculas), una base
con usuarios existentes, rol ROOT inactivo o sucursal ausente/inactiva. No restaura
contraseñas ni modifica usuarios existentes: una segunda ejecución se rechaza.
Usuario, rol y sucursal se asignan en una única transacción con rollback ante fallo.
Debe usarse una sola instancia del aprovisionador; no es un servidor de registro.

El bloqueo por nombre es una protección adicional, no identifica todos los posibles
alias de una base productiva. El aislamiento real depende del host y los privilegios
del usuario MySQL. No ejecutar el aprovisionador durante esta etapa sobre la base activa.

## Validación y diferencias

Desde la raíz, sin conexión ni escrituras:

```text
node --test backend/tests/database-initialization.test.js
node --check backend/src/utils/createRootUser.js
git diff --check
```

La comprobación opcional INITIAL_SCHEMA_READONLY=1 compara los 41 DDL con
SHOW CREATE TABLE en una transacción READ ONLY. No ejecuta el esquema ni el seed.
Los ensayos de aprovisionamiento usan conexiones simuladas y no crean usuarios.
La comprobación estática de repositorios cubre columnas calificadas y columnas
INSERT de SQL literal, no todas las expresiones ni SQL dinámico.

Consultar [RECONCILIATION.md](RECONCILIATION.md) para el inventario de diferencias
de columnas, índices y restricciones frente al esquema histórico. No se reintroducen
restricciones antiguas ausentes de la base real: hacerlo exigiría una decisión
comercial y una validación independiente. No se cambia la lógica del backend.

Las diferencias funcionales incorporadas incluyen: pagos con metodo/tipo_cambio/
monto_base; créditos y cuotas con sus importes, saldos y frecuencia actuales;
sesiones de caja con usuarios e importes de apertura/cierre; transferencias con
número, solicitante, confirmador y estados BORRADOR/CONFIRMADA/ANULADA; devoluciones
con valoración y condición APTO/DEFECTUOSO según el ENUM exacto del SQL; garantías
y reclamos con sus vínculos y estados actuales; respaldos con tamano_bytes,
fecha_creacion, fecha_restauracion y estados CREADO/RESTAURADO/ERROR. También se
incluyen imagen_ruta, tipos_cambio.id_moneda/activo, claves de pago_cuotas y
transferencia_unidades, y referencias genéricas en movimientos_caja.

Resultado de esta etapa: 33 pruebas enfocadas de inicialización, autenticación y
administración aprobadas; 7 corresponden al nuevo archivo de pruebas. Los 41 DDL
coinciden exactamente con la base activa tras omitir contadores AUTO_INCREMENT.
Se verificaron 1.242 referencias estáticas de columnas de repositorios, sintaxis Node
y git diff --check. Estas comprobaciones no ejecutaron DDL/DML en MySQL ni el
aprovisionador contra una base real.

Para una base existente se necesita un plan incremental separado, respaldos de SQL
y archivos, revisión del estado y ensayos de restauración. No sustituir su estructura
por este snapshot ni ejecutar automáticamente todas las migraciones históricas.
