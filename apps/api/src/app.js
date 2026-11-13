const express = require('express');
const cors = require('cors');
const config = require('./config');
const { globalLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const geocercasRoutes = require('./routes/geocercas');
const usuariosRoutes = require('./routes/usuarios');
const eventosRoutes = require('./routes/eventos');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use('/api', globalLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/geocercas', geocercasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 y errores
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
