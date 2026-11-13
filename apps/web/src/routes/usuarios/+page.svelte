<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores';

  let usuarios = $state([]);
  let error = $state(null);
  let msg = $state(null);
  let showForm = $state(false);

  // form
  let fNombre = $state('');
  let fEmail = $state('');
  let fPassword = $state('');
  let fRol = $state('empleado');
  let editId = $state(null);

  async function cargar() {
    try { usuarios = await api('/usuarios'); }
    catch (e) { error = e.message; }
  }
  onMount(cargar);

  function resetForm() {
    fNombre = fEmail = fPassword = '';
    fRol = 'empleado'; editId = null; showForm = false;
  }

  function editar(u) {
    editId = u.id; fNombre = u.nombre; fEmail = u.email; fRol = u.rol; fPassword = '';
    showForm = true;
  }

  async function guardar(e) {
    e.preventDefault(); error = null; msg = null;
    try {
      const body = { nombre: fNombre, email: fEmail, rol: fRol };
      if (fPassword) body.password = fPassword;
      if (editId) {
        await api(`/usuarios/${editId}`, { method: 'PUT', body });
        msg = 'Usuario actualizado';
      } else {
        body.password = fPassword;
        await api('/usuarios', { method: 'POST', body });
        msg = 'Usuario creado';
      }
      resetForm();
      await cargar();
    } catch (err) { error = err.message; }
  }

  async function toggleActivo(u) {
    try {
      await api(`/usuarios/${u.id}`, { method: 'PUT', body: { activo: !u.activo } });
      await cargar();
    } catch (e) { error = e.message; }
  }

  async function eliminar(u) {
    if (!confirm(`¿Eliminar a ${u.nombre}?`)) return;
    try {
      await api(`/usuarios/${u.id}`, { method: 'DELETE' });
      await cargar();
    } catch (e) { error = e.message; }
  }
</script>

<h1>Usuarios</h1>
{#if error}<div class="error">{error}</div>{/if}
{#if msg}<div class="ok">{msg}</div>{/if}

{#if $auth.user?.rol === 'admin'}
  <div class="card">
    <div class="row fixed">
      <button class="btn" onclick={() => (showForm = !showForm)}>
        {showForm ? 'Cancelar' : '+ Nuevo usuario'}
      </button>
    </div>
    {#if showForm}
      <form onsubmit={guardar} style="margin-top:0.75rem">
        <div class="row">
          <div><label>Nombre</label><input bind:value={fNombre} required /></div>
          <div><label>Email</label><input type="email" bind:value={fEmail} required /></div>
          <div><label>Rol</label>
            <select bind:value={fRol}>
              <option value="empleado">Empleado</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div><label>Contraseña {editId ? '(vacío = no cambiar)' : ''}</label>
            <input type="password" bind:value={fPassword} minlength="8" required={!editId} />
          </div>
          <div><button class="btn" type="submit">{editId ? 'Guardar' : 'Crear'}</button></div>
        </div>
      </form>
    {/if}
  </div>
{/if}

<div class="card">
  <table>
    <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
    <tbody>
      {#each usuarios as u}
        <tr>
          <td>{u.nombre}</td>
          <td>{u.email}</td>
          <td>{u.rol}</td>
          <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
          <td style="white-space:nowrap">
            {#if $auth.user?.rol === 'admin'}
              <button class="btn secondary" onclick={() => editar(u)}>Editar</button>
              <button class="btn secondary" onclick={() => toggleActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
              <button class="btn danger" onclick={() => eliminar(u)}>Eliminar</button>
            {/if}
          </td>
        </tr>
      {:else}
        <tr><td colspan="5" class="muted">Sin usuarios</td></tr>
      {/each}
    </tbody>
  </table>
</div>
