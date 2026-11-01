const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { inflateSync } = require('node:zlib');

const MAX_BYTES = 2 * 1024 * 1024;
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const invalid = () => Object.assign(new Error('La fotografía debe ser un PNG válido de hasta 512 × 512 píxeles y 2 MB.'), { status: 400 });
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const buffer = Buffer.alloc(data.length + 12);
  buffer.writeUInt32BE(data.length);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);
  buffer.writeUInt32BE(crc32(buffer.subarray(4, -4)), buffer.length - 4);
  return buffer;
}

// Check complete PNG structure, checksums and bounded decoded pixel rows, then strip metadata.
// Browser conversion supplies non-interlaced 8-bit RGB/RGBA; SVG and executable/polyglot files fail.
function validatePhoto(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_BYTES || !buffer.subarray(0, 8).equals(signature)) throw invalid();
  let offset = 8, header, ended = false, idatEnded = false;
  const compressed = [];
  while (offset + 12 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    if (size > MAX_BYTES || offset + size + 12 > buffer.length || ended) throw invalid();
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + size);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(buffer.subarray(offset + 4, offset + 8 + size)) !== buffer.readUInt32BE(offset + 8 + size)) throw invalid();
    if (!header && type !== 'IHDR') throw invalid();
    if (type === 'IHDR') {
      if (header || size !== 13) throw invalid();
      header = Buffer.from(data);
      const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
      if (!width || !height || width > 512 || height > 512 || header[8] !== 8 || ![2, 6].includes(header[9]) || header[10] || header[11] || header[12]) throw invalid();
    } else if (type === 'IDAT') {
      if (idatEnded) throw invalid();
      compressed.push(data);
    } else if (type === 'IEND') {
      if (size !== 0 || !compressed.length) throw invalid();
      ended = true;
    } else {
      if (type[0] === type[0].toUpperCase()) throw invalid();
      if (compressed.length) idatEnded = true;
    }
    offset += size + 12;
  }
  if (!ended || offset !== buffer.length) throw invalid();
  const stride = header.readUInt32BE(0) * (header[9] === 6 ? 4 : 3) + 1;
  const expected = stride * header.readUInt32BE(4);
  try {
    const bytes = Buffer.concat(compressed);
    const decoded = inflateSync(bytes, { maxOutputLength: expected, info: true });
    if (decoded.buffer.length !== expected || decoded.engine.bytesWritten !== bytes.length) throw invalid();
    for (let row = 0; row < expected; row += stride) if (decoded.buffer[row] > 4) throw invalid();
  } catch { throw invalid(); }
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', Buffer.concat(compressed)), chunk('IEND', Buffer.alloc(0))]);
}

function createPhotoStore(root = process.env.PROFILE_PHOTO_DIR || path.resolve(__dirname, '../../private/profile-photos')) {
  const filename = (id) => {
    if (!/^[1-9]\d{0,19}$/.test(String(id))) throw invalid();
    return path.join(root, `${id}.png`);
  };
  return {
    async read(id) {
      try { return await fs.readFile(filename(id)); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async write(id, input) {
      const photo = validatePhoto(input);
      const target = filename(id);
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, photo, { flag: 'wx', mode: 0o600 });
        await fs.rename(temporary, target);
      } finally { await fs.rm(temporary, { force: true }); }
    },
    async remove(id) { await fs.rm(filename(id), { force: true }); },
  };
}
module.exports = { MAX_BYTES, validatePhoto, createPhotoStore };
