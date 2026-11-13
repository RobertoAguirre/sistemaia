const express = require('express');
const { supabase } = require('../supabase');
const config = require('../config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { dentroDeGeocerca, distanciaAGeocerca } = require('../utils/geo');
const { listActivasForCheckIn } = require('../utils/geocercaStore');

const router = express.Router();

// POST /api/eventos/check-in — registra entrada/salida validando geocerca
// body: { lat, lng, precision_metros?, dispositivo?, tipo: 'entrada'|'salida' }
router.post('/check-in', requireAuth, authLimiter, async (req, res) => {
  const { lat, lng, precision_metros, dispositivo, tipo } = req.body || {};
  const latN = Number(lat), lonN = Number(lng);

  if (isNaN(latN) || latN < -90 || latN > 90 || isNaN(lonN) || lonN < -180 || lonN > 180) {
    return res.status(400).json({ error: 'Coordenadas inválidas' });
  }
  if (!['entrada', 'salida'].includes(tipo)) {
    return res.status(400).json({ error: "tipo debe ser 'entrada' o 'salida'" });
  }
  const precision = precision_metros != null ? Number(precision_metros) : null;
  if (config.minAccuracyMeters > 0 && precision != null && precision > config.minAccuracyMeters) {
    return res.status(400).json({
      error: `Precisión insuficiente (${precision}m > ${config.minAccuracyMeters}m). Activa el GPS`,
    });
  }

  // Geocercas activas (polígono o círculo); si hay varias, prioriza la más cercana al centroide
  let geocercas;
  try {
    geocercas = await listActivasForCheckIn();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const conDistancia = (geocercas || []).map((g) => ({
    ...g,
    distancia_metros: Math.round(distanciaAGeocerca(latN, lonN, g)),
    dentro: dentroDeGeocerca(latN, lonN, g),
  }));

  const dentro = conDistancia
    .filter((g) => g.dentro)
    .sort((a, b) => a.distancia_metros - b.distancia_metros);
  const geocerca = dentro[0] || null;

  const evento = {
    usuario_id: req.user.id,
    geocerca_id: geocerca?.id || null,
    tipo: geocerca ? tipo : 'denegado',
    latitud: latN,
    longitud: lonN,
    precision_metros: precision,
    dispositivo: dispositivo || null,
  };

  const { data, error } = await supabase.from('eventos_acceso').insert(evento).select().single();
  if (error) return res.status(500).json({ error: error.message });

  if (!geocerca) {
    const cercanas = conDistancia
      .sort((a, b) => a.distancia_metros - b.distancia_metros)
      .slice(0, 5)
      .map(({ id, nombre, distancia_metros, radio_metros }) => ({
        id,
        nombre,
        distancia_metros,
        radio_metros: Number(radio_metros),
      }));
    return res.status(403).json({
      error: 'Fuera de toda geocerca autorizada',
      evento_id: data.id,
      geocercas: cercanas,
    });
  }

  res.status(201).json({
    ...data,
    geocerca: geocerca.nombre,
    distancia_metros: geocerca.distancia_metros,
  });
});

// GET /api/eventos — listado con filtros (admin ve todo)
router.get('/', requireAuth, async (req, res) => {
  const { usuario_id, desde, hasta, tipo, limit = 100 } = req.query;

  let query = supabase
    .from('eventos_acceso')
    .select('*, usuarios(nombre, email), geocercas(nombre)')
    .order('creado_en', { ascending: false })
    .limit(Math.min(Number(limit) || 100, 500));

  if (req.user.rol !== 'admin') query = query.eq('usuario_id', req.user.id);
  if (req.user.rol === 'admin' && usuario_id) query = query.eq('usuario_id', usuario_id);
  if (desde) query = query.gte('creado_en', desde);
  if (hasta) query = query.lte('creado_en', hasta);
  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
