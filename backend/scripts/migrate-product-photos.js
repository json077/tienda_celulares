// Explicit, additive migration only. No automatic schema changes at startup.
require('dotenv').config({ quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../src/config/database');

async function main() {
  const expected = process.argv[process.argv.indexOf('--database') + 1];
  if (!process.argv.includes('--database') || !expected || expected.startsWith('--')) throw new Error('Indica --database NOMBRE para verificar la base configurada.');
  const connection = await pool.getConnection();
  try {
    const [[{ database }]] = await connection.query('SELECT DATABASE() AS `database`');
    if (database !== expected) throw new Error('La base activa no coincide con --database. No se aplicó ningún cambio.');
    const [columns] = await connection.query('SHOW COLUMNS FROM productos');
    if (!columns.some(c => c.Field === 'id_producto') || !columns.some(c => c.Field === 'sku')) throw new Error('La estructura de productos no es la esperada.');
    const existing = columns.find(c => c.Field === 'imagen_ruta');
    if (existing) {
      if (existing.Type !== 'varchar(255)' || existing.Null !== 'YES' || existing.Default !== null) throw new Error('imagen_ruta existe con una definición diferente. Requiere revisión manual.');
      console.log('Migración ya aplicada: imagen_ruta VARCHAR(255) NULL DEFAULT NULL.');
      return;
    }
    if (!process.argv.includes('--apply')) { console.log('Verificado: falta imagen_ruta. Para aplicar, añade --apply.'); return; }
    const sql = await fs.readFile(path.resolve(__dirname, '../../database/migrations/03_product_photos.sql'), 'utf8');
    await connection.query(sql);
    const [verified] = await connection.query("SHOW COLUMNS FROM productos LIKE 'imagen_ruta'");
    if (verified[0]?.Type !== 'varchar(255)' || verified[0]?.Null !== 'YES') throw new Error('Revisa la estructura después de la migración.');
    console.log('Migración aplicada y verificada. Solo se añadió imagen_ruta; no se actualizaron productos.');
  } finally { connection.release(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
