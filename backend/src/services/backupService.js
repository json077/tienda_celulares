const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const repository = require('../repositories/backupRepository');
const mysql = require('../utils/backupMysql');

const DIRECTORIO = path.resolve(__dirname, '../../private/respaldos');
let ocupado = false;

function errorControlado(status, message) {
  return Object.assign(new Error(message), { status, backupControlado: true });
}

function validarId(id) {
  const valor = String(id);
  if (!/^[1-9]\d{0,19}$/.test(valor) || BigInt(valor) > 18446744073709551615n) {
    throw errorControlado(400, 'El ID debe ser un entero positivo valido');
  }
  return valor;
}

function metadatos(registro) {
  const { ruta_archivo, ...datos } = registro;
  return datos;
}

async function exclusivo(accion) {
  if (ocupado) throw errorControlado(409, 'Hay una operacion de respaldo o restauracion en curso');
  ocupado = true;
  try { return await accion(); } finally { ocupado = false; }
}

async function obtenerRegistro(id) {
  const registro = await repository.obtenerPorId(validarId(id));
  if (!registro) throw errorControlado(404, 'Respaldo no encontrado');
  return registro;
}

async function abrirArchivo(registro) {
  let handle;
  try {
    // Solo nombres simples SQL; se rechazan rutas relativas, absolutas y enlaces.
    if (!/^[a-zA-Z0-9_-]+\.sql$/.test(registro.nombre_archivo) ||
        registro.ruta_archivo !== registro.nombre_archivo) {
      throw errorControlado(400, 'Ruta de respaldo no permitida');
    }
    const raiz = await fsp.realpath(DIRECTORIO);
    if (raiz !== DIRECTORIO) throw errorControlado(400, 'Directorio de respaldos no permitido');
    const archivo = path.resolve(raiz, registro.ruta_archivo);
    const info = await fsp.lstat(archivo);
    if (info.isSymbolicLink() || !info.isFile() ||
        path.dirname(await fsp.realpath(archivo)) !== raiz) {
      throw errorControlado(400, 'Archivo de respaldo no permitido');
    }
    handle = await fsp.open(archivo, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const abierto = await handle.stat();
    if (!abierto.isFile() || abierto.size === 0 || abierto.ino !== info.ino || abierto.dev !== info.dev) {
      throw errorControlado(400, 'Archivo de respaldo no valido');
    }
    return { handle, size: abierto.size };
  } catch (error) {
    if (handle) await handle.close();
    if (error.code === 'ENOENT') throw errorControlado(404, 'Archivo de respaldo no encontrado');
    throw error;
  }
}

async function listarRespaldos() {
  return (await repository.obtenerTodas()).map(metadatos);
}

async function crearRespaldo(idUsuario) {
  validarId(idUsuario);
  return exclusivo(async () => {
    await fsp.mkdir(DIRECTORIO, { recursive: true });
    if (await fsp.realpath(DIRECTORIO) !== DIRECTORIO) {
      throw errorControlado(400, 'Directorio de respaldos no permitido');
    }
    const nombre = `respaldo_${Date.now()}_${randomUUID()}.sql`;
    const archivo = path.join(DIRECTORIO, nombre);
    let creado = false;
    try {
      const handle = await fsp.open(archivo, 'wx');
      creado = true;
      await mysql.ejecutar('dump', handle.createWriteStream());
      const info = await fsp.stat(archivo);
      if (!info.isFile() || info.size === 0) throw new Error('Respaldo vacio');
      return metadatos(await repository.crear({ id_usuario: idUsuario,
        nombre_archivo: nombre, ruta_archivo: nombre, tamano_bytes: info.size }));
    } catch {
      if (creado) await fsp.unlink(archivo).catch(() => {});
      throw errorControlado(500, 'No se pudo crear el respaldo');
    }
  });
}

async function restaurarRespaldo(id) {
  return exclusivo(async () => {
    const registro = await obtenerRegistro(id);
    const { handle } = await abrirArchivo(registro);
    try {
      await mysql.ejecutar('restore', handle.createReadStream());
    } catch {
      throw errorControlado(500, 'La restauracion fallo; la base puede haber quedado parcialmente restaurada');
    } finally {
      await handle.close();
    }
    try {
      return metadatos(await repository.registrarRestauracion(registro));
    } catch {
      throw errorControlado(500, 'MySQL termino la restauracion, pero no se pudo registrar el resultado');
    }
  });
}

async function descargarRespaldo(id) {
  const registro = await obtenerRegistro(id);
  const { handle, size } = await abrirArchivo(registro);
  return { nombre: registro.nombre_archivo, size, stream: handle.createReadStream() };
}

module.exports = { listarRespaldos, crearRespaldo, restaurarRespaldo, descargarRespaldo, validarId };
