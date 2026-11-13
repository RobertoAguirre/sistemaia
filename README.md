# SISTEMAIA — Control de accesos con geocercas

Monorepo: **SvelteKit** (frontend) + **Node/Express** (backend) + **Supabase** (PostgreSQL).
Geocercas dibujadas sobre OpenStreetMap (Leaflet) y check-in/out usando el GPS del navegador.

## Estructura

```
apps/web    → SvelteKit (SPA, adapter-vercel)
apps/api    → Express API (JWT + bcrypt + Supabase + rate limit)
supabase/   → migraciones SQL
api/        → funciones serverless para Vercel (dentro de apps/api)
```

## Setup local

1. `cp .env.example .env` y completa las variables de Supabase.
2. En Supabase → SQL Editor, ejecuta `supabase/migrations/001_init.sql`.
3. Crea el admin: `ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD=clave1234 node apps/api/scripts/seed-admin.js`
4. Instala dependencias: `npm install`
5. Levanta ambos: `npm run dev:api` (puerto 3001) y `npm run dev:web` (puerto 5173)

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/eventos/check-in` | Check-in/out con GPS + geocerca |
| GET/POST/PUT/DELETE | `/api/geocercas` | CRUD de geocercas (escritura: admin) |
| GET/POST/PUT/DELETE | `/api/usuarios` | Gestión de usuarios (admin) |
| GET | `/api/eventos` | Historial con filtros |
| GET | `/api/dashboard/resumen` | Métricas del panel |

## Seguridad

- Contraseñas con **bcrypt** (12 rounds), nunca en texto plano.
- JWT HS256 con expiración (`JWT_EXPIRES_IN`).
- Toda la config sensible en `.env` (nunca commiteado; ver `.env.example`).
- **Balance de cargas**: rate limit global (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`) y estricto en login/check-in (`RATE_LIMIT_AUTH_*`).
- La service_role key solo vive en el backend.
- RLS activado en Supabase como segunda capa.
- Validación de precisión GPS (`MIN_ACCURACY_METERS`) para evitar spoofing básico.

## Login con Google (Supabase Auth)

El login/registro con Google usa **Supabase Auth**:

1. En Supabase → Authentication → Providers → **Google**: habilítalo con tu Client ID/Secret de Google Cloud.
2. En Authentication → URL Configuration agrega el redirect: `http://localhost:5173/auth/callback` (y la URL de producción en Vercel).
3. Flujo: el front llama `signInWithOAuth` → Google → `/auth/callback` → el front envía el `access_token` a `POST /api/auth/supabase` → el backend verifica el token con Supabase, **crea el usuario en `usuarios` si no existe** (rol `empleado`) y devuelve el JWT propio.

El middleware `requireAuth` acepta tanto el JWT propio como access tokens de Supabase, así la app móvil podrá autenticarse directo con Supabase si lo prefieres.

## Deploy en Vercel (Services)

Un solo proyecto Vercel con dos servicios (`vercel.json` en la raíz):

| Servicio | Root | Público |
|---|---|---|
| `api` | `apps/api` (Express) | sí, bajo `/api/*` |
| `web` | `apps/web` (SvelteKit) | sí, bajo `/*` |

1. Conecta el repo a Vercel (root del monorepo, no una subcarpeta).
2. Configura en el proyecto las env vars del `.env` (Supabase, JWT, etc.).
3. **No** definas `PUBLIC_API_URL` en Vercel: el front llama same-origin `/api/...` y el rewrite lo manda al servicio `api`.
4. Local unificado: `vercel dev` (o `vercel dev --local`).

> La app móvil puede consumir la misma URL pública `/api/...`. El endpoint `/api/eventos/check-in` acepta `{lat, lng, precision_metros, dispositivo, tipo}`.
