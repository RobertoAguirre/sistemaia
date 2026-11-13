<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores';

  let nombre = $state('');
  let email = $state('');
  let msg = $state(null);
  let error = $state(null);

  // cambio de contraseña
  let cur = $state('');
  let nueva = $state('');
  let msgPw = $state(null);
  let errorPw = $state(null);

  onMount(() => {
    if ($auth.user) { nombre = $auth.user.nombre; email = $auth.user.email; }
  });

  async function guardarPerfil(e) {
    e.preventDefault(); error = null; msg = null;
    try {
      const u = await api(`/usuarios/${$auth.user.id}`, { method: 'PUT', body: { nombre, email } });
      auth.update((a) => ({ ...a, user: { ...a.user, nombre: u.nombre, email: u.email } }));
      localStorage.setItem('sistemaia_user', JSON.stringify({ ...JSON.parse(localStorage.getItem('sistemaia_user')), nombre: u.nombre, email: u.email }));
      msg = 'Perfil actualizado';
    } catch (err) { error = err.message; }
  }

  async function cambiarPw(e) {
    e.preventDefault(); errorPw = null; msgPw = null;
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: nueva } });
      cur = nueva = '';
      msgPw = 'Contraseña actualizada';
    } catch (err) { errorPw = err.message; }
  }
</script>

<h1>Mi Perfil</h1>

<div class="card">
  <h2>Datos personales</h2>
  {#if error}<div class="error">{error}</div>{/if}
  {#if msg}<div class="ok">{msg}</div>{/if}
  <form onsubmit={guardarPerfil}>
    <label>Nombre</label>
    <input bind:value={nombre} required />
    <label>Email</label>
    <input type="email" bind:value={email} required />
    <div style="margin-top:1rem"><button class="btn" type="submit">Guardar</button></div>
  </form>
</div>

<div class="card">
  <h2>Cambiar contraseña</h2>
  {#if errorPw}<div class="error">{errorPw}</div>{/if}
  {#if msgPw}<div class="ok">{msgPw}</div>{/if}
  <form onsubmit={cambiarPw}>
    <label>Contraseña actual</label>
    <input type="password" bind:value={cur} required autocomplete="current-password" />
    <label>Nueva contraseña (mín. 8 caracteres)</label>
    <input type="password" bind:value={nueva} required minlength="8" autocomplete="new-password" />
    <div style="margin-top:1rem"><button class="btn" type="submit">Cambiar contraseña</button></div>
  </form>
</div>
