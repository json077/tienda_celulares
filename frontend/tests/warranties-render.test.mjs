import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Garantías CoreUI: carga, filtros, detalle histórico, reclamos y confirmaciones sin API real', async () => {
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
    const { default: Page } = await server.ssrLoadModule('/src/views/warranties/Warranties.jsx')
    const { default: Detail, ClaimDetail } = await server.ssrLoadModule(
      '/src/views/warranties/WarrantyDetail.jsx',
    )
    const { WarrantyForm, ClaimForm, ResolutionForm } = await server.ssrLoadModule(
      '/src/views/warranties/WarrantyForms.jsx',
    )
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx')
    const page = renderToStaticMarkup(
      React.createElement(AuthProvider, null, React.createElement(Page)),
    )
    for (const text of [
      'Garantías y reclamos',
      'Registrar garantía',
      'Cargando garantías',
      'Actualizar',
      'Estado de garantía',
      'no mueven inventario',
    ])
      assert.ok(page.includes(text), text)
    assert.ok(!page.includes('Anular garantía'))
    const warranty = {
      id_garantia: 8,
      id_venta: 4,
      id_detalle_venta: 20,
      id_producto: 2,
      id_unidad: 11,
      fecha_inicio: '2026-10-01',
      fecha_fin: '2026-12-30',
      dias_garantia: 90,
      estado: 'VIGENTE',
    }
    const claim = {
      id_reclamo: 9,
      id_garantia: 8,
      id_sucursal: 2,
      numero_reclamo: 'R-TEST',
      estado: 'RECIBIDO',
      motivo: 'Falla técnica',
      fecha_recepcion: '2026-10-28 09:00:00',
      id_usuario_recibe: 7,
      solucion: null,
      diagnostico: null,
    }
    const context = {
      sale: {
        id_venta: 4,
        numero_venta: 'V-TEST',
        cliente: 'Cliente prueba',
        sucursal: 'Centro',
        estado: 'CONFIRMADA',
      },
      warning: '',
      lines: [
        {
          id_detalle_venta: 20,
          id_producto: 2,
          producto: 'Teléfono',
          sku: 'TL',
          tipo_control: 'SERIALIZADO',
          dias_garantia: 90,
          cantidad: 1,
          units: [{ id_unidad: 11, imei1: '001234567890123', numero_serie: 'SERIE-TEST' }],
        },
      ],
    }
    const props = {
      warranty,
      context,
      claims: [claim],
      busy: false,
      canClaim: false,
      canResolve: true,
      onClaim() {},
      onSelectClaim() {},
    }
    const detail = render(Detail, props)
    for (const text of [
      'V-TEST',
      'Cliente prueba',
      'Teléfono',
      '001234567890123',
      'SERIE-TEST',
      '90',
      'R-TEST',
      'RECIBIDO',
      'table-responsive',
      'MySQL',
    ])
      assert.ok(detail.includes(text), text)
    assert.equal(detail.split('001234567890123').length - 1, 1)
    assert.ok(!detail.includes('2026-10-01T'))
    assert.match(
      render(Detail, { ...props, context: null, claims: null }),
      /IMEI histórico no disponible/,
    )
    for (const busy of [true, false]) {
      const form = render(WarrantyForm, { context, existing: [], busy, onSave() {} })
      assert.match(form, /Artículo vendido/)
      assert.match(form, /warranty-create-confirmation/)
      assert.equal(form.includes('fieldset disabled'), busy)
      const receive = render(ClaimForm, {
        warranty,
        claims: [],
        branches: [{ id: '2', label: 'Centro' }],
        busy,
        onSave() {},
      })
      for (const text of [
        'Número de reclamo',
        'Sucursal de recepción',
        'Motivo',
        'warranty-claim-confirmation',
      ])
        assert.ok(receive.includes(text), text)
    }
    for (const estado of ['RECIBIDO', 'EN_REVISION', 'APROBADO', 'RECHAZADO']) {
      const html = render(ResolutionForm, { claim: { ...claim, estado }, busy: false, onSave() {} })
      for (const text of [
        'Siguiente estado permitido',
        'Diagnóstico',
        'claim-resolve-confirmation',
        'no sustituyen dispositivos',
      ])
        assert.ok(html.includes(text), text)
      if (estado === 'RECIBIDO')
        assert.ok(html.includes('EN_REVISION') && !html.includes('value="RESUELTO"'))
      if (estado === 'EN_REVISION')
        assert.ok(html.includes('APROBADO') && html.includes('RECHAZADO'))
    }
    const closed = render(ClaimDetail, {
      claim: {
        ...claim,
        estado: 'RESUELTO',
        solucion: 'REPARACION',
        diagnostico: 'Prueba de reparación',
        fecha_resolucion: '2026-10-28 10:00:00',
        id_usuario_resuelve: 7,
      },
    })
    for (const text of ['RESUELTO', 'REPARACION', 'Prueba de reparación', 'Resuelto:'])
      assert.ok(closed.includes(text), text)
  } finally {
    globalThis.fetch = original
    await server.close()
  }
})
