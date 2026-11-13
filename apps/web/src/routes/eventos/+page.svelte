<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores';

  let eventos = $state([]);
  let usuarios = $state([]);
  let error = $state(null);
  let filtroTipo = $state('');
  let filtroUsuario = $state('');
  let filtroDesde = $state('');

  async function cargar() {
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroUsuario) params.set('usuario_id', filtroUsuario);
      if (filtroDesde) params.set('desde', new Date(filtroDesde).toISOString());
      eventos = await api(`/eventos?${params}`);
      if ($auth.user?.rol === 'admin') usuarios = await api('/usuarios');
    } catch (e) { error = e.message; }
  }

  onMount(cargar);

  function fmt(iso) { return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }); }
</script>

<h1>Eventos de acceso</h1>
{#if error}<div class="error">{error}</div>{/if}

<div class="card">
  <div class="row">
    <div>
      <label>Tipo</label>
      <select bind:value={filtroTipo} onchange={cargar}>
        <option value="">Todos</option>
        <option value="entrada">Entrada</option>
        <option value="salida">Salida</option>
        <option value="denegado">Denegado</option>
        <option value="fuera_de_rango">Fuera de rango</option>
      </select>
    </div>
    {#if $auth.user?.rol === 'admin'}
      <div>
        <label>Usuario</label>
        <select bind:value={filtroUsuario} onchange={cargar}>
          <option value="">Todos</option>
          {#each usuarios as u}<option value={u.id}>{u.nombre}</option>{/each}
        </select>
      </div>
    {/if}
    <div>
      <label>Desde</label>
      <input type="date" bind:value={filtroDesde} onchange={cargar} />
    </div>
  </div>
</div>

<div class="card">
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        {#if $auth.user?.rol === 'admin'}<th>Usuario</th>{/if}
        <th>Tipo</th><th>Geocerca</th><th>GPS</th><th>Precisión</th>
      </tr>
    </thead>
    <tbody>
      {#each eventos as ev}
        <tr>
          <td>{fmt(ev.creado_en)}</td>
          {#if $auth.user?.rol === 'admin'}<td>{ev.usuarios?.nombre || '—'}</td>{/if}
          <td><span class="badge {ev.tipo}">{ev.tipo}</span></td>
          <td>{ev.geocercas?.nombre || '—'}</td>
          <td class="muted">{ev.latitud?.toFixed(5)}, {ev.longitud?.toFixed(5)}</td>
          <td class="muted">{ev.precision_metros ? Math.round(ev.precision_metros) + ' m' : '—'}</td>
        </tr>
      {:else}
        <tr><td colspan="6" class="muted">Sin eventos</td></tr>
      {/each}
    </tbody>
  </table>
</div>
