'use strict';
// JARVIS Browser · Android — barras, pestañas, sugerencias, favoritos, historial, menús [04-nov]
const INICIO = 'https://appassets.androidplatform.net/assets/inicio/index.html';
const PRED = { idioma: 'en', buscador: 'google', tema: 'cian', guardarHistorial: true, bloquear: true, monitor: true, pipAuto: true, vozRespuestas: false, vozMotor: 'sistema',
  ordenIA: ['gemini', 'claude', 'openai'], memoriaJarvis: true, escaner: true, sonidos: true, efectos: true, telegramChat: null, telegramBot: null, qwenPC: '', localActivo: false, vigilar: true };
let cfg = { ...PRED };
let E = { pestanas: [], activa: 0, url: '' };
let favoritos = []; let historial = []; let memoria = [];
const BUSCADORES = { google: ['Google', 'https://www.google.com/search?q='], bing: ['Bing', 'https://www.bing.com/search?q='], duck: ['DuckDuckGo', 'https://duckduckgo.com/?q='], brave: ['Brave', 'https://search.brave.com/search?q='] };
const sat = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
const sab = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;

// ── tema e idioma ──
const TEMA = { c1: '56,214,255', c2: '127,233,255' };
function ponerTema(t) {
  if (t && t !== 'cian') document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
  const cs = getComputedStyle(document.documentElement); TEMA.c1 = cs.getPropertyValue('--c1').replace(/\s/g, '') || TEMA.c1; TEMA.c2 = cs.getPropertyValue('--c2').replace(/\s/g, '') || TEMA.c2;
}
const TEXTOS_ES = {   // la interfaz está escrita en inglés; esto la pone en español si lo eliges
  'Search or type a web address': 'Busca o escribe una dirección', 'Get me out': 'Sácame de aquí', 'Find in page': 'Buscar en la página', 'TABS': 'PESTAÑAS',
  '🕶 Private': '🕶 Privada', '＋ New tab': '＋ Nueva', '↺ Reopen closed tab': '↺ Reabrir cerrada', 'Close all': 'Cerrar todas', 'Desktop site': 'Versión escritorio',
  'CHAT': 'CHAT', 'PAGE': 'PÁGINA', 'SCANNER': 'ESCÁNER', 'DOWNLOADS': 'DESCARGAS', 'Message JARVIS…': 'Escríbele a JARVIS…', 'Add key': 'Poner llave',
  "To think on its own, JARVIS needs an AI key (Gemini's is free).": 'Para pensar solo, JARVIS necesita una llave de IA (la de Gemini es gratis).',
  'Trackers': 'Rastreadores', 'Ads': 'Anuncios', '3rd party': 'Terceros', 'Link': 'Conexión', 'Open Downloads folder': 'Abrir la carpeta Descargas',
};
function traducirInterfaz() {
  if (IDIOMA !== 'es') return;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (TEXTOS_ES[t]) n.nodeValue = n.nodeValue.replace(t, TEXTOS_ES[t]); }
  document.querySelectorAll('[placeholder]').forEach((e) => { if (TEXTOS_ES[e.placeholder]) e.placeholder = TEXTOS_ES[e.placeholder]; });
  document.documentElement.lang = 'es';
}

// ── huecos: dónde va la página (entre las barras) ──
function medir() {
  const ime = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ime')) || 0;
  const arriba = Math.round($('arriba').getBoundingClientRect().height - sat());
  const abajo = Math.round($('abajo').getBoundingClientRect().height - (ime > 0 ? 0 : sab()));
  H('layout', { arriba, abajo });
}
nav.en('insets', (i) => {
  const r = document.documentElement.style;
  r.setProperty('--sat', i.top + 'px'); r.setProperty('--sab', i.bottom + 'px'); r.setProperty('--ime', i.ime + 'px');
  document.body.classList.toggle('teclado', i.ime > 0);
  requestAnimationFrame(medir);
});
new ResizeObserver(() => medir()).observe($('arriba'));
new ResizeObserver(() => medir()).observe($('abajo'));

