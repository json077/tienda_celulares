// Check both the HTTP listener and its database without loading .env.
const http = require('node:http');
const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, connectTimeout: 3000,
  });
  try { await connection.query('SELECT 1'); } finally { await connection.end(); }
  await new Promise((resolve, reject) => {
    const req = http.get('http://127.0.0.1:3000/api/health', (res) => {
      res.resume();
      res.statusCode === 200 ? resolve() : reject(new Error('HTTP unavailable'));
    });
    req.setTimeout(3000, () => req.destroy(new Error('HTTP timeout')));
    req.on('error', reject);
  });
}
check().catch(() => { process.exitCode = 1; });
