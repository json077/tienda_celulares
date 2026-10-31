const definitions = require('./reportDefinitions');
const repository = require('../repositories/reportRepository');
const writeExcel = require('write-excel-file/node');

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function validate(type, query) {
  if (!Object.hasOwn(definitions, type)) fail('Reporte no encontrado', 404);
  const definition = definitions[type];
  const allowed = ['id_sucursal', ...(definition.dates === false ? [] : ['desde', 'hasta']), ...(definition.states ? ['estado'] : []), ...(definition.product ? ['id_producto'] : []), ...(definition.methods ? ['metodo'] : [])];
  const filters = {};
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.includes(key) || typeof value !== 'string' || !value) fail('Filtro no permitido o inválido');
    if (key.startsWith('id_')) {
      if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) fail('Identificador inválido');
      filters[key] = Number(value);
    } else if (['desde', 'hasta'].includes(key)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01' || !Number.isFinite(Date.parse(value)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) fail('Fecha inválida');
      filters[key] = value;
    } else {
      if (!(key === 'estado' ? definition.states : definition.methods).includes(value)) fail('Estado o método inválido');
      filters[key] = value;
    }
  }
  if (filters.desde && filters.hasta && filters.desde > filters.hasta) fail('Desde debe ser anterior o igual a Hasta');
  return filters;
}

async function catalog(actor) {
  const [branches, products] = await Promise.all([repository.branches(actor), repository.products(actor)]);
  return { reports: Object.entries(definitions).map(([id, d]) => ({ id, ...d })), branches, products };
}

function summarize(type, rows) {
  const d = definitions[type];
  const sum = (key, selected = rows) => selected.reduce((n, r) => n + Math.round(Number(r[key]) * 100), 0) / 100;
  const totals = [{ label: 'Registros', value: rows.length, type: 'number' }];
  for (const key of d.sums) {
    const c = d.columns.find(x => x.key === key);
    totals.push({ label: c.label, value: sum(key), type: c.type });
  }
  if (type === 'pagos') for (const state of ['APLICADO', 'ANULADO']) {
    totals.push({ label: `${state === 'APLICADO' ? 'Aplicados' : 'Anulados'} (NIO)`, value: sum('monto_base', rows.filter(r => r.estado === state)), type: 'money' });
  }
  if (d.states && type !== 'pagos') for (const state of d.states) {
    const selected = rows.filter(r => r.estado === state);
    const key = type === 'devoluciones' ? 'total_devuelto' : 'total';
    totals.push({ label: `${state} (NIO)`, value: sum(key, selected), type: 'money' });
  }
  return totals;
}

async function report(type, query, actor) {
  const filters = validate(type, query);
  if (filters.id_sucursal) {
    const branches = await repository.branches(actor);
    if (!branches.some(b => Number(b.id_sucursal) === filters.id_sucursal)) fail('No tiene acceso a la sucursal solicitada', 403);
  }
  const rows = await repository.read(type, filters, actor);
  if (rows.length > 10000) fail('Hay más de 10000 registros. Reduce el período o selecciona una sucursal; no se muestran ni exportan resultados incompletos.', 422);
  const d = definitions[type];
  const normalized = rows.map(r => Object.fromEntries(d.columns.map(c => [c.key, ['money', 'number'].includes(c.type) ? Number(r[c.key]) : String(r[c.key] ?? '')])));
  return { id: type, title: d.title, note: d.note || 'Los totales incluyen los estados seleccionados; se desglosan por estado.', columns: d.columns, filters, generatedAt: new Date().toISOString(), rows: normalized, totals: summarize(type, normalized) };
}

async function excel(data) {
  // Explicit String cells keep names beginning with =, +, - or @ as text, never formulas.
  const text = value => ({ type: String, value: String(value), wrap: true });
  const numeric = (value, money) => ({ type: Number, value, format: money ? '#,##0.00' : '#,##0.##' });
  const rows = [
    [{ ...text(`Tienda Celulares — ${data.title}`), columnSpan: data.columns.length, fontWeight: 'bold', fontSize: 16 }],
    [{ ...text(`Generado: ${data.generatedAt}`), columnSpan: data.columns.length }],
    [{ ...text(`Filtros: ${Object.entries(data.filters).map(([k, v]) => `${k}=${v}`).join('; ') || 'Todas las sucursales autorizadas, sin filtros adicionales'}`), columnSpan: data.columns.length }],
    [{ ...text(data.note), columnSpan: data.columns.length, height: 42 }], [],
    data.columns.map(c => ({ ...text(c.label), fontWeight: 'bold', backgroundColor: '#DDEBF7' })),
    ...data.rows.map(r => data.columns.map(c => ['number', 'money'].includes(c.type) ? numeric(r[c.key], c.type === 'money') : text(r[c.key]))),
    [], [text('Resumen')],
    ...data.totals.map(t => [text(t.label), numeric(t.value, t.type === 'money')]),
  ];
  return writeExcel(rows, { sheet: 'Reporte', columns: data.columns.map(() => ({ width: 24 })), stickyRowsCount: 6 }).toBuffer();
}

module.exports = { catalog, report, excel, validate, summarize };
