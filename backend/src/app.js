const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const brandRoutes = require('./routes/brandRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const serializedUnitRoutes = require('./routes/serializedUnitRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const clientRoutes = require('./routes/clientRoutes');
const saleRoutes = require('./routes/saleRoutes');
const cashRoutes = require('./routes/cashRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const exchangeRateRoutes = require('./routes/exchangeRateRoutes');
const creditRoutes = require('./routes/creditRoutes');
const transferRoutes = require('./routes/transferRoutes');
const returnRoutes = require('./routes/returnRoutes');
const warrantyRoutes = require('./routes/warrantyRoutes');
const auditRoutes = require('./routes/auditRoutes');
const backupRoutes = require('./routes/backupRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditMiddleware = require('./middlewares/auditMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(auditMiddleware);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'API de Tienda de Celulares funcionando'
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/marcas', brandRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/inventario', inventoryRoutes);
app.use('/api/unidades', serializedUnitRoutes);
app.use('/api/proveedores', supplierRoutes);
app.use('/api/compras', purchaseRoutes);
app.use('/api/clientes', clientRoutes);
app.use('/api/ventas', saleRoutes);
app.use('/api/cajas', cashRoutes);
app.use('/api/pagos', paymentRoutes);
app.use('/api/tipos-cambio', exchangeRateRoutes);
app.use('/api/creditos', creditRoutes);
app.use('/api/transferencias', transferRoutes);
app.use('/api/devoluciones', returnRoutes);
app.use('/api/garantias', warrantyRoutes);
app.use('/api/auditoria', auditRoutes);
app.use('/api/respaldos', backupRoutes);
app.use('/api/reportes', reportRoutes);
// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Ruta no encontrada'
  });
});

module.exports = app;