// ── capas: con algo abierto encima, la interfaz pasa al frente de la página ──
const pilaCapas = [];
function abrirCapa(id, velo = true) {
  cerrarCapasMenos(id);
  $(id).hidden = false; if (!pilaCapas.includes(id)) pilaCapas.push(id);
  $('velo').hidden = !velo; document.body.classList.add('cubierto'); H('cubrir', { on: true });
}
function cerrarCapa(id) {
  if (id && $(id)) $(id).hidden = true;
  const i = pilaCapas.indexOf(id); if (i >= 0) pilaCapas.splice(i, 1);
  if (!pilaCapas.length) { $('velo').hidden = true; document.body.classList.remove('cubierto'); H('cubrir', { on: false }); }
}
function cerrarCapasMenos(id) { for (const c of [...pilaCapas]) if (c !== id) cerrarCapa(c); }
$('velo').addEventListener('click', () => { const c = pilaCapas[pilaCapas.length - 1]; if (c) cerrarCapa(c); });
// botón atrás de Android: primero cierra lo que esté abierto
window.__atras = () => {
  if (document.activeElement === $('dir')) { $('dir').blur(); return true; }
  const c = pilaCapas[pilaCapas.length - 1]; if (c) { if (c === 'ajustes' && window.ajustesAtras && window.ajustesAtras()) return true; cerrarCapa(c); return true; }
  if (!$('buscar-barra').hidden) { cerrarBuscar(); return true; }
  return false;
};

