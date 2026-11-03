# Inventario de reconciliación

Actualización posterior: la importación aislada pendiente al redactar este inventario fue aprobada en MySQL 8.4.13; ver [validación](../../docs/mysql-8.4-validation-2026-11-03.md). Este documento conserva el inventario de la etapa estática.

Generado exclusivamente con definiciones de estructura, sin registros de usuarios ni datos comerciales.
Fuente: 41 SHOW CREATE TABLE leídos en una transacción READ ONLY.
Tipos, valores predeterminados, índices, claves primarias/únicas, foráneas y CHECK de la base activa se conservan en database/init/01_schema.sql, excepto contadores AUTO_INCREMENT derivados de registros.
No se encontraron vistas, triggers, rutinas ni eventos adicionales.

## Diferencias de columnas respecto al esquema histórico

Changed definition indica diferencias textuales tras una normalización básica: DEFAULT NULL explícito y formato pueden ser equivalentes. También incluye PRIMARY KEY movido de la columna a una cláusula propia. El SQL final contiene la definición exacta.

| Table | Added | Removed | Changed definition |
|---|---|---|---|
| atributos | - | - | id_atributo, unidad_medida |
| categorias | - | - | id_categoria, descripcion |
| clientes | - | - | id_cliente, apellidos, telefono, email, direccion |
| marcas | - | - | id_marca, descripcion |
| monedas | - | - | id_moneda |
| permisos | - | - | id_permiso, descripcion |
| productos | imagen_ruta | - | id_producto, id_marca, descripcion |
| proveedores | - | - | id_proveedor, tipo_identificacion, identificacion, telefono, email, direccion |
| roles | - | - | id_rol, descripcion |
| sucursales | - | - | id_sucursal, telefono, email |
| tipos_cambio | id_moneda, activo | id_moneda_origen, id_moneda_destino, id_usuario | id_tipo_cambio |
| usuarios | - | - | id_usuario, ultimo_acceso |
| ventas | - | - | id_venta, observacion |
| auditoria | - | - | id_auditoria, id_usuario, id_sucursal, id_entidad, datos_anteriores, datos_nuevos, ip |
| cajas | codigo, created_at, updated_at | descripcion | id_caja |
| compras | - | - | id_compra, observacion |
| creditos | id_cliente, monto_interes, monto_total, saldo_pendiente, frecuencia, observacion, created_at, updated_at | fecha_vencimiento, saldo | id_credito, monto_financiado, tasa_interes, numero_cuotas, estado |
| cuotas_credito | monto_cuota, monto_pagado, saldo_cuota, created_at, updated_at | capital, interes, monto_total, saldo | id_cuota, numero_cuota, estado |
| detalle_compras | - | - | id_detalle_compra |
| detalle_ventas | - | - | id_detalle_venta |
| devoluciones | numero_devolucion, motivo, total_devuelto, created_at, updated_at | motivo_general | id_devolucion, estado, observacion |
| facturas | - | - | id_factura, serie, direccion_cliente |
| respaldos | tamano_bytes, fecha_creacion, fecha_restauracion | tipo, tamanio, fecha | id_respaldo, estado, observacion |
| sesiones_caja | id_usuario_apertura, id_usuario_cierre, monto_cierre_sistema, monto_cierre_real, observacion_apertura, observacion_cierre, created_at, updated_at | id_usuario, monto_esperado, monto_real | id_sesion_caja, fecha_cierre, diferencia |
| transferencias | numero_transferencia, id_usuario_solicita, id_usuario_confirma, fecha_solicitud, fecha_confirmacion, created_at, updated_at | id_usuario, fecha | id_transferencia, estado, observacion |
| unidades_producto | - | - | id_unidad, id_detalle_compra, imei1, imei2, numero_serie |
| detalle_devoluciones | id_producto, precio_unitario, subtotal, condicion, reintegra_inventario, created_at | condicion_producto, accion | id_detalle_devolucion, id_unidad, motivo |
| detalle_transferencias | created_at | - | id_detalle_transferencia |
| garantias | id_venta, id_producto, dias_garantia, created_at, updated_at | condiciones | id_garantia, id_unidad |
| movimientos_caja | tipo_referencia, id_referencia | id_pago | id_movimiento_caja, tipo, concepto |
| movimientos_inventario | - | - | id_movimiento, id_unidad, tipo_referencia, id_referencia, observacion |
| pagos | metodo, tipo_cambio, monto_base, created_at | metodo_pago, tipo_cambio_aplicado, monto_moneda_base | id_pago, id_sesion_caja, referencia |
| reclamos_garantia | numero_reclamo, id_usuario_recibe, id_usuario_resuelve, fecha_reclamo, motivo, observacion, created_at, updated_at | id_usuario, fecha_recepcion, problema_reportado | id_reclamo, fecha_resolucion, diagnostico, estado, solucion |
| transferencia_unidades | id_transferencia_unidad, created_at | - | - |
| pago_cuotas | id_pago_cuota, fecha | - | monto_aplicado |

