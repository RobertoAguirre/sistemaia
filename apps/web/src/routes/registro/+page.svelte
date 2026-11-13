<script>
  import { goto } from '$app/navigation';
  import { setSession } from '$lib/stores';
  import { api } from '$lib/api';

  let nombre = $state('');
  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let error = $state(null);
  let loading = $state(false);

  async function submit(e) {
    e.preventDefault();
    error = null;
    if (password !== confirm) {
      error = 'Las contraseñas no coinciden';
      return;
    }
    loading = true;
    try {
      const res = await api('/auth/register', {
        method: 'POST',
        body: { nombre, email, password },
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
</script>

<div class="login-wrap">
  <div class="card">
    <h2>Crear cuenta</h2>
    <p class="muted">Registro manual en SISTEMAIA</p>
    <form onsubmit={submit}>
      <label for="nombre">Nombre completo</label>
      <input id="nombre" bind:value={nombre} required minlength="2" autocomplete="name" />
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required autocomplete="email" />
      <label for="password">Contraseña (mín. 8 caracteres)</label>
      <input id="password" type="password" bind:value={password} required minlength="8" autocomplete="new-password" />
      <label for="confirm">Confirmar contraseña</label>
      <input id="confirm" type="password" bind:value={confirm} required minlength="8" autocomplete="new-password" />
      {#if error}<div class="error">{error}</div>{/if}
      <div style="margin-top:1rem">
        <button class="btn" type="submit" disabled={loading}>
          {loading ? 'Creando…' : 'Registrarme'}
        </button>
      </div>
    </form>
    <p class="muted" style="font-size:.85rem;margin-top:1rem">
      ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
    </p>
  </div>
</div>