// ── estado ──
function hostDe(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
const esInicio = (u) => String(u || '').startsWith(INICIO) || !u || u === 'about:blank';
function pintar(e) {
  if (!e) return; E = e;
  $('b-pest-n').textContent = e.pestanas.length;
  if (document.activeElement !== $('dir') && !window.dirAnimando) $('dir').value = e.inicio ? '' : (hostDe(e.url) ? (e.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) : e.url || '');
  const c = $('candado'); c.className = 'candado' + (e.privada ? ' priv' : e.inicio || e.https ? '' : ' inseguro'); c.textContent = e.privada ? '🕶' : '●';
  $('b-atras').disabled = !e.atras; $('b-adelante').disabled = !e.adelante;
  $('recargar').textContent = e.cargando ? '✕' : '⟳';
  $('h-host').textContent = e.inicio ? 'JARVIS · ONLINE' : (hostDe(e.url) || 'ONLINE');
  $('m-zoom').textContent = (e.zoom || 100) + '%'; $('m-escritorio').checked = Boolean(e.escritorio);
  if (!$('pestanas-capa').hidden) pintarPestanas();
  if (window.alCambiarEstado) window.alCambiarEstado(e);
}
nav.en('estado', pintar);
nav.en('progreso', (n) => { const i = $('progreso').firstElementChild; i.style.width = n + '%'; i.style.opacity = n >= 100 ? 0 : 1; });

// ── barra de dirección ──
function aUrl(texto) {
  const t = String(texto || '').trim();
  if (!t) return INICIO;
  if (/^(https?|file|about|data):/i.test(t)) return t;
  if (/^localhost(:\d+)?/.test(t) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(t)) return 'http://' + t;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t)) return 'https://' + t;
  return (BUSCADORES[cfg.buscador] || BUSCADORES.google)[1] + encodeURIComponent(t);
}
function busquedaDe(u) { try { const x = new URL(u); if (/(^|\.)(google|bing|duckduckgo|search\.brave|youtube)\./.test(x.hostname)) return (x.searchParams.get('q') || x.searchParams.get('search_query') || '').trim(); } catch { /* */ } return ''; }
function sugerencias(q) {
  const n = String(q || '').trim().toLowerCase(); if (!n) return [];
  const mapa = new Map(); const ahora = Date.now();
  for (const h of historial) {
    const b = busquedaDe(h.url); const clave = b ? 'q:' + b.toLowerCase() : h.url.replace(/#.*$/, '');
    let e = mapa.get(clave); if (!e) { e = { tipo: b ? 'busqueda' : 'pagina', url: h.url, titulo: b || h.titulo || '', veces: 0, t: h.t }; mapa.set(clave, e); }
    e.veces++;
  }
  for (const f of favoritos) { const e = mapa.get(f.url) || { tipo: 'pagina', url: f.url, titulo: f.titulo, veces: 0, t: 0 }; e.fav = true; mapa.set(f.url, e); }
  const limpia = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).toLowerCase(); } catch { return u.toLowerCase(); } };
  const deCuenta = /(^|\.)(accounts|myaccount)\.google\.|\/(signin|login|oauth|auth|sso)\b|passkey/i;
  const lista = [];
  for (const e of mapa.values()) {
    if (e.tipo === 'pagina' && deCuenta.test(e.url)) continue;
    const t = (e.titulo || '').toLowerCase(); const u = limpia(e.url); let p = 0;
    if (u.startsWith(n)) p += 6; else if (u.includes(n)) p += 2;
    if (t.startsWith(n)) p += 5; else if (t.includes(n)) p += 3;
    if (!p) continue;
    p += Math.min(4, Math.log2(1 + e.veces)) + (e.fav ? 3 : 0) + Math.max(0, 2 - (ahora - e.t) / 864e5 / 7);
    lista.push({ ...e, p });
  }
  return lista.sort((a, b) => b.p - a.p).slice(0, 8);
}
let sugs = [];
function pintarSugs() {
  const q = $('dir').value.trim();
  sugs = [{ tipo: 'ir', url: aUrl(q), titulo: q }, ...sugerencias(q)];
  if (!q) sugs = favoritos.slice(0, 10).map((f) => ({ tipo: 'pagina', url: f.url, titulo: f.titulo, fav: true }));
  $('sugs').innerHTML = sugs.map((s, i) => {
    const ico = s.tipo === 'ir' ? (/^https?:/.test(s.url) && !s.url.includes('search?q=') ? '↗' : '🔎') : s.tipo === 'busqueda' ? '🕘' : s.fav ? '★' : '◷';
    const sub = s.tipo === 'ir' ? (s.url.includes(encodeURIComponent(q)) && !/^https?:\/\/[^/]*\./.test(q) ? T('Buscar en ', 'Search with ') + (BUSCADORES[cfg.buscador] || BUSCADORES.google)[0] : s.url) : s.tipo === 'busqueda' ? T('Búsqueda anterior', 'Past search') : s.url.replace(/^https?:\/\/(www\.)?/, '');
    return `<div class="sug" data-i="${i}"><i>${ico}</i><div><b>${esc(s.titulo || s.url)}</b><small>${esc(sub)}</small></div></div>`;
  }).join('') || `<div class="vacio">${T('Escribe para buscar', 'Type to search')}</div>`;
}
$('dir').addEventListener('focus', () => {
  $('dir').value = E.inicio ? '' : (E.url || '');
  setTimeout(() => $('dir').select(), 30);
  $('dir-x').hidden = false; $('recargar').hidden = true;
  abrirCapa('sugs', false); pintarSugs();
});
$('dir').addEventListener('blur', () => setTimeout(() => { $('dir-x').hidden = true; $('recargar').hidden = false; cerrarCapa('sugs'); pintar(E); }, 120));
$('dir').addEventListener('input', pintarSugs);
$('dir-x').addEventListener('mousedown', (ev) => { ev.preventDefault(); $('dir').value = ''; pintarSugs(); });
$('sugs').addEventListener('mousedown', (ev) => ev.preventDefault());
$('sugs').addEventListener('click', (ev) => { const s = ev.target.closest('.sug'); if (!s) return; const x = sugs[Number(s.dataset.i)]; ir(x.url); });
$('form-dir').addEventListener('submit', (ev) => { ev.preventDefault(); ir(aUrl($('dir').value)); });
function ir(url) { H('ir', { url }); $('dir').blur(); }
$('recargar').addEventListener('click', () => H('recargar'));

// ── botones de abajo ──
$('b-atras').addEventListener('click', () => { H('vibrar', { ms: 10 }); H('atras'); });
$('b-adelante').addEventListener('click', () => H('adelante'));
$('b-inicio').addEventListener('click', () => H('inicio'));
$('b-pestanas').addEventListener('click', () => { abrirCapa('pestanas-capa'); pintarPestanas(); });
$('b-menu').addEventListener('click', () => { abrirCapa('menu-capa'); pintarMenu(); });
$('orbe').addEventListener('click', () => abrirPanel());

