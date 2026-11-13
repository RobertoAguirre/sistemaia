<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let resumen = $state(null);
  let error = $state(null);

  onMount(async () => {
    try {
      resumen = await api('/dashboard/resumen');
    } catch (e) {
      error = e.message;
    }
  });

  function fmt(iso) {
    return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  }
</script>

<h1>Dashboard</h1>
{#if error}<div class="error">{error}</div>{/if}

{#if resumen}
  <div class="grid">
    <div class="stat"><div class="num">{resumen.usuariosActivos}</div><div class="lbl">Usuarios activos</div></div>
    <div class="stat"><div class="num">{resumen.geocercasActivas}</div><div class="lbl">Geocercas activas</div></div>
    <div class="stat"><div class="num">{resumen.eventosHoy.entrada || 0}</div><div class="lbl">Entradas hoy</div></div>
    <div class="stat"><div class="num">{resumen.eventosHoy.salida || 0}</div><div class="lbl">Salidas hoy</div></div>
    <div class="stat"><div class="num">{(resumen.eventosHoy.denegado || 0) + (resumen.eventosHoy.fuera_de_rango || 0)}</div><div class="lbl">Accesos denegados hoy</div></div>
  </div>

  <div class="card" style="margin-top:1rem">
    <h2>Eventos recientes</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Geocerca</th><th>Ubicación</th></tr></thead>
      <tbody>
        {#each resumen.eventosRecientes as ev}
          <tr>
            <td>{fmt(ev.creado_en)}</td>
            <td>{ev.usuarios?.nombre || '—'}</td>
            <td><span class="badge {ev.tipo}">{ev.tipo}</span></td>
            <td>{ev.geocercas?.nombre || '—'}</td>
            <td class="muted">{ev.latitud?.toFixed(5)}, {ev.longitud?.toFixed(5)}</td>
          </tr>
        {:else}
          <tr><td colspan="5" class="muted">Sin eventos registrados</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if !error}
  <p class="muted">Cargando…</p>
{/if}
