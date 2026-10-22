-- ============================================================
-- Sistema de Control de Inventario y Facturación
-- Tienda de Celulares - Modelo físico MySQL 8+
-- ============================================================

CREATE DATABASE IF NOT EXISTS tienda_celulares
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE tienda_celulares;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- A. SUCURSALES Y SEGURIDAD
-- ============================================================

CREATE TABLE sucursales (
    id_sucursal BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_sucursales_codigo UNIQUE (codigo),
    CONSTRAINT uq_sucursales_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
    id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL,
    email VARCHAR(150) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuarios_username UNIQUE (username),
    CONSTRAINT uq_usuarios_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE roles (
    id_rol BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_roles_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE permisos (
    id_permiso BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(80) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    modulo VARCHAR(60) NOT NULL,
    CONSTRAINT uq_permisos_codigo UNIQUE (codigo)
) ENGINE=InnoDB;

CREATE TABLE usuario_roles (
    id_usuario BIGINT UNSIGNED NOT NULL,
    id_rol BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id_usuario, id_rol),
    CONSTRAINT fk_usuario_roles_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_usuario_roles_rol FOREIGN KEY (id_rol)
        REFERENCES roles(id_rol) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE rol_permisos (
    id_rol BIGINT UNSIGNED NOT NULL,
    id_permiso BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id_rol, id_permiso),
    CONSTRAINT fk_rol_permisos_rol FOREIGN KEY (id_rol)
        REFERENCES roles(id_rol) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rol_permisos_permiso FOREIGN KEY (id_permiso)
        REFERENCES permisos(id_permiso) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE usuario_sucursales (
    id_usuario BIGINT UNSIGNED NOT NULL,
    id_sucursal BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id_usuario, id_sucursal),
    CONSTRAINT fk_usuario_sucursales_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_usuario_sucursales_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- B. CATÁLOGO
-- ============================================================

CREATE TABLE categorias (
    id_categoria BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_categorias_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE marcas (
    id_marca BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_marcas_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE productos (
    id_producto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_categoria BIGINT UNSIGNED NOT NULL,
    id_marca BIGINT UNSIGNED NULL,
    sku VARCHAR(50) NOT NULL,
    nombre VARCHAR(160) NOT NULL,
    descripcion TEXT NULL,
    tipo_control ENUM('CANTIDAD','SERIALIZADO') NOT NULL,
    precio_venta DECIMAL(14,2) NOT NULL,
    permite_descuento BOOLEAN NOT NULL DEFAULT FALSE,
    porcentaje_descuento_maximo DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    dias_garantia SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_productos_sku UNIQUE (sku),
    CONSTRAINT ck_productos_precio CHECK (precio_venta >= 0),
    CONSTRAINT ck_productos_descuento CHECK (porcentaje_descuento_maximo BETWEEN 0 AND 100),
    CONSTRAINT fk_productos_categoria FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_productos_marca FOREIGN KEY (id_marca)
        REFERENCES marcas(id_marca) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE atributos (
    id_atributo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(30) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_atributos_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE producto_atributos (
    id_producto BIGINT UNSIGNED NOT NULL,
    id_atributo BIGINT UNSIGNED NOT NULL,
    valor VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_producto, id_atributo),
    CONSTRAINT fk_producto_atributos_producto FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_producto_atributos_atributo FOREIGN KEY (id_atributo)
        REFERENCES atributos(id_atributo) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- C. PROVEEDORES Y COMPRAS
-- Se crean antes de unidades_producto porque cada unidad puede
-- conservar el detalle de compra que originó su ingreso.
-- ============================================================

CREATE TABLE proveedores (
    id_proveedor BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tipo_identificacion VARCHAR(30) NULL,
    identificacion VARCHAR(50) NULL,
    nombre VARCHAR(160) NOT NULL,
    telefono VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    direccion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_proveedores_identificacion UNIQUE (identificacion)
) ENGINE=InnoDB;

CREATE TABLE compras (
    id_compra BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_proveedor BIGINT UNSIGNED NOT NULL,
    id_sucursal BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    numero_documento VARCHAR(80) NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    descuento DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    impuesto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    estado ENUM('BORRADOR','CONFIRMADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
    observacion VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_compras_proveedor_documento UNIQUE (id_proveedor, numero_documento),
    CONSTRAINT ck_compras_montos CHECK (subtotal >= 0 AND descuento >= 0 AND impuesto >= 0 AND total >= 0),
    CONSTRAINT fk_compras_proveedor FOREIGN KEY (id_proveedor)
        REFERENCES proveedores(id_proveedor) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_compras_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_compras_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE detalle_compras (
    id_detalle_compra BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_compra BIGINT UNSIGNED NOT NULL,
    id_producto BIGINT UNSIGNED NOT NULL,
    cantidad INT UNSIGNED NOT NULL,
    costo_unitario DECIMAL(14,2) NOT NULL,
    descuento DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    impuesto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(14,2) NOT NULL,
    CONSTRAINT ck_detalle_compras_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_detalle_compras_montos CHECK (costo_unitario >= 0 AND descuento >= 0 AND impuesto >= 0 AND subtotal >= 0),
    CONSTRAINT fk_detalle_compras_compra FOREIGN KEY (id_compra)
        REFERENCES compras(id_compra) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_detalle_compras_producto FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_detalle_compras_compra (id_compra),
    INDEX idx_detalle_compras_producto (id_producto)
) ENGINE=InnoDB;

-- ============================================================
-- D. INVENTARIO E IMEI
-- ============================================================

CREATE TABLE inventario_sucursal (
    id_sucursal BIGINT UNSIGNED NOT NULL,
    id_producto BIGINT UNSIGNED NOT NULL,
    stock_actual INT UNSIGNED NOT NULL DEFAULT 0,
    stock_minimo INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_sucursal, id_producto),
    CONSTRAINT fk_inventario_sucursal_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_inventario_sucursal_producto FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_inventario_stock (stock_actual, stock_minimo)
) ENGINE=InnoDB;

CREATE TABLE unidades_producto (
    id_unidad BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_producto BIGINT UNSIGNED NOT NULL,
    id_sucursal_actual BIGINT UNSIGNED NOT NULL,
    id_detalle_compra BIGINT UNSIGNED NULL,
    imei1 VARCHAR(30) NULL,
    imei2 VARCHAR(30) NULL,
    numero_serie VARCHAR(80) NULL,
    estado ENUM('DISPONIBLE','RESERVADO','VENDIDO','DEFECTUOSO','DEVUELTO','EN_TRANSFERENCIA') NOT NULL DEFAULT 'DISPONIBLE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_unidades_imei1 UNIQUE (imei1),
    CONSTRAINT uq_unidades_imei2 UNIQUE (imei2),
    CONSTRAINT uq_unidades_numero_serie UNIQUE (numero_serie),
    CONSTRAINT ck_unidades_imeis_distintos CHECK (imei1 IS NULL OR imei2 IS NULL OR imei1 <> imei2),
    CONSTRAINT fk_unidades_producto FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_unidades_sucursal FOREIGN KEY (id_sucursal_actual)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_unidades_detalle_compra FOREIGN KEY (id_detalle_compra)
        REFERENCES detalle_compras(id_detalle_compra) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_unidades_producto_estado (id_producto, estado),
    INDEX idx_unidades_sucursal_estado (id_sucursal_actual, estado)
) ENGINE=InnoDB;

CREATE TABLE movimientos_inventario (
    id_movimiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_sucursal BIGINT UNSIGNED NOT NULL,
    id_producto BIGINT UNSIGNED NOT NULL,
    id_unidad BIGINT UNSIGNED NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    tipo ENUM('COMPRA','VENTA','DEVOLUCION','ANULACION','AJUSTE_ENTRADA','AJUSTE_SALIDA','TRANSFERENCIA_ENTRADA','TRANSFERENCIA_SALIDA') NOT NULL,
    cantidad INT NOT NULL,
    stock_anterior INT UNSIGNED NOT NULL,
    stock_nuevo INT UNSIGNED NOT NULL,
    tipo_referencia VARCHAR(40) NULL,
    id_referencia BIGINT UNSIGNED NULL,
    observacion VARCHAR(500) NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_movimientos_cantidad CHECK (cantidad <> 0),
    CONSTRAINT fk_movimientos_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_movimientos_producto FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_movimientos_unidad FOREIGN KEY (id_unidad)
        REFERENCES unidades_producto(id_unidad) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_movimientos_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_movimientos_producto_fecha (id_producto, fecha),
    INDEX idx_movimientos_sucursal_fecha (id_sucursal, fecha),
    INDEX idx_movimientos_referencia (tipo_referencia, id_referencia)
) ENGINE=InnoDB;

-- ============================================================
-- E. CLIENTES, VENTAS Y FACTURACIÓN
-- ============================================================

CREATE TABLE clientes (
    id_cliente BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tipo_identificacion VARCHAR(30) NOT NULL,
    identificacion VARCHAR(50) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NULL,
    telefono VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    direccion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_clientes_identificacion UNIQUE (identificacion)
) ENGINE=InnoDB;

CREATE TABLE ventas (
    id_venta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cliente BIGINT UNSIGNED NOT NULL,
    id_sucursal BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    numero_venta VARCHAR(50) NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_venta ENUM('CONTADO','CREDITO') NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    descuento DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    impuesto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    estado ENUM('BORRADOR','CONFIRMADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
    observacion VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_ventas_numero UNIQUE (numero_venta),
    CONSTRAINT ck_ventas_montos CHECK (subtotal >= 0 AND descuento >= 0 AND impuesto >= 0 AND total >= 0),
    CONSTRAINT fk_ventas_cliente FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_cliente) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ventas_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ventas_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_ventas_fecha (fecha),
    INDEX idx_ventas_cliente_fecha (id_cliente, fecha),
    INDEX idx_ventas_sucursal_fecha (id_sucursal, fecha)
) ENGINE=InnoDB;

CREATE TABLE detalle_ventas (
    id_detalle_venta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_venta BIGINT UNSIGNED NOT NULL,
    id_producto BIGINT UNSIGNED NOT NULL,
    cantidad INT UNSIGNED NOT NULL,
    costo_unitario DECIMAL(14,2) NOT NULL,
    precio_unitario DECIMAL(14,2) NOT NULL,
    descuento DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    impuesto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(14,2) NOT NULL,
    dias_garantia SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT ck_detalle_ventas_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_detalle_ventas_montos CHECK (costo_unitario >= 0 AND precio_unitario >= 0 AND descuento >= 0 AND impuesto >= 0 AND subtotal >= 0),
    CONSTRAINT fk_detalle_ventas_venta FOREIGN KEY (id_venta)
        REFERENCES ventas(id_venta) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_detalle_ventas_producto FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_detalle_ventas_venta (id_venta),
    INDEX idx_detalle_ventas_producto (id_producto)
) ENGINE=InnoDB;

CREATE TABLE detalle_venta_unidades (
    id_detalle_venta BIGINT UNSIGNED NOT NULL,
    id_unidad BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (id_detalle_venta, id_unidad),

    KEY idx_detalle_venta_unidad (id_unidad),

    CONSTRAINT fk_dvu_detalle_venta
        FOREIGN KEY (id_detalle_venta)
        REFERENCES detalle_ventas(id_detalle_venta)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_dvu_unidad
        FOREIGN KEY (id_unidad)
        REFERENCES unidades_producto(id_unidad)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE facturas (
    id_factura BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_venta BIGINT UNSIGNED NOT NULL,
    numero_factura VARCHAR(60) NOT NULL,
    serie VARCHAR(30) NULL,
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('EMITIDA','ANULADA') NOT NULL DEFAULT 'EMITIDA',
    nombre_cliente VARCHAR(200) NOT NULL,
    identificacion_cliente VARCHAR(50) NOT NULL,
    direccion_cliente VARCHAR(255) NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    descuento DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    impuesto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(14,2) NOT NULL,
    CONSTRAINT uq_facturas_venta UNIQUE (id_venta),
    CONSTRAINT uq_facturas_numero UNIQUE (numero_factura),
    CONSTRAINT ck_facturas_montos CHECK (subtotal >= 0 AND descuento >= 0 AND impuesto >= 0 AND total >= 0),
    CONSTRAINT fk_facturas_venta FOREIGN KEY (id_venta)
        REFERENCES ventas(id_venta) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- F. MONEDAS
-- ============================================================

CREATE TABLE monedas (
    id_moneda BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo CHAR(3) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    simbolo VARCHAR(10) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_monedas_codigo UNIQUE (codigo)
) ENGINE=InnoDB;

CREATE TABLE tipos_cambio (
    id_tipo_cambio BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_moneda_origen BIGINT UNSIGNED NOT NULL,
    id_moneda_destino BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    tasa DECIMAL(14,6) NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_tipo_cambio_tasa CHECK (tasa > 0),
    CONSTRAINT ck_tipo_cambio_monedas CHECK (id_moneda_origen <> id_moneda_destino),
    CONSTRAINT fk_tc_moneda_origen FOREIGN KEY (id_moneda_origen)
        REFERENCES monedas(id_moneda) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tc_moneda_destino FOREIGN KEY (id_moneda_destino)
        REFERENCES monedas(id_moneda) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tc_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_tc_monedas_fecha (id_moneda_origen, id_moneda_destino, fecha)
) ENGINE=InnoDB;

-- ============================================================
-- G. CAJA
-- Se crea antes de pagos porque pagos puede apuntar a una sesión.
-- ============================================================

CREATE TABLE cajas (
    id_caja BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_sucursal BIGINT UNSIGNED NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cajas_sucursal_nombre UNIQUE (id_sucursal, nombre),
    CONSTRAINT fk_cajas_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE sesiones_caja (
    id_sesion_caja BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_caja BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto_apertura DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    fecha_cierre DATETIME NULL,
    monto_esperado DECIMAL(14,2) NULL,
    monto_real DECIMAL(14,2) NULL,
    diferencia DECIMAL(14,2) NULL,
    estado ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
    CONSTRAINT ck_sesion_caja_apertura CHECK (monto_apertura >= 0),
    CONSTRAINT fk_sesion_caja_caja FOREIGN KEY (id_caja)
        REFERENCES cajas(id_caja) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sesion_caja_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_sesion_caja_estado (id_caja, estado)
) ENGINE=InnoDB;

-- ============================================================
-- H. PAGOS Y CRÉDITO
-- ============================================================

CREATE TABLE pagos (
    id_pago BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_venta BIGINT UNSIGNED NOT NULL,
    id_moneda BIGINT UNSIGNED NOT NULL,
    id_sesion_caja BIGINT UNSIGNED NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    metodo_pago ENUM('EFECTIVO','TARJETA','TRANSFERENCIA') NOT NULL,
    monto DECIMAL(14,2) NOT NULL,
    tipo_cambio_aplicado DECIMAL(14,6) NOT NULL DEFAULT 1.000000,
    monto_moneda_base DECIMAL(14,2) NOT NULL,
    referencia VARCHAR(120) NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('APLICADO','ANULADO') NOT NULL DEFAULT 'APLICADO',
    CONSTRAINT ck_pagos_monto CHECK (monto > 0 AND tipo_cambio_aplicado > 0 AND monto_moneda_base > 0),
    CONSTRAINT fk_pagos_venta FOREIGN KEY (id_venta)
        REFERENCES ventas(id_venta) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_moneda FOREIGN KEY (id_moneda)
        REFERENCES monedas(id_moneda) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_sesion FOREIGN KEY (id_sesion_caja)
        REFERENCES sesiones_caja(id_sesion_caja) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pagos_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_pagos_venta_fecha (id_venta, fecha),
    INDEX idx_pagos_sesion_fecha (id_sesion_caja, fecha)
) ENGINE=InnoDB;

CREATE TABLE creditos (
    id_credito BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_venta BIGINT UNSIGNED NOT NULL,
    monto_financiado DECIMAL(14,2) NOT NULL,
    tasa_interes DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
    numero_cuotas SMALLINT UNSIGNED NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    saldo DECIMAL(14,2) NOT NULL,
    estado ENUM('ACTIVO','PAGADO','VENCIDO','CANCELADO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT uq_creditos_venta UNIQUE (id_venta),
    CONSTRAINT ck_creditos_montos CHECK (monto_financiado > 0 AND saldo >= 0),
    CONSTRAINT ck_creditos_tasa CHECK (tasa_interes >= 0),
    CONSTRAINT ck_creditos_cuotas CHECK (numero_cuotas > 0),
    CONSTRAINT ck_creditos_fechas CHECK (fecha_vencimiento >= fecha_inicio),
    CONSTRAINT fk_creditos_venta FOREIGN KEY (id_venta)
        REFERENCES ventas(id_venta) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE cuotas_credito (
    id_cuota BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_credito BIGINT UNSIGNED NOT NULL,
    numero_cuota SMALLINT UNSIGNED NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    capital DECIMAL(14,2) NOT NULL,
    interes DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    monto_total DECIMAL(14,2) NOT NULL,
    saldo DECIMAL(14,2) NOT NULL,
    estado ENUM('PENDIENTE','PARCIAL','PAGADA','VENCIDA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    CONSTRAINT uq_cuota_numero UNIQUE (id_credito, numero_cuota),
    CONSTRAINT ck_cuotas_montos CHECK (capital >= 0 AND interes >= 0 AND monto_total > 0 AND saldo >= 0),
    CONSTRAINT fk_cuotas_credito FOREIGN KEY (id_credito)
        REFERENCES creditos(id_credito) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_cuotas_vencimiento_estado (fecha_vencimiento, estado)
) ENGINE=InnoDB;

CREATE TABLE pago_cuotas (
    id_pago BIGINT UNSIGNED NOT NULL,
    id_cuota BIGINT UNSIGNED NOT NULL,
    monto_aplicado DECIMAL(14,2) NOT NULL,
    PRIMARY KEY (id_pago, id_cuota),
    CONSTRAINT ck_pago_cuotas_monto CHECK (monto_aplicado > 0),
    CONSTRAINT fk_pago_cuotas_pago FOREIGN KEY (id_pago)
        REFERENCES pagos(id_pago) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pago_cuotas_cuota FOREIGN KEY (id_cuota)
        REFERENCES cuotas_credito(id_cuota) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE movimientos_caja (
    id_movimiento_caja BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_sesion_caja BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    id_pago BIGINT UNSIGNED NULL,
    tipo ENUM('INGRESO','EGRESO') NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    monto DECIMAL(14,2) NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_movimientos_caja_monto CHECK (monto > 0),
    CONSTRAINT fk_mc_sesion FOREIGN KEY (id_sesion_caja)
        REFERENCES sesiones_caja(id_sesion_caja) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_mc_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_mc_pago FOREIGN KEY (id_pago)
        REFERENCES pagos(id_pago) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_mc_sesion_fecha (id_sesion_caja, fecha)
) ENGINE=InnoDB;

-- ============================================================
-- I. TRANSFERENCIAS ENTRE SUCURSALES
-- ============================================================

CREATE TABLE transferencias (
    id_transferencia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_sucursal_origen BIGINT UNSIGNED NOT NULL,
    id_sucursal_destino BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('BORRADOR','ENVIADA','RECIBIDA','CANCELADA') NOT NULL DEFAULT 'BORRADOR',
    observacion VARCHAR(500) NULL,
    CONSTRAINT ck_transferencia_sucursales CHECK (id_sucursal_origen <> id_sucursal_destino),
    CONSTRAINT fk_transferencia_origen FOREIGN KEY (id_sucursal_origen)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_transferencia_destino FOREIGN KEY (id_sucursal_destino)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_transferencia_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_transferencias_fecha (fecha)
) ENGINE=InnoDB;

CREATE TABLE detalle_transferencias (
    id_detalle_transferencia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_transferencia BIGINT UNSIGNED NOT NULL,
    id_producto BIGINT UNSIGNED NOT NULL,
    cantidad INT UNSIGNED NOT NULL,
    CONSTRAINT ck_dt_cantidad CHECK (cantidad > 0),
    CONSTRAINT fk_dt_transferencia FOREIGN KEY (id_transferencia)
        REFERENCES transferencias(id_transferencia) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_dt_producto FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_dt_transferencia (id_transferencia)
) ENGINE=InnoDB;

CREATE TABLE transferencia_unidades (
    id_detalle_transferencia BIGINT UNSIGNED NOT NULL,
    id_unidad BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id_detalle_transferencia, id_unidad),
    CONSTRAINT fk_tu_detalle FOREIGN KEY (id_detalle_transferencia)
        REFERENCES detalle_transferencias(id_detalle_transferencia) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_tu_unidad FOREIGN KEY (id_unidad)
        REFERENCES unidades_producto(id_unidad) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- J. DEVOLUCIONES Y GARANTÍAS
-- ============================================================

CREATE TABLE devoluciones (
    id_devolucion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_venta BIGINT UNSIGNED NOT NULL,
    id_sucursal BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo_general VARCHAR(500) NOT NULL,
    estado ENUM('REGISTRADA','PROCESADA','CANCELADA') NOT NULL DEFAULT 'REGISTRADA',
    observacion VARCHAR(500) NULL,
    CONSTRAINT fk_devoluciones_venta FOREIGN KEY (id_venta)
        REFERENCES ventas(id_venta) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_devoluciones_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_devoluciones_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_devoluciones_venta_fecha (id_venta, fecha)
) ENGINE=InnoDB;

CREATE TABLE detalle_devoluciones (
    id_detalle_devolucion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_devolucion BIGINT UNSIGNED NOT NULL,
    id_detalle_venta BIGINT UNSIGNED NOT NULL,
    id_unidad BIGINT UNSIGNED NULL,
    cantidad INT UNSIGNED NOT NULL,
    motivo VARCHAR(500) NOT NULL,
    condicion_producto ENUM('APTO','DEFECTUOSO') NOT NULL,
    accion ENUM('REINTEGRAR_STOCK','ENVIAR_GARANTIA','NO_REINTEGRAR') NOT NULL,
    CONSTRAINT ck_dd_cantidad CHECK (cantidad > 0),
    CONSTRAINT fk_dd_devolucion FOREIGN KEY (id_devolucion)
        REFERENCES devoluciones(id_devolucion) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_dd_detalle_venta FOREIGN KEY (id_detalle_venta)
        REFERENCES detalle_ventas(id_detalle_venta) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_dd_unidad FOREIGN KEY (id_unidad)
        REFERENCES unidades_producto(id_unidad) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_dd_devolucion (id_devolucion)
) ENGINE=InnoDB;

CREATE TABLE garantias (
    id_garantia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_detalle_venta BIGINT UNSIGNED NOT NULL,
    id_unidad BIGINT UNSIGNED NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    condiciones TEXT NULL,
    estado ENUM('VIGENTE','VENCIDA','ANULADA') NOT NULL DEFAULT 'VIGENTE',
    CONSTRAINT ck_garantia_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT fk_garantias_detalle_venta FOREIGN KEY (id_detalle_venta)
        REFERENCES detalle_ventas(id_detalle_venta) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_garantias_unidad FOREIGN KEY (id_unidad)
        REFERENCES unidades_producto(id_unidad) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_garantias_vigencia (fecha_fin, estado)
) ENGINE=InnoDB;

CREATE TABLE reclamos_garantia (
    id_reclamo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_garantia BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    id_sucursal BIGINT UNSIGNED NOT NULL,
    fecha_recepcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    problema_reportado VARCHAR(1000) NOT NULL,
    diagnostico VARCHAR(1000) NULL,
    solucion VARCHAR(1000) NULL,
    fecha_resolucion DATETIME NULL,
    estado ENUM('RECIBIDO','EN_REVISION','REPARADO','REEMPLAZADO','RECHAZADO','CERRADO') NOT NULL DEFAULT 'RECIBIDO',
    CONSTRAINT fk_reclamos_garantia FOREIGN KEY (id_garantia)
        REFERENCES garantias(id_garantia) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reclamos_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reclamos_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_reclamos_estado_fecha (estado, fecha_recepcion)
) ENGINE=InnoDB;

-- ============================================================
-- K. ADMINISTRACIÓN, AUDITORÍA Y RESPALDOS
-- ============================================================

CREATE TABLE auditoria (
    id_auditoria BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NULL,
    id_sucursal BIGINT UNSIGNED NULL,
    modulo VARCHAR(80) NOT NULL,
    accion VARCHAR(80) NOT NULL,
    entidad VARCHAR(80) NOT NULL,
    id_entidad BIGINT UNSIGNED NULL,
    datos_anteriores JSON NULL,
    datos_nuevos JSON NULL,
    ip VARCHAR(45) NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_auditoria_sucursal FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_auditoria_fecha (fecha),
    INDEX idx_auditoria_entidad (entidad, id_entidad),
    INDEX idx_auditoria_usuario_fecha (id_usuario, fecha)
) ENGINE=InnoDB;

CREATE TABLE respaldos (
    id_respaldo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    tipo ENUM('MANUAL','AUTOMATICO') NOT NULL DEFAULT 'MANUAL',
    tamanio BIGINT UNSIGNED NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('GENERADO','RESTAURADO','FALLIDO') NOT NULL DEFAULT 'GENERADO',
    observacion VARCHAR(500) NULL,
    CONSTRAINT fk_respaldos_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_respaldos_fecha (fecha)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- FIN DEL ESQUEMA
-- Total: 41 tablas
-- ============================================================