// ── pestañas ──
function pintarPestanas() {
  $('pest-n').textContent = `${E.pestanas.length} ${T('PESTAÑAS', 'TABS')}`;
  $('pest-lista').innerHTML = E.pestanas.map((p) => `<div class="pt${p.id === E.activa ? ' activa' : ''}${p.privada ? ' priv' : ''}" data-id="${p.id}">
    <div class="pt-cab">${p.icono ? `<img src="${p.icono}" alt="">` : ''}<b>${esc(p.inicio ? T('Nueva pestaña', 'New tab') : p.titulo || hostDe(p.url))}</b><button class="pt-x" data-x="${p.id}">✕</button></div>
    ${p.inicio ? `<div class="pt-letra">J</div>` : `<small>${esc(p.url.replace(/^https?:\/\/(www\.)?/, ''))}</small>`}</div>`).join('');
}
$('pest-lista').addEventListener('click', (ev) => {
  const x = ev.target.closest('[data-x]'); if (x) { H('cerrar', { id: Number(x.dataset.x) }); return; }
  const p = ev.target.closest('.pt'); if (p) { H('activar', { id: Number(p.dataset.id) }); cerrarCapa('pestanas-capa'); }
});
$('pest-nueva').addEventListener('click', () => { H('nueva', { url: INICIO }); cerrarCapa('pestanas-capa'); setTimeout(() => $('dir').focus(), 250); });
$('pest-privada').addEventListener('click', () => { H('nueva', { url: INICIO, privada: true }); cerrarCapa('pestanas-capa'); });
$('pest-reabrir').addEventListener('click', async () => { const u = await H('reabrir'); if (u) cerrarCapa('pestanas-capa'); else toast(T('No hay pestañas cerradas', 'No closed tabs')); });
$('pest-cerrar-todas').addEventListener('click', () => { for (const p of [...E.pestanas]) H('cerrar', { id: p.id }); cerrarCapa('pestanas-capa'); });

// ── menú ──
const MENU = () => [
  ['＋', T('Nueva pestaña', 'New tab'), () => { H('nueva', { url: INICIO }); setTimeout(() => $('dir').focus(), 250); }],
  ['🕶', T('Privada', 'Private tab'), () => H('nueva', { url: INICIO, privada: true })],
  [esFavorito() ? '★' : '☆', esFavorito() ? T('Quitar favorito', 'Remove bookmark') : T('Añadir favorito', 'Bookmark'), alternarFavorito],
  ['📚', T('Favoritos', 'Bookmarks'), verFavoritos],
  ['🕘', T('Historial', 'History'), verHistorial],
  ['⬇', T('Descargas', 'Downloads'), () => abrirPanel('desc')],
  ['🔎', T('Buscar en página', 'Find in page'), abrirBuscar],
  ['🌐', T('Traducir', 'Translate'), () => window.traducirPagina && traducirPagina()],
  ['📝', T('Resumir', 'Summarize'), () => { abrirPanel('chat'); window.resumirAqui && resumirAqui(); }],
  ['📤', T('Compartir', 'Share'), () => H('compartir', { texto: E.url, titulo: E.titulo })],
  ['📱', T('Al teléfono (Telegram)', 'Send (Telegram)'), () => window.enviarTelefono && enviarTelefono()],
  ['▣', T('Video flotante', 'Floating video'), () => H('pip')],
  ['⌨', T('Terminal', 'Terminal'), () => window.abrirTerminal && abrirTerminal()],
  ['✋', window.gestosActivos && gestosActivos() ? T('Apagar gestos', 'Gestures off') : T('Control con gestos', 'Gesture control'), () => window.alternarGestos && alternarGestos()],
  ['🛡', T('Escáner', 'Scanner'), () => abrirPanel('escaner')],
  ['🎨', T('Tema', 'Theme'), () => window.abrirAjustes && abrirAjustes('general')],
  ['⚙', T('Ajustes', 'Settings'), () => window.abrirAjustes && abrirAjustes()],
];
function pintarMenu() {
  $('menu-grid').innerHTML = MENU().map(([i, t], n) => `<button data-n="${n}"><i>${i}</i>${esc(t)}</button>`).join('');
}
$('menu-grid').addEventListener('click', (ev) => { const b = ev.target.closest('[data-n]'); if (!b) return; const f = MENU()[Number(b.dataset.n)][2]; cerrarCapa('menu-capa'); f(); });
$('m-zoom-menos').addEventListener('click', () => H('zoom', { pct: (E.zoom || 100) - 10 }));
$('m-zoom-mas').addEventListener('click', () => H('zoom', { pct: (E.zoom || 100) + 10 }));
$('m-escritorio').addEventListener('change', (e) => { H('escritorio', { on: e.target.checked }); cerrarCapa('menu-capa'); });

