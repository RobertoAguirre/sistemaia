// Utilidades geográficas (círculos y polígonos)

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Distancia en metros entre dos puntos (fórmula de Haversine). */
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Normaliza vértices a [{lat,lng}, ...]. */
function normalizarPoligono(poligono) {
  if (!Array.isArray(poligono) || poligono.length < 3) return null;
  const pts = [];
  for (const p of poligono) {
    if (Array.isArray(p) && p.length >= 2) {
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      pts.push({ lat, lng });
    } else if (p && typeof p === 'object') {
      const lat = Number(p.lat ?? p.latitude);
      const lng = Number(p.lng ?? p.lon ?? p.longitud ?? p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      pts.push({ lat, lng });
    } else {
      return null;
    }
  }
  // Quitar cierre duplicado si el último = primero
  if (
    pts.length > 3 &&
    pts[0].lat === pts[pts.length - 1].lat &&
    pts[0].lng === pts[pts.length - 1].lng
  ) {
    pts.pop();
  }
  return pts.length >= 3 ? pts : null;
}

/** Centroide simple (promedio de vértices). */
function centroidePoligono(pts) {
  let lat = 0;
  let lng = 0;
  for (const p of pts) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

/** Radio envolvente: distancia máxima del centroide a un vértice. */
function radioEnvolvente(pts, centro) {
  let max = 0;
  for (const p of pts) {
    max = Math.max(max, distanciaMetros(centro.lat, centro.lng, p.lat, p.lng));
  }
  return Math.max(1, Math.round(max));
}

/**
 * Ray casting: ¿punto dentro del polígono?
 * @param {number} lat
 * @param {number} lon
 * @param {{lat:number,lng:number}[]} pts
 */
function puntoEnPoligono(lat, lon, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i].lat;
    const xi = pts[i].lng;
    const yj = pts[j].lat;
    const xj = pts[j].lng;
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Devuelve true si el punto está dentro de la geocerca (polígono o círculo). */
function dentroDeGeocerca(lat, lon, geocerca) {
  const poly = normalizarPoligono(geocerca.poligono);
  if (poly) return puntoEnPoligono(lat, lon, poly);

  const dist = distanciaMetros(lat, lon, geocerca.latitud, geocerca.longitud);
  return dist <= Number(geocerca.radio_metros);
}

/**
 * Distancia de referencia al "centro" de la geocerca (centroide o lat/lng).
 * Si hay polígono y el punto está dentro, distancia = 0 para priorizar en sort.
 */
function distanciaAGeocerca(lat, lon, geocerca) {
  const poly = normalizarPoligono(geocerca.poligono);
  if (poly) {
    if (puntoEnPoligono(lat, lon, poly)) return 0;
    const c = centroidePoligono(poly);
    return distanciaMetros(lat, lon, c.lat, c.lng);
  }
  return distanciaMetros(lat, lon, geocerca.latitud, geocerca.longitud);
}

/** A partir de un polígono, calcula campos circulares de compatibilidad. */
function metadatosDesdePoligono(poligono) {
  const pts = normalizarPoligono(poligono);
  if (!pts) return null;
  const centro = centroidePoligono(pts);
  return {
    poligono: pts,
    latitud: centro.lat,
    longitud: centro.lng,
    radio_metros: radioEnvolvente(pts, centro),
  };
}

module.exports = {
  distanciaMetros,
  dentroDeGeocerca,
  distanciaAGeocerca,
  normalizarPoligono,
  metadatosDesdePoligono,
  puntoEnPoligono,
};
