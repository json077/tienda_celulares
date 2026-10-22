const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  decimalNumbers: true
});

async function testConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.query('SELECT 1');
    console.log('Conexión a MySQL establecida correctamente.');
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  testConnection
};