const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabase } = require('../supabase');

/** Verifica el JWT propio o un access_token de Supabase Auth (Google OAuth). */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  let usuario = null;

  // 1) Intentar JWT propio
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const { data } = await supabase
      .from('usuarios')
      .select('id, email, nombre, rol, activo')
      .eq('id', payload.sub)
      .single();
    usuario = data;
  } catch {
    // 2) Intentar token de Supabase Auth (Google OAuth)
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.email) {
      const { data: found } = await supabase
        .from('usuarios')
        .select('id, email, nombre, rol, activo')
        .eq('email', data.user.email.toLowerCase())
        .single();
      usuario = found;
    }
  }

  if (!usuario || !usuario.activo) {
    return res.status(401).json({ error: 'Usuario inexistente o inactivo' });
  }

  req.user = usuario;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Se requiere rol administrador' });
  }
  next();
}

function signToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, rol: usuario.rol },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

module.exports = { requireAuth, requireAdmin, signToken };
