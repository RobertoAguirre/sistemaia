<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { setSession } from '$lib/stores';
  import { api } from '$lib/api';
  import { supabase } from '$lib/supabase';

  let error = $state(null);

  onMount(async () => {
    try {
      // Si la URL trae ?code= (PKCE), intercámbialo por sesión
      const params = new URLSearchParams(location.search);
      if (params.get('code')) {
        await supabase.auth.exchangeCodeForSession(location.href);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        error = 'No se recibió sesión de Google';
        goto('/login');
        return;
      }

      // Envía el access_token de Supabase al backend:
      // este crea/enlaza el usuario en `usuarios` y devuelve nuestro JWT
      const res = await api('/auth/supabase', {
        method: 'POST',
        body: { access_token: session.access_token },
        auth: false,
      });
      setSession(res.token, res.usuario);
      goto('/');
    } catch (e) {
      error = e.message;
      setTimeout(() => goto('/login'), 2500);
    }
  });
</script>

<div class="login-wrap">
  <div class="card" style="text-align:center">
    {#if error}
      <div class="error">{error}</div>
      <p class="muted">Redirigiendo al login…</p>
    {:else}
      <p>Completando acceso con Google…</p>
    {/if}
  </div>
</div>
