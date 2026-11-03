-- New databases only, after 01_schema.sql. No customer or commercial data.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
START TRANSACTION;

INSERT INTO roles (nombre, descripcion, activo) VALUES
  ('ROOT', 'Rol ROOT', 1),
  ('ADMINISTRADOR', 'Rol ADMINISTRADOR', 1),
  ('VENDEDOR', 'Rol VENDEDOR', 1),
  ('INVENTARIO', 'Rol INVENTARIO', 1);

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
  ('AUDITORIA_VER', 'AUDITORIA VER', 'Permiso requerido por la aplicacion', 'AUDITORIA'),
  ('BACKUP_CREAR', 'BACKUP CREAR', 'Permiso requerido por la aplicacion', 'BACKUP'),
  ('BACKUP_RESTAURAR', 'BACKUP RESTAURAR', 'Permiso requerido por la aplicacion', 'BACKUP'),
  ('CAJA_ABRIR', 'CAJA ABRIR', 'Permiso requerido por la aplicacion', 'CAJA'),
  ('CAJA_CERRAR', 'CAJA CERRAR', 'Permiso requerido por la aplicacion', 'CAJA'),
  ('CAJA_MOVIMIENTO', 'CAJA MOVIMIENTO', 'Permiso requerido por la aplicacion', 'CAJA'),
  ('CAJA_VER', 'CAJA VER', 'Permiso requerido por la aplicacion', 'CAJA'),
  ('CLIENTES_CREAR', 'CLIENTES CREAR', 'Permiso requerido por la aplicacion', 'CLIENTES'),
  ('CLIENTES_EDITAR', 'CLIENTES EDITAR', 'Permiso requerido por la aplicacion', 'CLIENTES'),
  ('CLIENTES_ELIMINAR', 'CLIENTES ELIMINAR', 'Permiso requerido por la aplicacion', 'CLIENTES'),
  ('CLIENTE_VER', 'CLIENTE VER', 'Permiso requerido por la aplicacion', 'CLIENTE'),
  ('COMPRAS_ANULAR', 'COMPRAS ANULAR', 'Permiso requerido por la aplicacion', 'COMPRAS'),
  ('COMPRAS_CONFIRMAR', 'COMPRAS CONFIRMAR', 'Permiso requerido por la aplicacion', 'COMPRAS'),
  ('COMPRAS_CREAR', 'COMPRAS CREAR', 'Permiso requerido por la aplicacion', 'COMPRAS'),
  ('COMPRAS_VER', 'COMPRAS VER', 'Permiso requerido por la aplicacion', 'COMPRAS'),
  ('CREDITOS_ANULAR', 'CREDITOS ANULAR', 'Permiso requerido por la aplicacion', 'CREDITOS'),
  ('CREDITOS_CREAR', 'CREDITOS CREAR', 'Permiso requerido por la aplicacion', 'CREDITOS'),
  ('CREDITOS_PAGAR', 'CREDITOS PAGAR', 'Permiso requerido por la aplicacion', 'CREDITOS'),
  ('CREDITOS_VER', 'CREDITOS VER', 'Permiso requerido por la aplicacion', 'CREDITOS'),
  ('DASHBOARD_VER', 'DASHBOARD VER', 'Permiso requerido por la aplicacion', 'DASHBOARD'),
  ('DEVOLUCIONES_ANULAR', 'DEVOLUCIONES ANULAR', 'Permiso requerido por la aplicacion', 'DEVOLUCIONES'),
  ('DEVOLUCIONES_CONFIRMAR', 'DEVOLUCIONES CONFIRMAR', 'Permiso requerido por la aplicacion', 'DEVOLUCIONES'),
  ('DEVOLUCIONES_CREAR', 'DEVOLUCIONES CREAR', 'Permiso requerido por la aplicacion', 'DEVOLUCIONES'),
  ('DEVOLUCIONES_VER', 'DEVOLUCIONES VER', 'Permiso requerido por la aplicacion', 'DEVOLUCIONES'),
  ('FACTURA_IMPRIMIR', 'FACTURA IMPRIMIR', 'Permiso requerido por la aplicacion', 'FACTURA'),
  ('GARANTIAS_CREAR', 'GARANTIAS CREAR', 'Permiso requerido por la aplicacion', 'GARANTIAS'),
  ('GARANTIAS_RECLAMAR', 'GARANTIAS RECLAMAR', 'Permiso requerido por la aplicacion', 'GARANTIAS'),
  ('GARANTIAS_RESOLVER', 'GARANTIAS RESOLVER', 'Permiso requerido por la aplicacion', 'GARANTIAS'),
  ('GARANTIAS_VER', 'GARANTIAS VER', 'Permiso requerido por la aplicacion', 'GARANTIAS'),
  ('IMEI_GESTIONAR', 'IMEI GESTIONAR', 'Permiso requerido por la aplicacion', 'IMEI'),
  ('IMEI_VER', 'IMEI VER', 'Permiso requerido por la aplicacion', 'IMEI'),
  ('INVENTARIO_AJUSTAR', 'INVENTARIO AJUSTAR', 'Permiso requerido por la aplicacion', 'INVENTARIO'),
  ('INVENTARIO_VER', 'INVENTARIO VER', 'Permiso requerido por la aplicacion', 'INVENTARIO'),
  ('MOVIMIENTO_VER', 'MOVIMIENTO VER', 'Permiso requerido por la aplicacion', 'MOVIMIENTO'),
  ('PAGO_ANULAR', 'PAGO ANULAR', 'Permiso requerido por la aplicacion', 'PAGO'),
  ('PAGO_REGISTRAR', 'PAGO REGISTRAR', 'Permiso requerido por la aplicacion', 'PAGO'),
  ('PRODUCTOS_CREAR', 'PRODUCTOS CREAR', 'Permiso requerido por la aplicacion', 'PRODUCTOS'),
  ('PRODUCTOS_EDITAR', 'PRODUCTOS EDITAR', 'Permiso requerido por la aplicacion', 'PRODUCTOS'),
  ('PRODUCTOS_ELIMINAR', 'PRODUCTOS ELIMINAR', 'Permiso requerido por la aplicacion', 'PRODUCTOS'),
  ('PRODUCTO_VER', 'PRODUCTO VER', 'Permiso requerido por la aplicacion', 'PRODUCTO'),
  ('PROVEEDORES_CREAR', 'PROVEEDORES CREAR', 'Permiso requerido por la aplicacion', 'PROVEEDORES'),
  ('PROVEEDORES_EDITAR', 'PROVEEDORES EDITAR', 'Permiso requerido por la aplicacion', 'PROVEEDORES'),
  ('PROVEEDORES_ELIMINAR', 'PROVEEDORES ELIMINAR', 'Permiso requerido por la aplicacion', 'PROVEEDORES'),
  ('PROVEEDORES_VER', 'PROVEEDORES VER', 'Permiso requerido por la aplicacion', 'PROVEEDORES'),
  ('REPORTE_EXPORTAR', 'REPORTE EXPORTAR', 'Permiso requerido por la aplicacion', 'REPORTES'),
  ('REPORTE_VER', 'REPORTE VER', 'Permiso requerido por la aplicacion', 'REPORTES'),
  ('ROL_VER', 'ROL VER', 'Permiso requerido por la aplicacion', 'ROL'),
  ('TIPO_CAMBIO_GESTIONAR', 'TIPO CAMBIO GESTIONAR', 'Permiso requerido por la aplicacion', 'TIPO'),
  ('TRANSFERENCIAS_ANULAR', 'TRANSFERENCIAS ANULAR', 'Permiso requerido por la aplicacion', 'TRANSFERENCIAS'),
  ('TRANSFERENCIAS_CONFIRMAR', 'TRANSFERENCIAS CONFIRMAR', 'Permiso requerido por la aplicacion', 'TRANSFERENCIAS'),
  ('TRANSFERENCIAS_CREAR', 'TRANSFERENCIAS CREAR', 'Permiso requerido por la aplicacion', 'TRANSFERENCIAS'),
  ('TRANSFERENCIAS_VER', 'TRANSFERENCIAS VER', 'Permiso requerido por la aplicacion', 'TRANSFERENCIAS'),
  ('USUARIO_CREAR', 'USUARIO CREAR', 'Permiso requerido por la aplicacion', 'USUARIO'),
  ('USUARIO_EDITAR', 'USUARIO EDITAR', 'Permiso requerido por la aplicacion', 'USUARIO'),
  ('USUARIO_ROLES', 'USUARIO ROLES', 'Permiso requerido por la aplicacion', 'USUARIO'),
  ('USUARIO_VER', 'USUARIO VER', 'Permiso requerido por la aplicacion', 'USUARIO'),
  ('VENTA_ANULAR', 'VENTA ANULAR', 'Permiso requerido por la aplicacion', 'VENTA'),
  ('VENTA_CONFIRMAR', 'VENTA CONFIRMAR', 'Permiso requerido por la aplicacion', 'VENTA'),
  ('VENTA_CREAR', 'VENTA CREAR', 'Permiso requerido por la aplicacion', 'VENTA'),
  ('VENTA_VER', 'VENTA VER', 'Permiso requerido por la aplicacion', 'VENTA');

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.nombre='ROOT';

