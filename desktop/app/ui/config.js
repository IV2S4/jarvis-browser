'use strict';
// Configuración del Navegador JARVIS
const $ = (id) => document.getElementById(id);
const C = (accion, d) => window.navConfig.hacer(accion, d);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let cfg = {};
const INTERRUPTORES = ['bloquearRastreadores', 'soloHttps', 'dnsSeguro', 'noRastrear', 'bloquearEmergentes', 'preguntarPermisos',
  'guardarHistorial', 'borrarAlCerrar', 'preguntarDonde', 'avisarProgramas', 'controlJarvis', 'panelAlAbrir', 'bloquearAnuncios', 'conectarJarvis', 'vozRespuestas', 'modoGaming', 'pestanasVerticales', 'vozSiempre', 'subtitulosAuto', 'escaner', 'efectos', 'sonidosUI', 'monitorSistema', 'clipTelefono', 'cerebroLocal', 'localPrimero', 'localArrancar', 'escanerDescargas', 'terminal', 'centroMando', 'memoriaJarvis', 'gestos', 'gestosVista', 'camaraPausa', 'camaraGuardian', 'lanzarTelefono', 'memoriaNavegador', 'doblajeEnVivo', 'buscaLoQueVes', 'dictado', 'documentos', 'actualizarAuto'];
const NOMBRE_PERMISO = { media: 'Cámara y micrófono', geolocation: 'Ubicación', notifications: 'Notificaciones', midi: 'Instrumentos MIDI',
  'clipboard-read': 'Leer el portapapeles', 'display-capture': 'Grabar la pantalla', hid: 'Dispositivos USB', serial: 'Puertos serie', usb: 'USB' };

function aviso(t) { const e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(() => { e.hidden = true; }, 2200); }
function confirmar(texto) {
  return new Promise((ok) => {
    $('confirmar-texto').textContent = texto; $('confirmar').hidden = false;
    const fin = (v) => { $('confirmar').hidden = true; ok(v); };
    $('c-si').onclick = () => fin(true); $('c-no').onclick = () => fin(false);
  });
}
async function guardar(cambio, texto = 'Guardado') { cfg = await C('poner', cambio); pintarEscudo(); aviso(texto); }

