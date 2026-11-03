const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { readSettings, provisionRoot } = require('../src/utils/createRootUser');
const root = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(path.join(root, 'database/init/01_schema.sql'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'database/init/02_catalogs.sql'), 'utf8');
const tables = new Map([...schema.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\) ENGINE[^;]+;/g)]
  .map(m => [m[1], { body: m[2], ddl: m[0], columns: new Set([...m[2].matchAll(/^  `([^`]+)`/gm)].map(c => c[1])) }]));

test('esquema nuevo: 41 tablas, orden FK, claves únicas estándar y ausencia de datos privados', () => {
  assert.equal(tables.size, 41);
  assert.equal([...schema.matchAll(/CREATE TABLE /g)].length, tables.size);
  assert.doesNotMatch(schema, /\b(?:USE|CREATE DATABASE|DROP|ALTER|TRUNCATE|INSERT INTO|FOREIGN_KEY_CHECKS|DEFINER)\b|AUTO_INCREMENT=\d+/i);
  const created = new Set();
  const constraints = new Set();
  for (const [name, table] of tables) {
    assert.ok(table.body.includes('PRIMARY KEY'), name);
    assert.match(table.ddl, /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;/);
    const columns = [...table.body.matchAll(/^  `([^`]+)`/gm)].map(m => m[1]);
    assert.equal(columns.length, table.columns.size, `Columnas duplicadas: ${name}`);
    for (const [, constraint] of table.body.matchAll(/CONSTRAINT `([^`]+)`/g)) {
      assert.ok(!constraints.has(constraint), `Restricción duplicada: ${constraint}`);
      constraints.add(constraint);
    }
    for (const [, child, parent, reference] of table.body.matchAll(/FOREIGN KEY \(([^)]+)\) REFERENCES `([^`]+)` \(([^)]+)\)/g)) {
      assert.ok(parent === name || created.has(parent), `${name} depende de ${parent}`);
      const parentKeys = [...tables.get(parent).body.matchAll(/(?:PRIMARY KEY|UNIQUE KEY `[^`]+`) \(([^)]+)\)/g)].map(m => m[1]);
      assert.ok(parentKeys.includes(reference), `FK no estándar: ${name} -> ${parent} (${reference})`);
      for (const col of child.matchAll(/`([^`]+)`/g)) assert.ok(table.columns.has(col[1]));
    }
    created.add(name);
  }
  assert.equal([...tables.get('productos').body.matchAll(/`imagen_ruta`/g)].length, 1);
});

test('catálogos: todos los guards actuales, sin datos comerciales ni usuarios', () => {
  const codes = new Set([...seed.matchAll(/^  \('([A-Z_]+)',/gm)].map(m => m[1]));
  for (const file of fs.readdirSync(path.join(root, 'backend/src/routes')).filter(f => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(root, 'backend/src/routes', file), 'utf8');
    for (const [, code] of source.matchAll(/verificarPermiso\(\s*'([A-Z_]+)'\s*\)/g)) assert.ok(codes.has(code), `${file}: ${code}`);
  }
  const allowed = new Set(['roles', 'permisos', 'rol_permisos', 'monedas', 'sucursales', 'cajas', 'categorias']);
  for (const [, table] of seed.matchAll(/INSERT INTO (\w+)/g)) assert.ok(allowed.has(table), table);
  assert.doesNotMatch(seed.replace(/^--.*$/gm, ''), /\b(?:UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE|USE)\b|INSERT IGNORE|ON DUPLICATE KEY/i);
  assert.match(seed, /'NIO'/); assert.match(seed, /'USD'/); assert.match(seed, /'SUC-001'/);
  assert.match(seed, /START TRANSACTION;/); assert.match(seed, /COMMIT;/);
});

test('compatibilidad estática: columnas referenciadas en consultas literales de repositorios', t => {
  let checked = 0;
  for (const file of fs.readdirSync(path.join(root, 'backend/src/repositories')).filter(f => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(root, 'backend/src/repositories', file), 'utf8');
    for (const [, sql] of source.matchAll(/`([^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*)`/g)) {
      if (sql.includes('${')) continue; // Dynamic SQL requires isolated MySQL execution.
      const aliases = new Map();
      for (const [, table, alias] of sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_]+)(?:\s+(?:AS\s+)?([a-z_]+))?/gi)) {
        if (!tables.has(table)) continue;
        aliases.set(table, table);
        if (alias && !/^(WHERE|SET|ORDER|GROUP|INNER|LEFT|RIGHT|ON|FOR|LIMIT|VALUES)$/i.test(alias)) aliases.set(alias, table);
      }
      for (const [, alias, col] of sql.matchAll(/\b([a-z_]+)\.([a-z_]+)\b/gi)) {
        if (!aliases.has(alias)) continue;
        checked++;
        assert.ok(tables.get(aliases.get(alias)).columns.has(col), `${file}: ${alias}.${col}`);
      }
      for (const [, table, columns] of sql.matchAll(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/gi)) {
        if (!tables.has(table)) continue;
        for (const col of columns.split(',').map(c => c.trim())) {
          checked++;
          assert.ok(tables.get(table).columns.has(col), `${file}: INSERT ${table}.${col}`);
        }
      }
    }
  }
  assert.ok(checked > 1000);
  t.diagnostic(`${checked} referencias; análisis parcial, no reemplaza ejecutar SQL en MySQL 8.4 aislado.`);
});

