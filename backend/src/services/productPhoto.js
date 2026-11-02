const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const TYPES = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const invalid = () => fail('Imagen inválida. Usa JPG, PNG o WebP de hasta 2 MB y 4096 × 4096 píxeles.');

async function normalizePhoto(input, mime) {
  if (!TYPES[mime]) throw fail('Usa JPG, PNG o WebP.', 415);
  if (!Buffer.isBuffer(input) || !input.length) throw invalid();
  if (input.length > MAX_BYTES) throw fail('La fotografía supera el máximo de 2 MB.', 413);
  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: MAX_DIMENSION ** 2 });
    const info = await image.metadata();
    if (info.format !== TYPES[mime] || !info.width || !info.height ||
        info.width > MAX_DIMENSION || info.height > MAX_DIMENSION || (info.pages || 1) > 1) throw invalid();
    // Fully decode and re-encode; discard original metadata and any appended payload.
    const output = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).timeout({ seconds: 10 }).toBuffer();
    if (output.length > MAX_BYTES) throw invalid();
    return output;
  } catch (error) {
    if (error.status) throw error;
    throw invalid();
  }
}

const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
function createProductPhotoStore(directory = process.env.PRODUCT_PHOTO_DIR || path.join(os.homedir(), '.tienda-celulares', 'product-photos')) {
  const root = path.resolve(directory);
  const repository = path.resolve(__dirname, '../../..');
  const filename = (reference) => {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(reference || '')) throw fail('Referencia de fotografía inválida.');
    return path.join(root, reference);
  };
  async function checkRoot(create = false) {
    if (inside(repository, root)) throw fail('Configura PRODUCT_PHOTO_DIR fuera del repositorio y de directorios públicos.', 500);
    if (create) await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const real = await fs.realpath(root);
    if (inside(await fs.realpath(repository), real)) throw fail('Directorio de fotografías no permitido.', 500);
  }
  return {
    async write(bytes) {
      await checkRoot(true);
      const reference = `${randomUUID()}.webp`;
      try { await fs.writeFile(filename(reference), bytes, { flag: 'wx', mode: 0o600 }); }
      catch (error) {
        if (error.code !== 'EEXIST') await fs.rm(filename(reference), { force: true }).catch(() => {});
        throw error;
      }
      return reference;
    },
    async read(reference) {
      const target = filename(reference);
      try {
        await checkRoot();
        const stat = await fs.lstat(target);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) throw fail('Fotografía no disponible.', 404);
        return await fs.readFile(target);
      } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async remove(reference) {
      const target = filename(reference);
      try { await checkRoot(); await fs.unlink(target); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    },
  };
}

function createProductPhotoService(repository, photos = createProductPhotoStore()) {
  // Old files are unreferenced only after a successful DB commit. Cleanup failure
  // must never turn a committed replacement into an apparent failed upload.
  const cleanup = async (reference) => {
    if (reference) await photos.remove(reference).catch(() => console.error('No se pudo limpiar una fotografía de producto no referenciada.'));
  };
  return {
    async read(id) {
      const product = await repository.obtenerFoto(id);
      if (!product) throw fail('Producto no encontrado.', 404);
      if (!product.imagen_ruta) return null;
      return photos.read(product.imagen_ruta);
    },
    async replace(id, input, mime) {
      const bytes = await normalizePhoto(input, mime);
      const reference = await photos.write(bytes);
      let previous;
      try { previous = await repository.cambiarFoto(id, reference); }
      catch (error) { await cleanup(reference); throw error; }
      await cleanup(previous);
    },
    async remove(id) {
      const previous = await repository.cambiarFoto(id, null);
      await cleanup(previous);
    },
  };
}
module.exports = { MAX_BYTES, MAX_DIMENSION, normalizePhoto, createProductPhotoStore, createProductPhotoService };