function ir(s) {
  document.querySelectorAll('#menu button').forEach((b) => b.classList.toggle('activo', b.dataset.s === s));
  document.querySelectorAll('.sec').forEach((x) => { x.hidden = x.id !== s; });
  if (s === 'historial') pintarHistorial();
  if (s === 'permisos') pintarPermisos();
  if (s === 'acerca') pintarAcerca();
  if (s === 'ia') pintarIA();
  if (s === 'extensiones') pintarExt();
  if (s === 'vigilante') pintarVig();
  if (s === 'telefono') pintarTel();
}
document.querySelectorAll('#menu button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.s)));
$('cerrar').addEventListener('click', () => C('cerrar'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') C('cerrar'); });

// buscar un ajuste
$('buscar').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { document.querySelectorAll('.oculto-busqueda').forEach((x) => x.classList.remove('oculto-busqueda')); return; }
  let primera = null;
  document.querySelectorAll('.sec').forEach((sec) => {
    let hay = false;
    sec.querySelectorAll('.fila').forEach((f) => { const si = f.textContent.toLowerCase().includes(q); f.classList.toggle('oculto-busqueda', !si); hay = hay || si; });
    if (hay && !primera) primera = sec.id;
  });
  if (primera) ir(primera);
});

function pintarEscudo() {
  const claves = ['bloquearRastreadores', 'soloHttps', 'dnsSeguro', 'bloquearEmergentes', 'preguntarPermisos'];
  const n = claves.filter((k) => cfg[k]).length;
  $('esc-titulo').textContent = n === claves.length ? 'Protección máxima activa' : n >= 3 ? 'Protección activa' : 'Protección baja';
  $('esc-sub').textContent = `${n} de ${claves.length} escudos encendidos`;
  document.querySelector('.escudo').classList.toggle('debil', n < 3);
}

function pintarTemas() {
  const t = cfg.tema || 'cian';
  if (t === 'cian') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t;
  document.querySelectorAll('#temas button').forEach((b) => b.classList.toggle('activo', b.dataset.tema === t));
}
document.querySelectorAll('#temas button').forEach((b) => b.addEventListener('click', async () => { await guardar({ tema: b.dataset.tema }, 'Tema cambiado'); pintarTemas(); }));
async function cargar() {
  cfg = await C('leer'); pintarTemas();
  const bus = await C('buscadores');
  $('buscador').innerHTML = Object.entries(bus).map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join('');
  for (const k of INTERRUPTORES) {
    $(k).checked = Boolean(cfg[k]);
    $(k).addEventListener('change', async (e) => {
      if (k === 'controlJarvis' && !e.target.checked) aviso('JARVIS ya no podrá manejar el navegador');
      await guardar({ [k]: e.target.checked }, k === 'dnsSeguro' ? 'Guardado: se aplica al reiniciar el navegador' : 'Guardado');
    });
  }
  for (const k of ['inicio', 'buscador', 'zoom']) {
    $(k).value = String(cfg[k]);
    $(k).addEventListener('change', (e) => { guardar({ [k]: k === 'zoom' ? Number(e.target.value) : e.target.value }); $('fila-pagina').hidden = $('inicio').value !== 'pagina'; });
  }
  // idioma: se aplica al reiniciar [28-oct]
  $('idioma').value = cfg.idioma || '';
  $('idioma').addEventListener('change', async (e) => {
    await guardar({ idioma: e.target.value });
    if (await confirmar('El idioma cambia al reiniciar el navegador. ¿Reiniciarlo ahora? (tus pestañas se guardan)')) C('reiniciar');
  });
  $('clipMetodo').value = cfg.clipMetodo || 'nvidia';
  $('clipMetodo').addEventListener('change', (e) => guardar({ clipMetodo: e.target.value }));
  $('carpeta-clips').textContent = await C('carpeta-videos');
  // monitores para el centro de mando [04-nov]
  const pant = await C('pantallas') || [];
  $('pantallaMando').innerHTML = `<option value="auto">Automático (el vertical, o el que no tiene el navegador)</option>` + pant.map((p) => `<option value="${p.id}">Pantalla ${p.n} · ${p.ancho}×${p.alto}${p.vertical ? ' (vertical)' : ''}${p.principal ? ' (principal)' : ''}</option>`).join('');
  $('pantallaMando').value = pant.some((p) => p.id === cfg.pantallaMando) ? cfg.pantallaMando : 'auto';
  $('pantallaMando').addEventListener('change', (e) => guardar({ pantallaMando: e.target.value }));
  pintarLocal(); pintarVT(); pintarMemoria(); pintarCamaras();
  pintarImportar();
  $('dictadoIdioma').value = cfg.dictadoIdioma || '';
  $('dictadoIdioma').addEventListener('change', (e) => guardar({ dictadoIdioma: e.target.value }));
  $('idiomaSubtitulos').value = cfg.idiomaSubtitulos || 'es';
  $('idiomaSubtitulos').addEventListener('change', (e) => guardar({ idiomaSubtitulos: e.target.value }));
  $('vozMotor').value = cfg.vozMotor || 'auto';
  $('vozMotor').addEventListener('change', (e) => guardar({ vozMotor: e.target.value }));
  $('primeraIA').value = (cfg.ordenIA || ['gemini'])[0];
  $('primeraIA').addEventListener('change', (e) => { const p = e.target.value; guardar({ ordenIA: [p, ...['gemini', 'claude', 'openai'].filter((x) => x !== p)] }); });
  $('paginaInicio').value = cfg.paginaInicio || '';
  $('paginaInicio').addEventListener('change', (e) => guardar({ paginaInicio: e.target.value.trim() }));
  $('fila-pagina').hidden = cfg.inicio !== 'pagina';
  $('carpeta-actual').textContent = await C('carpeta');
  pintarEscudo();
  const pedida = new URLSearchParams(location.search).get('s');
  if (pedida && $(pedida)) ir(pedida);
}

$('elegir-carpeta').addEventListener('click', async () => { const r = await C('elegir-carpeta'); if (r) { $('carpeta-actual').textContent = r; aviso('Carpeta cambiada'); } });

// permisos
function pintarPermisos() {
  const filas = [];
  for (const [sitio, p] of Object.entries(cfg.permisos || {})) {
    for (const [perm, v] of Object.entries(p)) {
      filas.push(`<div class="fila"><span>${esc(sitio)}<small>${esc(NOMBRE_PERMISO[perm] || perm)} <i class="chip ${v ? 'si' : 'no'}">${v ? 'Permitido' : 'Bloqueado'}</i></small></span>
        <button class="sec-btn" data-sitio="${esc(sitio)}" data-perm="${esc(perm)}">Quitar</button></div>`);
    }
  }
  $('lista-permisos').innerHTML = filas.join('') || '<div class="vacio">Ninguna página tiene permisos guardados.</div>';
  $('lista-permisos').querySelectorAll('[data-sitio]').forEach((b) => b.addEventListener('click', async () => {
    const p = { ...cfg.permisos }; const s = { ...(p[b.dataset.sitio] || {}) }; delete s[b.dataset.perm];
    if (Object.keys(s).length) p[b.dataset.sitio] = s; else delete p[b.dataset.sitio];
    await guardar({ permisos: p }, 'Permiso quitado'); pintarPermisos();
  }));
  const em = Object.keys(cfg.emergentesPermitidas || {});
  $('lista-emergentes').innerHTML = em.map((s) => `<div class="fila"><span>${esc(s)}</span><button class="sec-btn" data-em="${esc(s)}">Quitar</button></div>`).join('')
    || '<div class="vacio">Ninguna.</div>';
  $('lista-emergentes').querySelectorAll('[data-em]').forEach((b) => b.addEventListener('click', async () => {
    const e = { ...cfg.emergentesPermitidas }; delete e[b.dataset.em]; await guardar({ emergentesPermitidas: e }, 'Quitado'); pintarPermisos();
  }));
}

// historial
async function pintarHistorial() {
  const lista = await C('historial', $('h-buscar').value);
  let dia = '';
  const hoy = new Date().toDateString(); const ayer = new Date(Date.now() - 864e5).toDateString();
  $('lista-historial').innerHTML = lista.map((h) => {
    const f = new Date(h.t); const d = f.toDateString();
    const cab = d !== dia ? `<div class="h-dia">${d === hoy ? 'HOY' : d === ayer ? 'AYER' : f.toLocaleDateString(((document.documentElement.lang || 'es').startsWith('es') ? 'es-PR' : document.documentElement.lang), { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div>` : '';
    dia = d;
    let dom = ''; try { dom = new URL(h.url).hostname; } catch { /* nada */ }
    return `${cab}<div class="h-item"><span class="hora">${f.toLocaleTimeString(((document.documentElement.lang || 'es').startsWith('es') ? 'es-PR' : document.documentElement.lang), { hour: '2-digit', minute: '2-digit' })}</span>
      <img src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(dom)}" alt="" />
      <span class="h-t" data-url="${esc(h.url)}"><b>${esc(h.titulo || dom)}</b><small>${esc(h.url)}</small></span>
      <button class="x" data-t="${h.t}" title="Quitar">×</button></div>`;
  }).join('') || '<div class="vacio">Sin historial.</div>';
  $('lista-historial').querySelectorAll('img').forEach((i) => i.addEventListener('error', () => { i.style.visibility = 'hidden'; }));
}
$('h-buscar').addEventListener('input', () => { clearTimeout(pintarHistorial.t); pintarHistorial.t = setTimeout(pintarHistorial, 200); });
$('lista-historial').addEventListener('click', async (e) => {
  const x = e.target.closest('[data-t]'); const a = e.target.closest('[data-url]');
  if (x) { await C('historial-quitar', Number(x.dataset.t)); pintarHistorial(); }
  else if (a) C('abrir', a.dataset.url);
});
$('h-borrar').addEventListener('click', async () => {
  if (!(await confirmar('¿Borrar todo el historial? No se puede deshacer.'))) return;
  await C('borrar-datos', { historial: true, periodo: 0 }); aviso('Historial borrado'); pintarHistorial();
});

// borrar datos
$('d-borrar').addEventListener('click', async () => {
  const o = { periodo: Number($('d-periodo').value), historial: $('d-historial').checked, cookies: $('d-cookies').checked, cache: $('d-cache').checked, permisos: $('d-permisos').checked };
  if (!o.historial && !o.cookies && !o.cache && !o.permisos) return aviso('Elige qué borrar');
  if (!(await confirmar(`¿Borrar ${[o.historial && 'historial', o.cookies && 'cookies y sesiones', o.cache && 'caché', o.permisos && 'permisos'].filter(Boolean).join(', ')}?${o.cookies ? ' Tendrás que volver a entrar a tus cuentas.' : ''}`))) return;
  await C('borrar-datos', o); cfg = await C('leer'); aviso('Datos borrados');
});

async function pintarAcerca() {
  const a = await C('acerca');
  $('version').textContent = `Versión ${a.version}`; pintarAct(await C('actualizacion')); $('motor').textContent = `Chromium ${a.chromium} · Electron ${a.electron}`; $('bloq').textContent = String(a.bloqueados);
}
function pintarAct(r) {
  if (!r) return;
  $('act-estado').textContent = r.nueva ? `⬆ Hay una versión nueva: ${r.nueva}` : '✓ Tienes la última versión';
  $('act-estado').className = 'estado-llave ' + (r.nueva ? 'no' : 'si'); $('act-ya').hidden = !r.nueva;
}
$('act-buscar').addEventListener('click', async () => { $('act-estado').textContent = 'Buscando…'; pintarAct(await C('actualizar-buscar')); });
$('act-ya').addEventListener('click', async () => { if (await confirmar('El navegador se cerrará, se actualizará y se volverá a abrir solo (unos 20 segundos).')) C('actualizar-ya'); });
$('restablecer').addEventListener('click', async () => {
  if (!(await confirmar('¿Volver a la configuración original? Tus permisos guardados se quitan; el historial no se toca.'))) return;
  cfg = await C('restablecer'); location.reload();
});

// ── Cerebro de JARVIS: llaves (la ventana nunca recibe la llave: solo si está puesta) [28-oct] ──
async function pintarIA() {
  const ll = await C('llaves') || {};
  for (const p of ['gemini', 'claude', 'openai']) {
    const e = $(`ll-${p}`); const x = ll[p] || {};
    e.textContent = x.puesta ? `✓ Llave puesta (…${x.final})` : 'Sin llave';
    e.className = 'estado-llave ' + (x.puesta ? 'si' : 'no');
    document.querySelector(`[data-quitar="${p}"]`).hidden = !x.puesta;
    document.querySelector(`[data-probar="${p}"]`).hidden = !x.puesta;
  }
}
document.querySelectorAll('[data-guardar]').forEach((b) => b.addEventListener('click', async () => {
  const p = b.dataset.guardar; const v = $(`in-${p}`).value.trim();
  if (v.length < 12) return aviso('Esa llave parece incompleta');
  await C('poner-llave', { proveedor: p, valor: v }); $(`in-${p}`).value = '';
  await pintarIA(); aviso('Llave guardada y cifrada');
  probar(p);
}));
document.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
  if (!(await confirmar('¿Quitar esta llave?'))) return;
  await C('poner-llave', { proveedor: b.dataset.quitar, valor: '' }); pintarIA(); aviso('Llave quitada');
}));
async function probar(p) {
  const e = $(`ll-${p}`); e.textContent = 'Probando…';
  const r = await C('probar-ia', p);
  await pintarIA();
  if (r && r.ok) { e.textContent = `Funciona: «${r.texto}»`; e.className = 'estado-llave si'; } else { e.textContent = (r && r.texto) || 'No funcionó'; e.className = 'estado-llave no'; }
}
document.querySelectorAll('[data-probar]').forEach((b) => b.addEventListener('click', () => probar(b.dataset.probar)));
document.querySelectorAll('[data-enlace]').forEach((b) => b.addEventListener('click', () => { C('abrir', b.dataset.enlace); aviso('Abrí la página en el navegador'); }));

