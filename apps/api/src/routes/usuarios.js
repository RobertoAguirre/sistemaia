const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../supabase');
const config = require('../config');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const SELECT = 'id, nombre, email, rol, activo, created_at';

function validarUsuario(body, { parcial = false } = {}) {
  const { nombre, email, password, rol } = body;
  if (!parcial || nombre !== undefined) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) return 'Nombre inválido';
  }
  if (!parcial || email !== undefined) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido';
  }
  if (rol !== undefined && !['admin', 'empleado'].includes(rol)) return 'Rol inválido';
  if (!parcial && (!password || password.length < 8)) return 'La contraseña debe tener al menos 8 caracteres';
  if (parcial && password !== undefined && password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  return null;
}

// GET /api/usuarios — admin ve todos; usuario ve solo su perfil
router.get('/', requireAuth, async (req, res) => {
  let query = supabase.from('usuarios').select(SELECT).order('created_at', { ascending: false });
  if (req.user.rol !== 'admin') query = query.eq('id', req.user.id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/usuarios — admin crea usuarios
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const err = validarUsuario(req.body);
  if (err) return res.status(400).json({ error: err });

  const { nombre, email, password, rol } = req.body;
  const password_hash = await bcrypt.hash(password, config.bcryptRounds);

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      rol: rol || 'empleado',
    })
    .select(SELECT)
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// PUT /api/usuarios/:id — admin edita; usuario edita solo su perfil (sin rol/activo)
router.put('/:id', requireAuth, async (req, res) => {
  const esAdmin = req.user.rol === 'admin';
  const targetId = req.params.id;
  if (!esAdmin && targetId !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes editar tu propio perfil' });
  }

  const err = validarUsuario(req.body, { parcial: true });
  if (err) return res.status(400).json({ error: err });

  const update = {};
  const { nombre, email, password, rol, activo } = req.body;
  if (nombre !== undefined) update.nombre = nombre.trim();
  if (email !== undefined) update.email = email.toLowerCase().trim();
  if (password) update.password_hash = await bcrypt.hash(password, config.bcryptRounds);
  if (esAdmin) {
    if (rol !== undefined) update.rol = rol;
    if (activo !== undefined) update.activo = !!activo;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(update)
    .eq('id', targetId)
    .select(SELECT)
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// DELETE /api/usuarios/:id — solo admin; no puede eliminarse a sí mismo
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  const { error } = await supabase.from('usuarios').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
