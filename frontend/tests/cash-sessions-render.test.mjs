import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
test('Caja CoreUI: sesiones consultadas, estado, vacíos, recibo de movimiento y confirmaciones financieras', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const original = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('Prohibida API real')
  }
  const render = (C, props) => renderToStaticMarkup(React.createElement(C, props))
  try {
    const { default: Sessions } = await server.ssrLoadModule('/src/views/cash/CashSessions.jsx')
    const { default: Movement } = await server.ssrLoadModule(
      '/src/views/cash/CashMovementResult.jsx',
    )
    const { default: Operation } = await server.ssrLoadModule('/src/views/cash/CashOperation.jsx')
    const { default: Cash } = await server.ssrLoadModule('/src/views/cash/Cash.jsx')
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const session = {
      id_sesion_caja: 8,
      id_caja: 3,
      estado: 'ABIERTA',
      caja: 'Caja ficticia',
      sucursal: 'Sucursal prueba',
      usuario_apertura: 'operador-test',
      fecha_apertura: '2026-10-25 08:00:00',
      monto_apertura: 100,
    }
    let html = render(Sessions, {
      sessions: [
        session,
        {
          ...session,
          id_sesion_caja: 9,
          estado: 'CERRADA',
          monto_cierre_sistema: 110,
          monto_cierre_real: 108,
          diferencia: -2,
        },
      ],
      busy: true,
      onSelect() {},
    })
    for (const text of [
      'Sesiones consultadas durante esta visita',
      'no permite listar el historial completo',
      'ABIERTA',
      'CERRADA',
      'Caja ficticia',
      'operador-test',
      '110.00',
      '-2.00',
      'cash-session-search',
      'cash-session-state',
      'table-responsive',
    ])
      assert.ok(html.includes(text), text)
    assert.equal((html.match(/disabled=""/g) || []).length, 2)
    assert.match(
      render(Sessions, { sessions: [], busy: false, onSelect() {} }),
      /Todavía no hay sesiones consultadas/,
    )
    for (const tipo of ['INGRESO', 'EGRESO']) {
      html = render(Movement, {
        result: {
          movimiento: {
            tipo,
            concepto: 'Concepto de prueba',
            fecha: '2026-10-25 09:00:00',
            monto: 10,
            usuario: 'operador-test',
            tipo_referencia: 'MOVIMIENTO_MANUAL',
          },
          saldo_anterior: 100,
          saldo_actual: tipo === 'INGRESO' ? 110 : 90,
        },
      })
      for (const text of [
        'Concepto de prueba',
        'operador-test',
        'MOVIMIENTO_MANUAL',
        'no es un saldo actualizado',
        tipo === 'INGRESO' ? 'ENTRADA' : 'SALIDA',
      ])
        assert.ok(html.includes(text), text)
    }
    for (const mode of ['open', 'close', 'movement']) {
      html = render(Operation, { mode, boxes: [], session, busy: true, onSave() {} })
      assert.match(html, new RegExp('cash-' + mode + '-confirm'))
      assert.match(html, /fieldset disabled/)
      assert.match(html, /Revisé los datos/)
      if (mode !== 'open') {
        assert.match(html, /Caja ficticia/)
        assert.match(html, /Sucursal prueba/)
      }
    }
    html = renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(Cash)))
    assert.match(html, /Cargando cajas y ventas/)
    assert.match(html, /Abrir caja/)
    assert.match(html, /Sesiones consultadas durante esta visita/)
  } finally {
    globalThis.fetch = original
    await server.close()
  }
})