// ── Cerebro local (Qwen) [04-nov] ──
async function pintarLocal(texto) {
  const e = await C('local-estado'); if (!e) return;
  $('local-bat').textContent = `${e.encontrado ? '✓' : '✕ No lo encuentro:'} ${e.bat}`;
  const s = $('local-estado');
  s.textContent = texto || (e.vivo ? '● Qwen encendido' : e.arrancando ? 'Encendiendo Qwen…' : '○ Qwen apagado');
  s.className = 'estado-llave ' + (e.vivo ? 'si' : 'no');
}
$('local-elegir').addEventListener('click', async () => { const r = await C('local-elegir'); if (r) { pintarLocal(); aviso('Guardado'); } });
$('local-encender').addEventListener('click', async () => {
  $('local-estado').textContent = 'Encendiendo Qwen… (20-60 s)';
  const ok = await C('local-arrancar'); pintarLocal(ok ? '● Qwen encendido' : '✕ No se pudo encender (revisa «Cómo se enciende»)');
});
$('local-probar').addEventListener('click', async () => {
  if (!cfg.cerebroLocal) return aviso('Primero activa «Usar el cerebro local»');
  const s = $('local-estado'); s.textContent = 'Probando… (si está apagado, lo enciendo)';
  const r = await C('probar-ia', 'local');
  s.textContent = r && r.ok ? `Funciona: «${r.texto}»` : (r && r.texto) || 'No funcionó'; s.className = 'estado-llave ' + (r && r.ok ? 'si' : 'no');
});
// ── Cámaras para los gestos ──
async function pintarCamaras(conNombres) {
  let lista = [];
  try {
    if (conNombres) { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); }
    lista = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  } catch { /* sin cámaras o bloqueadas */ }
  const sel = $('camaraGestos');
  sel.innerHTML = '<option value="">Predeterminada</option>' + lista.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `Cámara ${i + 1}`)}</option>`).join('');
  if (cfg.camaraGestos && !lista.some((d) => d.deviceId === cfg.camaraGestos)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(cfg.camaraGestos)}">Cámara elegida (no conectada ahora)</option>`);
  sel.value = cfg.camaraGestos || '';
  if (conNombres) aviso(lista.length ? `${lista.length} ${lista.length === 1 ? 'cámara encontrada' : 'cámaras encontradas'}` : 'No encontré cámaras');
}
$('camaraGestos').addEventListener('change', (e) => guardar({ camaraGestos: e.target.value }));
$('cam-buscar').addEventListener('click', () => pintarCamaras(true));

