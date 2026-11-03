-- Nueva instalación exclusivamente. Seleccionar una base VACÍA con mysql --database.
-- Metadatos SHOW CREATE TABLE; sin registros ni contadores AUTO_INCREMENT de origen.
-- Objetivo: MySQL 8.4 LTS; ejecución aislada pendiente de validar.
-- No ejecutar junto al esquema histórico ni sus migraciones.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `atributos` (
  `id_atributo` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `unidad_medida` varchar(30) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_atributo`),
  UNIQUE KEY `uq_atributos_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `categorias` (
  `id_categoria` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_categoria`),
  UNIQUE KEY `uq_categorias_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `clientes` (
  `id_cliente` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tipo_identificacion` varchar(30) NOT NULL,
  `identificacion` varchar(50) NOT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) DEFAULT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cliente`),
  UNIQUE KEY `uq_clientes_identificacion` (`identificacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `marcas` (
  `id_marca` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_marca`),
  UNIQUE KEY `uq_marcas_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `monedas` (
  `id_moneda` bigint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` char(3) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `simbolo` varchar(10) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_moneda`),
  UNIQUE KEY `uq_monedas_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `permisos` (
  `id_permiso` bigint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(80) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `modulo` varchar(60) NOT NULL,
  PRIMARY KEY (`id_permiso`),
  UNIQUE KEY `uq_permisos_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `productos` (
  `id_producto` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_categoria` bigint unsigned NOT NULL,
  `id_marca` bigint unsigned DEFAULT NULL,
  `sku` varchar(50) NOT NULL,
  `nombre` varchar(160) NOT NULL,
  `descripcion` text,
  `tipo_control` enum('CANTIDAD','SERIALIZADO') NOT NULL,
  `precio_venta` decimal(14,2) NOT NULL,
  `permite_descuento` tinyint(1) NOT NULL DEFAULT '0',
  `porcentaje_descuento_maximo` decimal(5,2) NOT NULL DEFAULT '0.00',
  `dias_garantia` smallint unsigned NOT NULL DEFAULT '0',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `imagen_ruta` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_producto`),
  UNIQUE KEY `uq_productos_sku` (`sku`),
  KEY `fk_productos_categoria` (`id_categoria`),
  KEY `fk_productos_marca` (`id_marca`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_productos_marca` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id_marca`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_productos_descuento` CHECK ((`porcentaje_descuento_maximo` between 0 and 100)),
  CONSTRAINT `ck_productos_precio` CHECK ((`precio_venta` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `proveedores` (
  `id_proveedor` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tipo_identificacion` varchar(30) DEFAULT NULL,
  `identificacion` varchar(50) DEFAULT NULL,
  `nombre` varchar(160) NOT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_proveedor`),
  UNIQUE KEY `uq_proveedores_identificacion` (`identificacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `roles` (
  `id_rol` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `uq_roles_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `sucursales` (
  `id_sucursal` bigint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `direccion` varchar(255) NOT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_sucursal`),
  UNIQUE KEY `uq_sucursales_codigo` (`codigo`),
  UNIQUE KEY `uq_sucursales_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tipos_cambio` (
  `id_tipo_cambio` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_moneda` bigint unsigned NOT NULL,
  `tasa` decimal(14,6) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_tipo_cambio`),
  KEY `idx_tipos_cambio_moneda_fecha` (`id_moneda`,`fecha`),
  CONSTRAINT `fk_tipos_cambio_moneda` FOREIGN KEY (`id_moneda`) REFERENCES `monedas` (`id_moneda`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `usuarios` (
  `id_usuario` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(60) NOT NULL,
  `email` varchar(150) NOT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `ultimo_acceso` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uq_usuarios_username` (`username`),
  UNIQUE KEY `uq_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `ventas` (
  `id_venta` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_cliente` bigint unsigned NOT NULL,
  `id_sucursal` bigint unsigned NOT NULL,
  `id_usuario` bigint unsigned NOT NULL,
  `numero_venta` varchar(50) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo_venta` enum('CONTADO','CREDITO') NOT NULL,
  `subtotal` decimal(14,2) NOT NULL DEFAULT '0.00',
  `descuento` decimal(14,2) NOT NULL DEFAULT '0.00',
  `impuesto` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `estado` enum('BORRADOR','CONFIRMADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
  `observacion` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_venta`),
  UNIQUE KEY `uq_ventas_numero` (`numero_venta`),
  KEY `fk_ventas_usuario` (`id_usuario`),
  KEY `idx_ventas_fecha` (`fecha`),
  KEY `idx_ventas_cliente_fecha` (`id_cliente`,`fecha`),
  KEY `idx_ventas_sucursal_fecha` (`id_sucursal`,`fecha`),
  CONSTRAINT `fk_ventas_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ventas_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ventas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_ventas_montos` CHECK (((`subtotal` >= 0) and (`descuento` >= 0) and (`impuesto` >= 0) and (`total` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `auditoria` (
  `id_auditoria` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` bigint unsigned DEFAULT NULL,
  `id_sucursal` bigint unsigned DEFAULT NULL,
  `modulo` varchar(80) NOT NULL,
  `accion` varchar(80) NOT NULL,
  `entidad` varchar(80) NOT NULL,
  `id_entidad` bigint unsigned DEFAULT NULL,
  `datos_anteriores` json DEFAULT NULL,
  `datos_nuevos` json DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_auditoria`),
  KEY `idx_auditoria_fecha` (`fecha`),
  KEY `idx_auditoria_entidad` (`entidad`,`id_entidad`),
  KEY `idx_auditoria_usuario_fecha` (`id_usuario`,`fecha`),
  KEY `idx_auditoria_modulo_fecha` (`modulo`,`fecha`),
  KEY `idx_auditoria_accion_fecha` (`accion`,`fecha`),
  KEY `idx_auditoria_sucursal_fecha` (`id_sucursal`,`fecha`),
  CONSTRAINT `fk_auditoria_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_auditoria_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cajas` (
  `id_caja` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_sucursal` bigint unsigned NOT NULL,
  `codigo` varchar(30) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_caja`),
  UNIQUE KEY `uq_cajas_sucursal_codigo` (`id_sucursal`,`codigo`),
  CONSTRAINT `fk_cajas_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `compras` (
  `id_compra` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_proveedor` bigint unsigned NOT NULL,
  `id_sucursal` bigint unsigned NOT NULL,
  `id_usuario` bigint unsigned NOT NULL,
  `numero_documento` varchar(80) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subtotal` decimal(14,2) NOT NULL DEFAULT '0.00',
  `descuento` decimal(14,2) NOT NULL DEFAULT '0.00',
  `impuesto` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `estado` enum('BORRADOR','CONFIRMADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
  `observacion` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_compra`),
  UNIQUE KEY `uq_compras_proveedor_documento` (`id_proveedor`,`numero_documento`),
  KEY `fk_compras_sucursal` (`id_sucursal`),
  KEY `fk_compras_usuario` (`id_usuario`),
  CONSTRAINT `fk_compras_proveedor` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_compras_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_compras_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_compras_montos` CHECK (((`subtotal` >= 0) and (`descuento` >= 0) and (`impuesto` >= 0) and (`total` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `creditos` (
  `id_credito` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_venta` bigint unsigned NOT NULL,
  `id_cliente` bigint unsigned NOT NULL,
  `monto_financiado` decimal(12,2) NOT NULL,
  `tasa_interes` decimal(5,2) NOT NULL DEFAULT '0.00',
  `numero_cuotas` int unsigned NOT NULL,
  `monto_interes` decimal(12,2) NOT NULL DEFAULT '0.00',
  `monto_total` decimal(12,2) NOT NULL,
  `saldo_pendiente` decimal(12,2) NOT NULL,
  `frecuencia` enum('SEMANAL','QUINCENAL','MENSUAL') NOT NULL DEFAULT 'MENSUAL',
  `fecha_inicio` date NOT NULL,
  `estado` enum('ACTIVO','PAGADO','ANULADO') NOT NULL DEFAULT 'ACTIVO',
  `observacion` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_credito`),
  UNIQUE KEY `uq_credito_venta` (`id_venta`),
  KEY `idx_credito_cliente` (`id_cliente`),
  KEY `idx_credito_estado` (`estado`),
  CONSTRAINT `fk_credito_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_credito_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cuotas_credito` (
  `id_cuota` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_credito` bigint unsigned NOT NULL,
  `numero_cuota` int unsigned NOT NULL,
  `fecha_vencimiento` date NOT NULL,
  `monto_cuota` decimal(12,2) NOT NULL,
  `monto_pagado` decimal(12,2) NOT NULL DEFAULT '0.00',
  `saldo_cuota` decimal(12,2) NOT NULL,
  `estado` enum('PENDIENTE','PARCIAL','PAGADA','VENCIDA','ANULADA') NOT NULL DEFAULT 'PENDIENTE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cuota`),
  UNIQUE KEY `uq_credito_numero_cuota` (`id_credito`,`numero_cuota`),
  KEY `idx_cuota_vencimiento` (`fecha_vencimiento`),
  KEY `idx_cuota_estado` (`estado`),
  CONSTRAINT `fk_cuota_credito` FOREIGN KEY (`id_credito`) REFERENCES `creditos` (`id_credito`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `detalle_compras` (
  `id_detalle_compra` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_compra` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `cantidad` int unsigned NOT NULL,
  `costo_unitario` decimal(14,2) NOT NULL,
  `descuento` decimal(14,2) NOT NULL DEFAULT '0.00',
  `impuesto` decimal(14,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id_detalle_compra`),
  KEY `idx_detalle_compras_compra` (`id_compra`),
  KEY `idx_detalle_compras_producto` (`id_producto`),
  CONSTRAINT `fk_detalle_compras_compra` FOREIGN KEY (`id_compra`) REFERENCES `compras` (`id_compra`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_compras_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_detalle_compras_cantidad` CHECK ((`cantidad` > 0)),
  CONSTRAINT `ck_detalle_compras_montos` CHECK (((`costo_unitario` >= 0) and (`descuento` >= 0) and (`impuesto` >= 0) and (`subtotal` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `detalle_ventas` (
  `id_detalle_venta` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_venta` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `cantidad` int unsigned NOT NULL,
  `costo_unitario` decimal(14,2) NOT NULL,
  `precio_unitario` decimal(14,2) NOT NULL,
  `descuento` decimal(14,2) NOT NULL DEFAULT '0.00',
  `impuesto` decimal(14,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(14,2) NOT NULL,
  `dias_garantia` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_detalle_venta`),
  KEY `idx_detalle_ventas_venta` (`id_venta`),
  KEY `idx_detalle_ventas_producto` (`id_producto`),
  CONSTRAINT `fk_detalle_ventas_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_ventas_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ck_detalle_ventas_cantidad` CHECK ((`cantidad` > 0)),
  CONSTRAINT `ck_detalle_ventas_montos` CHECK (((`costo_unitario` >= 0) and (`precio_unitario` >= 0) and (`descuento` >= 0) and (`impuesto` >= 0) and (`subtotal` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `devoluciones` (
  `id_devolucion` bigint unsigned NOT NULL AUTO_INCREMENT,
  `numero_devolucion` varchar(50) NOT NULL,
  `id_venta` bigint unsigned NOT NULL,
  `id_sucursal` bigint unsigned NOT NULL,
  `id_usuario` bigint unsigned NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `motivo` varchar(500) NOT NULL,
  `estado` enum('BORRADOR','CONFIRMADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
  `total_devuelto` decimal(14,2) NOT NULL DEFAULT '0.00',
  `observacion` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_devolucion`),
  UNIQUE KEY `numero_devolucion` (`numero_devolucion`),
  KEY `idx_devoluciones_venta` (`id_venta`),
  KEY `idx_devoluciones_sucursal` (`id_sucursal`),
  KEY `idx_devoluciones_usuario` (`id_usuario`),
  KEY `idx_devoluciones_fecha` (`fecha`),
  KEY `idx_devoluciones_estado` (`estado`),
  CONSTRAINT `fk_devoluciones_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`),
  CONSTRAINT `fk_devoluciones_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_devoluciones_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `facturas` (
  `id_factura` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_venta` bigint unsigned NOT NULL,
  `numero_factura` varchar(60) NOT NULL,
  `serie` varchar(30) DEFAULT NULL,
  `fecha_emision` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('EMITIDA','ANULADA') NOT NULL DEFAULT 'EMITIDA',
  `nombre_cliente` varchar(200) NOT NULL,
  `identificacion_cliente` varchar(50) NOT NULL,
  `direccion_cliente` varchar(255) DEFAULT NULL,
  `subtotal` decimal(14,2) NOT NULL,
  `descuento` decimal(14,2) NOT NULL DEFAULT '0.00',
  `impuesto` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id_factura`),
  UNIQUE KEY `uq_facturas_venta` (`id_venta`),
  UNIQUE KEY `uq_facturas_numero` (`numero_factura`),
  CONSTRAINT `fk_facturas_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_facturas_montos` CHECK (((`subtotal` >= 0) and (`descuento` >= 0) and (`impuesto` >= 0) and (`total` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inventario_sucursal` (
  `id_sucursal` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `stock_actual` int unsigned NOT NULL DEFAULT '0',
  `stock_minimo` int unsigned NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_sucursal`,`id_producto`),
  KEY `fk_inventario_sucursal_producto` (`id_producto`),
  KEY `idx_inventario_stock` (`stock_actual`,`stock_minimo`),
  CONSTRAINT `fk_inventario_sucursal_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_inventario_sucursal_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `producto_atributos` (
  `id_producto` bigint unsigned NOT NULL,
  `id_atributo` bigint unsigned NOT NULL,
  `valor` varchar(150) NOT NULL,
  PRIMARY KEY (`id_producto`,`id_atributo`),
  KEY `fk_producto_atributos_atributo` (`id_atributo`),
  CONSTRAINT `fk_producto_atributos_atributo` FOREIGN KEY (`id_atributo`) REFERENCES `atributos` (`id_atributo`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_producto_atributos_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `respaldos` (
  `id_respaldo` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` bigint unsigned NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `ruta_archivo` varchar(500) NOT NULL,
  `tamano_bytes` bigint unsigned DEFAULT NULL,
  `estado` enum('CREADO','RESTAURADO','ERROR') NOT NULL DEFAULT 'CREADO',
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_restauracion` datetime DEFAULT NULL,
  `observacion` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id_respaldo`),
  KEY `idx_respaldos_usuario` (`id_usuario`),
  KEY `idx_respaldos_fecha` (`fecha_creacion`),
  KEY `idx_respaldos_estado` (`estado`),
  CONSTRAINT `fk_respaldos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `rol_permisos` (
  `id_rol` bigint unsigned NOT NULL,
  `id_permiso` bigint unsigned NOT NULL,
  PRIMARY KEY (`id_rol`,`id_permiso`),
  KEY `fk_rol_permisos_permiso` (`id_permiso`),
  CONSTRAINT `fk_rol_permisos_permiso` FOREIGN KEY (`id_permiso`) REFERENCES `permisos` (`id_permiso`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rol_permisos_rol` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `sesiones_caja` (
  `id_sesion_caja` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_caja` bigint unsigned NOT NULL,
  `id_usuario_apertura` bigint unsigned NOT NULL,
  `id_usuario_cierre` bigint unsigned DEFAULT NULL,
  `fecha_apertura` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_cierre` datetime DEFAULT NULL,
  `monto_apertura` decimal(14,2) NOT NULL DEFAULT '0.00',
  `monto_cierre_sistema` decimal(14,2) DEFAULT NULL,
  `monto_cierre_real` decimal(14,2) DEFAULT NULL,
  `diferencia` decimal(14,2) DEFAULT NULL,
  `estado` enum('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
  `observacion_apertura` varchar(500) DEFAULT NULL,
  `observacion_cierre` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_sesion_caja`),
  KEY `fk_sesiones_caja_usuario_apertura` (`id_usuario_apertura`),
  KEY `fk_sesiones_caja_usuario_cierre` (`id_usuario_cierre`),
  KEY `idx_sesiones_caja_estado` (`id_caja`,`estado`),
  CONSTRAINT `fk_sesiones_caja_caja` FOREIGN KEY (`id_caja`) REFERENCES `cajas` (`id_caja`),
  CONSTRAINT `fk_sesiones_caja_usuario_apertura` FOREIGN KEY (`id_usuario_apertura`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_sesiones_caja_usuario_cierre` FOREIGN KEY (`id_usuario_cierre`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `transferencias` (
  `id_transferencia` bigint unsigned NOT NULL AUTO_INCREMENT,
  `numero_transferencia` varchar(50) NOT NULL,
  `id_sucursal_origen` bigint unsigned NOT NULL,
  `id_sucursal_destino` bigint unsigned NOT NULL,
  `id_usuario_solicita` bigint unsigned NOT NULL,
  `id_usuario_confirma` bigint unsigned DEFAULT NULL,
  `fecha_solicitud` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_confirmacion` datetime DEFAULT NULL,
  `estado` enum('BORRADOR','CONFIRMADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
  `observacion` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_transferencia`),
  UNIQUE KEY `uq_transferencias_numero` (`numero_transferencia`),
  KEY `fk_transferencia_usuario_solicita` (`id_usuario_solicita`),
  KEY `fk_transferencia_usuario_confirma` (`id_usuario_confirma`),
  KEY `idx_transferencia_origen` (`id_sucursal_origen`),
  KEY `idx_transferencia_destino` (`id_sucursal_destino`),
  KEY `idx_transferencia_estado` (`estado`),
  KEY `idx_transferencia_fecha` (`fecha_solicitud`),
  CONSTRAINT `fk_transferencia_sucursal_destino` FOREIGN KEY (`id_sucursal_destino`) REFERENCES `sucursales` (`id_sucursal`),
  CONSTRAINT `fk_transferencia_sucursal_origen` FOREIGN KEY (`id_sucursal_origen`) REFERENCES `sucursales` (`id_sucursal`),
  CONSTRAINT `fk_transferencia_usuario_confirma` FOREIGN KEY (`id_usuario_confirma`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_transferencia_usuario_solicita` FOREIGN KEY (`id_usuario_solicita`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `unidades_producto` (
  `id_unidad` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_producto` bigint unsigned NOT NULL,
  `id_sucursal_actual` bigint unsigned NOT NULL,
  `id_detalle_compra` bigint unsigned DEFAULT NULL,
  `imei1` varchar(30) DEFAULT NULL,
  `imei2` varchar(30) DEFAULT NULL,
  `numero_serie` varchar(80) DEFAULT NULL,
  `estado` enum('DISPONIBLE','RESERVADO','VENDIDO','DEFECTUOSO','DEVUELTO','EN_TRANSFERENCIA') NOT NULL DEFAULT 'DISPONIBLE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_unidad`),
  UNIQUE KEY `uq_unidades_imei1` (`imei1`),
  UNIQUE KEY `uq_unidades_imei2` (`imei2`),
  UNIQUE KEY `uq_unidades_numero_serie` (`numero_serie`),
  KEY `fk_unidades_detalle_compra` (`id_detalle_compra`),
  KEY `idx_unidades_producto_estado` (`id_producto`,`estado`),
  KEY `idx_unidades_sucursal_estado` (`id_sucursal_actual`,`estado`),
  CONSTRAINT `fk_unidades_detalle_compra` FOREIGN KEY (`id_detalle_compra`) REFERENCES `detalle_compras` (`id_detalle_compra`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_unidades_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_unidades_sucursal` FOREIGN KEY (`id_sucursal_actual`) REFERENCES `sucursales` (`id_sucursal`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_unidades_imeis_distintos` CHECK (((`imei1` is null) or (`imei2` is null) or (`imei1` <> `imei2`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `usuario_roles` (
  `id_usuario` bigint unsigned NOT NULL,
  `id_rol` bigint unsigned NOT NULL,
  PRIMARY KEY (`id_usuario`,`id_rol`),
  KEY `fk_usuario_roles_rol` (`id_rol`),
  CONSTRAINT `fk_usuario_roles_rol` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_usuario_roles_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `usuario_sucursales` (
  `id_usuario` bigint unsigned NOT NULL,
  `id_sucursal` bigint unsigned NOT NULL,
  PRIMARY KEY (`id_usuario`,`id_sucursal`),
  KEY `fk_usuario_sucursales_sucursal` (`id_sucursal`),
  CONSTRAINT `fk_usuario_sucursales_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_usuario_sucursales_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `detalle_devoluciones` (
  `id_detalle_devolucion` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_devolucion` bigint unsigned NOT NULL,
  `id_detalle_venta` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `id_unidad` bigint unsigned DEFAULT NULL,
  `cantidad` int unsigned NOT NULL,
  `precio_unitario` decimal(14,2) NOT NULL,
  `subtotal` decimal(14,2) NOT NULL,
  `condicion` enum('APTO','DEFECTUOSO') NOT NULL DEFAULT 'APTO',
  `reintegra_inventario` tinyint(1) NOT NULL DEFAULT '1',
  `motivo` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_detalle_devolucion`),
  KEY `idx_det_dev_devolucion` (`id_devolucion`),
  KEY `idx_det_dev_detalle_venta` (`id_detalle_venta`),
  KEY `idx_det_dev_producto` (`id_producto`),
  KEY `idx_det_dev_unidad` (`id_unidad`),
  CONSTRAINT `fk_detalle_devolucion_detalle_venta` FOREIGN KEY (`id_detalle_venta`) REFERENCES `detalle_ventas` (`id_detalle_venta`),
  CONSTRAINT `fk_detalle_devolucion_devolucion` FOREIGN KEY (`id_devolucion`) REFERENCES `devoluciones` (`id_devolucion`),
  CONSTRAINT `fk_detalle_devolucion_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `fk_detalle_devolucion_unidad` FOREIGN KEY (`id_unidad`) REFERENCES `unidades_producto` (`id_unidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `detalle_transferencias` (
  `id_detalle_transferencia` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_transferencia` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `cantidad` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_detalle_transferencia`),
  UNIQUE KEY `uq_detalle_transferencia_producto` (`id_transferencia`,`id_producto`),
  KEY `idx_detalle_transferencia_producto` (`id_producto`),
  CONSTRAINT `fk_detalle_transferencia_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `fk_detalle_transferencia_transferencia` FOREIGN KEY (`id_transferencia`) REFERENCES `transferencias` (`id_transferencia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `detalle_venta_unidades` (
  `id_detalle_venta` bigint unsigned NOT NULL,
  `id_unidad` bigint unsigned NOT NULL,
  PRIMARY KEY (`id_detalle_venta`,`id_unidad`),
  KEY `idx_detalle_venta_unidad` (`id_unidad`),
  CONSTRAINT `fk_dvu_detalle_venta` FOREIGN KEY (`id_detalle_venta`) REFERENCES `detalle_ventas` (`id_detalle_venta`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dvu_unidad` FOREIGN KEY (`id_unidad`) REFERENCES `unidades_producto` (`id_unidad`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `garantias` (
  `id_garantia` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_venta` bigint unsigned NOT NULL,
  `id_detalle_venta` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `id_unidad` bigint unsigned DEFAULT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `dias_garantia` smallint unsigned NOT NULL,
  `estado` enum('VIGENTE','VENCIDA','ANULADA') NOT NULL DEFAULT 'VIGENTE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_garantia`),
  KEY `idx_garantias_venta` (`id_venta`),
  KEY `idx_garantias_detalle` (`id_detalle_venta`),
  KEY `idx_garantias_producto` (`id_producto`),
  KEY `idx_garantias_unidad` (`id_unidad`),
  KEY `idx_garantias_estado` (`estado`),
  KEY `idx_garantias_fecha_fin` (`fecha_fin`),
  CONSTRAINT `fk_garantias_detalle_venta` FOREIGN KEY (`id_detalle_venta`) REFERENCES `detalle_ventas` (`id_detalle_venta`),
  CONSTRAINT `fk_garantias_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `fk_garantias_unidad` FOREIGN KEY (`id_unidad`) REFERENCES `unidades_producto` (`id_unidad`),
  CONSTRAINT `fk_garantias_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `movimientos_caja` (
  `id_movimiento_caja` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_sesion_caja` bigint unsigned NOT NULL,
  `id_usuario` bigint unsigned NOT NULL,
  `tipo` enum('APERTURA','VENTA','INGRESO','EGRESO','ANULACION') NOT NULL,
  `monto` decimal(14,2) NOT NULL,
  `tipo_referencia` varchar(50) DEFAULT NULL,
  `id_referencia` bigint unsigned DEFAULT NULL,
  `concepto` varchar(255) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_movimiento_caja`),
  KEY `fk_movimientos_caja_usuario` (`id_usuario`),
  KEY `idx_movimientos_caja_sesion_fecha` (`id_sesion_caja`,`fecha`),
  CONSTRAINT `fk_movimientos_caja_sesion` FOREIGN KEY (`id_sesion_caja`) REFERENCES `sesiones_caja` (`id_sesion_caja`),
  CONSTRAINT `fk_movimientos_caja_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `movimientos_inventario` (
  `id_movimiento` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_sucursal` bigint unsigned NOT NULL,
  `id_producto` bigint unsigned NOT NULL,
  `id_unidad` bigint unsigned DEFAULT NULL,
  `id_usuario` bigint unsigned NOT NULL,
  `tipo` enum('COMPRA','VENTA','DEVOLUCION','ANULACION','AJUSTE_ENTRADA','AJUSTE_SALIDA','TRANSFERENCIA_ENTRADA','TRANSFERENCIA_SALIDA') NOT NULL,
  `cantidad` int NOT NULL,
  `stock_anterior` int unsigned NOT NULL,
  `stock_nuevo` int unsigned NOT NULL,
  `tipo_referencia` varchar(40) DEFAULT NULL,
  `id_referencia` bigint unsigned DEFAULT NULL,
  `observacion` varchar(500) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_movimiento`),
  KEY `fk_movimientos_unidad` (`id_unidad`),
  KEY `fk_movimientos_usuario` (`id_usuario`),
  KEY `idx_movimientos_producto_fecha` (`id_producto`,`fecha`),
  KEY `idx_movimientos_sucursal_fecha` (`id_sucursal`,`fecha`),
  KEY `idx_movimientos_referencia` (`tipo_referencia`,`id_referencia`),
  CONSTRAINT `fk_movimientos_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_movimientos_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_movimientos_unidad` FOREIGN KEY (`id_unidad`) REFERENCES `unidades_producto` (`id_unidad`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_movimientos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_movimientos_cantidad` CHECK ((`cantidad` <> 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pagos` (
  `id_pago` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_venta` bigint unsigned NOT NULL,
  `id_moneda` bigint unsigned NOT NULL,
  `id_sesion_caja` bigint unsigned DEFAULT NULL,
  `id_usuario` bigint unsigned NOT NULL,
  `metodo` enum('EFECTIVO','TARJETA','TRANSFERENCIA') NOT NULL,
  `monto` decimal(14,2) NOT NULL,
  `tipo_cambio` decimal(14,6) NOT NULL DEFAULT '1.000000',
  `monto_base` decimal(14,2) NOT NULL,
  `referencia` varchar(150) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('APLICADO','ANULADO') NOT NULL DEFAULT 'APLICADO',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_pago`),
  KEY `fk_pagos_moneda` (`id_moneda`),
  KEY `fk_pagos_usuario` (`id_usuario`),
  KEY `idx_pagos_venta` (`id_venta`),
  KEY `idx_pagos_fecha` (`fecha`),
  KEY `idx_pagos_sesion` (`id_sesion_caja`),
  CONSTRAINT `fk_pagos_moneda` FOREIGN KEY (`id_moneda`) REFERENCES `monedas` (`id_moneda`),
  CONSTRAINT `fk_pagos_sesion_caja` FOREIGN KEY (`id_sesion_caja`) REFERENCES `sesiones_caja` (`id_sesion_caja`),
  CONSTRAINT `fk_pagos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_pagos_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `reclamos_garantia` (
  `id_reclamo` bigint unsigned NOT NULL AUTO_INCREMENT,
  `numero_reclamo` varchar(50) NOT NULL,
  `id_garantia` bigint unsigned NOT NULL,
  `id_sucursal` bigint unsigned NOT NULL,
  `id_usuario_recibe` bigint unsigned NOT NULL,
  `id_usuario_resuelve` bigint unsigned DEFAULT NULL,
  `fecha_reclamo` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_resolucion` datetime DEFAULT NULL,
  `motivo` varchar(500) NOT NULL,
  `diagnostico` varchar(1000) DEFAULT NULL,
  `estado` enum('RECIBIDO','EN_REVISION','APROBADO','RECHAZADO','RESUELTO') NOT NULL DEFAULT 'RECIBIDO',
  `solucion` enum('REPARACION','REEMPLAZO','DEVOLUCION','SIN_COBERTURA') DEFAULT NULL,
  `observacion` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_reclamo`),
  UNIQUE KEY `numero_reclamo` (`numero_reclamo`),
  KEY `fk_reclamos_usuario_recibe` (`id_usuario_recibe`),
  KEY `fk_reclamos_usuario_resuelve` (`id_usuario_resuelve`),
  KEY `idx_reclamos_garantia` (`id_garantia`),
  KEY `idx_reclamos_sucursal` (`id_sucursal`),
  KEY `idx_reclamos_estado` (`estado`),
  KEY `idx_reclamos_fecha` (`fecha_reclamo`),
  CONSTRAINT `fk_reclamos_garantia` FOREIGN KEY (`id_garantia`) REFERENCES `garantias` (`id_garantia`),
  CONSTRAINT `fk_reclamos_sucursal` FOREIGN KEY (`id_sucursal`) REFERENCES `sucursales` (`id_sucursal`),
  CONSTRAINT `fk_reclamos_usuario_recibe` FOREIGN KEY (`id_usuario_recibe`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_reclamos_usuario_resuelve` FOREIGN KEY (`id_usuario_resuelve`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `transferencia_unidades` (
  `id_transferencia_unidad` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_detalle_transferencia` bigint unsigned NOT NULL,
  `id_unidad` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_transferencia_unidad`),
  UNIQUE KEY `uq_transferencia_detalle_unidad` (`id_detalle_transferencia`,`id_unidad`),
  KEY `idx_transferencia_unidad` (`id_unidad`),
  CONSTRAINT `fk_transferencia_unidad_detalle` FOREIGN KEY (`id_detalle_transferencia`) REFERENCES `detalle_transferencias` (`id_detalle_transferencia`),
  CONSTRAINT `fk_transferencia_unidad_unidad` FOREIGN KEY (`id_unidad`) REFERENCES `unidades_producto` (`id_unidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pago_cuotas` (
  `id_pago_cuota` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_cuota` bigint unsigned NOT NULL,
  `id_pago` bigint unsigned NOT NULL,
  `monto_aplicado` decimal(12,2) NOT NULL,
  `fecha` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_pago_cuota`),
  UNIQUE KEY `uq_pago_cuota_pago` (`id_cuota`,`id_pago`),
  KEY `idx_pago_cuota_pago` (`id_pago`),
  CONSTRAINT `fk_pago_cuota_cuota` FOREIGN KEY (`id_cuota`) REFERENCES `cuotas_credito` (`id_cuota`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_pago_cuota_pago` FOREIGN KEY (`id_pago`) REFERENCES `pagos` (`id_pago`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
