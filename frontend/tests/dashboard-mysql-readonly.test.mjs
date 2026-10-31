import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test(
  'Dashboard MySQL: tres gráficos y cuatro indicadores contra SELECT independientes, sin escrituras',
  { skip: process.env.REPORTS_MYSQL_READONLY !== '1' },
  async (t) => {
    const require = createRequire(new URL('../../backend/package.json', import.meta.url))
    require('dotenv').config({
      path: fileURLToPath(new URL('../../backend/.env', import.meta.url)),
      quiet: true,
    })
    const connection = await require('mysql2/promise').createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      decimalNumbers: true,
      connectTimeout: 6000,
    })
    t.after(async () => {
      await connection.rollback()
      await connection.end()
    })
    await connection.query('START TRANSACTION READ ONLY')
    async function loadBackend(file, dependencies) {
      const module = { exports: {} }
      vm.runInNewContext(
        await readFile(new URL(`../../backend/src/${file}`, import.meta.url), 'utf8'),
        {
          module,
          require: (name) =>
            Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
        },
      )
      return module.exports
    }
    const repo = await loadBackend('repositories/reportRepository.js', {
      '../config/database': { pool: connection },
    })
    const service = await loadBackend('services/reportService.js', {
      './reportDefinitions': require('./src/services/reportDefinitions'),
      '../repositories/reportRepository': repo,
    })
    const server = await createServer({
      root: fileURLToPath(new URL('..', import.meta.url)),
      configFile: false,
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, watch: null, hmr: false, ws: false },
      appType: 'custom',
    })
    t.after(() => server.close())
    const { loadDashboard } = await server.ssrLoadModule('/src/views/dashboard/dashboardModel.js')
    const { default: Results } = await server.ssrLoadModule(
      '/src/views/dashboard/DashboardResults.jsx',
    )
    const root = { roles: ['ROOT'] }
    const branches = await repo.branches(root)
    const periods = [
      { desde: '2026-10-01', hasta: '2026-10-31' },
      { desde: '1000-01-01', hasta: '1000-01-01' },
    ]
    for (const period of periods)
      for (const branch of ['', ...branches.map((b) => String(b.id_sucursal))]) {
        const filters = { ...period, id_sucursal: branch }
        const data = await loadDashboard(
          {
            read: async (type, f) => ({
              data: await service.report(
                type,
                Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')),
                root,
              ),
            }),
          },
          filters,
        )
        const where =
          'v.fecha>=? AND v.fecha<DATE_ADD(?, INTERVAL 1 DAY)' +
          (branch ? ' AND v.id_sucursal=?' : '')
        const params = [period.desde, period.hasta, ...(branch ? [branch] : [])]
        const [[sales]] = await connection.query(
          `SELECT COUNT(*) n, COALESCE(SUM(v.total),0) total FROM ventas v WHERE ${where} AND v.estado='CONFIRMADA'`,
          params,
        )
        assert.equal(data.total, Number(sales.total))
        assert.equal(data.count, Number(sales.n))
        const [daily] = await connection.query(
          `SELECT DATE_FORMAT(v.fecha,'%Y-%m-%d') fecha, SUM(v.total) total FROM ventas v WHERE ${where} AND v.estado='CONFIRMADA' GROUP BY DATE_FORMAT(v.fecha,'%Y-%m-%d') ORDER BY fecha`,
          params,
        )
        assert.equal(
          JSON.stringify(data.daily),
          JSON.stringify(daily.map((r) => ({ fecha: r.fecha, total: Number(r.total) }))),
        )
        const [states] = await connection.query(
          `SELECT v.estado, COUNT(*) n FROM ventas v WHERE ${where} GROUP BY v.estado`,
          params,
        )
        for (const row of data.states)
          assert.equal(row.cantidad, Number(states.find((s) => s.estado === row.estado)?.n || 0))
        const [products] = await connection.query(
          `SELECT p.sku, p.nombre producto, SUM(d.cantidad) cantidad FROM detalle_ventas d INNER JOIN ventas v ON v.id_venta=d.id_venta INNER JOIN productos p ON p.id_producto=d.id_producto WHERE ${where} AND v.estado='CONFIRMADA' GROUP BY p.id_producto,p.sku,p.nombre ORDER BY cantidad DESC,p.sku`,
          params,
        )
        assert.equal(
          data.units,
          products.reduce((n, r) => n + Number(r.cantidad), 0),
        )
        assert.equal(
          JSON.stringify(
            data.products.map(({ sku, cantidad }) => ({ sku, cantidad: Number(cantidad) })),
          ),
          JSON.stringify(
            products.slice(0, 10).map(({ sku, cantidad }) => ({ sku, cantidad: Number(cantidad) })),
          ),
        )
        const [[stock]] = await connection.query(
          `SELECT COALESCE(SUM(stock_actual),0) total FROM inventario_sucursal${branch ? ' WHERE id_sucursal=?' : ''}`,
          branch ? [branch] : [],
        )
        assert.equal(data.stock, Number(stock.total))
        const html = renderToStaticMarkup(React.createElement(Results, { data, filters, branches }))
        for (const title of [
          'Ventas por día',
          'Productos más vendidos',
          'Ventas por estado',
          'Existencias actuales',
        ])
          assert.ok(html.includes(title))
        if (data.count) assert.ok(html.includes('<canvas'))
        else assert.ok(html.includes('No hay resultados'))
        if (!branch && period.desde === '2026-10-01')
          t.diagnostic(
            JSON.stringify({
              período: period,
              ventasConfirmadas: data.count,
              importe: data.total,
              unidades: data.units,
              existencias: data.stock,
              días: data.daily.length,
              productos: data.products.length,
              estados: data.states,
            }),
          )
      }
    // A real user without membership cannot obtain any of the three source reports.
    const outsider = { id_usuario: 999999999, roles: ['VENDEDOR'] }
    for (const type of ['ventas', 'ranking', 'existencias'])
      assert.equal((await repo.read(type, {}, outsider)).length, 0)
    const inaccessible = await repo.branches(outsider)
    assert.equal(inaccessible.length, 0)
    await assert.rejects(
      service.report('ventas', { id_sucursal: String(branches[0]?.id_sucursal || 1) }, outsider),
      (e) => e.status === 403,
    )
  },
)