// ── Importar de Chrome / Edge / Brave y navegador predeterminado ──
async function pintarImportar() {
  const l = await C('importar-perfiles') || [];
  $('imp-perfil').innerHTML = l.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('') || '<option value="">No encontré Chrome, Edge ni Brave</option>';
  $('imp-ya').disabled = !l.length;
  const pred = await C('predeterminado-estado');
  $('pred-estado').textContent = pred ? '✓ Ya es tu navegador predeterminado' : 'Ahora mismo no es el predeterminado';
  $('pred-estado').className = 'estado-llave ' + (pred ? 'si' : 'no');
}
$('imp-ya').addEventListener('click', async () => {
  const id = $('imp-perfil').value; if (!id) return;
  $('imp-estado').textContent = 'Importando…'; $('imp-estado').className = 'estado-llave';
  const r = await C('importar', { id, favoritos: $('imp-fav').checked, historial: $('imp-hist').checked });
  if (!r) { $('imp-estado').textContent = 'No se pudo importar'; return; }
  $('imp-estado').textContent = `✓ ${r.favoritos} favoritos y ${r.historial} páginas del historial importados` + (r.errorHistorial ? ` (historial: ${r.errorHistorial})` : '');
  $('imp-estado').className = 'estado-llave si';
});
$('pred-ya').addEventListener('click', async () => {
  const r = await C('predeterminado');
  if (r && r.ok) aviso('En la ventana de Windows pulsa «Establecer como predeterminado»'); else aviso('No pude registrarlo en Windows');
  setTimeout(pintarImportar, 8000);
});

