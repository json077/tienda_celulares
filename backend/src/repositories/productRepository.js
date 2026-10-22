const { pool } = require('../config/database');

async function obtenerTodos() {
  const [rows] = await pool.query(`
    SELECT
      p.id_producto,
      p.id_categoria,
      c.nombre AS categoria,
      p.id_marca,
      m.nombre AS marca,
      p.sku,
      p.nombre,
      p.descripcion,
      p.tipo_control,
      p.precio_venta,
      p.permite_descuento,
      p.porcentaje_descuento_maximo,
      p.dias_garantia,
      p.activo
    FROM productos p
    INNER JOIN categorias c
      ON c.id_categoria = p.id_categoria
    LEFT JOIN marcas m
      ON m.id_marca = p.id_marca
    ORDER BY p.nombre ASC
  `);

  return rows;
}

async function obtenerPorId(idProducto) {
  const [rows] = await pool.query(
    `SELECT
       p.id_producto,
       p.id_categoria,
       c.nombre AS categoria,
       p.id_marca,
       m.nombre AS marca,
       p.sku,
       p.nombre,
       p.descripcion,
       p.tipo_control,
       p.precio_venta,
       p.permite_descuento,
       p.porcentaje_descuento_maximo,
       p.dias_garantia,
       p.activo
     FROM productos p
     INNER JOIN categorias c
       ON c.id_categoria = p.id_categoria
     LEFT JOIN marcas m
       ON m.id_marca = p.id_marca
     WHERE p.id_producto = ?
     LIMIT 1`,
    [idProducto]
  );

  return rows[0] || null;
}

async function obtenerPorSku(sku) {
  const [rows] = await pool.query(
    `SELECT id_producto, sku
     FROM productos
     WHERE sku = ?
     LIMIT 1`,
    [sku]
  );

  return rows[0] || null;
}

async function obtenerCategoria(idCategoria) {
  const [rows] = await pool.query(
    `SELECT id_categoria, nombre, activo
     FROM categorias
     WHERE id_categoria = ?
     LIMIT 1`,
    [idCategoria]
  );

  return rows[0] || null;
}

async function obtenerMarca(idMarca) {
  const [rows] = await pool.query(
    `SELECT id_marca, nombre, activo
     FROM marcas
     WHERE id_marca = ?
     LIMIT 1`,
    [idMarca]
  );

  return rows[0] || null;
}

async function crear(datos) {
  const [result] = await pool.query(
    `INSERT INTO productos (
       id_categoria,
       id_marca,
       sku,
       nombre,
       descripcion,
       tipo_control,
       precio_venta,
       permite_descuento,
       porcentaje_descuento_maximo,
       dias_garantia,
       activo
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      datos.id_categoria,
      datos.id_marca,
      datos.sku,
      datos.nombre,
      datos.descripcion,
      datos.tipo_control,
      datos.precio_venta,
      datos.permite_descuento,
      datos.porcentaje_descuento_maximo,
      datos.dias_garantia
    ]
  );

  return result.insertId;
}

async function actualizar(idProducto, datos) {
  const [result] = await pool.query(
    `UPDATE productos
     SET id_categoria = ?,
         id_marca = ?,
         sku = ?,
         nombre = ?,
         descripcion = ?,
         tipo_control = ?,
         precio_venta = ?,
         permite_descuento = ?,
         porcentaje_descuento_maximo = ?,
         dias_garantia = ?,
         activo = ?
     WHERE id_producto = ?`,
    [
      datos.id_categoria,
      datos.id_marca,
      datos.sku,
      datos.nombre,
      datos.descripcion,
      datos.tipo_control,
      datos.precio_venta,
      datos.permite_descuento,
      datos.porcentaje_descuento_maximo,
      datos.dias_garantia,
      datos.activo,
      idProducto
    ]
  );

  return result.affectedRows;
}

async function desactivar(idProducto) {
  const [result] = await pool.query(
    `UPDATE productos
     SET activo = 0
     WHERE id_producto = ?`,
    [idProducto]
  );

  return result.affectedRows;
}

module.exports = {
  obtenerTodos,
  obtenerPorId,
  obtenerPorSku,
  obtenerCategoria,
  obtenerMarca,
  crear,
  actualizar,
  desactivar
};