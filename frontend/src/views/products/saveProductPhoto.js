// Separate persistence steps: a failed photo upload must never repeat creation.
export async function saveProductWithPhoto({
  products,
  photos,
  product,
  values,
  change,
  photoOnly,
  onPersisted,
}) {
  const response = photoOnly
    ? { data: product, message: 'Producto guardado.' }
    : product
      ? await products.update(product.id_producto, values)
      : await products.create(values)
  const saved = response.data
  onPersisted(saved)
  try {
    if (change?.action === 'upload') await photos.upload(saved.id_producto, change.file)
    else if (change?.action === 'remove') await photos.remove(saved.id_producto)
  } catch (error) {
    throw Object.assign(
      new Error(
        `El producto ya se guardó, pero falló la fotografía: ${error.message} Puedes reintentar sin crear otro producto.`,
      ),
      { photoPending: true },
    )
  }
  return response
}
