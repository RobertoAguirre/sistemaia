-- Geocercas poligonales (dibujo libre).
-- poligono: [{ "lat": number, "lng": number }, ...] (mín. 3 vértices).
-- latitud/longitud/radio_metros se conservan como centroide + radio envolvente
-- para ordenar distancias y compatibilidad con geocercas circulares previas.

alter table public.geocercas
  add column if not exists poligono jsonb;

comment on column public.geocercas.poligono is
  'Vértices del polígono [{lat,lng},...]. Si es null, la geocerca es circular (lat/lng/radio).';

-- Relajar NOT NULL de radio solo si quieres polígonos sin círculo;
-- mantenemos radio_metros siempre poblado (envolvente) desde la API.
