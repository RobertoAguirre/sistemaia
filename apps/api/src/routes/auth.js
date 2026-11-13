const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../supabase');
const config = require('../config');
const { requireAuth, signToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, password_hash, rol, activo')
    .eq('email', email.toLowerCase().trim())
    .single();

  // Respuesta genérica para no revelar si el email existe
  const invalid = () => res.status(401).json({ error: 'Credenciales inválidas' });

  if (error || !usuario) return invalid();
  if (!usuario.activo) return res.status(403).json({ error: 'Usuario inactivo' });

  const ok = await bcrypt.compare(password, usuario.password_hash);
  if (!ok) return invalid();

  const { password_hash, ...safe } = usuario;
  res.json({ token: signToken(usuario), usuario: safe });
});

// POST /api/auth/register — registro manual con email/contraseña
router.post('/register', authLimiter, async (req, res) => {
  const { nombre, email, password } = req.body || {};

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({ error: 'Nombre inválido' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const password_hash = await bcrypt.hash(password, config.bcryptRounds);
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      rol: 'empleado',
    })
    .select('id, nombre, email, rol, activo')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ token: signToken(data), usuario: data });
});

// POST /api/auth/supabase — login/registro con Google vía Supabase Auth.
// Recibe el access_token de Supabase, crea el usuario en `usuarios` si no existe
// y devuelve nuestro JWT + datos de perfil.
router.post('/supabase', authLimiter, async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) return res.status(400).json({ error: 'access_token requerido' });

  const { data, error } = await supabase.auth.getUser(access_token);
  if (error || !data?.user?.email) {
    return res.status(401).json({ error: 'Token de Supabase inválido' });
  }

  const su = data.user;
  const email = su.email.toLowerCase();

  // Buscar usuario existente por email
  let { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, activo, password_hash')
    .eq('email', email)
    .single();

  if (!usuario) {
    // Registro automático: crea la fila en `usuarios` (rol empleado por defecto)
    const password_hash = await bcrypt.hash(crypto.randomUUID(), config.bcryptRounds);
    const nombre =
      su.user_metadata?.full_name ||
      su.user_metadata?.name ||
      email.split('@')[0];

    const { data: created, error: insErr } = await supabase
      .from('usuarios')
      .insert({ nombre, email, password_hash, rol: 'empleado' })
      .select('id, nombre, email, rol, activo, password_hash')
      .single();

    if (insErr) return res.status(500).json({ error: insErr.message });
    usuario = created;
  }

  if (!usuario.activo) return res.status(403).json({ error: 'Usuario inactivo' });

  const { password_hash, ...safe } = usuario;
  res.json({ token: signToken(usuario), usuario: safe });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const { id, nombre, email, rol } = req.user;
  res.json({ id, nombre, email, rol });
});

// POST /api/auth/change-password (usuario cambia su propia contraseña)
router.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('password_hash')
    .eq('id', req.user.id)
    .single();

  if (!usuario || !(await bcrypt.compare(currentPassword, usuario.password_hash))) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const hash = await bcrypt.hash(newPassword, config.bcryptRounds);
  const { error } = await supabase
    .from('usuarios')
    .update({ password_hash: hash })
    .eq('id', req.user.id);

  if (error) return res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  res.json({ ok: true });
});

module.exports = router;
