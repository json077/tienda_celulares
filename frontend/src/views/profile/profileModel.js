const bytes = (value) => new TextEncoder().encode(value).length
export function validatePassword(values) {
  if (!values.actual || bytes(values.actual) > 72 || values.actual.includes('\0'))
    return 'Introduce tu contraseña actual (hasta 72 bytes).'
  if ([...values.nueva].length < 12 || bytes(values.nueva) > 72 || values.nueva.includes('\0'))
    return 'La nueva contraseña debe tener al menos 12 caracteres y hasta 72 bytes, sin caracteres nulos.'
  if (values.nueva !== values.confirmacion)
    return 'La confirmación no coincide con la nueva contraseña.'
  if (values.actual === values.nueva) return 'La nueva contraseña debe ser diferente de la actual.'
  return ''
}
export function photoDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) &&
    bytes.length >= 24
  ) {
    return [view.getUint32(16), view.getUint32(20)]
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 0xff) break
      while (bytes[offset] === 0xff) offset++
      const type = bytes[offset++]
      if (type === 0xda || type === 0xd9) break
      if (type === 0x01 || (type >= 0xd0 && type <= 0xd7)) continue
      if (offset + 2 > bytes.length) break
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) break
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          type,
        ) &&
        length >= 7
      ) {
        return [view.getUint16(offset + 5), view.getUint16(offset + 3)]
      }
      offset += length
    }
  }
  throw new Error('Selecciona una fotografía JPEG o PNG válida.')
}
export async function preparePhoto(file) {
  if (
    !file ||
    !['image/jpeg', 'image/png'].includes(file.type) ||
    !file.size ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Selecciona una fotografía JPEG o PNG de hasta 5 MB.')
  const dimensions = photoDimensions(new Uint8Array(await file.arrayBuffer()))
  if (
    dimensions.some((value) => !value || value > 8192) ||
    dimensions[0] * dimensions[1] > 16000000
  )
    throw new Error('La fotografía admite hasta 16 megapíxeles y 8192 píxeles por lado.')
  let image
  try {
    image = await createImageBitmap(file)
  } catch {
    throw new Error('No se pudo leer la fotografía. Elige otro archivo JPEG o PNG.')
  }
  try {
    const scale = Math.min(1, 512 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob || blob.size > 2 * 1024 * 1024)
      throw new Error('No se pudo preparar la fotografía. Prueba con una imagen más pequeña.')
    return blob
  } finally {
    image.close()
  }
}
