# Fotografías de productos — etapa 1

Una fotografía opcional por producto. No cambia los endpoints JSON, reglas
comerciales ni el POS. Los productos anteriores siguen funcionando sin foto.

## Migración explícita

Desde `backend`, con la misma configuración `.env` del servidor:

```powershell
node scripts/migrate-product-photos.js --database tienda_celulares
node scripts/migrate-product-photos.js --database tienda_celulares --apply
```

El primer comando verifica la base activa y la estructura. El segundo agrega
solo `imagen_ruta VARCHAR(255) NULL DEFAULT NULL` si falta. Si ya existe con esa
definición, no hace cambios. Si la base o columna no coinciden, se detiene.
El archivo SQL es `database/migrations/03_product_photos.sql`. No se ejecuta al
iniciar la aplicación; no modifica el esquema histórico ni restaura datos.

## Almacenamiento privado

Configurar `PRODUCT_PHOTO_DIR` con un directorio absoluto, persistente, fuera
del repositorio y de cualquier directorio servido por HTTP. Por defecto:
`~/.tienda-celulares/product-photos` (directorio personal del usuario que ejecuta
Node). No configurar un directorio público ni compartido con usuarios no
confiables. El proceso necesita lectura/escritura; los archivos nuevos usan
permisos privados donde el sistema los soporta. En Windows, restringir también
la ACL de la carpeta al usuario del servicio. No se añade `express.static`.

Las copias de seguridad deben conservar conjuntamente esta carpeta y MySQL.
Los respaldos SQL solos no contienen las imágenes. No añadir imágenes a Git.

## Endpoints

Todos requieren JWT en `Authorization: Bearer ...`:

| Endpoint | Permiso | Resultado |
| --- | --- | --- |
| GET /api/productos/:id/foto | PRODUCTO_VER | WebP binario o 404 si no hay fotografía/producto |
| PUT /api/productos/:id/foto | PRODUCTOS_EDITAR | Cuerpo binario con Content-Type image/jpeg, image/png o image/webp |
| DELETE /api/productos/:id/foto | PRODUCTOS_EDITAR | Quita la foto; no desactiva ni elimina el producto |

Máximo de entrada: 2.097.152 bytes; dimensiones entre 1 y 4096 por eje.
Se rechazan formatos falsos, archivos truncados y animaciones/múltiples páginas.
Sharp decodifica la imagen, elimina metadatos, corrige orientación y genera WebP
de hasta 1600 × 1600 sin ampliar imágenes pequeñas. El nombre UUID lo genera
el servidor; MySQL guarda solo ese nombre relativo. No se aceptan rutas de cliente.
Las respuestas de foto usan caché privada `no-store` y `nosniff`.

El archivo nuevo se escribe antes de cambiar la referencia. Una transacción
bloquea la fila para serializar cambios concurrentes de foto. Un fallo de
escritura/validación o rollback conserva la referencia anterior; se limpia el
archivo nuevo. El anterior solo se elimina después de confirmar MySQL. Si falla
su limpieza, se registra un mensaje sin rutas ni contenido; la operación ya
confirmada no se reporta como fallida. Una interrupción abrupta puede dejar
archivos huérfanos, que no se sirven porque GET usa exclusivamente la referencia
actual del producto. No hay borrado masivo automático.

## Formulario

Seleccionar/reemplazar/quitar se aplica al pulsar Guardar. Cancelar no cambia
la foto. La descarga autenticada genera una URL de blob temporal que se revoca
al cambiar de imagen o desmontar la vista; no se envían tokens en la URL.
Los colores usan las clases del tema existente.

Si el producto se guarda pero falla la foto, el editor conserva el ID y la
selección. Los campos comerciales quedan bloqueados; Reintentar fotografía
solo reintenta esa operación. Cancelar conserva el producto guardado. Quienes
solo tienen permiso para crear pueden crear sin foto, pero no cambiar fotos.

## Validación enfocada

```powershell
# backend: pruebas aisladas, sin escrituras comerciales en MySQL
node --test tests/product-photos.test.js tests/catalog-read-authorization.test.js
# frontend
node --test --test-concurrency=1 tests/products.test.mjs tests/products-render.test.mjs tests/product-photos.test.mjs tests/permissions.test.mjs
npm.cmd run lint
npm.cmd run build
git diff --check
```

Las pruebas generan imágenes en memoria y guardan únicamente en una carpeta
temporal aislada. No cargan fotografías ficticias en productos reales.
