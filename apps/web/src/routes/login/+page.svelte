<script>
  import { goto } from '$app/navigation';
  import { setSession } from '$lib/stores';
  import { api } from '$lib/api';
  import { supabase } from '$lib/supabase';

  let email = $state('');
  let password = $state('');
  let error = $state(null);
  let loading = $state(false);

  async function submit(e) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      setSession(res.token, res.usuario);
      goto('/');
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loginGoogle() {
    error = null;
    const redirectTo = `${location.origin}/auth/callback`;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (err) error = err.message;
  }
</script>

<div class="login-wrap">
  <div class="card">
    <h2>SISTEMAIA</h2>
    <p class="muted">Control de accesos con geocercas</p>

    <button class="btn" style="width:100%;background:#fff;color:#0f172a;border:1px solid #cbd5e1" onclick={loginGoogle} disabled={loading}>
      <svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:-3px;margin-right:6px">
        <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.02c2.2-2 3.5-5 3.5-8.6z"/>
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.14.01-3.6 2.8-.05.13C3.4 21.3 7.4 24 12 24z"/>
        <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-.01-.16-3.7-2.9-.12.06C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.4l3.8-3z"/>
        <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l3.8 3c1-2.9 3.7-5 6.8-5z"/>
      </svg>
      Continuar con Google
    </button>

    <div class="row" style="margin:1rem 0"><hr style="flex:1;border:0;border-top:1px solid #e2e8f0"><span class="muted" style="font-size:.8rem">o</span><hr style="flex:1;border:0;border-top:1px solid #e2e8f0"></div>

    <form onsubmit={submit}>
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required autocomplete="email" />
      <label for="password">Contraseña</label>
      <input id="password" type="password" bind:value={password} required autocomplete="current-password" />
      {#if error}<div class="error">{error}</div>{/if}
      <div style="margin-top:1rem">
        <button class="btn" type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </div>
    </form>
    <p class="muted" style="font-size:.8rem;margin-top:1rem">
      ¿Primera vez con Google? Tu cuenta se crea automáticamente al ingresar.<br />
      ¿Prefieres email? <a href="/registro">Crea una cuenta</a>
    </p>
  </div>
</div>
