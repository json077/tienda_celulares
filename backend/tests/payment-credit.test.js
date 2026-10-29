const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Solo dependencias simuladas: no se carga database ni se conecta a MySQL.
function cargar(archivo, dependencias) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', archivo), 'utf8'), {
    module, console: { error() {} },
    require(nombre) {
      assert.ok(Object.hasOwn(dependencias, nombre), nombre);
      return dependencias[nombre];
    },
  });
  return module.exports;
}
const creditSQL = cargar('repositories/creditRepository.js', { '../config/database': { pool: {} } });
const paymentSQL = cargar('repositories/paymentRepository.js', { '../config/database': { pool: {} } });
const datos = { id_venta: 1, id_moneda: 1, monto: 20, metodo: 'EFECTIVO', id_sesion_caja: 1 };
const plan = { id_venta: 1, tasa_interes: 0, numero_cuotas: 1,
  frecuencia: 'MENSUAL', fecha_inicio: '2026-10-28' };

function fixture({ credito = null, tipo = 'CONTADO', fallo, pausa } = {}) {
  let estado = { pagos: [], caja: [], credito, cuotas: [], aplicaciones: [] };
  const eventos = [];
  let cola = Promise.resolve();
  let numero = 0;
  const pool = { async getConnection() {
    const nombre = ++numero;
    let liberar;
    let snapshot;
    return {
      async beginTransaction() { eventos.push([nombre, 'begin']); },
      async query(sql, params) {
        assert.deepEqual(Array.from(params), [1]);
        if (/FROM ventas v/.test(sql)) {
          assert.match(sql, /FOR UPDATE/);
          const anterior = cola;
          cola = new Promise(resolve => { liberar = resolve; });
          eventos.push([nombre, 'espera venta']);
          await anterior;
          snapshot = structuredClone(estado);
          eventos.push([nombre, 'venta bloqueada']);
          if (pausa) await pausa(nombre);
          return [[{ id_venta: 1, id_cliente: 1, id_sucursal: 1,
            numero_venta: 'V1', estado: 'CONFIRMADA', tipo_venta: tipo, total: 100 }]];
        }
        assert.match(sql, /FROM creditos/);
        assert.match(sql, /FOR UPDATE/);
        assert.doesNotMatch(sql, /estado\s*=/);
        assert.ok(snapshot, 'primero debe bloquear la venta');
        eventos.push([nombre, 'consulta credito']);
        if (fallo === 'consulta') throw new Error('fallo consulta');
        return [estado.credito ? [structuredClone(estado.credito)] : []];
      },
      async commit() { eventos.push([nombre, 'commit']); liberar?.(); liberar = null; },
      async rollback() {
        eventos.push([nombre, 'rollback']);
        if (snapshot) estado = snapshot;
        liberar?.(); liberar = null;
      },
      release() { eventos.push([nombre, 'release']); },
    };
  } };
  const paymentRepo = {
    pool, obtenerVentaParaPago: paymentSQL.obtenerVentaParaPago,
    obtenerMoneda: async () => ({ codigo: 'NIO', activo: 1 }),
    obtenerTotalPagado: async () => estado.pagos.reduce((s, p) => s + p.monto_base, 0),
    obtenerSesionCaja: async () => ({ estado: 'ABIERTA', caja_activa: 1, id_sucursal: 1 }),
    crearPago: async (_, pago) => { estado.pagos.push(pago); return estado.pagos.length; },
    registrarMovimientoCaja: async (_, movimiento) => {
      estado.caja.push(movimiento);
      if (fallo === 'caja') throw new Error('fallo caja');
    },
    obtenerPagoPorId: async id => estado.pagos[id - 1],
  };
  const creditRepo = {
    pool, obtenerVentaParaCredito: creditSQL.obtenerVentaParaCredito,
    obtenerCreditoPorVenta: creditSQL.obtenerCreditoPorVenta,
    obtenerTotalPagadoVenta: paymentRepo.obtenerTotalPagado,
    crearCredito: async (_, credito) => {
      estado.credito = { ...credito, id_credito: 1, estado: 'ACTIVO' }; return 1;
    },
    crearCuota: async (_, cuota) => { estado.cuotas.push({ ...cuota, id_cuota: 1,
      monto_pagado: 0, saldo_cuota: cuota.monto_cuota, estado: 'PENDIENTE' }); },
    obtenerPorId: async () => estado.credito,
    obtenerCuotasPorCredito: async () => estado.cuotas,
    obtenerCuotaParaPago: async () => ({ ...estado.cuotas[0], id_venta: 1,
      id_sucursal: 1, estado_venta: 'CONFIRMADA', estado_credito: estado.credito.estado,
      saldo_credito: estado.credito.saldo_pendiente }),
    crearPagoCuota: async (_, aplicacion) => { estado.aplicaciones.push(aplicacion); },
    actualizarCuotaPago: async (_, id, pagado, saldo, estadoCuota) => {
      Object.assign(estado.cuotas[0], { monto_pagado: pagado, saldo_cuota: saldo, estado: estadoCuota });
    },
    actualizarSaldoCredito: async (_, id, saldo, estadoCredito) => {
      Object.assign(estado.credito, { saldo_pendiente: saldo, estado: estadoCredito });
    },
  };
  const dependencias = { '../repositories/paymentRepository': paymentRepo,
    '../repositories/creditRepository': creditRepo };
  return {
    pagos: cargar('services/paymentService.js', dependencias),
    creditos: cargar('services/creditService.js', dependencias),
    estado: () => estado, eventos,
  };
}

