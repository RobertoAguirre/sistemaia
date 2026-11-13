const express = require('express');
const { supabase } = require('../supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/resumen — métricas para el panel
router.get('/resumen', requireAuth, async (req, res) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const desdeISO = hoy.toISOString();

  const [usuarios, geocercas, hoyStats, recientes] = await Promise.all([
    supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('geocercas').select('id', { count: 'exact', head: true }).eq('activa', true),
    supabase
      .from('eventos_acceso')
      .select('tipo')
      .gte('creado_en', desdeISO),
    supabase
      .from('eventos_acceso')
      .select('*, usuarios(nombre), geocercas(nombre)')
      .order('creado_en', { ascending: false })
      .limit(10),
  ]);

  if (usuarios.error || geocercas.error || hoyStats.error || recientes.error) {
    return res.status(500).json({ error: 'Error cargando resumen' });
  }

  const conteo = { entrada: 0, salida: 0, denegado: 0, fuera_de_rango: 0 };
  for (const e of hoyStats.data || []) conteo[e.tipo] = (conteo[e.tipo] || 0) + 1;

  res.json({
    usuariosActivos: usuarios.count ?? 0,
    geocercasActivas: geocercas.count ?? 0,
    eventosHoy: conteo,
    eventosRecientes: recientes.data || [],
  });
});

// GET /api/dashboard/mis-eventos — historial del usuario autenticado
router.get('/mis-eventos', requireAuth, async (req, res) => {
  const { limit = 50 } = req.query;
  const { data, error } = await supabase
    .from('eventos_acceso')
    .select('*, geocercas(nombre)')
    .eq('usuario_id', req.user.id)
    .order('creado_en', { ascending: false })
    .limit(Math.min(Number(limit) || 50, 200));
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