const environment = () => ({ DB_NAME: 'tienda_prueba_nueva', ROOT_USERNAME: 'admin_inicial',
  ROOT_EMAIL: 'admin@example.invalid', ROOT_PASSWORD: randomBytes(24).toString('hex') });
const args = ['--provision-new', '--database', 'tienda_prueba_nueva'];

test('ROOT: validación antes de conectar, protección de base activa y límites bcrypt', () => {
  const env = environment();
  assert.equal(readSettings(env, args).branch, 'SUC-001');
  for (const [input, cli] of [
    [env, []], [env, ['--database', env.DB_NAME]],
    [{ ...env, DB_NAME: 'otra' }, args],
    [{ ...env, DB_NAME: 'tienda_celulares' }, ['--provision-new', '--database', 'tienda_celulares']],
    [{ ...env, DB_NAME: 'TIENDA_CELULARES' }, ['--provision-new', '--database', 'TIENDA_CELULARES']],
    [{ ...env, ROOT_PASSWORD: undefined }, args], [{ ...env, ROOT_PASSWORD: 'x'.repeat(11) }, args],
    [{ ...env, ROOT_PASSWORD: 'é'.repeat(37) }, args], [{ ...env, ROOT_PASSWORD: `${env.ROOT_PASSWORD}\0` }, args],
    [{ ...env, ROOT_EMAIL: 'inválido' }, args], [{ ...env, ROOT_BRANCH_CODE: '../otra' }, args],
  ]) assert.throws(() => readSettings(input, cli));
});

function fakePool({ users = 0, target = 'tienda_prueba_nueva', roles = [{ id_rol: 2 }], branches = [{ id_sucursal: 3 }], failInsert = false } = {}) {
  const calls = [];
  const connection = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT DATABASE')) return [[{ database_name: target }]];
      if (sql.startsWith('SELECT COUNT')) return [[{ total: users }]];
      if (sql.includes('FROM roles')) return [roles];
      if (sql.includes('FROM sucursales')) return [branches];
      if (failInsert && sql.includes('INSERT INTO usuario_roles')) throw new Error('Fallo simulado');
      return [{ insertId: 7 }];
    },
    async beginTransaction() { calls.push('begin'); }, async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); }, release() { calls.push('release'); },
  };
  return { calls, async getConnection() { return connection; } };
}

test('ROOT: inserción atómica, hash y sucursal, sin contraseña en SQL', async () => {
  const env = environment(); const settings = readSettings(env, args); const pool = fakePool();
  await provisionRoot(pool, settings, async (password, rounds) => {
    assert.equal(password, env.ROOT_PASSWORD); assert.equal(rounds, 12); return 'HASH_SIMULADO';
  });
  assert.ok(pool.calls.includes('commit')); assert.ok(!pool.calls.includes('rollback'));
  assert.equal(pool.calls.filter(c => c.sql?.startsWith('INSERT')).length, 3);
  assert.ok(!JSON.stringify(pool.calls).includes(env.ROOT_PASSWORD));
  assert.equal(pool.calls.at(-1), 'release');
});

test('ROOT: base equivocada, usuarios existentes o catálogos ausentes no se modifican; fallo revierte', async () => {
  for (const option of [{ target: 'tienda_celulares' }, { users: 1 }, { roles: [] }, { branches: [] }, { failInsert: true }]) {
    const pool = fakePool(option);
    await assert.rejects(provisionRoot(pool, readSettings(environment(), args), async () => 'HASH_SIMULADO'));
    assert.ok(!pool.calls.includes('commit'));
    if (!option.failInsert) assert.equal(pool.calls.filter(c => c.sql?.startsWith('INSERT')).length, 0);
    if (!option.target) assert.ok(pool.calls.includes('rollback'));
    assert.equal(pool.calls.at(-1), 'release');
  }
});

test('opcional solo lectura: esquema completo coincide con metadatos activos', { skip: process.env.INITIAL_SCHEMA_READONLY !== '1' }, async t => {
  require('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
  const connection = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, connectTimeout: 6000 });
  t.after(async () => { await connection.rollback(); await connection.end(); });
  await connection.query('START TRANSACTION READ ONLY');
  const [existing] = await connection.query("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'");
  assert.deepEqual(existing.map(r => r.TABLE_NAME).sort(), [...tables.keys()].sort());
  for (const [table, definition] of tables) {
    const [[actual]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    assert.equal(actual['Create Table'].replace(/\) ENGINE=InnoDB AUTO_INCREMENT=\d+/, ') ENGINE=InnoDB') + ';', definition.ddl, table);
  }
});