-- Existing named-role grants restricted to currently used codes; no alias inference.
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='ADMINISTRADOR' AND p.codigo IN ('AUDITORIA_VER', 'BACKUP_CREAR', 'CAJA_ABRIR', 'CAJA_CERRAR', 'CAJA_MOVIMIENTO', 'CAJA_VER', 'CLIENTE_VER', 'CREDITOS_ANULAR', 'CREDITOS_CREAR', 'CREDITOS_PAGAR', 'CREDITOS_VER', 'DASHBOARD_VER', 'DEVOLUCIONES_ANULAR', 'DEVOLUCIONES_CONFIRMAR', 'DEVOLUCIONES_CREAR', 'DEVOLUCIONES_VER', 'FACTURA_IMPRIMIR', 'GARANTIAS_CREAR', 'GARANTIAS_RECLAMAR', 'GARANTIAS_RESOLVER', 'GARANTIAS_VER', 'IMEI_GESTIONAR', 'INVENTARIO_AJUSTAR', 'INVENTARIO_VER', 'MOVIMIENTO_VER', 'PAGO_ANULAR', 'PAGO_REGISTRAR', 'PRODUCTO_VER', 'REPORTE_EXPORTAR', 'REPORTE_VER', 'ROL_VER', 'TIPO_CAMBIO_GESTIONAR', 'TRANSFERENCIAS_ANULAR', 'TRANSFERENCIAS_CONFIRMAR', 'TRANSFERENCIAS_CREAR', 'TRANSFERENCIAS_VER', 'USUARIO_CREAR', 'USUARIO_EDITAR', 'USUARIO_ROLES', 'USUARIO_VER', 'VENTA_ANULAR', 'VENTA_CONFIRMAR', 'VENTA_CREAR', 'VENTA_VER');

