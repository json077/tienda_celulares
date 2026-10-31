# Dashboard, Reportes y Copias de seguridad

## Archivos modificados o añadidos

- `frontend/src/views/dashboard/Dashboard.jsx`
- `frontend/src/views/dashboard/DashboardResults.jsx`
- `frontend/src/views/dashboard/dashboardModel.js`
- `frontend/src/views/reports/Reports.jsx`
- `frontend/src/views/reports/ReportResult.jsx`
- `frontend/src/views/backups/Backups.jsx`
- `frontend/src/views/backups/backupModel.js`
- `frontend/src/services/backupService.js`
- `frontend/src/components/management/ManagementUI.jsx`
- `frontend/src/components/management/management.css`
- `frontend/src/routes.js`
- `frontend/src/config/modules.js` (comentario sobre el permiso del Dashboard)
- `frontend/tests/dashboard-mysql-readonly.test.mjs`
- `frontend/tests/management-models.test.mjs`
- `frontend/tests/management-ui.test.mjs`
- `docs/dashboard-interfaz.md`

## Dashboard

Ruta: `/#/dashboard`. La página de inicio sigue disponible para usuarios autenticados;
los datos requieren `REPORTE_VER`. No se conceden permisos nuevos.

Período inicial: **01/10/2026 al 31/10/2026**, con todas las sucursales autorizadas.
Cambiar fechas/sucursal y pulsar **Aplicar filtros**. La leyenda de período aplicado
corresponde a los gráficos mostrados, no a los cambios aún sin aplicar del formulario.

Se reutilizan estos GET existentes, con la sesión actual:

- `/api/reportes`: catálogo y sucursales autorizadas.
- `/api/reportes/ventas`: importe confirmado por día, total y número de ventas
  confirmadas; cantidad de documentos CONFIRMADA, BORRADOR y ANULADA para la dona.
- `/api/reportes/ranking`: cantidades en ventas confirmadas; gráfico de hasta diez
  productos y suma de unidades de **todos** los productos del resultado.
- `/api/reportes/existencias`: suma de stock actual por sucursal, sin fechas.

Las unidades vendidas son brutas, sin descontar devoluciones. Los importes de ventas
no equivalen a pagos cobrados. Las existencias no son un saldo histórico del período.
No se reconstruyen datos ni se muestran registros ficticios. Los días se agrupan
según la fecha de MySQL, sin conversión de zona horaria.

Las tres consultas deben terminar correctamente antes de mostrar los indicadores.
Se conserva el límite de Reportes: si hay más de 10000 filas, aparece el error del
servidor y no se presentan indicadores parciales. Cada gráfico tiene una tabla
desplegable **Ver datos del gráfico** para comprobar sus valores.

## Reportes

Ruta: `/#/reportes`. Encabezado, tarjeta de filtros, tarjetas de indicadores y
tabla responsiva. Los cálculos, consultas, permisos y exportación Excel se conservan.
Seleccionar un reporte, aplicar filtros y descargar con **Exportar a Excel**.
Créditos pendientes conserva el aviso de que las fechas filtran el inicio del crédito.

## Copias de seguridad

Ruta: `/#/respaldos`. En esta revisión el frontend tenía un marcador de módulo;
se añade la pantalla sobre el backend existente, sin cambiar sus procesos.

- Crear/consultar/descargar exige `BACKUP_CREAR`.
- Restaurar exige además `BACKUP_RESTAURAR` para acceder desde esta pantalla.
- GET `/api/respaldos` y GET `/api/respaldos/:id/descargar` consultan/descargan.
- POST `/api/respaldos` crea una copia después de confirmar.
- POST `/api/respaldos/:id/restaurar` requiere seleccionar una copia, revisar el
  aviso y escribir exactamente `RESTAURAR <ID>` antes de confirmar en el modal.
- Los POST no envían campos adicionales. No hay carga de archivos ni rutas libres.
- Las operaciones se bloquean durante su ejecución y no se reintentan automáticamente.
  Si falla la conexión, verificar el resultado antes de repetir una operación.
- Si una operación termina y falla la recarga, se conserva su aviso de éxito junto
  con el error de consulta. Un fallo de restauración invalida la lista visible.

No se modifica el backend, `mysqldump`, `mysql`, sus validaciones ni sus controles.

## Verificación

Desde la raíz:

```powershell
node --test backend/tests/*.test.js
cd frontend
node --test --test-concurrency=1 tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
cd ..
git diff --check
```

Comprobaciones optativas con MySQL real, en transacción `READ ONLY`:

```powershell
$env:REPORTS_MYSQL_READONLY='1'
node --test backend/tests/reports-mysql-readonly.test.js
cd frontend
node --test tests/dashboard-mysql-readonly.test.mjs
cd ..
Remove-Item Env:REPORTS_MYSQL_READONLY
```

La prueba del Dashboard compara sus tres gráficos y cuatro tarjetas con SELECT
agregados independientes, por período/sucursal y sin resultados; también verifica
aislamiento y rechazo de una sucursal no autorizada. No inicia el servidor de la
aplicación, no ejecuta escrituras y no crea/restaura respaldos.

Para revisión manual, iniciar backend y frontend con sus comandos existentes
(`npm.cmd start` en cada carpeta) y abrir la URL que muestre Vite:

1. Iniciar sesión con `REPORTE_VER`, abrir Dashboard y revisar octubre de 2026.
   Comparar **Ver datos del gráfico** con Ventas y Ranking en Reportes.
2. Aplicar otra sucursal autorizada y un período vacío. Stock puede seguir mostrando
   unidades porque es actual. Probar una sesión sin `REPORTE_VER`: no hay gráficos
   ni solicitudes de datos del Dashboard.
3. En Reportes, probar los ocho selectores y verificar filtros, tarjetas, tabla,
   vacíos y XLSX. Revisar también una ventana estrecha y el tema oscuro.
4. En Copias de seguridad, revisar historial, fechas, tamaño, estados y permisos.
   Abrir los modales y **cancelar** permite comprobar confirmaciones sin modificar
   MySQL. Una sesión sin `BACKUP_RESTAURAR` no habilita restauración. No confirmar
   creación/restauración durante una revisión que deba mantener MySQL sin cambios.

Los tests de acciones y errores usan servicios simulados; ningún test nuevo invoca
creación ni restauración sobre MySQL real.
