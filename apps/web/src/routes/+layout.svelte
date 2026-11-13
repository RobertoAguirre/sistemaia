<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth, initAuth, clearSession } from '$lib/stores';
  import { api } from '$lib/api';

  let { children } = $props();

  const PUBLIC = new Set(['/login', '/registro', '/auth/callback']);

  onMount(() => {
    initAuth();
    // Valida el token contra la API una vez cargada la sesión
    const unsub = auth.subscribe(async (s) => {
      if (!s.loaded) return;
      if (!s.token) {
        if (!PUBLIC.has($page.url.pathname)) goto('/login');
        return;
      }
      try {
        const me = await api('/auth/me');
        // Evita restaurar user si hubo logout mientras /me estaba en vuelo
        auth.update((a) => (a.token ? { ...a, user: me } : a));
      } catch (e) {
        // Solo cerrar sesión si el token es inválido; no por rate limit/red
        if (e?.status === 401 || e?.status === 403) {
          clearSession();
          goto('/login');
        }
      }
    });
    return unsub;
  });

  function logout() {
    clearSession();
    goto('/login');
  }

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/mapa', label: 'Mapa y Geocercas' },
    { href: '/eventos', label: 'Eventos' },
    { href: '/perfil', label: 'Mi Perfil' },
  ];
</script>

{#if $auth.loaded && $auth.user}
  <header class="topbar">
    <strong>SISTEMAIA</strong>
    <nav>
      {#each links as l}
        <a href={l.href} class:active={$page.url.pathname === l.href}>{l.label}</a>
      {/each}
      {#if $auth.user.rol === 'admin'}
        <a href="/usuarios" class:active={$page.url.pathname === '/usuarios'}>Usuarios</a>
      {/if}
    </nav>
    <div class="user">
      <span>{$auth.user.nombre} <em>({$auth.user.rol})</em></span>
      <button onclick={logout}>Salir</button>
    </div>
  </header>
{/if}

<main>
  {#if $auth.loaded}
    {#if $auth.token || PUBLIC.has($page.url.pathname)}
      {@render children()}
    {/if}
  {:else}
    <p class="muted">Cargando…</p>
  {/if}
</main>