// ── Memoria de JARVIS ──
async function pintarMemoria() {
  const l = await C('memoria') || [];
  $('mem-n').textContent = l.length ? `${l.length} ${l.length === 1 ? 'cosa recordada' : 'cosas recordadas'}` : 'Todavía no recuerda nada';
  $('mem-borrar').hidden = !l.length;
  $('mem-lista').innerHTML = l.map((x) => `<div class="fila mem"><span>${esc(x.texto)}<small>${new Date(x.t).toLocaleDateString()}${x.origen === 'manual' ? ' · tú' : ''}</small></span><button class="sec-btn" data-olvidar="${esc(x.id)}">Olvidar</button></div>`).join('');
}
$('mem-lista').addEventListener('click', async (ev) => { const b = ev.target.closest('[data-olvidar]'); if (!b) return; await C('memoria-quitar', b.dataset.olvidar); pintarMemoria(); aviso('Olvidado'); });
$('mem-poner').addEventListener('click', async () => {
  const v = $('mem-nueva').value.trim(); if (!v) return;
  const r = await C('memoria-poner', v);
  if (r && r.ok) { $('mem-nueva').value = ''; pintarMemoria(); aviso('JARVIS lo recordará'); } else aviso('Eso no lo guardo (contraseñas, tarjetas o llaves)');
});
$('mem-nueva').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('mem-poner').click(); });
$('mem-borrar').addEventListener('click', async () => { if (!(await confirmar('¿Borrar todo lo que JARVIS recuerda de ti?'))) return; await C('memoria-borrar'); pintarMemoria(); aviso('Memoria borrada'); });

