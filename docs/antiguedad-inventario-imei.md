# Antigüedad de inventario por IMEI

Reporte `antiguedad_imei`, disponible con REPORTE_VER; Excel requiere además
REPORTE_EXPORTAR. Reutiliza la autorización vigente de Reportes: ROOT tiene su
excepción existente; los demás usuarios requieren asignación explícita, usuario
activo y sucursal activa. El alcance se aplica sobre la sucursal actual de la unidad
en la propia consulta y se vuelve a comprobar al exportar.

Solo incluye unidades DISPONIBLES de productos SERIALIZADOS activos en sucursales
activas. RESERVADO, VENDIDO, DEFECTUOSO, DEVUELTO y EN_TRANSFERENCIA quedan excluidos.
inventario_sucursal contiene cantidades agregadas, no fechas de ingreso por IMEI;
no se utiliza su updated_at ni su stock para deducir el origen de una unidad.

La inspección del esquema real confirmó el vínculo nullable
unidades_producto.id_detalle_compra → detalle_compras → compras. La confirmación
crea la unidad y un movimiento COMPRA por unidad en la misma transacción. Se utiliza
movimientos_inventario.fecha únicamente cuando existe una entrada COMPRA única,
con cantidad 1, producto, sucursal y referencia coincidentes con la compra confirmada,
sin movimientos anteriores y sin fecha futura. compras.fecha es la fecha documental;
created_at y updated_at no prueban por sí solos el ingreso físico.

Sin esa evidencia, fecha, días y clasificación muestran «No determinada». Esto
incluye altas manuales por AJUSTE_ENTRADA: el tipo de movimiento por sí solo no
prueba una recepción original. La referencia de compra se conserva cuando existe,
aunque su fecha no sea verificable. No se deduce un ingreso a partir de transferencias
o devoluciones. Una transferencia recibida cambia sucursal y vuelve a DISPONIBLE;
una devolución APTO vuelve a DISPONIBLE, las demás quedan DEFECTUOSAS. Ambas conservan
el vínculo original de compra.

DATEDIFF(CURRENT_DATE(), ingreso) calcula días calendario en una sola consulta,
según la zona de la sesión MySQL, igual que los timestamps registrados por el sistema.
En la inspección: zona SYSTEM y horario de América Central. Clasificación inclusiva:
0–30 Reciente; 31–60 Seguimiento; 61–90 Inventario lento; >90 Revisar.

Filtros: sucursal actual autorizada, producto, clasificación (incluida No determinada)
y coincidencia parcial literal en IMEI1, IMEI2 o serie. Excel reutiliza consulta,
validación y filtros; vuelve a leer los datos al descargar. No calcula depreciación.

Validación enfocada: pruebas de Reportes backend, frontend y MySQL con transacción
READ ONLY. Las variantes sin compra, transferidas, devueltas y no disponibles se
ejercitan mediante tablas derivadas SELECT, sin insertar fixtures. En los datos reales
inspeccionados había tres unidades disponibles, todas con ingreso verificable.
No se realizaron migraciones, escrituras de datos, commit ni push.

La revisión visual interactiva en navegador no se realizó; la presentación se verificó
por renderizado del componente y build. Se conservan los estilos y cambios pendientes
del historial de costos. La incertidumbre histórica no puede resolverse sin evidencia
adicional y permanece visible.
