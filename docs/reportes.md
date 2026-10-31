# Reportes del examen de grado

## Pantalla y API

`/#/reportes` reúne ocho reportes: `ventas`, `compras`, `existencias`,
`movimientos`, `ranking`, `creditos`, `pagos` y `devoluciones`.

- `GET /api/reportes`: catálogo de reportes, sucursales autorizadas y productos
  presentes en el inventario de esas sucursales.
- `GET /api/reportes/:type`: columnas, filas, filtros aplicados, fecha de generación,
  advertencia y resumen. Todos los importes etiquetados NIO están en moneda base.
- `GET /api/reportes/:type/excel`: descarga un XLSX real generado en memoria.

Consulta y catálogo requieren sesión vigente y `REPORTE_VER`. Exportación requiere
además `REPORTE_EXPORTAR`. La autenticación consulta los permisos actuales en cada
petición; los claims de roles de un JWT antiguo no autorizan.

ROOT tiene alcance global. Los otros roles solo consultan sucursales activas con
asignación explícita en `usuario_sucursales`, comprobada en la consulta SQL mediante
EXISTS y usuario activo. Sin asignaciones se devuelven cero registros. Solicitar
explícitamente una sucursal no autorizada devuelve 403. Consultar, agregar y exportar
usan el mismo alcance; el ranking se limita antes de agrupar. No hay consultas N+1.

Los endpoints nuevos usan los permisos de reportes existentes como autorización
de lectura independiente. No se crean alias de permisos ni se amplían escrituras.
En particular, Compras en Reportes no depende de la discrepancia histórica
`COMPRA_VER` / `COMPRAS_VER`. La pantalla comercial Compras y sus guards no cambian.
REPORTE_VER permite los ocho reportes dentro del alcance de sucursales del actor.

## Filtros y significado

- Todos: `id_sucursal`, opcional; omitirlo selecciona todas las autorizadas.
- Fechas: `desde` y `hasta` inclusivas, salvo existencias. SQL usa límite inferior
  inclusivo y superior exclusivo al día siguiente, sin aplicar DATE a la columna.
  Se interpretan conforme a las fechas registradas en MySQL. No hay conversión
  implícita de zona en las fechas de las filas.
- Ventas, compras y devoluciones: `estado` (CONFIRMADA, BORRADOR, ANULADA).
  Sin filtro se muestran todos y los importes se desglosan por estado. Un total
  general de documentos no equivale a ingresos o compras confirmadas.
- Movimientos, existencias y ranking: `id_producto` opcional.
- Pagos: `estado` (APLICADO, ANULADO) y `metodo` (EFECTIVO, TARJETA, TRANSFERENCIA).
- Ranking: solo ventas CONFIRMADA, orden por unidades vendidas. Es **bruto**, sin
  descontar devoluciones. El importe suma `detalle_ventas.subtotal`, no utilidad.
- Créditos: solo ACTIVO con saldo_pendiente > 0. Fecha filtra `fecha_inicio`.
  El saldo es actual, no una reconstrucción histórica a la fecha seleccionada.
- Existencias: stock actual al consultar, sin filtro de período ni historial.
- Pagos: montos originales conservan su moneda; los resúmenes suman exclusivamente
  `monto_base` en NIO, separados en aplicados y anulados. No se suman monedas originales.
- Devoluciones: `total_devuelto` es valoración de artículos, **no dinero reembolsado**;
  no se modifican pagos, caja ni créditos.

Los filtros desconocidos, repetidos, incompatibles, estados inválidos y fechas
imposibles devuelven 400. Reporte desconocido: 404. Más de 10000 filas: 422 solicitando
reducir el período/sucursal; nunca se exporta o totaliza silenciosamente un subconjunto.
Los filtros se aplican con el botón Consultar. Excel vuelve a consultar usando los
filtros de la tabla mostrada; puede reflejar operaciones nuevas entre ambas consultas.

## Excel

Dependencia backend: `write-excel-file` 4.1.1 (MIT), con su lockfile.
Documentación: https://github.com/catamphetamine/write-excel-file

El XLSX incluye título, filtros, fecha de generación UTC, notas, columnas legibles,
valores numéricos, cabeceras fijas y resumen. Los valores de texto se escriben
expresamente como String, incluso si empiezan por `=`; no son fórmulas.
No se escriben archivos privados ni temporales en el servidor. Respuesta `no-store`.

## Verificación

```powershell
# Desde la raíz: pruebas aisladas; no consultan MySQL salvo opt-in explícito.
node --test backend/tests/*.test.js
cd frontend
node --test --test-concurrency=1 tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
cd ..
git diff --check

# Prueba adicional contra los datos actuales, protegida por transacción READ ONLY.
$env:REPORTS_MYSQL_READONLY='1'
node --test backend/tests/reports-mysql-readonly.test.js
Remove-Item Env:REPORTS_MYSQL_READONLY
```

En navegador:

1. Desde la raíz, iniciar backend (`cd backend; npm.cmd start`) y frontend
   (`cd frontend; npm.cmd start -- --port 3001`) en terminales separadas, con las
   configuraciones locales existentes. La API actual apunta a localhost:3000.
2. Abrir `http://localhost:3001`, iniciar sesión como ROOT y entrar por menú Reportes
   o `http://localhost:3001/#/reportes`. Seleccionar cada uno de los ocho reportes.
3. Usar 2026-10-01 a 2026-10-31 para los documentos existentes; consultar y comparar
   filas y resumen. En Créditos pendientes el período filtra el inicio del crédito:
   una venta de octubre puede tener un crédito iniciado en enero y quedar fuera.
   Dejar ambas fechas vacías permite consultar todos los pendientes autorizados.
   Existencias no ofrece fechas. Probar sucursal, producto, estados
   y métodos donde corresponda. Probar un período sin resultados.
4. Exportar cada reporte y abrirlo en Excel/LibreOffice: comprobar título, filtros,
   fecha, números y resumen. Pagos separa aplicados/anulados; devoluciones aclara que
   no hay reembolso; ranking aclara que es bruto.
5. Con un usuario con REPORTE_VER pero sin REPORTE_EXPORTAR: tabla disponible y
   exportación bloqueada. GET directo a Excel debe devolver 403. Sin REPORTE_VER,
   menú/ruta y endpoints quedan bloqueados.
6. Con un usuario sin sucursales asignadas: resultados vacíos. Con asignaciones:
   solo esas sucursales; una petición directa a otra sucursal devuelve 403.
   No crear asignaciones durante esta verificación sin autorización independiente.
7. Factura existente: Ventas → venta confirmada con factura → Ver / imprimir factura
   → Imprimir factura. Comprobar la vista previa. Ese flujo no se modificó.

## Observación de datos existentes

La inspección de solo lectura encontró una venta confirmada sin factura:
`id_venta=2`, `numero_venta=VTA-SAM-001`. No se repara ni se altera en este trabajo.
El esquema real se inspeccionó antes de programar; sus columnas difieren del SQL
histórico en pagos y créditos. No se ejecutaron migraciones ni escrituras de MySQL.