// ── VirusTotal ──
async function pintarVT() {
  const v = await C('vt-estado') || {};
  $('vt-estado').textContent = v.llave ? `✓ Llave puesta (…${v.final})` : 'Sin llave: solo Windows Defender';
  $('vt-estado').className = 'estado-llave ' + (v.llave ? 'si' : 'no'); $('vt-quitar').hidden = !v.llave;
}
$('vt-guardar').addEventListener('click', async () => {
  const v = $('in-vt').value.trim(); if (v.length < 30) return aviso('Esa llave parece incompleta');
  $('vt-estado').textContent = 'Probando la llave…';
  const r = await C('vt-llave', v); $('in-vt').value = '';
  if (r && r.ok) { await pintarVT(); aviso('Llave guardada y cifrada'); } else { $('vt-estado').textContent = (r && r.error) || 'No funcionó'; $('vt-estado').className = 'estado-llave no'; }
});
$('vt-quitar').addEventListener('click', async () => { if (!(await confirmar('¿Quitar la llave de VirusTotal?'))) return; await C('vt-llave', ''); pintarVT(); aviso('Llave quitada'); });

// ── Extensiones ──
function dibujarExt(r) {
  if (!r) return;
  $('ext-ruta').textContent = `📁 ${r.carpeta || ''}`;
  $('lista-ext').innerHTML = (r.lista || []).map((x) => `<div class="fila"><span>${esc(x.nombre)} <i class="chip">${x.tipo === 'chrome' ? 'Chrome' : x.tipo === 'jarvis' ? 'JARVIS' : '?'}</i>
      <small>${esc(x.error ? '⚠ ' + x.error : x.desc)}</small></span><label class="sw"><input type="checkbox" data-ext="${esc(x.id)}" ${x.activa ? 'checked' : ''} /><i></i></label></div>`).join('')
    || '<div class="vacio">Todavía no hay extensiones. Abre la carpeta y copia una dentro.</div>';
  $('lista-ext').querySelectorAll('[data-ext]').forEach((i) => i.addEventListener('change', async () => {
    await C('ext-poner', { id: i.dataset.ext, activa: i.checked }); cfg = await C('leer'); aviso(i.checked ? 'Extensión encendida' : 'Extensión apagada');
  }));
}
async function pintarExt() { dibujarExt(await C('extensiones')); }
$('ext-carpeta').addEventListener('click', () => C('ext-carpeta'));
$('ext-recargar').addEventListener('click', async () => { dibujarExt(await C('ext-recargar')); aviso('Extensiones recargadas'); });

// ── Clips ──
$('elegir-clips').addEventListener('click', async () => { const r = await C('elegir-carpeta-clips'); if (r) { $('carpeta-clips').textContent = r; aviso('Carpeta cambiada'); } });
$('probar-clip').addEventListener('click', async () => { $('probar-clip').disabled = true; $('probar-clip').textContent = '…'; const r = await C('clip'); $('probar-clip').disabled = false; $('probar-clip').textContent = 'Clip'; aviso(r && r.ok ? (r.enviado ? 'Clip guardado y enviado' : 'Clip guardado') : ((r && r.error) || 'No funcionó')); });

