const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { gzipSync, deflateSync, brotliCompressSync } = require('node:zlib');
const express = require('express');
const { body, validationResult } = require('express-validator');

// Aplicación aislada: no importa el servidor comercial ni módulos de MySQL.
test('regresión de parsers y validación de Express', async (t) => {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.use(express.urlencoded({ extended: true, limit: '1kb' }));
  app.post('/json', body('cantidad').isInt({ min: 1 }), (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    res.json(req.body);
  });
  app.post('/form', (req, res) => res.json(req.body));
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ type: err.type || 'internal' });
  });
  const server = http.createServer(app);
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  function request(payload, headers = {}, path = '/json') {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: server.address().port, path, method: 'POST',
        agent: false,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers },
      }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('error', reject);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
          catch (err) { reject(err); }
        });
      });
      req.setTimeout(3000, () => req.destroy(new Error('Tiempo de espera local agotado')));
      req.on('error', reject);
      req.end(payload);
    });
  }
  const json = JSON.stringify({ cantidad: 2, nombre: 'Teléfono' });
  await t.test('JSON válido', async () => {
    assert.deepEqual(await request(json), { status: 200, body: JSON.parse(json) });
  });
  await t.test('errores de validación estructurados', async () => {
    const result = await request('{"cantidad":0}');
    assert.equal(result.status, 422);
    assert.equal(result.body.errors[0].path, 'cantidad');
  });
  await t.test('JSON malformado devuelve 400 y permite otra solicitud', async () => {
    assert.deepEqual(await request('{'), { status: 400, body: { type: 'entity.parse.failed' } });
    assert.equal((await request(json)).status, 200);
  });
  for (const [encoding, compress] of [['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]]) {
    await t.test(`JSON comprimido con ${encoding}`, async () => {
      assert.deepEqual(await request(compress(Buffer.from(json)), { 'content-encoding': encoding }),
        { status: 200, body: JSON.parse(json) });
    });
  }
  await t.test('gzip inválido se rechaza sin detener el servidor', async () => {
    assert.equal((await request(Buffer.from('gzip inválido'), { 'content-encoding': 'gzip' })).status, 400);
    assert.equal((await request(json)).status, 200);
  });
  await t.test('bytes sobrantes tras gzip no provocan caída', async () => {
    const payload = Buffer.concat([gzipSync(Buffer.from(json)), Buffer.from('invalid trailing bytes')]);
    assert.equal((await request(payload, { 'content-encoding': 'gzip' })).status, 400);
    assert.equal((await request(json)).status, 200);
  });
  await t.test('límite sobre contenido descomprimido', async () => {
    const payload = gzipSync(Buffer.from(JSON.stringify({ cantidad: 1, texto: 'x'.repeat(2048) })));
    const result = await request(payload, { 'content-encoding': 'gzip' });
    assert.equal(result.status, 413);
    assert.equal(result.body.type, 'entity.too.large');
  });
  await t.test('formulario anidado procesado por qs', async () => {
    assert.deepEqual(await request('producto[nombre]=Cable&producto[cantidad]=2',
      { 'content-type': 'application/x-www-form-urlencoded' }, '/form'),
    { status: 200, body: { producto: { nombre: 'Cable', cantidad: '2' } } });
  });
});
