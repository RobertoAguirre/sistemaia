const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Cliente con service_role: solo para uso en el backend.
// NUNCA exponer esta key al frontend.
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabase };
