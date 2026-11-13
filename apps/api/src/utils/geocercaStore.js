/**
 * Persistencia de polígonos:
 * 1) Columna jsonb `poligono` (migración 002) si existe
 * 2) Fallback en `descripcion` como JSON {v:1,texto,poligono} hasta aplicar la migración
 */
const { supabase } = require('../supabase');
const { normalizarPoligono, metadatosDesdePoligono } = require('./geo');

const SELECT_FULL =
  'id, nombre, descripcion, latitud, longitud, radio_metros, poligono, color, activa, created_at';
const SELECT_LEGACY =
  'id, nombre, descripcion, latitud, longitud, radio_metros, color, activa, created_at';

let usePoligonoColumn = null; // null = desconocido

async function detectPoligonoColumn() {
  if (usePoligonoColumn != null) return usePoligonoColumn;
  const { error } = await supabase.from('geocercas').select('poligono').limit(1);
  usePoligonoColumn = !error;
  return usePoligonoColumn;
}

function encodeDescripcion(texto, poligono) {
  if (!poligono) return texto || null;
  return JSON.stringify({ v: 1, texto: texto || null, poligono });
}

function decodeRow(row) {
  if (!row) return row;
  const out = { ...row };

  if (Array.isArray(out.poligono) && out.poligono.length >= 3) {
    // columna real
    if (typeof out.descripcion === 'string' && out.descripcion.startsWith('{"v":1')) {
      try {
        const parsed = JSON.parse(out.descripcion);
        out.descripcion = parsed.texto ?? null;
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  // Fallback: polígono embebido en descripcion
  if (typeof out.descripcion === 'string' && out.descripcion.startsWith('{"v":1')) {
    try {
      const parsed = JSON.parse(out.descripcion);
      out.descripcion = parsed.texto ?? null;
      const poly = normalizarPoligono(parsed.poligono);
      if (poly) out.poligono = poly;
    } catch {
      /* leave as-is */
    }
  }

  if (!out.poligono) out.poligono = null;
  return out;
}

function buildRow(body) {
  const polyMeta = metadatosDesdePoligono(body.poligono);
  const texto = body.descripcion || null;

  if (polyMeta) {
    return {
      nombre: String(body.nombre).trim(),
      color: body.color || '#2563eb',
      activa: body.activa !== false,
      latitud: polyMeta.latitud,
      longitud: polyMeta.longitud,
      radio_metros: polyMeta.radio_metros,
      poligono: polyMeta.poligono,
      texto,
    };
  }

  return {
    nombre: String(body.nombre).trim(),
    color: body.color || '#2563eb',
    activa: body.activa !== false,
    latitud: Number(body.latitud),
    longitud: Number(body.longitud),
    radio_metros: Number(body.radio_metros),
    poligono: null,
    texto,
  };
}

async function listGeocercas() {
  const hasCol = await detectPoligonoColumn();
  const { data, error } = await supabase
    .from('geocercas')
    .select(hasCol ? SELECT_FULL : SELECT_LEGACY)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(decodeRow);
}

async function insertGeocerca(body) {
  const built = buildRow(body);
  const hasCol = await detectPoligonoColumn();

  const row = {
    nombre: built.nombre,
    latitud: built.latitud,
    longitud: built.longitud,
    radio_metros: built.radio_metros,
    color: built.color,
    activa: built.activa,
    descripcion: hasCol
      ? built.texto
      : encodeDescripcion(built.texto, built.poligono),
  };
  if (hasCol) row.poligono = built.poligono;

  const { data, error } = await supabase
    .from('geocercas')
    .insert(row)
    .select(hasCol ? SELECT_FULL : SELECT_LEGACY)
    .single();
  if (error) throw new Error(error.message);
  return decodeRow(data);
}

async function updateGeocerca(id, body) {
  const built = buildRow(body);
  const hasCol = await detectPoligonoColumn();

  const row = {
    nombre: built.nombre,
    latitud: built.latitud,
    longitud: built.longitud,
    radio_metros: built.radio_metros,
    color: built.color,
    activa: built.activa,
    descripcion: hasCol
      ? built.texto
      : encodeDescripcion(built.texto, built.poligono),
  };
  if (hasCol) row.poligono = built.poligono;

  const { data, error } = await supabase
    .from('geocercas')
    .update(row)
    .eq('id', id)
    .select(hasCol ? SELECT_FULL : SELECT_LEGACY)
    .single();
  if (error) throw new Error(error.message);
  return decodeRow(data);
}

async function listActivasForCheckIn() {
  const hasCol = await detectPoligonoColumn();
  const select = hasCol
    ? 'id, nombre, latitud, longitud, radio_metros, poligono, descripcion'
    : 'id, nombre, latitud, longitud, radio_metros, descripcion';
  const { data, error } = await supabase.from('geocercas').select(select).eq('activa', true);
  if (error) throw new Error(error.message);
  return (data || []).map(decodeRow);
}

async function setActiva(id, activa) {
  const hasCol = await detectPoligonoColumn();
  const { data, error } = await supabase
    .from('geocercas')
    .update({ activa: !!activa })
    .eq('id', id)
    .select(hasCol ? SELECT_FULL : SELECT_LEGACY)
    .single();
  if (error) throw new Error(error.message);
  return decodeRow(data);
}

module.exports = {
  listGeocercas,
  insertGeocerca,
  updateGeocerca,
  listActivasForCheckIn,
  detectPoligonoColumn,
  setActiva,
  decodeRow,
};