// ── buscar en la página ──
function abrirBuscar() { $('buscar-barra').hidden = false; setTimeout(() => $('buscar-q').focus(), 50); }
function cerrarBuscar() { $('buscar-barra').hidden = true; H('buscar-parar'); $('buscar-q').value = ''; }
$('buscar-q').addEventListener('input', () => H('buscar-en-pagina', { texto: $('buscar-q').value }));
$('buscar-sig').addEventListener('click', () => H('buscar-en-pagina', { siguiente: true }));
$('buscar-ant').addEventListener('click', () => H('buscar-en-pagina', { siguiente: true, atras: true }));
$('buscar-x').addEventListener('click', cerrarBuscar);
nav.en('encontrado', (r) => { $('buscar-n').textContent = `${r.actual}/${r.total}`; });

// ── favoritos e historial ──
const esFavorito = () => favoritos.some((f) => f.url === E.url);
function alternarFavorito() {
  if (esInicio(E.url)) return;
  if (esFavorito()) { favoritos = favoritos.filter((f) => f.url !== E.url); toast(T('Favorito quitado', 'Bookmark removed')); }
  else { favoritos.unshift({ url: E.url, titulo: E.titulo || hostDe(E.url) }); toast('★ ' + T('Guardado en favoritos', 'Bookmarked')); }
  Datos.guardar('favoritos', favoritos);
}
let guardarHistT = 0;
nav.en('navegado', (h) => {
  if (!cfg.guardarHistorial || !h || !/^https?:/.test(h.url)) return;
  const ult = historial[historial.length - 1];
  if (ult && ult.url === h.url && Date.now() - ult.t < 30000) { ult.titulo = h.titulo || ult.titulo; return; }
  historial.push({ url: h.url, titulo: h.titulo || '', t: Date.now() });
  if (historial.length > 3000) historial = historial.slice(-3000);
  clearTimeout(guardarHistT); guardarHistT = setTimeout(() => Datos.guardar('historial', historial), 1500);
});
function pantallaLista(titulo, items, alTocar, alBorrar) {
  const s = $('ajustes');
  s.innerHTML = `<div class="aj-cab"><button id="pl-x">❮</button><b>${esc(titulo)}</b><span class="grow"></span>${alBorrar ? `<button id="pl-borrar" class="sec" style="width:auto;font-size:13px">${T('Borrar todo', 'Clear all')}</button>` : ''}</div>
    <div class="aj-sec"><input id="pl-q" type="search" placeholder="${T('Buscar…', 'Search…')}" style="width:100%;height:42px;border-radius:12px;border:1px solid var(--borde);background:rgba(var(--c1),.06);padding:0 12px;outline:0"></div>
    <div id="pl-items"></div>`;
  const pintarItems = () => {
    const q = $('pl-q').value.toLowerCase();
    $('pl-items').innerHTML = items.filter((x) => !q || (x.titulo + x.url).toLowerCase().includes(q)).slice(0, 300).map((x) => `<div class="sug" data-u="${esc(x.url)}"><i>${x.ico || '◷'}</i><div><b>${esc(x.titulo || x.url)}</b><small>${esc((x.cuando ? x.cuando + ' · ' : '') + x.url.replace(/^https?:\/\/(www\.)?/, ''))}</small></div></div>`).join('') || `<div class="vacio">${T('Nada todavía', 'Nothing yet')}</div>`;
  };
  abrirCapa('ajustes', false); pintarItems();
  $('pl-q').addEventListener('input', pintarItems);
  $('pl-x').addEventListener('click', () => cerrarCapa('ajustes'));
  $('pl-items').addEventListener('click', (ev) => { const d = ev.target.closest('[data-u]'); if (d) { cerrarCapa('ajustes'); alTocar(d.dataset.u); } });
  if (alBorrar) $('pl-borrar').addEventListener('click', () => { alBorrar(); cerrarCapa('ajustes'); toast(T('Borrado', 'Cleared')); });
}
function verFavoritos() { pantallaLista(T('FAVORITOS', 'BOOKMARKS'), favoritos.map((f) => ({ ...f, ico: '★' })), (u) => ir(u)); }
function verHistorial() {
  const l = [...historial].reverse().map((h) => ({ ...h, cuando: new Date(h.t).toLocaleString(IDIOMA === 'es' ? 'es-PR' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }));
  pantallaLista(T('HISTORIAL', 'HISTORY'), l, (u) => ir(u), () => { historial = []; Datos.guardar('historial', historial); });
}

// ── mantener pulsado un enlace o una imagen ──
nav.en('menu-pagina', (m) => {
  $('me-url').textContent = m.url;
  const acc = [[T('Abrir en pestaña nueva', 'Open in new tab'), () => H('nueva', { url: m.url, activar: false }) && toast(T('Abierta en segundo plano', 'Opened in background'))],
    [T('Abrir en pestaña privada', 'Open in private tab'), () => H('nueva', { url: m.url, privada: true })],
    [T('Copiar enlace', 'Copy link'), () => { H('copiar', { texto: m.url }); toast(T('Copiado', 'Copied')); }],
    [T('Compartir', 'Share'), () => H('compartir', { texto: m.url })],
    [T('Mandar al teléfono (Telegram)', 'Send via Telegram'), () => window.enviarTelefono && enviarTelefono({ url: m.url })],
    [T('Preguntarle a JARVIS', 'Ask JARVIS about it'), () => { abrirPanel('chat'); window.chatear && chatear(T(`Ábrelo y dime de qué trata: ${m.url}`, `Open it and tell me what it is about: ${m.url}`)); }]];
  if (m.tipo !== 'enlace') acc.splice(2, 0, [T('Abrir imagen', 'Open image'), () => H('nueva', { url: m.url })]);
  $('me-acc').innerHTML = acc.map(([t], i) => `<button data-i="${i}">${esc(t)}</button>`).join('');
  $('me-acc').onclick = (ev) => { const b = ev.target.closest('[data-i]'); if (!b) return; cerrarCapa('menu-enlace'); acc[Number(b.dataset.i)][1](); };
  H('vibrar', { ms: 20 }); abrirCapa('menu-enlace');
});

// ── descargas ──
const descs = [];
nav.en('descarga', (d) => { descs.unshift({ ...d, t: Date.now() }); pintarDescargas(); toast('⬇ ' + d.nombre); });
function pintarDescargas() {
  $('descargas').innerHTML = descs.map((d) => `<div class="d">${esc(d.nombre)}<small>${T('En Descargas · ', 'In Downloads · ')}${new Date(d.t).toLocaleTimeString()}</small></div>`).join('') || `<div class="vacio">${T('Sin descargas todavía.', 'No downloads yet.')}</div>`;
}
$('abrir-desc').addEventListener('click', () => H('descargas'));
nav.en('aviso', (t) => toast(t));
nav.en('compartido', (t) => { const u = (String(t).match(/https?:\/\/\S+/) || [])[0]; if (u) H('nueva', { url: u }); else { abrirPanel('chat'); $('q').value = t; } });

// ── reloj del HUD ──
function reloj() { $('h-hora').textContent = new Date().toLocaleTimeString(IDIOMA === 'es' ? 'es-PR' : 'en-US', { hour: 'numeric', minute: '2-digit' }); }
setInterval(reloj, 15000);

// ── arranque ──
async function arrancar() {
  const g = await Datos.cargar('config', {}); cfg = { ...PRED, ...(g || {}) };
  IDIOMA = cfg.idioma === 'es' ? 'es' : 'en';
  ponerTema(cfg.tema); traducirInterfaz(); reloj();
  favoritos = (await Datos.cargar('favoritos', [])) || []; historial = (await Datos.cargar('historial', [])) || []; memoria = (await Datos.cargar('memoria', [])) || [];
  pintar(await H('estado')); pintarDescargas();
  medir(); setTimeout(medir, 400);
  if (window.alArrancar) for (const f of window.alArrancar) { try { await f(); } catch (e) { console.error(e); } }
}
window.alArrancar = [];
function guardarCfg(cambio) { Object.assign(cfg, cambio); Datos.guardar('config', cfg); }
window.addEventListener('load', arrancar);
