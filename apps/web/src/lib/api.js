import { PUBLIC_API_URL } from '$env/static/public';
import { getToken } from './stores';

/**
 * Base del backend.
 * - Vercel (mismo dominio + rewrite /api → servicio api): deja PUBLIC_API_URL vacío → `/api/...`
 * - Dev local con API en otro puerto: PUBLIC_API_URL=http://localhost:3001
 */
const BASE = (PUBLIC_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export async function api(path, { method = 'GET', body, auth: useAuth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Error ${res.status}`, data);
  }
  return data;
}
