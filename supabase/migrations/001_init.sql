-- SISTEMAIA: esquema base para control de accesos con geocercas
-- Ejecutar en el SQL Editor de Supabase o con `supabase db push`.

create extension if not exists "uuid-ossp";

-- ============ USUARIOS ============
create table if not exists public.usuarios (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text not null,
  email         text not null unique,
  password_hash text not null,
  rol           text not null default 'empleado' check (rol in ('admin', 'empleado')),
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============ GEOCERCAS ============
create table if not exists public.geocercas (
  id             uuid primary key default uuid_generate_v4(),
  nombre         text not null,
  descripcion    text,
  latitud        double precision not null,
  longitud       double precision not null,
  radio_metros   numeric not null check (radio_metros > 0),
  color          text not null default '#2563eb',
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ============ EVENTOS DE ACCESO ============
create table if not exists public.eventos_acceso (
  id                 uuid primary key default uuid_generate_v4(),
  usuario_id         uuid references public.usuarios(id) on delete cascade,
  geocerca_id        uuid references public.geocercas(id) on delete set null,
  tipo               text not null check (tipo in ('entrada', 'salida', 'denegado', 'fuera_de_rango')),
  latitud            double precision,
  longitud           double precision,
  precision_metros   numeric,
  dispositivo        text,
  creado_en          timestamptz not null default now()
);

create index if not exists idx_eventos_usuario on public.eventos_acceso(usuario_id, creado_en desc);
create index if not exists idx_eventos_geocerca on public.eventos_acceso(geocerca_id, creado_en desc);
create index if not exists idx_eventos_creado on public.eventos_acceso(creado_en desc);

-- ============ TRIGGER updated_at ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_usuarios_updated on public.usuarios;
create trigger trg_usuarios_updated
  before update on public.usuarios
  for each row execute function public.touch_updated_at();

-- ============ ROW LEVEL SECURITY ============
-- La API usa la service_role key (bypassa RLS). Estas políticas cubren
-- el acceso directo desde el cliente con la anon key.
alter table public.usuarios        enable row level security;
alter table public.geocercas       enable row level security;
alter table public.eventos_acceso  enable row level security;

-- Lectura para autenticados (la API media todo; políticas restrictivas por defecto)
create policy "usuarios: lectura autenticados"
  on public.usuarios for select to authenticated using (true);

create policy "geocercas: lectura autenticados"
  on public.geocercas for select to authenticated using (true);

create policy "eventos: lectura autenticados"
  on public.eventos_acceso for select to authenticated using (true);

-- Las escrituras se hacen siempre desde la API con service_role.
