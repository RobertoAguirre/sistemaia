const express = require('express');
const { supabase } = require('../supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { normalizarPoligono } = require('../utils/geo');
const {
  listGeocercas,
  insertGeocerca,
  updateGeocerca,
  setActiva,
} = require('../utils/geocercaStore');

const router = express.Router();

function validarGeocerca(body) {
  const { nombre } = body || {};
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) return 'Nombre requerido';

  const poly = normalizarPoligono(body.poligono);
  if (poly) {
    if (poly.length < 3) return 'El polígono requiere al menos 3 vértices';
    if (poly.length > 200) return 'Máximo 200 vértices por geocerca';
    return null;
  }

  const lat = Number(body.latitud);
  const lon = Number(body.longitud);
  const radio = Number(body.radio_metros);
  if (isNaN(lat) || lat < -90 || lat > 90) return 'Latitud inválida';
  if (isNaN(lon) || lon < -180 || lon > 180) return 'Longitud inválida';
  if (isNaN(radio) || radio <= 0 || radio > 50000) return 'Radio inválido (1–50000 m)';
  return null;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    res.json(await listGeocercas());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const err = validarGeocerca(req.body);
  if (err) return res.status(400).json({ error: err });
  try {
    res.status(201).json(await insertGeocerca(req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const err = validarGeocerca(req.body);
  if (err) return res.status(400).json({ error: err });
  try {
    res.json(await updateGeocerca(req.params.id, req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/activa', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await setActiva(req.params.id, !!(req.body || {}).activa));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('geocercas').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
