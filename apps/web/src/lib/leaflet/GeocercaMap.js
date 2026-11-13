/**
 * Módulo independiente Leaflet para geocercas.
 * Dibujo libre de polígonos: clic = vértice, doble clic o «cerrar» = terminar (≥3).
 * Compatibilidad: geocercas circulares (lat/lng/radio) sin poligono.
 *
 * @see https://leafletjs.com
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [19.4326, -99.1332]; // CDMX
const DEFAULT_ZOOM = 13;
const CLOSE_PX = 14;

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function puntoEnPoligono(lat, lng, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i].lat;
    const xi = pts[i].lng;
    const yj = pts[j].lat;
    const xj = pts[j].lng;
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function normalizePoly(poligono) {
  if (!Array.isArray(poligono) || poligono.length < 3) return null;
  return poligono.map((p) =>
    Array.isArray(p) ? { lat: Number(p[0]), lng: Number(p[1]) } : { lat: Number(p.lat), lng: Number(p.lng) }
  );
}

function styleGeocerca(color, activa) {
  return {
    color: color || '#2563eb',
    weight: 2,
    fillColor: color || '#2563eb',
    fillOpacity: activa === false ? 0.04 : 0.18,
    dashArray: activa === false ? '6 6' : null,
    interactive: true,
  };
}

export class GeocercaMap {
  /**
   * @param {HTMLElement} container
   * @param {object} [options]
   */
  constructor(container, options = {}) {
    if (!container) throw new Error('GeocercaMap: container requerido');

    this._opts = options;
    this._editable = !!options.editable;
    this._layers = new Map();
    this._draft = null;
    this._drawing = false;
    this._draftLayer = null;
    this._draftPreview = null;
    this._vertexMarkers = [];
    this._cursor = null;
    this._userMarker = null;
    this._accuracyCircle = null;
    this._userPos = null;
    this._geocercas = [];
    this._locateWatchId = null;

    this.map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      doubleClickZoom: false,
    }).setView(options.center || DEFAULT_CENTER, options.zoom ?? DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this._onClick = (e) => this._handleClick(e);
    this._onMove = (e) => this._handleMove(e);
    this._onDblClick = (e) => this._handleDblClick(e);
    this.map.on('click', this._onClick);
    this.map.on('mousemove', this._onMove);
    this.map.on('dblclick', this._onDblClick);

    requestAnimationFrame(() => this.map.invalidateSize());

    if (options.locateOnStart !== false) {
      this.locateUser({ fly: true });
    }
  }

  getDraft() {
    if (!this._draft) return null;
    return {
      ...this._draft,
      poligono: this._draft.poligono ? this._draft.poligono.map((p) => ({ ...p })) : [],
      vertices: this._draft.poligono?.length || 0,
      listo: (this._draft.poligono?.length || 0) >= 3 && !this._drawing,
    };
  }

  isDrawing() {
    return this._drawing;
  }

  setGeocercas(list = []) {
    this._geocercas = list;
    const keep = new Set(list.map((g) => g.id));

    for (const [id, layer] of this._layers) {
      if (!keep.has(id)) {
        this.map.removeLayer(layer);
        this._layers.delete(id);
      }
    }

    for (const g of list) {
      const style = styleGeocerca(g.color, g.activa);
      const poly = normalizePoly(g.poligono);
      let layer = this._layers.get(g.id);

      if (poly) {
        const latlngs = poly.map((p) => [p.lat, p.lng]);
        if (layer && layer instanceof L.Polygon) {
          layer.setLatLngs(latlngs);
          layer.setStyle(style);
        } else {
          if (layer) this.map.removeLayer(layer);
          layer = L.polygon(latlngs, style).addTo(this.map);
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this._opts.onSelect?.(g);
          });
          this._layers.set(g.id, layer);
        }
        layer.bindTooltip(`${g.nombre} · polígono (${poly.length} pts)`);
      } else {
        const latlng = [Number(g.latitud), Number(g.longitud)];
        const circleStyle = { ...style, radius: Number(g.radio_metros) };
        if (layer && layer instanceof L.Circle) {
          layer.setLatLng(latlng);
          layer.setRadius(circleStyle.radius);
          layer.setStyle(style);
        } else {
          if (layer) this.map.removeLayer(layer);
          layer = L.circle(latlng, circleStyle).addTo(this.map);
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this._opts.onSelect?.(g);
          });
          this._layers.set(g.id, layer);
        }
        layer.bindTooltip(`${g.nombre} · ${Math.round(g.radio_metros)} m`);
      }
    }
  }

  fitToGeocercas(padding = [40, 40]) {
    const layers = [...this._layers.values()];
    if (!layers.length) return;
    const group = L.featureGroup(layers);
    this.map.fitBounds(group.getBounds().pad(0.15), { padding });
  }

  focusGeocerca(id, zoom = 16) {
    const layer = this._layers.get(id);
    if (!layer) return;
    if (layer.getBounds) {
      this.map.fitBounds(layer.getBounds().pad(0.2));
    } else if (layer.getLatLng) {
      this.map.setView(layer.getLatLng(), zoom);
    }
  }

  /**
   * Modo dibujo de polígono libre.
   * @param {{color?: string}} [opts]
   */
  startDraw(opts = {}) {
    if (!this._editable) return;
    this.cancelDraw({ silent: true });
    this._drawing = true;
    this._draft = {
      poligono: [],
      color: opts.color || '#2563eb',
    };
    this.map.getContainer().style.cursor = 'crosshair';
    this._emitDraft();
  }

  /** Cierra el polígono si hay ≥3 vértices. */
  finishDraw() {
    if (!this._drawing || !this._draft || this._draft.poligono.length < 3) return null;
    this._drawing = false;
    this.map.getContainer().style.cursor = '';
    this._clearPreview();
    this._paintDraft(true);
    this._emitDraft();
    const draft = this.getDraft();
    this._opts.onDrawEnd?.(draft);
    return draft;
  }

  undoVertex() {
    if (!this._drawing || !this._draft?.poligono?.length) return;
    this._draft.poligono.pop();
    this._paintDraft(false);
    this._emitDraft();
  }

  cancelDraw(opts = {}) {
    this._drawing = false;
    this._clearDraftLayers();
    this._draft = null;
    this.map.getContainer().style.cursor = '';
    if (!opts.silent) this._emitDraft();
  }

  setDraft(partial = {}) {
    if (!this._draft) return;
    if (partial.color) this._draft.color = partial.color;
    if (partial.poligono) {
      const poly = normalizePoly(partial.poligono);
      if (poly) this._draft.poligono = poly;
    }
    this._paintDraft(!this._drawing);
    this._emitDraft();
  }

  getUserPosition() {
    return this._userPos ? { ...this._userPos } : null;
  }

  matchGeocercas(point) {
    const lat = point?.lat ?? this._userPos?.lat;
    const lng = point?.lng ?? this._userPos?.lng;
    if (lat == null || lng == null) return { dentro: [], fuera: [], actual: null };

    const scored = (this._geocercas || []).map((g) => {
      const poly = normalizePoly(g.poligono);
      let dentro = false;
      let distancia_metros = 0;

      if (poly) {
        dentro = puntoEnPoligono(lat, lng, poly) && g.activa !== false;
        const cLat = poly.reduce((s, p) => s + p.lat, 0) / poly.length;
        const cLng = poly.reduce((s, p) => s + p.lng, 0) / poly.length;
        distancia_metros = dentro
          ? 0
          : Math.round(haversineMeters({ lat, lng }, { lat: cLat, lng: cLng }));
      } else {
        distancia_metros = Math.round(
          haversineMeters({ lat, lng }, { lat: Number(g.latitud), lng: Number(g.longitud) })
        );
        dentro = distancia_metros <= Number(g.radio_metros) && g.activa !== false;
      }

      return { ...g, distancia_metros, dentro, tipo: poly ? 'poligono' : 'circulo' };
    });

    const dentro = scored.filter((g) => g.dentro).sort((a, b) => a.distancia_metros - b.distancia_metros);
    const fuera = scored.filter((g) => !g.dentro).sort((a, b) => a.distancia_metros - b.distancia_metros);
    return { dentro, fuera, actual: dentro[0] || null };
  }

  locateUser(opts = {}) {
    const fly = opts.fly !== false;
    const zoom = opts.zoom ?? 16;

    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const err = new Error('Geolocalización no disponible en este navegador');
        this._opts.onLocateError?.(err);
        reject(err);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy || 0;
          this.setUserLocation(lat, lng, { fly, zoom, accuracy });
          const payload = { lat, lng, accuracy };
          this._opts.onLocate?.(payload);
          resolve(payload);
        },
        (err) => {
          this._opts.onLocateError?.(err);
          reject(err);
        },
        {
          enableHighAccuracy: opts.highAccuracy !== false,
          timeout: opts.timeout ?? 15000,
          maximumAge: opts.maximumAge ?? 0,
        }
      );
    });
  }

  centerOnUser(opts = {}) {
    if (this._userPos) {
      this.setUserLocation(this._userPos.lat, this._userPos.lng, {
        fly: true,
        zoom: opts.zoom ?? 16,
        accuracy: this._userPos.accuracy,
      });
      return Promise.resolve(this.getUserPosition());
    }
    return this.locateUser({ fly: true, ...opts });
  }

  setUserLocation(lat, lng, { fly = true, zoom = 16, accuracy = 0 } = {}) {
    const latlng = [lat, lng];
    this._userPos = { lat, lng, accuracy: Number(accuracy) || 0 };

    if (this._userMarker) {
      this._userMarker.setLatLng(latlng);
    } else {
      this._userMarker = L.circleMarker(latlng, {
        radius: 8,
        color: '#0f172a',
        weight: 2,
        fillColor: '#22c55e',
        fillOpacity: 1,
      })
        .addTo(this.map)
        .bindTooltip('Tu ubicación');
    }

    const acc = Math.max(20, Math.min(Number(accuracy) || 40, 2000));
    if (this._accuracyCircle) {
      this._accuracyCircle.setLatLng(latlng);
      this._accuracyCircle.setRadius(acc);
    } else {
      this._accuracyCircle = L.circle(latlng, {
        radius: acc,
        color: '#2563eb',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(this.map);
    }

    if (fly) this.map.setView(latlng, Math.max(this.map.getZoom(), zoom));
  }

  invalidateSize() {
    this.map?.invalidateSize();
  }

  destroy() {
    if (this._locateWatchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this._locateWatchId);
      this._locateWatchId = null;
    }
    this.cancelDraw({ silent: true });
    this.map.off('click', this._onClick);
    this.map.off('mousemove', this._onMove);
    this.map.off('dblclick', this._onDblClick);
    this.map.remove();
    this.map = null;
    this._layers.clear();
  }

  // —— internos ——

  _emitDraft() {
    this._opts.onDraft?.(this.getDraft());
  }

  _clearPreview() {
    if (this._draftPreview) {
      this.map.removeLayer(this._draftPreview);
      this._draftPreview = null;
    }
  }

  _clearDraftLayers() {
    this._clearPreview();
    if (this._draftLayer) {
      this.map.removeLayer(this._draftLayer);
      this._draftLayer = null;
    }
    for (const m of this._vertexMarkers) this.map.removeLayer(m);
    this._vertexMarkers = [];
  }

  _paintDraft(closed) {
    this._clearDraftLayers();
    if (!this._draft?.poligono?.length) return;

    const color = this._draft.color || '#2563eb';
    const pts = this._draft.poligono;
    const latlngs = pts.map((p) => [p.lat, p.lng]);

    if (closed && pts.length >= 3) {
      this._draftLayer = L.polygon(latlngs, {
        color,
        weight: 2,
        dashArray: '4 6',
        fillColor: color,
        fillOpacity: 0.22,
      }).addTo(this.map);
    } else if (pts.length >= 2) {
      this._draftLayer = L.polyline(latlngs, {
        color,
        weight: 2,
        dashArray: '4 6',
      }).addTo(this.map);
    }

    this._vertexMarkers = pts.map((p, idx) =>
      L.circleMarker([p.lat, p.lng], {
        radius: idx === 0 ? 7 : 5,
        color: idx === 0 ? '#0f172a' : color,
        weight: 2,
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .addTo(this.map)
        .bindTooltip(idx === 0 ? 'Inicio (clic cerca para cerrar)' : `Vértice ${idx + 1}`)
    );
  }

  _nearFirstVertex(latlng) {
    if (!this._draft?.poligono?.length) return false;
    const first = this._draft.poligono[0];
    const a = this.map.latLngToContainerPoint(L.latLng(first.lat, first.lng));
    const b = this.map.latLngToContainerPoint(latlng);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) <= CLOSE_PX;
  }

  _handleClick(e) {
    if (!this._drawing || !this._editable || !this._draft) return;

    // Cerrar al hacer clic cerca del primer vértice
    if (this._draft.poligono.length >= 3 && this._nearFirstVertex(e.latlng)) {
      this.finishDraw();
      return;
    }

    this._draft.poligono.push({ lat: e.latlng.lat, lng: e.latlng.lng });
    this._paintDraft(false);
    this._emitDraft();
  }

  _handleDblClick(e) {
    if (!this._drawing) return;
    L.DomEvent.stopPropagation(e);
    L.DomEvent.preventDefault(e);
    // El doble clic también dispara click: el último vértice puede ser duplicado
    if (this._draft?.poligono?.length >= 2) {
      const last = this._draft.poligono[this._draft.poligono.length - 1];
      const prev = this._draft.poligono[this._draft.poligono.length - 2];
      if (
        Math.abs(last.lat - prev.lat) < 1e-10 &&
        Math.abs(last.lng - prev.lng) < 1e-10
      ) {
        this._draft.poligono.pop();
      }
    }
    this.finishDraw();
  }

  _handleMove(e) {
    if (!this._drawing || !this._draft?.poligono?.length) {
      this._clearPreview();
      return;
    }
    const last = this._draft.poligono[this._draft.poligono.length - 1];
    const latlngs = [
      [last.lat, last.lng],
      [e.latlng.lat, e.latlng.lng],
    ];
    if (this._draftPreview) {
      this._draftPreview.setLatLngs(latlngs);
    } else {
      this._draftPreview = L.polyline(latlngs, {
        color: this._draft.color || '#2563eb',
        weight: 1.5,
        dashArray: '2 6',
        opacity: 0.8,
      }).addTo(this.map);
    }
  }
}

export default GeocercaMap;
