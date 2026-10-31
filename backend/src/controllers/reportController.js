const service = require('../services/reportService');
const handle = action => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { await action(req, res); } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ ok: false, message: status === 500 ? 'No se pudo generar el reporte' : error.message });
  }
};
module.exports = {
  catalog: handle(async (req, res) => res.json({ ok: true, data: await service.catalog(req.usuario) })),
  read: handle(async (req, res) => res.json({ ok: true, data: await service.report(req.params.type, req.query, req.usuario) })),
  export: handle(async (req, res) => {
    const data = await service.report(req.params.type, req.query, req.usuario);
    const buffer = await service.excel(data);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment(`reporte-${data.id}.xlsx`).send(buffer);
  }),
};
