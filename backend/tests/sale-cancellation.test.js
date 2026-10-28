const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// No se carga config/database ni se abre ninguna conexión MySQL.
function cargar(archivo, dependencia, sustituto) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', archivo), 'utf8'), {
    module,
    require(nombre) {
      assert.equal(nombre, dependencia);
      return sustituto;
    },
    console,
  });
  return module.exports;
}

const repositorio = cargar('repositories/saleRepository.js', '../config/database', { pool: {} });

function fixture({ tipo = 'CANTIDAD', devoluciones = [], stock = 8, fallo } = {}) {
  let estado = {
    stock, venta: 'CONFIRMADA', factura: 'EMITIDA', unidad: 'VENDIDO', movimientos: [],
  };
  let anterior;
  const eventos = [];
  const connection = {
    async beginTransaction() { eventos.push('begin'); anterior = structuredClone(estado); },
    async commit() { eventos.push('commit'); },
    async rollback() { eventos.push('rollback'); estado = anterior; },
    release() { eventos.push('release'); },
    async query(sql, parametros) {
      eventos.push('devoluciones');
      assert.match(sql, /WHERE id_venta = \? AND estado = 'CONFIRMADA'/);
      assert.match(sql, /LIMIT 1 FOR UPDATE/);
      assert.deepEqual(Array.from(parametros), [1]);
      if (fallo === 'consulta') throw new Error('fallo consulta');
      return [devoluciones.filter(d => d.estado === 'CONFIRMADA')];
    },
  };
  const detalle = { id_detalle_venta: 2, id_producto: 3, producto: 'Producto',
    tipo_control: tipo, cantidad: tipo === 'CANTIDAD' ? 2 : 1 };
  const repo = {
    pool: { getConnection: async () => connection },
    obtenerVentaParaActualizar: async c => {
      assert.equal(c, connection);
      eventos.push('venta bloqueada');
      return { id_venta: 1, id_sucursal: 4, numero_venta: 'V1', estado: estado.venta };
    },
    tieneDevolucionesConfirmadas: repositorio.tieneDevolucionesConfirmadas,
    obtenerTotalPagosAplicados: async () => { eventos.push('pagos'); return 0; },
    obtenerDetallesParaConfirmar: async () => [detalle],
    obtenerStock: async () => ({ stock_actual: estado.stock }),
    actualizarStock: async (_, sucursal, producto, nuevo) => { estado.stock = nuevo; },
    registrarMovimientoAnulacion: async (_, movimiento) => {
      estado.movimientos.push(movimiento);
      if (fallo === 'movimiento') throw new Error('fallo movimiento');
    },
    obtenerUnidadesParaAnular: async () => [{ id_unidad: 5, id_producto: 3,
      id_sucursal_actual: 4, estado: estado.unidad }],
    marcarUnidadDisponible: async () => { estado.unidad = 'DISPONIBLE'; return 1; },
    anularFactura: async () => { estado.factura = 'ANULADA'; },
    anularVenta: async () => {
      estado.venta = 'ANULADA';
      if (fallo === 'venta') throw new Error('fallo venta');
      return 1;
    },
    obtenerPorId: async () => ({ id_venta: 1, estado: estado.venta }),
    obtenerDetalles: async () => [detalle],
  };
  const servicio = cargar('services/saleService.js', '../repositories/saleRepository', repo);
  return { anular: () => servicio.anularVenta(1, 7), estado: () => estado, eventos };
}

for (const tipo of ['CANTIDAD', 'SERIALIZADO']) {
  test(`sin devoluciones: anula y reintegra una sola vez (${tipo})`, async () => {
    const f = fixture({ tipo });
    await f.anular();
    assert.equal(f.estado().stock, tipo === 'CANTIDAD' ? 10 : 9);
    assert.equal(f.estado().venta, 'ANULADA');
    assert.equal(f.estado().factura, 'ANULADA');
    assert.equal(f.estado().movimientos.length, 1);
    if (tipo === 'SERIALIZADO') assert.equal(f.estado().unidad, 'DISPONIBLE');
    assert.deepEqual(f.eventos.slice(0, 4), ['begin', 'venta bloqueada', 'devoluciones', 'pagos']);
    const despues = structuredClone(f.estado());
    await assert.rejects(f.anular(), e => e.statusCode === 400);
    assert.deepEqual(f.estado(), despues);
    assert.equal(f.eventos.filter(e => e === 'commit').length, 1);
  });

  for (const cantidad of tipo === 'CANTIDAD' ? [1, 2] : [1]) {
    test(`rechaza devolución confirmada ${tipo === 'CANTIDAD' && cantidad === 1 ? 'parcial' : 'total'} (${tipo})`, async () => {
      const f = fixture({ tipo, stock: 8 + cantidad,
        devoluciones: [{ estado: 'CONFIRMADA', cantidad }] });
      const antes = structuredClone(f.estado());
      await assert.rejects(f.anular(), e => e.statusCode === 409 && /devoluciones CONFIRMADAS/.test(e.message));
      assert.deepEqual(f.estado(), antes);
      assert.deepEqual(f.eventos, ['begin', 'venta bloqueada', 'devoluciones', 'rollback', 'release']);
    });
  }

  for (const fallo of ['movimiento', 'venta']) {
    test(`rollback restaura stock, movimientos, unidad, venta y factura: ${fallo} (${tipo})`, async () => {
      const f = fixture({ tipo, fallo });
      const antes = structuredClone(f.estado());
      await assert.rejects(f.anular(), new RegExp(`fallo ${fallo}`));
      assert.deepEqual(f.estado(), antes);
      assert.ok(!f.eventos.includes('commit'));
      assert.deepEqual(f.eventos.slice(-2), ['rollback', 'release']);
    });
  }
}

for (const estado of ['BORRADOR', 'ANULADA']) {
  test(`devolución ${estado} permite anulación`, async () => {
    const f = fixture({ devoluciones: [{ estado }] });
    await f.anular();
    assert.equal(f.estado().stock, 10);
    assert.equal(f.estado().venta, 'ANULADA');
  });
}

test('devolución confirmada sin reintegro también bloquea la anulación', async () => {
  const f = fixture({ devoluciones: [{ estado: 'CONFIRMADA', reintegra_inventario: 0 }] });
  await assert.rejects(f.anular(), e => e.statusCode === 409);
  assert.equal(f.estado().stock, 8);
});

test('fallo de consulta no permite reintegro y revierte la transacción', async () => {
  const f = fixture({ fallo: 'consulta' });
  await assert.rejects(f.anular(), /fallo consulta/);
  assert.equal(f.estado().stock, 8);
  assert.deepEqual(f.eventos.slice(-2), ['rollback', 'release']);
});
