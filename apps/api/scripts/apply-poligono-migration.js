/**
 * Aplica 002_geocercas_poligono.sql vía la API SQL de Supabase Management
 * o verifica si la columna ya existe.
 *
 * Uso: node apps/api/scripts/apply-poligono-migration.js
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function columnaExiste() {
  // Intento de lectura de la columna
  const { error } = await supabase.from('geocercas').select('poligono').limit(1);
  if (!error) return true;
  if (/poligono/i.test(error.message)) return false;
  // Otros errores: asumir que no podemos comprobar
  console.warn('No se pudo comprobar la columna:', error.message);
  return false;
}

async function main() {
  if (await columnaExiste()) {
    console.log('OK: columna poligono ya existe');
    return;
  }

  const sqlPath = path.resolve(__dirname, '../../../supabase/migrations/002_geocercas_poligono.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.error('La columna poligono NO existe todavía.');
  console.error('Ejecuta este SQL en Supabase → SQL Editor:\n');
  console.log(sql);
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