-- Existing named-role grants restricted to currently used codes; no alias inference.
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='VENDEDOR' AND p.codigo IN ('CAJA_ABRIR', 'CAJA_CERRAR', 'CAJA_MOVIMIENTO', 'CAJA_VER', 'CLIENTE_VER', 'CREDITOS_CREAR', 'CREDITOS_PAGAR', 'CREDITOS_VER', 'DASHBOARD_VER', 'DEVOLUCIONES_CREAR', 'DEVOLUCIONES_VER', 'FACTURA_IMPRIMIR', 'GARANTIAS_RECLAMAR', 'GARANTIAS_VER', 'IMEI_VER', 'INVENTARIO_VER', 'PAGO_REGISTRAR', 'PRODUCTO_VER', 'REPORTE_VER', 'VENTA_CONFIRMAR', 'VENTA_CREAR', 'VENTA_VER');

-- Existing named-role grants restricted to currently used codes; no alias inference.
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='INVENTARIO' AND p.codigo IN ('DASHBOARD_VER', 'DEVOLUCIONES_CONFIRMAR', 'DEVOLUCIONES_VER', 'GARANTIAS_RECLAMAR', 'GARANTIAS_RESOLVER', 'GARANTIAS_VER', 'IMEI_GESTIONAR', 'INVENTARIO_AJUSTAR', 'INVENTARIO_VER', 'MOVIMIENTO_VER', 'PRODUCTO_VER', 'REPORTE_EXPORTAR', 'REPORTE_VER', 'TRANSFERENCIAS_ANULAR', 'TRANSFERENCIAS_CONFIRMAR', 'TRANSFERENCIAS_CREAR', 'TRANSFERENCIAS_VER');

INSERT INTO monedas (codigo, nombre, simbolo, activo) VALUES
  ('NIO', 'Cordoba nicaraguense', 'C$', 1),
  ('USD', 'Dolar estadounidense', '$', 1);

-- Synthetic configuration. Replace labels/address before actual operation.
INSERT INTO sucursales (codigo, nombre, direccion, activo) VALUES
  ('SUC-001', 'Sucursal inicial', 'Configurar antes de operar', 1);
INSERT INTO cajas (id_sucursal, codigo, nombre, activo)
SELECT id_sucursal, 'CAJA-001', 'Caja inicial', 1 FROM sucursales WHERE codigo='SUC-001';
INSERT INTO categorias (nombre, descripcion, activo) VALUES
  ('General', 'Categoria inicial configurable', 1);

-- No exchange rate is invented. Configure a real rate before USD operations.
COMMIT;
