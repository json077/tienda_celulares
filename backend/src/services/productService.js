const productRepository = require('../repositories/productRepository');

async function listarProductos() {
  return productRepository.obtenerTodos();
}

async function obtenerProducto(idProducto) {
  const producto = await productRepository.obtenerPorId(idProducto);

  if (!producto) {
    throw crearError('Producto no encontrado', 404);
  }

  return producto;
}

async function validarRelaciones(idCategoria, idMarca) {
  const categoria = await productRepository.obtenerCategoria(idCategoria);

  if (!categoria || !categoria.activo) {
    throw crearError('La categoría no existe o está inactiva', 400);
  }

  if (idMarca !== null && idMarca !== undefined) {
    const marca = await productRepository.obtenerMarca(idMarca);

    if (!marca || !marca.activo) {
      throw crearError('La marca no existe o está inactiva', 400);
    }
  }
}

function prepararDatos(datos) {
  const permiteDescuento = Boolean(datos.permite_descuento);

  return {
    id_categoria: Number(datos.id_categoria),
    id_marca:
      datos.id_marca === null || datos.id_marca === undefined
        ? null
        : Number(datos.id_marca),

    sku: datos.sku.trim().toUpperCase(),
    nombre: datos.nombre.trim(),

    descripcion: datos.descripcion
      ? datos.descripcion.trim()
      : null,

    tipo_control: datos.tipo_control,
    precio_venta: Number(datos.precio_venta),

    permite_descuento: permiteDescuento ? 1 : 0,

    porcentaje_descuento_maximo: permiteDescuento
      ? Number(datos.porcentaje_descuento_maximo || 0)
      : 0,

    dias_garantia: Number(datos.dias_garantia || 0),

    activo:
      datos.activo === undefined
        ? 1
        : datos.activo
          ? 1
          : 0
  };
}

async function crearProducto(datos) {
  const preparado = prepararDatos(datos);

  await validarRelaciones(
    preparado.id_categoria,
    preparado.id_marca
  );

  const existente = await productRepository.obtenerPorSku(preparado.sku);

  if (existente) {
    throw crearError('Ya existe un producto con ese SKU', 409);
  }

  const idProducto = await productRepository.crear(preparado);

  return productRepository.obtenerPorId(idProducto);
}

async function actualizarProducto(idProducto, datos) {
  const actual = await productRepository.obtenerPorId(idProducto);

  if (!actual) {
    throw crearError('Producto no encontrado', 404);
  }

  const preparado = prepararDatos(datos);

  await validarRelaciones(
    preparado.id_categoria,
    preparado.id_marca
  );

  const existente = await productRepository.obtenerPorSku(preparado.sku);

  if (
    existente &&
    Number(existente.id_producto) !== Number(idProducto)
  ) {
    throw crearError('Ya existe otro producto con ese SKU', 409);
  }

  await productRepository.actualizar(idProducto, preparado);

  return productRepository.obtenerPorId(idProducto);
}

async function desactivarProducto(idProducto) {
  const producto = await productRepository.obtenerPorId(idProducto);

  if (!producto) {
    throw crearError('Producto no encontrado', 404);
  }

  if (!producto.activo) {
    throw crearError('El producto ya está inactivo', 409);
  }

  await productRepository.desactivar(idProducto);

  return {
    id_producto: Number(idProducto),
    message: 'Producto desactivado correctamente'
  };
}

function crearError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  desactivarProducto
};