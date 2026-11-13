// Crea el usuario administrador inicial.
// Uso: ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD=... node scripts/seed-admin.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const config = require('../src/config');

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const nombre = process.env.ADMIN_NOMBRE || 'Administrador';

if (!email || !password || password.length < 8) {
  console.error('Define ADMIN_EMAIL y ADMIN_PASSWORD (mín. 8 caracteres)');
  process.exit(1);
}

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
});

(async () => {
  const password_hash = await bcrypt.hash(password, config.bcryptRounds);
  const { data, error } = await supabase
    .from('usuarios')
    .insert({ nombre, email: email.toLowerCase(), password_hash, rol: 'admin' })
    .select('id, email, rol')
    .single();

  if (error) {
    if (error.code === '23505') console.log('Ya existe un usuario con ese email');
    else console.error(error.message);
    process.exit(1);
  }
  console.log('Admin creado:', data);
})();
