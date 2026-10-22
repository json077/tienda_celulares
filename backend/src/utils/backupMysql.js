const { spawn } = require('node:child_process');
const { pipeline, finished } = require('node:stream/promises');

// No registrar texto libre: stderr puede contener SQL, datos, rutas o secretos.
// Solo extraer campos de formato cerrado y categorias conocidas para desarrollo.
function diagnosticoSeguro(stderr, detalles) {
  const sql = /\bERROR\s+(\d{1,5})\s+\(([A-Z0-9]{5})\)/.exec(stderr);
  const linea = /\bat line (\d{1,10})\b/i.exec(stderr);
  const categorias = [
    ['entrada_batch', /batch_readline|initialize batch|input source/i],
    ['opcion_cliente', /unknown (?:option|variable)|unrecognized option/i],
    ['autenticacion_o_privilegios', /access denied|command denied|privilege/i],
    ['conexion', /can.t connect|lost connection|server has gone away/i],
    ['codificacion', /incorrect string value|invalid.*character|ASCII.*appeared/i],
    ['clave_foranea', /foreign key constraint/i],
    ['sintaxis_sql', /SQL syntax/i]
  ];
  const codigosIO = new Set(['ENOENT', 'EACCES', 'EPERM', 'EPIPE', 'ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE']);
  return {
    operacion: detalles.tipo === 'dump' ? 'dump' : 'restore',
    salida: Number.isInteger(detalles.salida) ? detalles.salida : null,
    timeout: detalles.timeout,
    inicio: codigosIO.has(detalles.inicio) ? detalles.inicio : null,
    transferencia: codigosIO.has(detalles.transferencia) ? detalles.transferencia : null,
    codigoMySQL: sql ? Number(sql[1]) : null,
    sqlState: sql ? sql[2] : null,
    lineaSQL: linea ? Number(linea[1]) : null,
    categoria: categorias.find(([, patron]) => patron.test(stderr))?.[0] || 'sin_clasificar',
    stderrLimitado: detalles.stderrLimitado
  };
}

function ejecutable(tipo) {
  const variable = tipo === 'dump' ? 'MYSQLDUMP_PATH' : 'MYSQL_PATH';
  const nombre = tipo === 'dump' ? 'mysqldump' : 'mysql';
  return process.env[variable] || (process.platform === 'win32'
    ? `C:\\Program Files\\MySQL\\MySQL Server 26.7\\bin\\${nombre}.exe`
    : nombre);
}

async function ejecutarProceso(tipo, stream) {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME || !/^\d+$/.test(DB_PORT || '') ||
      Number(DB_PORT) < 1 || Number(DB_PORT) > 65535 || DB_NAME.startsWith('-')) {
    throw new Error('Configuracion MySQL no valida');
  }
  const args = ['--no-defaults', '--no-login-paths', '--protocol=TCP', `--host=${DB_HOST}`,
    `--port=${DB_PORT}`, `--user=${DB_USER}`, '--default-character-set=utf8mb4'];
  if (tipo === 'dump') {
    // skip-lock-tables evita bloqueos al exportar; skip-add-locks omite LOCK/UNLOCK en el SQL.
    args.push('--single-transaction', '--quick', '--skip-lock-tables', '--skip-add-locks', '--no-tablespaces',
      '--set-gtid-purged=OFF', '--hex-blob', DB_NAME);
  } else {
    // binary-mode desactiva comandos del cliente como system/source en entrada no interactiva.
    args.push('--binary-mode=1', `--database=${DB_NAME}`);
  }
  // La clave solo viaja en el entorno privado del hijo, nunca en argv ni stderr HTTP.
  const child = spawn(ejecutable(tipo), args, {
    shell: false, windowsHide: true,
    env: { ...process.env, MYSQL_PWD: DB_PASSWORD || '' },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let stderr = Buffer.alloc(0);
  const detalles = { tipo, salida: null, inicio: null, transferencia: null, timeout: false, stderrLimitado: false };
  child.stderr.on('data', (chunk) => {
    const bytes = Buffer.from(chunk);
    const disponible = 8192 - stderr.length;
    if (bytes.length > disponible) detalles.stderrLimitado = true;
    if (disponible > 0) stderr = Buffer.concat([stderr, bytes.subarray(0, disponible)]);
  });
  const closed = new Promise((resolve, reject) => {
    child.once('error', (error) => {
      detalles.inicio = error.code;
      reject(new Error('No se pudo iniciar la herramienta MySQL'));
    });
    child.once('close', (code) => {
      detalles.salida = code;
      if (code === 0) resolve();
      else reject(new Error('La herramienta MySQL fallo'));
    });
  });
  if (tipo === 'dump') child.stdin.end();
  else child.stdout.resume();
  const timer = setTimeout(() => { detalles.timeout = true; child.kill(); }, 30 * 60 * 1000);
  timer.unref();
  const transfer = pipeline(...(tipo === 'dump' ? [child.stdout, stream] : [stream, child.stdin]));
  try {
    const resultados = await Promise.allSettled([closed, transfer.catch((error) => {
      detalles.transferencia = error.code;
      // EPIPE suele ser consecuencia de que mysql ya esta saliendo por otro error.
      // Esperar close permite recoger el diagnostico original sin matarlo antes.
      if (!['EPIPE', 'ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE'].includes(error.code)) child.kill();
      throw error;
    })]);
    if (resultados.some((resultado) => resultado.status === 'rejected')) {
      throw new Error('Fallo del proceso o de la transferencia');
    }
  } catch {
    child.kill();
    stream.destroy();
    await Promise.allSettled([closed, transfer]);
    if (process.env.NODE_ENV !== 'production') {
      console.error('Diagnostico MySQL de respaldos:', diagnosticoSeguro(stderr.toString('utf8'), detalles));
    }
    throw new Error('No se pudo completar la operacion MySQL');
  } finally {
    clearTimeout(timer);
  }
}

async function ejecutar(tipo, stream) {
  const terminado = finished(stream).catch(() => {});
  try {
    await ejecutarProceso(tipo, stream);
  } finally {
    stream.destroy();
    await terminado;
  }
}

module.exports = { ejecutar };