test('contado sin crédito: pago y movimiento de caja conservan saldo correcto', async () => {
  const f = fixture();
  const resultado = await f.pagos.registrarPago(datos, 7);
  assert.equal(resultado.saldo_pendiente, 80);
  assert.equal(f.estado().pagos.length, 1);
  assert.equal(f.estado().caja.length, 1);
  assert.deepEqual(f.eventos.map(e => e[1]),
    ['begin', 'espera venta', 'venta bloqueada', 'consulta credito', 'commit', 'release']);
});

for (const estado of ['ACTIVO', 'ANULADO', 'PAGADO']) {
  test(`plan ${estado}: HTTP 409 sin cambios financieros`, async () => {
    const f = fixture({ credito: { id_credito: 1, estado, saldo_pendiente: 100 } });
    const antes = structuredClone(f.estado());
    const controller = cargar('controllers/paymentController.js', { '../services/paymentService': f.pagos });
    let status;
    let respuesta;
    await controller.registrar({ body: datos, usuario: { id_usuario: 7 } }, {
      status(codigo) { status = codigo; return this; },
      json(body) { respuesta = body; },
    });
    assert.equal(status, 409);
    assert.match(respuesta.message, /plan de crédito.*pago de cuotas/);
    assert.deepEqual(f.estado(), antes);
    assert.deepEqual(f.eventos.slice(-2).map(e => e[1]), ['rollback', 'release']);
  });
}

test('repetición de pago total rechazada, sin segundo movimiento', async () => {
  const f = fixture();
  await f.pagos.registrarPago({ ...datos, monto: 100 }, 7);
  await assert.rejects(f.pagos.registrarPago({ ...datos, monto: 100 }, 7), e => e.status === 409);
  assert.equal(f.estado().pagos.length, 1);
  assert.equal(f.estado().caja.length, 1);
});

test('pago superior al saldo rechazado sin cobro', async () => {
  const f = fixture();
  await assert.rejects(f.pagos.registrarPago({ ...datos, monto: 101 }, 7), e => e.status === 409);
  assert.equal(f.estado().pagos.length, 0);
  assert.equal(f.estado().caja.length, 0);
});

for (const fallo of ['consulta', 'caja']) {
  test(`fallo ${fallo}: rollback sin pago ni movimiento parcial`, async () => {
    const f = fixture({ fallo });
    const antes = structuredClone(f.estado());
    await assert.rejects(f.pagos.registrarPago(datos, 7), new RegExp(`fallo ${fallo}`));
    assert.deepEqual(f.estado(), antes);
    assert.ok(!f.eventos.some(e => e[1] === 'commit'));
    assert.deepEqual(f.eventos.slice(-2).map(e => e[1]), ['rollback', 'release']);
  });
}

test('pagarCuota sigue creando pago, aplicación y caja y actualizando ambos saldos', async () => {
  const f = fixture({ tipo: 'CREDITO' });
  await f.creditos.crearCredito(plan);
  const respuesta = await f.creditos.pagarCuota(1, datos, 7);
  assert.equal(respuesta.cuota.saldo_cuota, 80);
  assert.equal(f.estado().credito.saldo_pendiente, 80);
  assert.equal(f.estado().cuotas[0].estado, 'PARCIAL');
  assert.equal(f.estado().aplicaciones.length, 1);
  assert.equal(f.estado().pagos.length, 1);
  assert.equal(f.estado().caja.length, 1);
  await f.creditos.pagarCuota(1, { ...datos, monto: 80 }, 7);
  assert.equal(f.estado().credito.estado, 'PAGADO');
  await assert.rejects(f.creditos.pagarCuota(1, datos, 7), e => e.status === 409);
  assert.equal(f.estado().pagos.length, 2);
});

// Barrera determinista: la segunda operación llega al bloqueo mientras la primera lo retiene.
for (const primero of ['credito', 'pago']) {
  test(`concurrencia simulada: ${primero} obtiene primero el bloqueo de venta`, async () => {
    let entrar;
    let continuar;
    const dentro = new Promise(resolve => { entrar = resolve; });
    const barrera = new Promise(resolve => { continuar = resolve; });
    const f = fixture({ tipo: 'CREDITO', pausa: async numero => {
      if (numero === 1) { entrar(); await barrera; }
    } });
    const crear = () => f.creditos.crearCredito(plan);
    const pagar = () => f.pagos.registrarPago(datos, 7);
    const primera = primero === 'credito' ? crear() : pagar();
    await dentro;
    const segunda = primero === 'credito' ? pagar() : crear();
    // Espera a que la segunda transacción solicite el bloqueo, sin tiempos arbitrarios.
    while (!f.eventos.some(e => e[0] === 2 && e[1] === 'espera venta')) {
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.ok(!f.eventos.some(e => e[0] === 2 && e[1] === 'consulta credito'));
    continuar();
    const resultados = await Promise.allSettled([primera, segunda]);
    assert.equal(resultados[0].status, 'fulfilled');
    if (primero === 'credito') {
      assert.equal(resultados[1].status, 'rejected');
      assert.equal(resultados[1].reason.status, 409);
      assert.equal(f.estado().pagos.length, 0);
      assert.equal(f.estado().caja.length, 0);
      assert.equal(f.estado().credito.monto_financiado, 100);
    } else {
      assert.equal(resultados[1].status, 'fulfilled');
      assert.equal(f.estado().pagos.length, 1);
      assert.equal(f.estado().credito.monto_financiado, 80);
      assert.equal(f.estado().cuotas[0].saldo_cuota, 80);
    }
  });
}

test('limitación existente: un pago parcial repetido cabe en el saldo y no tiene idempotencia', async () => {
  const f = fixture();
  await f.pagos.registrarPago(datos, 7);
  await f.pagos.registrarPago(datos, 7);
  assert.equal(f.estado().pagos.length, 2);
});