// ── Teléfono (Telegram) ──
let tgBot = null;
async function pintarTel() {
  const s = await C('telegram-estado') || {};
  tgBot = s.bot;
  $('tg-estado-bot').textContent = s.llave && s.bot ? `✓ Bot @${s.bot.usuario}` : 'Sin bot';
  $('tg-estado-bot').className = 'estado-llave ' + (s.llave ? 'si' : 'no');
  $('tg-quitar').hidden = !s.llave; $('tg-abrir-bot').hidden = !(s.bot && s.bot.usuario);
  $('tg-estado-chat').textContent = s.chat ? `✓ Conectado con ${s.chat.nombre || 'tu teléfono'}` : (s.llave ? 'Falta conectar' : '');
  $('tg-estado-chat').className = 'estado-llave ' + (s.chat ? 'si' : 'no');
}
$('tg-botfather').addEventListener('click', () => C('abrir', 'https://t.me/BotFather'));
$('tg-abrir-bot').addEventListener('click', () => { if (tgBot) C('abrir', `https://t.me/${tgBot.usuario}`); });
$('tg-guardar').addEventListener('click', async () => {
  const v = $('tg-llave').value.trim(); if (!/^\d+:[\w-]{20,}$/.test(v)) return aviso('Esa llave no parece de un bot de Telegram');
  $('tg-guardar').disabled = true; const r = await C('telegram-llave', v); $('tg-guardar').disabled = false;
  if (r && r.ok) { $('tg-llave').value = ''; aviso('Bot guardado'); } else aviso((r && r.error) || 'No funcionó');
  pintarTel();
});
$('tg-quitar').addEventListener('click', async () => { if (await confirmar('¿Quitar el bot de Telegram?')) { await C('telegram-quitar'); pintarTel(); } });
$('tg-conectar').addEventListener('click', async () => {
  $('tg-conectar').disabled = true; const r = await C('telegram-conectar'); $('tg-conectar').disabled = false;
  if (r && r.ok) aviso('Conectado: te mandé un mensaje de prueba'); else { $('tg-estado-chat').textContent = (r && r.error) || 'No funcionó'; $('tg-estado-chat').className = 'estado-llave no'; return; }
  pintarTel();
});

// ── Vigilante ──
function dibujarVig(lista) {
  $('lista-vig').innerHTML = (lista || []).map((v) => {
    const m = v.moneda || '$';
    const precio = v.tipo === 'precio' ? `${m}${v.precio ?? '?'}${v.precioInicial && v.precio && v.precio !== v.precioInicial ? ` (antes ${m}${v.precioInicial})` : ''}${v.objetivo ? ` · meta ${m}${v.objetivo}` : ''}` : 'Cambios';
    const cuando = v.revisado ? new Date(v.revisado).toLocaleString(((document.documentElement.lang || 'es').startsWith('es') ? 'es-PR' : document.documentElement.lang), { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
    return `<div class="fila"><span>${esc(v.titulo)}<small>${esc(precio)} · ${esc(cuando)}${v.error ? ' · ⚠ ' + esc(v.error) : ''}</small></span>
      <span class="llave"><button class="sec-btn" data-ver="${esc(v.url)}">Abrir</button><button class="sec-btn" data-rev="${v.id}">Revisar ya</button><button class="sec-btn" data-qv="${v.id}">Quitar</button></span></div>`;
  }).join('') || '<div class="vacio">Todavía no vigilas ninguna página.</div>';
  $('lista-vig').querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => C('abrir', b.dataset.ver)));
  $('lista-vig').querySelectorAll('[data-qv]').forEach((b) => b.addEventListener('click', async () => dibujarVig(await C('vigilancia-quitar', b.dataset.qv))));
  $('lista-vig').querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', async () => { b.textContent = 'Revisando…'; b.disabled = true; dibujarVig(await C('vigilancia-revisar', b.dataset.rev)); }));
}
async function pintarVig() { dibujarVig(await C('vigilancias')); }

cargar();
