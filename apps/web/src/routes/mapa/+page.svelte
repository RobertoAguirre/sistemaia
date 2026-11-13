<script>
  import { onMount, tick } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import { auth } from '$lib/stores';
  import { GeocercaMap } from '$lib/leaflet';

  let mapEl;
  /** @type {import('$lib/leaflet').GeocercaMap | null} */
  let geoMap = null;

  let geocercas = $state([]);
  let misEventos = $state([]);
  let error = $state(null);
  let msg = $state(null);
  let drawing = $state(false);
  let draft = $state(null);
  let saving = $state(false);
  let locating = $state(false);
  let locatingMap = $state(true);
  let status = $state(/** @type {{actual: object|null, fuera: object[]}|null} */ (null));

  let fNombre = $state('');
  let fColor = $state('#2563eb');
  let fDescripcion = $state('');

  const isAdmin = $derived($auth.user?.rol === 'admin');
  const vertices = $derived(draft?.poligono?.length || 0);
  const puedeGuardar = $derived(vertices >= 3);

  function refreshStatus() {
    const match = geoMap?.matchGeocercas();
    status = match ? { actual: match.actual, fuera: match.fuera.slice(0, 3) } : null;
  }

  async function cargar() {
    try {
      [geocercas, misEventos] = await Promise.all([
        api('/geocercas'),
        api('/dashboard/mis-eventos?limit=10'),
      ]);
      geoMap?.setGeocercas(geocercas);
      refreshStatus();
    } catch (e) {
      error = e.message;
    }
  }

  onMount(() => {
    geoMap = new GeocercaMap(mapEl, {
      editable: true,
      locateOnStart: true,
      onDraft: (d) => {
        draft = d;
      },
      onDrawEnd: (d) => {
        drawing = false;
        draft = d;
        msg = `Polígono listo (${d.poligono.length} vértices). Completa el panel y guarda.`;
      },
      onSelect: (g) => {
        if (!g) return;
        msg = `Geocerca: ${g.nombre}`;
        geoMap?.focusGeocerca(g.id);
      },
      onLocate: (pos) => {
        locatingMap = false;
        const match = geoMap?.matchGeocercas(pos);
        status = match ? { actual: match.actual, fuera: match.fuera.slice(0, 3) } : null;
        if (!drawing && !draft) {
          msg = match?.actual
            ? `Estás dentro de «${match.actual.nombre}». Ya puedes registrar entrada o salida.`
            : `Ubicación obtenida (±${Math.round(pos.accuracy)} m).`;
        }
      },
      onLocateError: (err) => {
        locatingMap = false;
        const denied = err?.code === 1;
        error = denied
          ? 'Permiso de ubicación denegado. Actívalo en el navegador o usa «Mi ubicación».'
          : `No se pudo obtener tu ubicación: ${err?.message || 'error de GPS'}`;
        if (geocercas.length) geoMap?.fitToGeocercas();
      },
    });

    cargar();
    tick().then(() => geoMap?.invalidateSize());

    return () => {
      geoMap?.destroy();
      geoMap = null;
    };
  });

  async function irAMiUbicacion() {
    locatingMap = true;
    error = null;
    try {
      await geoMap?.locateUser({ fly: true, zoom: 16 });
      refreshStatus();
    } catch {
      /* onLocateError */
    } finally {
      locatingMap = false;
    }
  }

  function empezarDibujo() {
    if (!isAdmin) return;
    error = null;
    msg = 'Panel de dibujo activo: clic en el mapa para cada vértice.';
    drawing = true;
    fNombre = '';
    fDescripcion = '';
    fColor = '#2563eb';
    geoMap?.startDraw({ color: fColor });
    tick().then(() => geoMap?.invalidateSize());
  }

  function cerrarPoligono() {
    const d = geoMap?.finishDraw();
    if (!d) {
      error = 'Necesitas al menos 3 vértices para cerrar el polígono';
      return;
    }
    drawing = false;
    draft = d;
    msg = `Polígono cerrado (${d.poligono.length} pts). Pon nombre y guarda.`;
  }

  function deshacerVertice() {
    geoMap?.undoVertex();
  }

  function cancelarDibujo() {
    drawing = false;
    draft = null;
    msg = null;
    error = null;
    geoMap?.cancelDraw();
  }

  function onColorInput() {
    geoMap?.setDraft({ color: fColor });
  }

  async function crearGeocerca(e) {
    e.preventDefault();
    const d = geoMap?.getDraft() || draft;
    if (!d?.poligono || d.poligono.length < 3) {
      error = 'Dibuja un polígono con al menos 3 vértices';
      return;
    }
    if (drawing) {
      const closed = geoMap?.finishDraw();
      if (!closed) {
        error = 'Cierra el polígono antes de guardar (mín. 3 vértices)';
        return;
      }
      draft = closed;
    }

    saving = true;
    error = null;
    try {
      const created = await api('/geocercas', {
        method: 'POST',
        body: {
          nombre: fNombre.trim(),
          descripcion: fDescripcion,
          poligono: (geoMap?.getDraft() || draft).poligono,
          color: fColor,
        },
      });
      fNombre = '';
      fDescripcion = '';
      draft = null;
      drawing = false;
      geoMap?.cancelDraw({ silent: true });
      msg = `Geocerca «${created.nombre}» guardada. Quien esté dentro podrá registrar entrada/salida.`;
      await cargar();
      geoMap?.focusGeocerca(created.id);
      refreshStatus();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function toggleActiva(g) {
    try {
      await api(`/geocercas/${g.id}/activa`, { method: 'PATCH', body: { activa: !g.activa } });
      await cargar();
    } catch (e) {
      error = e.message;
    }
  }

  async function eliminar(g) {
    if (!confirm(`¿Eliminar geocerca "${g.nombre}"?`)) return;
    try {
      await api(`/geocercas/${g.id}`, { method: 'DELETE' });
      await cargar();
    } catch (e) {
      error = e.message;
    }
  }

  async function registrar(tipo) {
    locating = true;
    error = null;
    msg = null;
    try {
      const pos = await geoMap?.locateUser({ fly: true, zoom: 16 });
      if (!pos) throw new Error('Sin ubicación GPS');
      refreshStatus();

      const res = await api('/eventos/check-in', {
        method: 'POST',
        body: {
          lat: pos.lat,
          lng: pos.lng,
          precision_metros: pos.accuracy,
          dispositivo: navigator.userAgent.slice(0, 120),
          tipo,
        },
      });
      msg = `${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada en «${res.geocerca}»`;
      await cargar();
    } catch (e) {
      if (e instanceof ApiError && e.extra?.geocercas?.length) {
        const cerca = e.extra.geocercas[0];
        error = `${e.message}. Más cercana: «${cerca.nombre}» a ${cerca.distancia_metros} m.`;
      } else if (e?.message) {
        error = e.message;
      } else {
        error = 'No se pudo registrar el acceso';
      }
      refreshStatus();
    } finally {
      locating = false;
    }
  }

  function fmt(iso) {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  }

  function labelGeocerca(g) {
    if (Array.isArray(g.poligono) && g.poligono.length >= 3) {
      return `${g.poligono.length} vértices`;
    }
    return `${Math.round(g.radio_metros)} m`;
  }
</script>

<h1>Mapa y Geocercas</h1>
{#if error}<div class="error">{error}</div>{/if}
{#if msg}<div class="ok">{msg}</div>{/if}

<div class="mapa-layout">
  <div>
    <div class="map-frame">
      {#if isAdmin}
        <div class="draw-panel">
          <div class="draw-panel-head">
            <div>
              <h2>Panel de dibujo</h2>
              <div class="draw-meta">
                {#if drawing}
                  {#if vertices < 1}
                    Clic en el mapa para el primer vértice
                  {:else if vertices < 3}
                    Vértices: {vertices}/3 mín. — sigue marcando puntos
                  {:else}
                    Vértices: {vertices} — cierra el polígono o guárdalo
                  {/if}
                {:else if draft}
                  Polígono listo ({vertices} pts) — completa y guarda
                {:else}
                  Dibuja un polígono libre para crear una geocerca
                {/if}
              </div>
            </div>
            <div class="draw-tools">
              {#if !drawing && !draft}
                <button class="btn" type="button" onclick={empezarDibujo}>Dibujar polígono</button>
              {:else}
                {#if drawing}
                  <button
                    class="btn secondary"
                    type="button"
                    onclick={deshacerVertice}
                    disabled={vertices < 1}
                  >
                    Deshacer punto
                  </button>
                  <button
                    class="btn"
                    type="button"
                    onclick={cerrarPoligono}
                    disabled={vertices < 3}
                  >
                    Cerrar polígono
                  </button>
                {/if}
                <button class="btn secondary" type="button" onclick={cancelarDibujo}>Cancelar</button>
              {/if}
              <button class="btn secondary" type="button" onclick={irAMiUbicacion} disabled={locatingMap}>
                {locatingMap ? 'Localizando…' : 'Mi ubicación'}
              </button>
            </div>
          </div>

          <form class="draw-form" onsubmit={crearGeocerca}>
            <div>
              <label for="geo-nombre">Nombre de la geocerca</label>
              <input
                id="geo-nombre"
                bind:value={fNombre}
                required
                minlength="2"
                placeholder="Ej. Oficina, Bodega, Patio…"
                disabled={!drawing && !draft}
              />
            </div>
            <div>
              <label for="geo-color">Color</label>
              <input
                id="geo-color"
                type="color"
                bind:value={fColor}
                oninput={onColorInput}
                disabled={!drawing && !draft}
              />
            </div>
            <div>
              <label for="geo-desc">Descripción</label>
              <input
                id="geo-desc"
                bind:value={fDescripcion}
                placeholder="Opcional"
                disabled={!drawing && !draft}
              />
            </div>
            <div class="draw-save">
              <label for="geo-save">&nbsp;</label>
              <button
                id="geo-save"
                class="btn"
                type="submit"
                style="width:100%"
                disabled={saving || !puedeGuardar || !fNombre.trim()}
              >
                {saving ? 'Guardando…' : 'Crear geocerca'}
              </button>
            </div>
          </form>
        </div>
      {/if}

      <div class="map-shell">
        <div id="map" bind:this={mapEl}></div>
        {#if locatingMap}
          <div class="map-hint">Obteniendo tu ubicación…</div>
        {:else if drawing}
          <div class="map-hint">
            {#if vertices < 1}
              Clic = <strong>primer vértice</strong>
            {:else if vertices < 3}
              Clic = más vértices ({vertices}/3)
            {:else}
              Doble clic / clic en inicio / «Cerrar polígono»
            {/if}
          </div>
        {:else if status?.actual}
          <div class="map-hint">Dentro de <strong>{status.actual.nombre}</strong></div>
        {/if}
      </div>
    </div>

    <div class="row fixed" style="margin-top:0.75rem">
      <button class="btn" onclick={() => registrar('entrada')} disabled={locating || locatingMap}>
        {locating ? 'Registrando…' : 'Registrar entrada'}
      </button>
      <button class="btn secondary" onclick={() => registrar('salida')} disabled={locating || locatingMap}>
        Registrar salida
      </button>
      {#if !isAdmin}
        <button class="btn secondary" onclick={irAMiUbicacion} disabled={locatingMap}>
          {locatingMap ? 'Localizando…' : 'Mi ubicación'}
        </button>
      {/if}
    </div>
  </div>

  <div>
    <div class="card">
      <h2>Estado GPS</h2>
      {#if locatingMap}
        <p class="muted">Localizando…</p>
      {:else if status?.actual}
        <p>
          <span class="badge entrada">dentro</span>
          <strong>{status.actual.nombre}</strong>
        </p>
        <p class="muted" style="font-size:.85rem;margin:0">Puedes registrar entrada o salida ahora.</p>
      {:else if geocercas.length}
        <p>
          <span class="badge denegado">fuera</span>
          <span class="muted">No estás dentro de ninguna geocerca activa.</span>
        </p>
        {#if status?.fuera?.[0]}
          <p class="muted" style="font-size:.85rem;margin:0">
            Más cercana: {status.fuera[0].nombre} a {status.fuera[0].distancia_metros} m
          </p>
        {/if}
      {:else}
        <p class="muted">Aún no hay geocercas. {#if isAdmin}Usa el panel superior para dibujar.{/if}</p>
      {/if}
    </div>

    <div class="card">
      <h2>Geocercas</h2>
      {#each geocercas as g}
        <div class="geo-item">
          <button
            type="button"
            class="geo-select"
            onclick={() => geoMap?.focusGeocerca(g.id)}
            title="Centrar en mapa"
          >
            <span class="dot" style="background:{g.color}"></span>
            <span style="flex:1;text-align:left">
              {g.nombre}
              <span class="muted">· {labelGeocerca(g)}</span>
              {#if !g.activa}<span class="muted">· inactiva</span>{/if}
            </span>
          </button>
          {#if isAdmin}
            <button class="icon" title={g.activa ? 'Desactivar' : 'Activar'} onclick={() => toggleActiva(g)}>
              {g.activa ? '⏸' : '▶'}
            </button>
            <button class="icon" title="Eliminar" onclick={() => eliminar(g)}>🗑</button>
          {/if}
        </div>
      {:else}
        <p class="muted">
          No hay geocercas.
          {#if isAdmin}Usa <em>Dibujar polígono</em> en el panel.{/if}
        </p>
      {/each}
    </div>

    <div class="card">
      <h2>Mis últimos eventos</h2>
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Geocerca</th></tr></thead>
        <tbody>
          {#each misEventos as ev}
            <tr>
              <td>{fmt(ev.creado_en)}</td>
              <td><span class="badge {ev.tipo}">{ev.tipo}</span></td>
              <td>{ev.geocercas?.nombre || '—'}</td>
            </tr>
          {:else}
            <tr><td colspan="3" class="muted">Sin eventos</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