## Inventario de claves y restricciones (histórico / final)

Los conteos incluyen los índices declarados explícitamente en cada archivo. SHOW CREATE TABLE incluye índices auxiliares creados implícitamente por MySQL; una diferencia numérica no implica por sí sola una nueva regla. Nombres, orden de columnas, acciones referenciales y expresiones constan en el SQL final.

| Table | Primary keys | Unique keys | Secondary indexes | Foreign keys | CHECK |
|---|---|---|---|---|---|
| atributos | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| categorias | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| clientes | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| marcas | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| monedas | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| permisos | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| productos | 1 / 1 | 1 / 1 | 0 / 2 | 2 / 2 | 2 / 2 |
| proveedores | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| roles | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| sucursales | 1 / 1 | 2 / 2 | 0 / 0 | 0 / 0 | 0 / 0 |
| tipos_cambio | 1 / 1 | 0 / 0 | 1 / 1 | 3 / 1 | 2 / 0 |
| usuarios | 1 / 1 | 2 / 2 | 0 / 0 | 0 / 0 | 0 / 0 |
| ventas | 1 / 1 | 1 / 1 | 3 / 4 | 3 / 3 | 1 / 1 |
| auditoria | 1 / 1 | 0 / 0 | 3 / 6 | 2 / 2 | 0 / 0 |
| cajas | 1 / 1 | 1 / 1 | 0 / 0 | 1 / 1 | 0 / 0 |
| compras | 1 / 1 | 1 / 1 | 0 / 2 | 3 / 3 | 1 / 1 |
| creditos | 1 / 1 | 1 / 1 | 0 / 2 | 1 / 2 | 4 / 0 |
| cuotas_credito | 1 / 1 | 1 / 1 | 1 / 2 | 1 / 1 | 1 / 0 |
| detalle_compras | 1 / 1 | 0 / 0 | 2 / 2 | 2 / 2 | 2 / 2 |
| detalle_ventas | 1 / 1 | 0 / 0 | 2 / 2 | 2 / 2 | 2 / 2 |
| devoluciones | 1 / 1 | 0 / 1 | 1 / 5 | 3 / 3 | 0 / 0 |
| facturas | 1 / 1 | 2 / 2 | 0 / 0 | 1 / 1 | 1 / 1 |
| inventario_sucursal | 1 / 1 | 0 / 0 | 1 / 2 | 2 / 2 | 0 / 0 |
| producto_atributos | 1 / 1 | 0 / 0 | 0 / 1 | 2 / 2 | 0 / 0 |
| respaldos | 1 / 1 | 0 / 0 | 1 / 3 | 1 / 1 | 0 / 0 |
| rol_permisos | 1 / 1 | 0 / 0 | 0 / 1 | 2 / 2 | 0 / 0 |
| sesiones_caja | 1 / 1 | 0 / 0 | 1 / 3 | 2 / 3 | 1 / 0 |
| transferencias | 1 / 1 | 0 / 1 | 1 / 6 | 3 / 4 | 1 / 0 |
| unidades_producto | 1 / 1 | 3 / 3 | 2 / 3 | 3 / 3 | 1 / 1 |
| usuario_roles | 1 / 1 | 0 / 0 | 0 / 1 | 2 / 2 | 0 / 0 |
| usuario_sucursales | 1 / 1 | 0 / 0 | 0 / 1 | 2 / 2 | 0 / 0 |
| detalle_devoluciones | 1 / 1 | 0 / 0 | 1 / 4 | 3 / 4 | 1 / 0 |
| detalle_transferencias | 1 / 1 | 0 / 1 | 1 / 1 | 2 / 2 | 1 / 0 |
| detalle_venta_unidades | 1 / 1 | 0 / 0 | 1 / 1 | 2 / 2 | 0 / 0 |
| garantias | 1 / 1 | 0 / 0 | 1 / 6 | 2 / 4 | 1 / 0 |
| movimientos_caja | 1 / 1 | 0 / 0 | 1 / 2 | 3 / 2 | 1 / 0 |
| movimientos_inventario | 1 / 1 | 0 / 0 | 3 / 5 | 4 / 4 | 1 / 1 |
| pagos | 1 / 1 | 0 / 0 | 2 / 5 | 4 / 4 | 1 / 0 |
| reclamos_garantia | 1 / 1 | 0 / 1 | 1 / 6 | 3 / 4 | 0 / 0 |
| transferencia_unidades | 1 / 1 | 0 / 1 | 0 / 1 | 2 / 2 | 0 / 0 |
| pago_cuotas | 1 / 1 | 0 / 1 | 0 / 1 | 2 / 2 | 1 / 0 |

Esta es una línea base para instalaciones nuevas, NO un plan de migración. Las definiciones históricas indicadas como Removed no se eliminaron de la base activa. No se reintroducen restricciones históricas ausentes por suposición. La importación en MySQL oficial 8.4 LTS sigue pendiente en una instancia independiente.
