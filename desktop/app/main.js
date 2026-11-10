'use strict';
// Navegador JARVIS [2026-10-27]
//  · Interfaz HUD propia (ui/), cada pestaña es una WebContentsView (motor Chromium).
//  · Control de JARVIS: servidor local 127.0.0.1 (puerto al azar) con llave (token) en ~/.config/jarvis/navegador.json (modo 600).
//    Acciones: abrir, buscar, pestañas, atrás/adelante, desplazar, zoom, leer, ver (elementos numerados), clic, escribir, tecla, panel.
//
// ── MAPA DEL CÓDIGO [04-nov, ordenado] ─────────────────────────────────────────
//  main.js (este archivo): ventana, pestañas, atajos, control de JARVIS, chat, y el pegamento entre las piezas.
//    Secciones (busca «// ──» o «// ══»): idioma · utilidades · pantalla dividida · video flotante · modo gaming ·
//    historial de la barra · pestañas · reabrir pestaña · JARVIS dentro de la página · servidor de control ·
//    recorrer la página · chat · cerebro propio · traducir · vigilante · teléfono · subtítulos · voz siempre activa ·
//    gestos · Cyber HUD · descargas · dictado · PDFs · actualizaciones · importar · temas · cerebro local ·
//    escáner de descargas · terminal · centro de mando · configuración · ventana · arranque.
//  lib/ — las piezas: cerebro (IAs), proteccion (configuración, bloqueo, historial), anuncios, extensiones, gaming,
//    vigilante, telefono, escaner, monitor, clip, antivirus, memoria, importar, actualizar, windows, terminal.
//  ui/ — lo que se ve: index.html + app.js (navegador), gestos.js, dictado.js, mapa.js, config.* (configuración),
//    mando.* (centro de mando), estilo.css.
// ──────────────────────────────────────────────────────────────────────────────
const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu, clipboard, shell, nativeTheme, dialog, protocol } = require('electron');
const proteccion = require('./lib/proteccion');
const cerebro = require('./lib/cerebro');          // cerebro propio: funciona sin el JARVIS de fondo [28-oct]
const anuncios = require('./lib/anuncios');        // bloqueador completo de anuncios [28-oct]
const extensiones = require('./lib/extensiones');  // carpeta de extensiones [28-oct]
const juegos = require('./lib/gaming');            // modo gaming automático [04-nov]
const path = require('path');

// ── Idioma del navegador [28-oct: «que por default esté en inglés»] ──
// Configuración › Idioma. Vacío = inglés en Windows; en JARVIS OS, el idioma del sistema.
const idioma = (() => { try { return require(path.join(__dirname, '..', 'idiomas', 'idioma-node.js')); } catch { return null; } })();
function codIdioma(c) {
  const elegido = String((c || proteccion.leerConfig()).idioma || '').toLowerCase();
  if (cerebro.NOMBRE_IDIOMA[elegido]) return elegido;
  if (process.platform === 'linux' && idioma) { try { return idioma.actual(); } catch { /* */ } }
  return 'en';
}
const COD = codIdioma();
app.commandLine.appendSwitch('lang', COD); app.commandLine.appendSwitch('accept-lang', COD === 'es' ? 'es-419,es,en' : `${COD},en`);   // la página de inicio y las webs, en tu idioma
ipcMain.on('idioma:diccionario', (e) => { try { e.returnValue = idioma ? idioma.diccionario(COD) : { lang: COD, exactas: {}, patrones: [] }; } catch { e.returnValue = null; } });
const tr = (s) => { if (COD === 'es' || !idioma) return s; try { return idioma.diccionario(COD).exactas[String(s).trim().toLowerCase()] || s; } catch { return s; } };   // menús nativos
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

app.setName('Navegador JARVIS');
const ES_LINUX = process.platform === 'linux';
const CONF = path.join(os.homedir(), '.config', 'jarvis');
const DATOS = path.join(CONF, 'navegador-datos.json');      // pestañas abiertas y favoritos
const LLAVE = path.join(CONF, 'navegador.json');            // puerto + token del control (solo para JARVIS)
const carpetaDe = (cual, nombres) => { try { const p = app.getPath(cual); if (p && fs.existsSync(p)) return p; } catch { /* nada */ } return nombres.map((d) => path.join(os.homedir(), d)).find((d) => fs.existsSync(d)) || path.join(os.homedir(), nombres[0]); };
const DESCARGAS = carpetaDe('downloads', ['Descargas', 'Downloads']);   // la del idioma del sistema (xdg)
const INICIO = (() => {
  for (const p of ['/usr/share/jarvis/inicio/index.html', path.join(__dirname, '..', 'jarvis-os', 'sistema', 'usr', 'share', 'jarvis', 'inicio', 'index.html'), path.join(__dirname, '..', 'inicio', 'index.html')]) {
    if (fs.existsSync(p)) return 'file:///' + p.replace(/\\/g, '/').replace(/^\/+/, '');
  }
  return 'about:blank';
})();
const IMAGENES = path.join(carpetaDe('pictures', ['Imágenes', 'Pictures']), 'JARVIS');
const ARRIBA = 98;   // pestañas + barra de dirección
const ABAJO = 28;    // barra de estado HUD
const PANEL = 380;   // panel de JARVIS
const LATERAL = 230; // pestañas verticales
const CAPTURA = (process.argv.find((a) => a.startsWith('--captura=')) || '').slice(10);  // pruebas: guarda una foto y sale

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
// el modelo de voz (Vosk) se sirve a la interfaz por aquí [04-nov]
protocol.registerSchemesAsPrivileged([{ scheme: 'jarvisvoz', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let win = null;
let pestanas = [];          // { id, vista, cargando, icono }
let activa = null;
let siguienteId = 1;
let panelAbierto = process.argv.includes('--panel');
let pantallaCompleta = false;
let leyendo = false;
let datos = { pestanas: [], favoritos: [] };
try { datos = { ...datos, ...JSON.parse(fs.readFileSync(DATOS, 'utf8')) }; } catch { /* primera vez */ }
let cfg = proteccion.leerConfig();
let ventanaConfig = null;
let extraArriba = 0;   // barra de avisos (permisos, emergentes) debajo de la dirección
const guardarDatos = () => { try { fs.mkdirSync(CONF, { recursive: true }); fs.writeFileSync(DATOS, JSON.stringify(datos, null, 1)); } catch { /* nada */ } };

// 🔒 [seguridad 05-nov] ¿la petición viene de un archivo de la propia interfaz (ui/…)? Las páginas web nunca pasan esta prueba.
const UI_DIR = 'file:///' + path.join(__dirname, 'ui').replace(/\\/g, '/').replace(/^\/+/, '');
function deLaInterfaz(e, archivos) {
  try {
    const u = new URL((e.senderFrame && e.senderFrame.url) || '');
    if (u.protocol !== 'file:') return false;
    const ruta = decodeURIComponent(u.pathname).replace(/\\/g, '/').toLowerCase();
    const base = decodeURIComponent(new URL(UI_DIR).pathname).toLowerCase();
    return archivos.some((a) => ruta === (base + '/' + a).toLowerCase());
  } catch { return false; }
}
app.on('web-contents-created', (_e, c) => {
  c.on('will-attach-webview', (ev) => ev.preventDefault());   // nadie puede meter <webview> (tendría más poderes)
});
// ── utilidades ──────────────────────────────────────────────────────────
function aUrl(texto) {
  const t = String(texto || '').trim();
  if (!t) return INICIO;
  if (/^(https?|file|about|chrome|data):/i.test(t)) return t;
  if (/^localhost(:\d+)?/.test(t)) return 'http://' + t;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t)) return 'https://' + t;
  return proteccion.buscar(cfg, t);
}
// lo que una PÁGINA puede abrir sola: solo web (nunca file:, data: ni chrome:) [revisión 27-oct]
const deUnaPagina = (u) => /^https?:\/\//i.test(String(u || '')) || u === 'about:blank';
const pest = (id) => pestanas.find((p) => p.id === id);
const actual = () => pest(activa);
const wc = () => actual()?.vista.webContents;
const uaChrome = () => session.fromPartition('persist:jarvis').getUserAgent().replace(/\s(Electron|jarvis-navegador|Navegador JARVIS)\/\S+/g, '');

function aviso(canal, d) {
  if (win && !win.isDestroyed()) win.webContents.send(canal, d);
  if (mandoWin && !mandoWin.isDestroyed() && CANALES_MANDO.has(canal)) mandoWin.webContents.send(canal, d);   // centro de mando [04-nov]
}
function estado() {
  const p = actual();
  const w = p?.vista.webContents;
  return {
    pestanas: pestanas.map((x) => ({ id: x.id, titulo: x.dormida ? x.dormida.titulo : (x.vista.webContents.getTitle() || 'Nueva pestaña'), url: urlDe(x),
      icono: x.dormida ? x.dormida.icono : (x.icono || ''), cargando: x.cargando, sonido: x.vista.webContents.isCurrentlyAudible(), privada: Boolean(x.privada),
      dormida: Boolean(x.dormida), lado: dividida ? (x.id === dividida.a ? 'izq' : x.id === dividida.b ? 'der' : '') : '' })),
    verticales: Boolean(cfg.pestanasVerticales), dividida: Boolean(dividida), gaming: gaming ? { juego: gaming.juego, liberado: gaming.liberado || 0 } : null,
    activa, url: w ? w.getURL() : '', titulo: w ? w.getTitle() : '', cargando: p?.cargando || false,
    atras: w ? w.navigationHistory.canGoBack() : false, adelante: w ? w.navigationHistory.canGoForward() : false,
    zoom: w ? Math.round(w.getZoomFactor() * 100) : 100, panel: panelAbierto, inicio: INICIO, leyendo,
    efectos: cfg.efectos !== false, sonidos: cfg.sonidosUI !== false, monitor: cfg.monitorSistema !== false,
    actualizacion: nuevaVersion ? nuevaVersion.version : '', version: app.getVersion(),
    terminal: cfg.terminal !== false, mando: mandoAbierto(), tema: cfg.tema || 'cian', dictado: cfg.dictado !== false,
    documento: Boolean(cfg.documentos !== false && p && !p.privada && (p.esPdf || esPdfUrl(urlDe(p)))),
    gestos: Boolean(cfg.gestos), camaraGestos: cfg.camaraGestos || '', gestosVista: cfg.gestosVista !== false, camaraPausa: cfg.camaraPausa !== false, camaraGuardian: cfg.camaraGuardian !== false, lanzarTelefono: cfg.lanzarTelefono !== false, local: Boolean(cfg.cerebroLocal),
    favorito: w ? datos.favoritos.some((f) => f.url === w.getURL()) : false, favoritos: datos.favoritos,
  };
}
let empujar = null;
function avisarEstado() { clearTimeout(empujar); empujar = setTimeout(() => aviso('estado', estado()), 30); }

let tapado = false;
const consolaUI = [];   // errores de la interfaz (para diagnosticar desde «control»)
let dividida = null;   // { a: id izquierda, b: id derecha }
let gaming = null;     // { juego, desde, liberado }
const urlDe = (p) => (p.dormida ? p.dormida.url : p.vista.webContents.getURL());

// ── Pantalla dividida [04-nov] ──
function dividir(on, url) {
  const quiere = on === undefined ? !dividida : Boolean(on);
  if (!quiere) { dividida = null; acomodar(); avisarEstado(); return { ok: true, dividida: false }; }
  if (!actual()) return { ok: false };
  let otra = url ? null : pestanas.filter((p) => p.id !== activa).pop();
  if (!otra) otra = nueva(url || INICIO, false);
  dividida = { a: activa, b: otra.id };
  if (otra.dormida) despertar(otra);
  acomodar(); avisarEstado();
  return { ok: true, dividida: true };
}

// ── Video flotante: el video encima de todo, aunque cambies de ventana [04-nov] ──
let mini = null;
const idYoutube = (u) => { try { const x = new URL(u); if (/youtu\.be$/.test(x.hostname)) return x.pathname.slice(1); if (/youtube\.com$/.test(x.hostname.replace(/^www\.|^m\./, ''))) return x.searchParams.get('v') || (x.pathname.match(/\/(shorts|live|embed)\/([\w-]{6,})/) || [])[2] || ''; } catch { /* */ } return ''; };
function miniVentana(id, t) {
  if (mini && !mini.isDestroyed()) mini.close();
  const { screen } = require('electron');
  const area = (win ? screen.getDisplayMatching(win.getBounds()) : screen.getPrimaryDisplay()).workArea;   // en el monitor donde está el navegador
  mini = new BrowserWindow({ width: 480, height: 290, x: area.x + area.width - 500, y: area.y + area.height - 310, alwaysOnTop: true, frame: true, autoHideMenuBar: true,
    title: 'JARVIS · Video', backgroundColor: '#000', icon: path.join(__dirname, 'ui', 'icono.png'),
    webPreferences: { partition: 'persist:jarvis', sandbox: true, contextIsolation: true } });
  mini.setAlwaysOnTop(true, 'screen-saver');   // encima de todo, también del navegador y de los juegos en ventana
  mini.setVisibleOnAllWorkspaces(true);
  mini.on('blur', () => { if (mini && !mini.isDestroyed()) mini.setAlwaysOnTop(true, 'screen-saver'); });
  mini.webContents.setWindowOpenHandler(({ url: u }) => { if (deUnaPagina(u)) nueva(u); return { action: 'deny' }; });
  // la página normal del video (el reproductor «incrustado» YouTube lo bloquea), con todo oculto menos el reproductor
  const CSS_MINI = `#masthead-container,#secondary,#below,#guide,ytd-mini-guide-renderer,tp-yt-app-drawer,#chat,ytd-popup-container,.ytp-paid-content-overlay{display:none!important}
    html,body,ytd-app{overflow:hidden!important;background:#000!important}
    #movie_player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483647!important;background:#000!important}
    #movie_player video{width:100vw!important;height:100vh!important;left:0!important;top:0!important;object-fit:contain!important}
    #movie_player .ytp-chrome-bottom{width:calc(100vw - 24px)!important;left:12px!important}`;
  const ajustar = () => {
    if (!mini || mini.isDestroyed()) return;
    mini.webContents.insertCSS(CSS_MINI).catch(() => {});
    mini.webContents.executeJavaScript(`(() => { const v = document.querySelector('#movie_player video'); dispatchEvent(new Event('resize'));
      if (v && ${Math.floor(t || 0)} > 0 && v.currentTime < ${Math.floor(t || 0)} - 3) v.currentTime = ${Math.floor(t || 0)}; if (v && v.paused) v.play().catch(() => {}); })()`, true).catch(() => {});
  };
  mini.webContents.on('dom-ready', ajustar);
  mini.webContents.on('did-finish-load', () => subtitulosAlCargar(mini.webContents));
  mini.webContents.on('did-finish-load', () => { ajustar(); setTimeout(ajustar, 1500); setTimeout(ajustar, 4000); });
  mini.on('resize', () => { if (mini && !mini.isDestroyed()) mini.webContents.executeJavaScript("dispatchEvent(new Event('resize'))").catch(() => {}); });
  mini.webContents.setUserAgent(uaChrome());
  mini.loadURL(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}&t=${Math.floor(t || 0)}s`).catch(() => {});
  mini.on('closed', () => { mini = null; });
}
async function videoFlotante() {
  const w = wc(); if (!w) return { ok: false, error: 'No hay página.' };
  // YouTube: ventanita propia siempre encima (se ve seguro y se puede mover); otra vez = volver a la pestaña
  if (mini && !mini.isDestroyed()) { mini.close(); try { await w.executeJavaScript('(() => { const v = document.querySelector("video"); if (v) v.play(); })()', true); } catch { /* */ } return { ok: true, modo: 'cerrado' }; }
  const idYt = idYoutube(w.getURL());
  if (idYt) {
    let t = 0; try { t = await w.executeJavaScript('(() => { const v = document.querySelector("video"); if (!v) return 0; v.pause(); return v.currentTime; })()', true); } catch { /* */ }
    miniVentana(idYt, t); return { ok: true, modo: 'ventanita' };
  }
  let r = '';
  try {
    r = await w.executeJavaScript(`(async () => {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return 'salio'; }
      const area = (v) => { const b = v.getBoundingClientRect(); return b.width * b.height; };
      const v = [...document.querySelectorAll('video')].filter((x) => x.readyState > 0).sort((a, b) => (Number(!b.paused) - Number(!a.paused)) || area(b) - area(a))[0];
      if (!v) return 'sin-video';
      v.removeAttribute('disablepictureinpicture'); v.disablePictureInPicture = false;
      try { await v.requestPictureInPicture(); if (v.paused) v.play().catch(() => {}); return 'ok'; } catch (e) { return 'error: ' + e.message; }
    })()`, true);
  } catch (e) { r = 'error: ' + e.message; }
  if (r === 'ok' || r === 'salio') return { ok: true, modo: r === 'ok' ? 'flotante' : 'cerrado' };
  const id = idYoutube(w.getURL());
  if (id) {   // YouTube no deja: ventanita propia siempre encima, desde el mismo segundo
    let t = 0; try { t = await w.executeJavaScript('(() => { const v = document.querySelector("video"); if (!v) return 0; v.pause(); return v.currentTime; })()', true); } catch { /* */ }
    miniVentana(id, t); return { ok: true, modo: 'ventanita' };
  }
  return { ok: false, error: r === 'sin-video' ? 'No veo ningún video en esta página.' : 'Esta página no deja sacar el video.' };
}

// ── Modo gaming: al abrir un juego, duermen las pestañas de fondo y el navegador baja su prioridad [04-nov] ──
const memoriaMB = () => Math.round(app.getAppMetrics().reduce((a, m) => a + ((m.memory && m.memory.workingSetSize) || 0), 0) / 1024);
function prioridad(baja) {
  const pr = baja ? os.constants.priority.PRIORITY_BELOW_NORMAL : os.constants.priority.PRIORITY_NORMAL;
  for (const m of app.getAppMetrics()) { try { os.setPriority(m.pid, pr); } catch { /* */ } }
}
function cambioGaming(j) {
  if (j) {
    const antes = memoriaMB();
    gaming = { juego: String(j.titulo || j.nombre).slice(0, 40), desde: Date.now(), liberado: 0, dormidas: 0 };
    for (const p of pestanas) {
      const visible = p.id === activa || (dividida && (p.id === dividida.a || p.id === dividida.b));
      if (!visible && dormir(p)) gaming.dormidas++;
    }
    prioridad(true); avisarEstado();
    if (qwenProc) apagarQwen();   // el Qwen que encendió el navegador suelta la tarjeta gráfica para el juego
    for (const t of [5000, 12000]) setTimeout(() => { if (gaming) { gaming.liberado = Math.max(gaming.liberado || 0, antes - memoriaMB()); avisarEstado(); } }, t);
  } else if (gaming) { gaming = null; prioridad(false); avisarEstado(); }   // las pestañas dormidas despiertan al tocarlas
}

// ── Pestañas dormidas (modo gaming): la página se descarga para liberar memoria y vuelve al tocarla ──
function dormir(p) {
  if (p.dormida || p.privada) return false;
  const w = p.vista.webContents; const u = w.getURL();
  if (!/^https?:/.test(u) || w.isCurrentlyAudible()) return false;
  p.dormida = { url: u, titulo: w.getTitle() || u, icono: p.icono || '' };
  w.loadURL('data:text/html;charset=utf-8,<body style="background:%23050b12"></body>').catch(() => {});   // otro proceso: el de la web se cierra y suelta su memoria
  return true;
}
function despertar(p) {
  if (!p.dormida) return;
  const u = p.dormida.url; p.dormida = null;
  const w = p.vista.webContents; const h = w.navigationHistory;
  if (h.canGoBack()) { const i = h.getActiveIndex(); const prev = h.getEntryAtIndex(i - 1); if (prev && prev.url === u) { h.goBack(); return; } }
  w.loadURL(u).catch(() => {});
}
// ── Historial en la barra de dirección: lo que ya buscaste y visitaste [28-oct] ──
function busquedaDe(u) {
  try { const x = new URL(u); if (/(^|\.)(google|bing|duckduckgo|search\.brave|youtube)\./.test(x.hostname)) return (x.searchParams.get('q') || x.searchParams.get('search_query') || '').trim(); } catch { /* */ }
  return '';
}
function sugerencias(q) {
  const n = String(q || '').trim().toLowerCase();
  if (!n) return [];
  const mapa = new Map();
  const ahora = Date.now();
  for (const h of proteccion.historial.buscar('', 3000)) {
    const b = busquedaDe(h.url);
    const clave = b ? 'q:' + b.toLowerCase() : h.url.replace(/#.*$/, '');
    let e = mapa.get(clave);
    if (!e) { e = { tipo: b ? 'busqueda' : 'pagina', url: h.url, titulo: b || h.titulo || '', veces: 0, t: h.t }; mapa.set(clave, e); }
    e.veces++;
  }
  for (const f of datos.favoritos) { const e = mapa.get(f.url) || { tipo: 'pagina', url: f.url, titulo: f.titulo, veces: 0, t: 0 }; e.fav = true; mapa.set(f.url, e); }
  // solo el sitio y la ruta (no lo que va detrás del «?»), y sin páginas de iniciar sesión
  const limpia = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).toLowerCase(); } catch { return u.toLowerCase(); } };
  const deCuenta = /(^|\.)(accounts|myaccount|gds)\.google\.|\/(signin|login|oauth|auth|sso)\b|passkey|ServiceLogin/i;
  const lista = [];
  for (const e of mapa.values()) {
    if (e.tipo === 'pagina' && deCuenta.test(e.url)) continue;
    const t = (e.titulo || '').toLowerCase(); const u = limpia(e.url);
    let p = 0;
    if (u.startsWith(n)) p += 6; else if (u.includes(n)) p += 2;
    if (t.startsWith(n)) p += 5; else if (t.includes(n)) p += 3;
    if (!p) continue;
    p += Math.min(4, Math.log2(1 + e.veces)) + (e.fav ? 3 : 0) + Math.max(0, 2 - (ahora - e.t) / 864e5 / 7);
    lista.push({ ...e, p });
  }
  return lista.sort((a, b) => b.p - a.p).slice(0, 8).map(({ tipo, url, titulo, fav }) => ({ tipo, url, titulo, fav: Boolean(fav) }));
}
function acomodar() {
  if (!win) return;
  const [ancho, alto] = win.getContentSize();
  if (dividida && (!pest(dividida.a) || !pest(dividida.b))) dividida = null;
  const izq = cfg.pestanasVerticales ? LATERAL : 0;   // pestañas verticales a la izquierda [04-nov]
  const util = Math.max(200, ancho - izq - (panelAbierto ? PANEL : 0));
  const y = ARRIBA + extraArriba; const h = Math.max(100, alto - ARRIBA - extraArriba - ABAJO);
  for (const p of pestanas) {
    const enPar = Boolean(dividida) && !pantallaCompleta && (p.id === dividida.a || p.id === dividida.b);
    if (p.id !== activa && !enPar) { p.vista.setVisible(false); continue; }
    p.vista.setVisible(!tapado);   // tapado: la lista del historial de la barra está abierta encima
    if (pantallaCompleta) p.vista.setBounds({ x: 0, y: 0, width: ancho, height: alto });
    else if (enPar) {   // pantalla dividida: dos páginas lado a lado [04-nov]
      const mitad = Math.floor((util - 6) / 2);
      p.vista.setBounds({ x: izq + (p.id === dividida.a ? 0 : mitad + 6), y, width: p.id === dividida.a ? mitad : util - mitad - 6, height: h });
    } else p.vista.setBounds({ x: izq, y, width: util, height: h });
  }
}

// ── pestañas ────────────────────────────────────────────────────────────
function nueva(url, activar = true, privada = false) {
  const vista = new WebContentsView({ webPreferences: { partition: privada ? 'jarvis-privado' : 'persist:jarvis', sandbox: true, contextIsolation: true, spellcheck: true, webviewTag: false, navigateOnDragDrop: false, plugins: true } });   // plugins: visor de PDF [04-nov]
  vista.setBackgroundColor('#050b12');
  const p = { id: siguienteId++, vista, cargando: false, icono: '', privada };
  pestanas.push(p);
  win.contentView.addChildView(vista);
  const w = vista.webContents;
  w.setUserAgent(uaChrome());
  w.setWindowOpenHandler(({ url: u, disposition }) => {
    if (!deUnaPagina(u)) return { action: 'deny' };
    if (disposition === 'new-window' && cfg.bloquearEmergentes && !proteccion.emergentePermitida(cfg, w.getURL())) {
      aviso('emergente', { host: proteccion.host(w.getURL()), url: u }); return { action: 'deny' };
    }
    nueva(u, disposition !== 'background-tab', p.privada); return { action: 'deny' };
  });
  w.on('did-navigate', (_e, u) => { if (!p.privada && cfg.guardarHistorial) proteccion.historial.anotar(u, w.getTitle()); });
  // 🧠 memoria del navegador [09-nov]: un pedacito del texto de cada página, para encontrarla después por lo que tenía
  const recordar = () => {
    if (p.privada || !cfg.guardarHistorial || cfg.memoriaNavegador === false) return;
    clearTimeout(p.recordarT);
    p.recordarT = setTimeout(async () => {
      if (w.isDestroyed()) return;
      const u = w.getURL(); if (!/^https?:/.test(u)) return;
      try { recuerdos.anotar(u, await w.executeJavaScript(recuerdos.JS_PAGINA, true)); } catch { /* */ }
    }, 3500);
  };
  w.on('did-finish-load', recordar);
  w.on('did-navigate-in-page', (_e, _u, principal) => { if (principal) recordar(); });
  w.on('page-title-updated', (_e, t) => { if (!p.privada && cfg.guardarHistorial) proteccion.historial.titulo(w.getURL(), t); });
  w.once('dom-ready', () => { if (cfg.zoom && cfg.zoom !== 100) w.setZoomFactor(cfg.zoom / 100); });
  w.on('dom-ready', () => extensiones.inyectar(w, cfg.extensionesApagadas));
  w.on('dom-ready', () => temaInicio(w));   // la página de inicio también cambia de color con el tema [04-nov]
  w.on('did-finish-load', () => subtitulosAlCargar(w));
  w.on('did-navigate-in-page', () => subtitulosAlCargar(w));   // YouTube cambia de video sin recargar
  w.on('will-attach-webview', (e) => e.preventDefault());
  w.on('will-navigate', (e, u) => { if (/^(file|chrome|devtools):/i.test(u) && !String(w.getURL()).startsWith('file:')) e.preventDefault(); });
  // "abrir igual" desde el aviso de página sin HTTPS
  const idW = w.id;
  w.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) escaner.navegacion(idW, d.url); });
  w.on('certificate-error', () => escaner.certificado(idW));
  w.on('did-finish-load', () => { escanear(p).catch(() => {}); });
  w.on('did-finish-load', () => { p.esPdf = undefined; esPdf(p).then((x) => { if (x) avisarEstado(); }).catch(() => {}); });
  w.once('destroyed', () => escaner.olvidar(idW));
  w.on('did-start-navigation', (d) => {
    if (d.isMainFrame && /error\.html/.test(w.getURL()) && d.url.startsWith('http://')) proteccion.httpPermitido.add(proteccion.host(d.url));
  });
  w.on('did-start-loading', () => { p.cargando = true; avisarEstado(); });
  w.on('did-stop-loading', () => { p.cargando = false; avisarEstado(); guardarPestanas(); });
  for (const ev of ['page-title-updated', 'did-navigate', 'did-navigate-in-page', 'audio-state-changed']) w.on(ev, avisarEstado);
  w.on('page-favicon-updated', (_e, iconos) => { p.icono = iconos[0] || ''; avisarEstado(); });
  w.on('focus', () => { if (dividida && activa !== p.id && (p.id === dividida.a || p.id === dividida.b)) { activa = p.id; avisarEstado(); } });
  w.on('did-fail-load', (_e, codigo, desc, u, principal) => {
    if (principal && codigo !== -3) w.loadFile(path.join(__dirname, 'ui', 'error.html'), { query: { u, d: desc, http: (cfg.soloHttps && u.startsWith('https://')) ? '1' : '' } }).catch(() => {});
  });
  w.on('enter-html-full-screen', () => { pantallaCompleta = true; aviso('completa', true); acomodar(); });
  w.on('leave-html-full-screen', () => { pantallaCompleta = false; aviso('completa', false); acomodar(); });
  w.on('found-in-page', (_e, r) => aviso('encontrado', { actual: r.activeMatchOrdinal, total: r.matches }));
  w.on('context-menu', (_e, m) => menuPagina(w, m));
  w.on('before-input-event', (e, i) => atajos(e, i));
  w.loadURL(aUrl(url)).catch(() => {});
  if (activar) activarPestana(p.id); else acomodar();
  avisarEstado();
  return p;
}
function activarPestana(id) {
  const p = pest(id);
  if (!p) return;
  // con la pantalla dividida, la pestaña elegida entra en el lado que tenías activo
  if (dividida && id !== dividida.a && id !== dividida.b) { if (activa === dividida.b) dividida.b = id; else dividida.a = id; }
  if (p.dormida) despertar(p);
  const cambio = activa !== id;
  activa = id; acomodar(); avisarEstado();
  wc()?.focus();
  if (cambio) { aviso('escaner', p.escaneo || null); if (cfg.efectos && !p.dormida && !p.privada) efectoHolograma(p.vista.webContents); }
}
// ── Reabrir la pestaña cerrada (Ctrl+Mayús+T) [04-nov] ──
const cerradas = [];
function reabrirPestana() { const x = cerradas.pop(); if (x) nueva(x.url); return x || null; }
function cerrarPestana(id = activa) {
  const i = pestanas.findIndex((p) => p.id === id);
  if (i < 0) return;
  const [p] = pestanas.splice(i, 1);
  if (!p.privada) { const u = urlDe(p); if (/^(https?|file):/.test(u)) { cerradas.push({ url: u, titulo: p.dormida ? p.dormida.titulo : p.vista.webContents.getTitle() }); if (cerradas.length > 25) cerradas.shift(); } }   // para Ctrl+Mayús+T
  if (dividida && (id === dividida.a || id === dividida.b)) dividida = null;
  win.contentView.removeChildView(p.vista);
  p.vista.webContents.close();
  if (!pestanas.length) { nueva(INICIO); return; }
  if (activa === id) activarPestana(pestanas[Math.min(i, pestanas.length - 1)].id);
  guardarPestanas(); avisarEstado();
}
function moverPestana(paso) {
  const i = pestanas.findIndex((p) => p.id === activa);
  if (i >= 0) activarPestana(pestanas[(i + paso + pestanas.length) % pestanas.length].id);
}
function guardarPestanas() {
  if (CAPTURA) return;
  datos.pestanas = pestanas.filter((p) => !p.privada).map((p) => urlDe(p)).filter((u) => u && !u.startsWith('file:') && !u.startsWith('about:'));
  guardarDatos();
}
function navegar(texto) { const w = wc(); if (w) { w.loadURL(aUrl(texto)).catch(() => {}); w.focus(); } }

function menuPagina(w, m) {
  const t = [];
  const tel = (o) => async () => { const r = await enviarTelefono(o); abrirPanel(true); aviso('telefono', r); };
  if (m.linkURL && deUnaPagina(m.linkURL)) t.push({ label: tr('Abrir enlace en pestaña nueva'), click: () => nueva(m.linkURL, false) }, { label: tr('Copiar enlace'), click: () => clipboard.writeText(m.linkURL) }, { type: 'separator' });
  if (m.selectionText) t.push({ label: tr('Copiar'), role: 'copy' }, { label: `${tr('Buscar')} «${m.selectionText.slice(0, 24)}»`, click: () => nueva(aUrl(m.selectionText)) },
    { label: tr('Preguntarle a JARVIS'), click: () => { abrirPanel(true); aviso('preguntar', `Explícame: «${m.selectionText.slice(0, 400)}»`); } }, { type: 'separator' });
  if (m.isEditable) t.push(...(cfg.dictado !== false ? [{ label: tr('🎙 Dictar aquí (Ctrl+Mayús+D)'), click: () => aviso('dictar') }] : []), { label: tr('Pegar'), role: 'paste' }, { label: tr('Cortar'), role: 'cut' }, { type: 'separator' });
  if (m.mediaType === 'image') t.push({ label: tr('Guardar imagen'), click: () => w.downloadURL(m.srcURL) }, { type: 'separator' });
  t.push({ label: tr('Atrás'), enabled: w.navigationHistory.canGoBack(), click: () => w.navigationHistory.goBack() },
    { label: tr('Recargar'), click: () => w.reload() },
    { label: tr('Resumir con JARVIS'), click: () => { abrirPanel(true); aviso('preguntar', 'Resume esta página en pocas frases.'); } },
    { label: tr('Traducir página'), click: () => traducirPagina() },
    { label: tr('Vigilar el precio de esta página'), click: async () => { const r = await vigilarActual('precio'); abrirPanel(true); aviso('vigilado', r); } },
    { label: tr('Enviar al teléfono'), submenu: [
      { label: tr('Esta página'), click: tel({ tipo: 'pagina' }) },
      { label: tr('Foto de la página'), click: tel({ tipo: 'captura' }) },
      ...(m.selectionText ? [{ label: tr('El texto seleccionado'), click: tel({ tipo: 'texto', texto: m.selectionText }) }] : []),
      ...(m.mediaType === 'image' && m.srcURL ? [{ label: tr('Esta imagen'), click: tel({ tipo: 'imagen', url: m.srcURL }) }] : []),
      ...(m.linkURL && deUnaPagina(m.linkURL) ? [{ label: tr('Este enlace'), click: tel({ tipo: 'enlace', url: m.linkURL }) }] : []),
    ] },
    { type: 'separator' }, { label: tr('Inspeccionar'), click: () => w.inspectElement(m.x, m.y) });
  Menu.buildFromTemplate(t).popup({ window: win });
}

function atajos(e, i) {
  if (i.type !== 'keyDown') return;
  const c = i.control || i.meta;
  const k = i.key.toLowerCase();
  let hecho = true;
  if (c && i.shift && k === 'n') nueva(INICIO, true, true);
  else if (c && i.shift && k === 't') reabrirPestana();
  else if (c && k === ',') abrirConfig();
  else if (c && k === 'h') abrirConfig('historial');
  else if (c && k === 't') nueva(INICIO);
  else if (c && k === 'w') cerrarPestana();
  else if (c && k === 'l') { win.webContents.focus(); aviso('foco-direccion'); }   // el teclado pasa de la página a la barra
  else if (c && k === 'f') { win.webContents.focus(); aviso('foco-buscar'); }
  else if (c && k === 'j') abrirPanel(!panelAbierto);
  else if (c && i.shift && k === 'd' && cfg.dictado !== false) aviso('dictar');   // 🎙 dictado en el campo donde estás escribiendo [04-nov]
  else if (c && !i.shift && k === 'o' && cfg.documentos !== false) abrirDocumento();
  else if (c && !i.shift && k === 'k' && cfg.terminal !== false) { win.webContents.focus(); aviso('terminal'); }   // terminal de comandos [04-nov]
  else if (c && i.shift && k === 's') dividir();
  else if (c && i.shift && k === 'v') videoFlotante();
  else if (c && k === 'd') alternarFavorito();
  else if (c && k === 'tab') moverPestana(i.shift ? -1 : 1);
  else if (c && (k === '+' || k === '=')) zoom(1);
  else if (c && k === '-') zoom(-1);
  else if (c && k === '0') zoom(0);
  else if (k === 'f5' || (c && k === 'r')) wc()?.reload();
  else if (i.alt && k === 'arrowleft') wc()?.navigationHistory.goBack();
  else if (i.alt && k === 'arrowright') wc()?.navigationHistory.goForward();
  else if (k === 'f11') win.setFullScreen(!win.isFullScreen());
  else if (k === 'f12') wc()?.toggleDevTools();
  else hecho = false;
  if (hecho) e.preventDefault();
}
function zoom(paso) {
  const w = wc(); if (!w) return;
  const niveles = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];
  const z = w.getZoomFactor();
  let i = niveles.findIndex((n) => Math.abs(n - z) < 0.01); if (i < 0) i = 4;
  w.setZoomFactor(paso === 0 ? 1 : niveles[Math.max(0, Math.min(niveles.length - 1, i + paso))]);
  avisarEstado();
}
function abrirPanel(on) { panelAbierto = Boolean(on); acomodar(); avisarEstado(); }
function alternarFavorito() {
  const w = wc(); if (!w) return;
  const u = w.getURL();
  if (!u || u.startsWith('file:')) return;
  const i = datos.favoritos.findIndex((f) => f.url === u);
  if (i >= 0) datos.favoritos.splice(i, 1); else datos.favoritos.unshift({ url: u, titulo: w.getTitle() || u });
  datos.favoritos = datos.favoritos.slice(0, 40); guardarDatos(); avisarEstado();
}

// ── lo que JARVIS puede hacer DENTRO de la página ───────────────────────
const JS_VER = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none'; };
  const sel = 'a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[contenteditable=true],summary';
  const out = []; let n = 1;
  document.querySelectorAll('[data-jarvis-id]').forEach((e) => e.removeAttribute('data-jarvis-id'));
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el) || out.length >= 160) continue;
    el.setAttribute('data-jarvis-id', String(n));
    const t = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.alt || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
    out.push({ id: n++, tipo: el.tagName.toLowerCase() + (el.type ? ':' + el.type : ''), texto: t });
  }
  return out;
})()`;
const JS_DESTELLO = `(el) => { const r = el.getBoundingClientRect(); const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px;border:2px solid #38d6ff;border-radius:8px;box-shadow:0 0 18px #38d6ff,inset 0 0 12px rgba(56,214,255,.35);transition:all .6s ease;opacity:1';
  document.documentElement.appendChild(d); setTimeout(() => { d.style.opacity = '0'; d.style.transform = 'scale(1.15)'; }, 350); setTimeout(() => d.remove(), 1000); }`;
function buscarElemento(id, texto) {
  // por número (de "ver") o por el texto visible más parecido
  return `(() => { const destello = ${JS_DESTELLO};
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim();
    let el = ${id ? `document.querySelector('[data-jarvis-id="${Number(id)}"]')` : 'null'};
    const q = norm(${JSON.stringify(texto || '')});
    if (!el && q) {
      const palabras = q.split(' ').filter((w) => w.length > 1);
      let mejor = null, pm = 1e9;
      for (const e of document.querySelectorAll('a,button,input,textarea,select,[role=button],[role=link],[role=tab],[role=menuitem],summary,label')) {
        const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        const t = norm(e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.title);
        if (!t) continue;
        const p = t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 + t.length / 200 : palabras.every((w) => t.includes(w)) ? 3 + t.length / 200 : 1e9;
        if (p < pm) { pm = p; mejor = e; }
      }
      el = mejor;
    }
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    destello(el);
    return el;
  })()`;
}
// ── JARVIS mira la página: lo principal, títulos e imágenes [2026-10-27] ──
const JS_RAIZ = `(document.querySelector('#mw-content-text, main, article, [role=main], #content, .content') || document.body)`;
const JS_NORM = `const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim();`;
const JS_DESCRIBIR = `(() => { ${JS_NORM} const raiz = ${JS_RAIZ};
  const titulos = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.innerText.replace(/\\[editar\\]|\\s+/g, ' ').trim()).filter(Boolean).slice(0, 30);
  const imgs = [...raiz.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); return r.width >= 80 && r.height >= 80; }).slice(0, 15)
    .map((i, n) => { const fig = i.closest('figure, .thumb, .infobox, td, div'); const cap = (i.closest('figure') && i.closest('figure').querySelector('figcaption')) ? i.closest('figure').querySelector('figcaption').innerText : '';
      const r = i.getBoundingClientRect();
      return { n: n + 1, alt: (i.alt || i.title || '').slice(0, 120), leyenda: cap.slice(0, 160), ancho: Math.round(r.width), alto: Math.round(r.height), en_pantalla: r.top < innerHeight && r.bottom > 0 }; });
  return { titulo: document.title, url: location.href, titulos, imagenes: imgs, texto: raiz.innerText.replace(/\\n{3,}/g, '\\n\\n').slice(0, 14000) };
})()`;
function jsLeerDesde(desde) {
  return `(async () => { ${JS_NORM} const raiz = ${JS_RAIZ}; const q = norm(${JSON.stringify(desde || '')});
    let el = null;
    if (q) {
      const palabras = q.split(' ').filter((w) => w.length > 2);
      const grupos = [raiz.querySelectorAll('h1,h2,h3,h4,h5,h6,dt,th,caption,strong,b'), raiz.querySelectorAll('p,li,td,span,div,a')];
      for (const g of grupos) {
        let mejor = null, pm = 1e9;
        for (const e of g) { const t = norm(e.innerText); if (!t || t.length > 600) continue;
          const p = t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 + t.length / 300 : (palabras.length && palabras.every((w) => t.includes(w))) ? 3 + t.length / 300 : 1e9;
          if (p < pm) { pm = p; mejor = e; } }
        if (mejor) { el = mejor; break; }
      }
      if (!el) return { ok: false };
      const cab = el.closest('h1,h2,h3,h4,h5,h6') || (el.parentElement && el.parentElement.matches('.mw-heading') ? el.parentElement : null);
      if (cab) el = cab.closest('.mw-heading') || cab;
    } else el = raiz.firstElementChild || raiz;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const r = el.getBoundingClientRect(); const d = document.createElement('div');
    d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:0;right:0;top:' + Math.max(0, r.top - 4) + 'px;height:' + (r.height + 8) + 'px;background:rgba(56,214,255,.14);box-shadow:inset 3px 0 0 #38d6ff;transition:opacity 1.5s';
    document.documentElement.appendChild(d); setTimeout(() => { d.style.opacity = '0'; }, 1800); setTimeout(() => d.remove(), 3400);
    const rango = document.createRange(); rango.setStartBefore(el); rango.setEndAfter(raiz.lastChild || raiz);
    const caja = document.createElement('div'); caja.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px';
    caja.appendChild(rango.cloneContents());
    caja.querySelectorAll('script,style,sup.reference,.mw-editsection,.reference,.navbox,.noprint,nav,button,img,figure figcaption,table.infobox').forEach((x) => x.remove());
    document.body.appendChild(caja); const texto = caja.innerText.replace(/\\[\\d+\\]/g, '').replace(/\\n{2,}/g, '\\n').trim(); caja.remove();
    return { ok: true, desde: (el.innerText || '').replace(/\\[?editar\\]?/gi, '').trim().slice(0, 80), texto: texto.replace(/\\[?editar\\]?/gi, '').slice(0, 25000) };
  })()`;
}
function jsBuscarImagen(que) {
  return `(() => { ${JS_NORM} const raiz = ${JS_RAIZ}; const q = norm(${JSON.stringify(que || '')});
    const genericas = ['la','el','de','del','una','un','foto','imagen','persona','que','sale','aparece','principal','cara','hombre','mujer','senor','senora','nino','nina','esta','pagina','arriba','primera','grande'];
    const palabras = q.split(' ').filter((w) => w.length > 2 && !genericas.includes(w));
    const imgs = [...raiz.querySelectorAll('img, video')].filter((i) => { const r = i.getBoundingClientRect(); return r.width >= 60 && r.height >= 60; });
    if (!imgs.length) return null;
    const desc = (i) => { const f = i.closest('figure'); const fila = i.closest('tr, .thumb, .infobox');
      return norm([i.alt, i.title, i.getAttribute('aria-label'), decodeURIComponent((i.currentSrc || i.src || '').split('/').pop()), f && f.querySelector('figcaption') && f.querySelector('figcaption').innerText, fila && fila.innerText.slice(0, 200)].join(' ')); };
    let mejor = null, pm = -1;
    imgs.forEach((i, n) => { const r = i.getBoundingClientRect(); const t = desc(i);
      let p = Math.min(r.width * r.height, 400000) / 400000 + (n === 0 ? 0.6 : 0) + (i.closest('.infobox, figure, .thumb') ? 0.4 : 0);
      if (palabras.length) p += 3 * palabras.filter((w) => t.includes(w)).length;
      if (p > pm) { pm = p; mejor = i; } });
    mejor.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = mejor.getBoundingClientRect();
    const f = mejor.closest('figure'); const cap = f && f.querySelector('figcaption') ? f.querySelector('figcaption').innerText : '';
    const nombre = (mejor.alt || cap || document.title.split(' - ')[0].split(' | ')[0] || 'imagen').trim().slice(0, 60);
    return { x: r.left, y: r.top, ancho: r.width, alto: r.height, nombre };
  })()`;
}
async function guardarFoto(imagen, nombre) {
  fs.mkdirSync(IMAGENES, { recursive: true });
  const limpio = String(nombre || 'captura').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]+/g, '').trim().slice(0, 40).replace(/\s+/g, '-') || 'captura';
  const f = new Date(); const sello = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}_${String(f.getHours()).padStart(2, '0')}${String(f.getMinutes()).padStart(2, '0')}${String(f.getSeconds()).padStart(2, '0')}`;
  const ruta = path.join(IMAGENES, `${limpio}_${sello}.png`);
  fs.writeFileSync(ruta, imagen.toPNG());
  aviso('foto', { ruta, nombre });
  return ruta;
}

async function enPagina(js) { const w = wc(); if (!w) return null; try { return await w.executeJavaScript(js, true); } catch (e) { return { error: String(e.message || e) }; } }
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function control(accion, d = {}) {
  if (!cfg.controlJarvis && !['estado', 'ajustes', 'mostrar', 'probar-ia', 'diag-llaves'].includes(accion)) return { ok: false, error: 'El control de JARVIS está apagado en la configuración del navegador.' };
  if (!['estado', 'leer', 'vigilancias', 'chat', 'foto', 'gaming', 'consola', 'mapa', 'panel-pestana', 'clip', 'telefono', 'subtitulos', 'dividir', 'pip', 'probar-ia', 'diag-llaves', 'vigilancia-revisar', 'terminal', 'mando', 'local-estado'].includes(accion)) aviso('control', accion);   // la interfaz muestra "JARVIS AL MANDO"
  const w = wc();
  switch (accion) {
    case 'estado': return { ok: true, enfocado: Boolean(win?.isFocused()), control: cfg.controlJarvis, ...estado() };
    case 'recorrer': recorrer(d.voz !== false); return { ok: true };
    case 'traducir': traducirPagina(d.idioma); return { ok: true };
    case 'dividir': return dividir(d.on, d.url);
    case 'telefono': return enviarTelefono(d);
    case 'mapa': return mapaConexiones();
    case 'terminal': if (d.abrir) aviso('terminal'); return d.texto ? terminal(d.texto) : { ok: true };   // pruebas [04-nov]
    case 'mando': return centroMando(d.on !== false);
    case 'local-estado': return estadoLocal();
    case 'clip': return clipThat();
    case 'panel-pestana': abrirPanel(true); aviso('panel-pestana', String(d.cual || 'jarvis')); return { ok: true };
    case 'consola': return consolaUI.slice(-30);
    case 'subtitulos': return subtitulos(d.on !== false, d.idioma);
    case 'chat': abrirPanel(true); aviso('chat-externo', String(d.texto || '')); return { ok: true };   // escribir en el chat del panel (JARVIS de fondo / pruebas)
    case 'vigilar': return vigilarActual(d.tipo, d.objetivo);
    case 'vigilancias': return vigilante.todas();
    case 'vigilancia-revisar': return vigilante.revisarYa(d.id, opcionesVigilante);
    case 'gaming': cambioGaming(d.on === false ? null : { titulo: d.juego || 'Prueba' }); return { ok: true, memoria: memoriaMB(), ...estado().gaming };
    case 'pip': return videoFlotante();
    case 'diag-llaves': return cerebro.diagnostico();
    case 'probar-ia': {   // pruebas: ¿piensa el cerebro propio? (nunca devuelve llaves)
      const t0 = Date.now();
      try { const r = await cerebro.pensar({ sistema: 'Reply with one short sentence.', historia: [{ rol: 'user', texto: d.texto || 'Say hello.' }], max: 200 }, d.proveedor ? [d.proveedor] : cfg.ordenIA); return { ok: true, texto: r.texto, quien: cerebro.ultimo(), ms: Date.now() - t0 }; }
      catch (e) { return { ok: false, error: String(e.message || e).slice(0, 300) }; }
    }
    case 'resumir': return { ok: true, respuesta: await resumirActual() };
    case 'ajustes': abrirConfig(d.seccion); return { ok: true };
    case 'privada': nueva(d.url || INICIO, true, true); return { ok: true };
    case 'mostrar': if (win.isMinimized()) win.restore(); win.show(); win.focus(); return { ok: true };
    case 'abrir': if (d.nueva || !w) nueva(d.url || d.texto); else navegar(d.url || d.texto); win.show(); return { ok: true, url: aUrl(d.url || d.texto) };
    case 'buscar': if (d.nueva || !w) nueva(aUrl(d.q)); else navegar(proteccion.buscar(cfg, d.q || '')); return { ok: true };
    case 'pestana': {
      const a = d.que;
      if (a === 'nueva') nueva(d.url || INICIO);
      else if (a === 'cerrar') cerrarPestana();
      else if (a === 'siguiente') moverPestana(1);
      else if (a === 'anterior') moverPestana(-1);
      else if (a === 'ir' && pestanas[Number(d.n) - 1]) activarPestana(pestanas[Number(d.n) - 1].id);
      else return { ok: false, error: 'pestaña no válida' };
      return { ok: true, pestanas: pestanas.length };
    }
    case 'atras': if (w?.navigationHistory.canGoBack()) w.navigationHistory.goBack(); return { ok: true };
    case 'adelante': if (w?.navigationHistory.canGoForward()) w.navigationHistory.goForward(); return { ok: true };
    case 'recargar': w?.reload(); return { ok: true };
    case 'inicio': navegar(INICIO); return { ok: true };
    case 'desplazar': {
      const dir = d.dir || 'abajo';
      const js = dir === 'inicio' ? 'scrollTo({top:0,behavior:"smooth"})' : dir === 'final' ? 'scrollTo({top:document.body.scrollHeight,behavior:"smooth"})'
        : `scrollBy({top:${dir === 'arriba' ? -1 : 1}*innerHeight*0.8,behavior:"smooth"})`;
      await enPagina(js); return { ok: true };
    }
    case 'zoom': zoom(d.dir === 'mas' ? 1 : d.dir === 'menos' ? -1 : 0); return { ok: true, zoom: estado().zoom };
    case 'completa': win.setFullScreen(d.on === undefined ? !win.isFullScreen() : Boolean(d.on)); return { ok: true };
    case 'favorito': alternarFavorito(); return { ok: true, favorito: estado().favorito };
    case 'panel': abrirPanel(d.on === undefined ? !panelAbierto : d.on); if (d.pregunta) aviso('preguntar', d.pregunta); return { ok: true };
    case 'leer': {
      if (actual()?.privada) return { ok: false, error: 'En una pestaña privada no miro ni envío nada.' };
      const r = await enPagina('({titulo: document.title, url: location.href, texto: (document.body ? document.body.innerText : "").replace(/\\n{3,}/g, "\\n\\n").slice(0, 30000)})');
      return { ok: Boolean(r && !r.error), ...(r || {}) };
    }
    case 'ver': { const el = await enPagina(JS_VER); return { ok: Array.isArray(el), url: w?.getURL(), titulo: w?.getTitle(), elementos: Array.isArray(el) ? el : [] }; }
    case 'clic': {
      const r = await enPagina(`(() => { const el = ${buscarElemento(d.id, d.texto)}; if (!el) return false; setTimeout(() => el.click(), 380); return (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 60) || true; })()`);
      if (!r || r.error) return { ok: false, error: 'No encontré ese botón o enlace en la página.' };
      await pausa(900); return { ok: true, clic: r, url: wc()?.getURL() };
    }
    case 'escribir': {
      const r = await enPagina(`(() => { const destello = ${JS_DESTELLO};
        const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
        const campos = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),textarea,[contenteditable=true],[role=textbox],[role=searchbox],[role=combobox]')]
          .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2; });
        let el = ${d.id ? `document.querySelector('[data-jarvis-id="${Number(d.id)}"]')` : 'null'};
        const q = norm(${JSON.stringify(d.campo || '')});
        if (!el && q) el = campos.find((e) => [e.placeholder, e.getAttribute('aria-label'), e.name, e.id, e.title, e.labels && e.labels[0] && e.labels[0].innerText].some((t) => norm(t).includes(q)));
        if (!el) { const a = document.activeElement; el = (a && campos.includes(a)) ? a : (campos.find((e) => e.type === 'search' || e.getAttribute('role') === 'searchbox') || campos[0]); }
        if (!el) return false;
        el.scrollIntoView({ block: 'center', behavior: 'instant' }); destello(el); el.focus();
        if ('value' in el && ${d.borrar !== false}) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }
        return true; })()`);
      if (!r || r.error) return { ok: false, error: 'No encontré dónde escribir.' };
      await w.insertText(String(d.texto || ''));
      if (d.enviar) { await pausa(150); for (const type of ['keyDown', 'char', 'keyUp']) w.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' }); }
      return { ok: true };
    }
    case 'tecla': {
      const k = String(d.tecla || 'Enter');
      for (const type of ['keyDown', 'keyUp']) w?.sendInputEvent({ type, keyCode: k });
      return { ok: true };
    }
    case 'encontrar': if (d.texto) w?.findInPage(d.texto); else w?.stopFindInPage('clearSelection'); return { ok: true };
    case 'foto': if (!/^[\w:\\/. -]+\.png$/i.test(d.ruta || '')) return { ok: false }; await capturar(d.ruta, false); return { ok: true, ruta: d.ruta };
    case 'describir': {
      if (actual()?.privada) return { ok: false, error: 'En una pestaña privada no miro ni envío nada: abre la página en una pestaña normal.' };
      const r = await enPagina(JS_DESCRIBIR);
      let captura = '';
      try { const im = await w.capturePage(); const t = im.getSize().width > 1280 ? im.resize({ width: 1280 }) : im; captura = t.toJPEG(72).toString('base64'); } catch { /* sin foto */ }
      return { ok: Boolean(r && !r.error), ...(r || {}), captura };
    }
    case 'leer-desde': {
      const r = await enPagina(jsLeerDesde(d.desde));
      if (!r || !r.ok || !r.texto) return { ok: false, error: d.desde ? `No encontré «${d.desde}» en la página.` : 'La página no tiene texto para leer.' };
      leyendo = true; aviso('leer', { texto: r.texto, desde: r.desde }); avisarEstado();
      return { ok: true, desde: r.desde, letras: r.texto.length, inicio: r.texto.slice(0, 200) };
    }
    case 'responder': abrirPanel(true); aviso('respuesta', { texto: String(d.texto || '').slice(0, 6000), pregunta: d.pregunta || '', voz: d.voz !== false }); return { ok: true };
    case 'callar': leyendo = false; aviso('callar'); avisarEstado(); return { ok: true };
    case 'foto-imagen': {
      const r = await enPagina(jsBuscarImagen(d.que));
      if (!r || r.error) return { ok: false, error: 'No encontré ninguna imagen en esta parte de la página.' };
      await pausa(450);
      const r2 = await enPagina(jsBuscarImagen(d.que)) || r;   // ya quieta después de desplazar
      const z = w.getZoomFactor();
      const rect = { x: Math.max(0, Math.round(r2.x * z)), y: Math.max(0, Math.round(r2.y * z)), width: Math.round(r2.ancho * z), height: Math.round(r2.alto * z) };
      const im = await w.capturePage(rect);
      const ruta = await guardarFoto(im, r2.nombre || d.que);
      return { ok: true, ruta, nombre: r2.nombre };
    }
    case 'foto-pagina': { const im = await w.capturePage(); const ruta = await guardarFoto(im, w.getTitle()); return { ok: true, ruta }; }
    case 'cerrar': setTimeout(() => app.quit(), 100); return { ok: true };
    default: return { ok: false, error: 'acción desconocida' };
  }
}

// ── servidor de control (solo esta PC, con llave) ───────────────────────
function iniciarControl() {
  const token = crypto.randomBytes(24).toString('hex');
  const srv = http.createServer((req, res) => {
    const fin = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const dado = Buffer.from(String(req.headers['x-jarvis-token'] || '')); const bueno = Buffer.from(token);
    if (req.method !== 'POST' || dado.length !== bueno.length || !crypto.timingSafeEqual(dado, bueno)) return fin(401, { ok: false });
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; if (cuerpo.length > 200000) req.destroy(); });
    req.on('end', async () => {
      let d = {}; try { d = JSON.parse(cuerpo || '{}'); } catch { return fin(400, { ok: false }); }
      try { fin(200, await control(String(d.accion || 'estado'), d)); } catch (e) { fin(500, { ok: false, error: String(e.message || e) }); }
    });
  });
  srv.on('error', () => { /* puerto ocupado */ });
  srv.listen(0, '127.0.0.1', () => {
    try { fs.mkdirSync(CONF, { recursive: true }); fs.writeFileSync(LLAVE, JSON.stringify({ puerto: srv.address().port, token, pid: process.pid }), { mode: 0o600 }); fs.chmodSync(LLAVE, 0o600); } catch { /* nada */ }
  });
  app.on('quit', () => { try { const l = JSON.parse(fs.readFileSync(LLAVE, 'utf8')); if (l.pid === process.pid) fs.writeFileSync(LLAVE, '{}', { mode: 0o600 }); } catch { /* nada */ } });
}

// ── cerebro de JARVIS (backend local 8765), pedido desde aquí para no abrir CORS ──
function backend(ruta, cuerpo, espera = 95000) {
  return new Promise((resolve) => {
    const s = JSON.stringify(cuerpo || {});
    const r = http.request({ host: '127.0.0.1', port: 8765, path: ruta, method: 'POST', timeout: espera,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) } }, (res) => {
      let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => { try { resolve(JSON.parse(t)); } catch { resolve({ ok: false, respuesta: 'JARVIS no respondió bien.' }); } });
    });
    r.on('error', () => resolve({ ok: false, respuesta: 'El cerebro de JARVIS no está encendido.' }));
    r.on('timeout', () => { r.destroy(); resolve({ ok: false, respuesta: 'JARVIS tardó demasiado.' }); });
    r.end(s);
  });
}

// ── «¿Qué ves?»: JARVIS recorre la página parte por parte; en el chat va saliendo la foto de cada parte
//    y lo que hay en ella («esta foto es de…, aquí dice…»), como en el navegador de JARVIS OS. [28-oct] ──
let recorrido = 0;
async function recorrer(voz = false) {
  const yo = ++recorrido;
  const w = wc();
  if (!w) return { ok: false };
  if (actual()?.privada) { aviso('recorrido', { tipo: 'error', texto: 'En una pestaña privada no miro ni envío nada.' }); return { ok: false }; }
  abrirPanel(true);
  aviso('recorrido', { tipo: 'inicio', titulo: w.getTitle() || '' });
  try { await w.executeJavaScript('window.scrollTo({ top: 0 })', true); } catch { /* */ }
  await pausa(500);
  const med = await enPagina('({ h: document.documentElement.scrollHeight, vh: innerHeight })') || { h: 1, vh: 1 };
  const total = Math.max(1, Math.min(6, Math.ceil((med.h || 1) / Math.max(1, (med.vh || 1) * 0.9))));
  let previo = '';
  const viaJarvis = await conJarvis();
  for (let n = 1; n <= total && yo === recorrido; n++) {
    let captura = '', img = '';
    try {
      const im = await w.capturePage();
      const g = im.getSize().width > 1280 ? im.resize({ width: 1280 }) : im;
      captura = g.toJPEG(72).toString('base64');
      img = im.resize({ width: 520 }).toDataURL();
    } catch { /* sin foto */ }
    aviso('recorrido', { tipo: 'parte', n, total, img });
    const vis = await enPagina(`(() => { const out = []; const vh = innerHeight;
      document.querySelectorAll('h1,h2,h3,h4,p,li,figcaption,a,span,td,img').forEach((e) => { const r = e.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.width < 2) return;
        const t = e.tagName === 'IMG' ? ('[imagen: ' + (e.alt || '') + ']') : (e.children.length > 3 ? '' : (e.innerText || '').trim());
        if (t && t.length > 2) out.push(t.slice(0, 300)); });
      return [...new Set(out)].join(' · ').slice(0, 4000); })()`) || '';
    const datosParte = { parte: true, n, total, previo, captura, texto: typeof vis === 'string' ? vis : '', titulo: w.getTitle(), url: w.getURL() };
    let r;
    if (viaJarvis) r = await backend('/api/navegador/describir', datosParte, 120000);
    else { try { r = { ok: true, respuesta: await cerebro.describirParte(datosParte, codIdioma(cfg), cfg.ordenIA) }; } catch (e) { r = { ok: false, respuesta: errorIA(e) }; } }
    if (yo !== recorrido) break;
    const texto = (r && r.respuesta) || 'No pude ver esta parte.';
    aviso('recorrido', { tipo: 'texto', n, total, texto, voz });
    if (!r || !r.ok) break;
    previo += ` Parte ${n}: ${texto}`;
    if (n < total) { try { await w.executeJavaScript('window.scrollBy({ top: innerHeight * 0.9 })', true); } catch { /* */ } await pausa(700); }
  }
  if (yo === recorrido) aviso('recorrido', { tipo: 'fin' });
  return { ok: true };
}

// ── Chat con JARVIS (todo lo que sabe hacer, no solo la página) [28-oct] ──
// Va al cerebro (/api/chat) y trae la respuesta palabra por palabra. Mientras JARVIS trabaja, la «pantallita»
// del panel muestra en vivo la página que está mirando.
let chatEnCurso = null;
function chatJarvis(mensaje) {
  if (chatEnCurso) { try { chatEnCurso.destroy(); } catch { /* */ } }
  const s = JSON.stringify({ message: String(mensaje || '').slice(0, 4000) });
  let vivo = true;
  const foto = async () => {
    if (!vivo) return;
    try {
      const w = wc();
      if (w && !w.isDestroyed()) {
        const img = await w.capturePage();
        const chica = img.resize({ width: 480 });
        aviso('vista', { img: chica.toDataURL(), titulo: w.getTitle() || '' });
      }
    } catch { /* */ }
    if (vivo) setTimeout(foto, 1500);
  };
  foto();
  const fin = (ev) => { vivo = false; chatEnCurso = null; aviso('chat-ev', ev); };
  const r = http.request({ host: '127.0.0.1', port: 8765, path: '/api/chat', method: 'POST', timeout: 300000,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) } }, (res) => {
    let resto = '';
    res.setEncoding('utf8');
    res.on('data', (c) => {
      resto += c;
      const partes = resto.split('\n\n'); resto = partes.pop();
      for (const p of partes) {
        const linea = p.split('\n').find((l) => l.startsWith('data:'));
        if (!linea) continue;
        let ev; try { ev = JSON.parse(linea.slice(5).trim()); } catch { continue; }
        if (ev.type === 'token') aviso('chat-ev', { tipo: 'token', texto: ev.content || '' });
        else if (ev.type === 'tool_start') aviso('chat-ev', { tipo: 'herramienta', texto: ev.tool || '' });
        else if (ev.type === 'done') aviso('chat-ev', { tipo: 'final', texto: ev.content || '' });
      }
    });
    res.on('end', () => fin({ tipo: 'fin' }));
  });
  r.on('error', () => fin({ tipo: 'apagado' }));
  r.on('timeout', () => { r.destroy(); fin({ tipo: 'error', texto: 'JARVIS tardó demasiado.' }); });
  r.end(s);
  chatEnCurso = r;
  return true;
}
function jarvisVivo() {
  return new Promise((resolve) => {
    const r = http.get({ host: '127.0.0.1', port: 8765, path: '/api/health', timeout: 2500 }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    r.on('error', () => resolve(false)); r.on('timeout', () => { r.destroy(); resolve(false); });
  });
}
// Windows: encender el cerebro de JARVIS (START_JARVIS.bat de la carpeta de JARVIS) con un botón
function carpetaJarvis() {
  const c = [process.env.JARVIS_HOME, path.join(__dirname, '..'), path.join(os.homedir(), 'OneDrive', 'Desktop', 'AI', 'J.A.R.V.I.S'),
    path.join(os.homedir(), 'Desktop', 'AI', 'J.A.R.V.I.S'), path.join(os.homedir(), 'J.A.R.V.I.S')].filter(Boolean);
  return c.find((d) => fs.existsSync(path.join(d, 'START_JARVIS.bat')) && fs.existsSync(path.join(d, 'backend', 'main.py'))) || '';
}
function encenderJarvis() {
  if (ES_LINUX) return { ok: false, texto: 'En JARVIS OS el cerebro se enciende solo.' };
  const d = carpetaJarvis();
  if (!d) return { ok: false, texto: 'No encuentro la carpeta de JARVIS (con START_JARVIS.bat).' };
  spawn('cmd.exe', ['/c', 'start', '""', '/min', path.join(d, 'START_JARVIS.bat')], { cwd: d, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return { ok: true, texto: 'Encendiendo JARVIS… tarda unos segundos.' };
}

// voz de JARVIS en mp3 (para leer páginas largas trozo a trozo, sin cortar)
// Con el JARVIS de fondo: su voz. Solo: voces neuronales de Edge (gratis). Si nada responde, la interfaz usa la voz de Windows.
async function vozBytes(texto) {
  if (await conJarvis()) { const b = await vozJarvis(texto); if (b) return b; }
  return cerebro.voz(texto, codIdioma(cfg), cfg.vozMotor);
}
function vozJarvis(texto) {
  return new Promise((resolve) => {
    const s = JSON.stringify({ text: texto });
    const r = http.request({ host: '127.0.0.1', port: 8765, path: '/api/tts', method: 'POST', timeout: 60000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) } }, (res) => {
      const partes = []; res.on('data', (c) => partes.push(c)); res.on('end', () => resolve(res.statusCode === 200 ? new Uint8Array(Buffer.concat(partes)) : null));
    });
    r.on('error', () => resolve(null)); r.on('timeout', () => { r.destroy(); resolve(null); });
    r.end(s);
  });
}

// ══ Cerebro propio: el navegador funciona solo, sin el JARVIS de fondo [28-oct] ══════════════════
// Con «Conectar con JARVIS de fondo» encendido y JARVIS vivo, todo va a JARVIS (como antes, y además maneja la PC).
let vivoCache = { t: 0, v: false };
async function conJarvis() {
  if (!cfg.conectarJarvis) return false;
  if (Date.now() - vivoCache.t < 8000) return vivoCache.v;
  vivoCache = { t: Date.now(), v: await jarvisVivo() };
  return vivoCache.v;
}
function errorIA(e) {
  if (e && e.sinLlaves) return 'Para pensar sin el JARVIS de fondo necesito una llave de IA. Póngala en Configuración › Cerebro de JARVIS (la de Gemini es gratis).';
  if (e && e.sinAudio) return 'Para entender el micrófono necesito una llave de Gemini u OpenAI (Claude no entiende audio). Póngala en Configuración › Cerebro de JARVIS.';
  return `La IA no respondió: ${String((e && e.message) || e).slice(0, 160)}`;
}
async function leerPagina() {
  if (actual()?.privada) return { ok: false, error: 'En una pestaña privada no miro ni envío nada.' };
  if (cfg.documentos !== false && actual() && (await esPdf(actual()))) {   // 📄 PDF: el texto de verdad, página por página [04-nov]
    try { const x = await textoPdf(actual()); return { ok: true, pdf: true, paginas: x.paginas, titulo: x.titulo, url: urlDe(actual()), texto: x.texto || '(This PDF has no text layer: it is a scanned image.)' }; }
    catch (e) { return { ok: false, error: `No pude leer el PDF: ${String(e.message || e).slice(0, 100)}` }; }
  }
  const r = await enPagina('({titulo: document.title, url: location.href, texto: (document.body ? document.body.innerText : "").replace(/\\n{3,}/g, "\\n\\n").slice(0, 30000)})');
  return { ok: Boolean(r && !r.error), ...(r || {}) };
}
async function esperarCarga(max = 9000) {
  await pausa(450);
  const t0 = Date.now();
  while (actual()?.cargando && Date.now() - t0 < max) await pausa(200);
  await pausa(300);
}
// YouTube: subtítulos del video (si los tiene) para resumirlo
const JS_SUBTITULOS = `(async () => { try {
  const pr = window.ytInitialPlayerResponse; const vid = new URLSearchParams(location.search).get('v');
  if (!pr || (pr.videoDetails && pr.videoDetails.videoId !== vid)) return '';
  const pistas = pr.captions && pr.captions.playerCaptionsTracklistRenderer && pr.captions.playerCaptionsTracklistRenderer.captionTracks;
  if (!pistas || !pistas.length) return '';
  const p = pistas.find((x) => !x.kind) || pistas[0];
  const j = await (await fetch(p.baseUrl + '&fmt=json3')).json();
  return (j.events || []).map((e) => (e.segs || []).map((s) => s.utf8).join('')).join(' ').replace(/\\s+/g, ' ').slice(0, 40000);
} catch (e) { return ''; } })()`;
async function resumirActual() {
  const pag = await leerPagina();
  if (!pag.ok) return pag.error || 'No pude leer la página.';
  if (await conJarvis()) { const r = await backend('/api/navegador/preguntar', { pregunta: 'Resume esta página en pocas frases.', titulo: pag.titulo, url: pag.url, texto: pag.texto }); return (r && r.respuesta) || 'No pude resumirla.'; }
  if (/youtube\.com\/watch/.test(pag.url || '')) { const s = await enPagina(JS_SUBTITULOS); if (typeof s === 'string' && s.length > 200) pag.transcripcion = s; }
  try { return await cerebro.resumir(pag, codIdioma(cfg), cfg.ordenIA); } catch (e) { return errorIA(e); }
}

// ── Traducir la página entera, en su sitio (por tandas: se ve cómo va cambiando) ──
const JS_TEXTOS = `(() => {
  const NO = /^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE|TEXTAREA|SVG|MATH|KBD|SAMP)$/;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => {
    const p = n.parentElement; if (!p || NO.test(p.tagName) || p.isContentEditable || p.closest('[translate="no"],.notranslate')) return 2;
    const t = n.nodeValue.trim(); return (t.length < 2 || !/\\p{L}{2}/u.test(t)) ? 2 : 1; } });
  window.__jarvisTxt = []; const out = []; let n;
  while ((n = w.nextNode()) && out.length < 900) { window.__jarvisTxt.push(n); out.push(n.nodeValue.trim().slice(0, 600)); }
  return out; })()`;
let traduccion = 0;
async function traducirPagina(cod) {
  const yo = ++traduccion;
  const p = actual(); const w = p?.vista.webContents;
  if (!w) return;
  if (p.privada) { aviso('traduccion', { tipo: 'error', texto: 'En una pestaña privada no miro ni envío nada.' }); return; }
  const c = String(cod || '').slice(0, 2).toLowerCase();
  const destino = cerebro.NOMBRE_IDIOMA[c] ? c : codIdioma(cfg);
  if (!cerebro.hayAlguna()) { aviso('traduccion', { tipo: 'error', texto: errorIA({ sinLlaves: true }) }); return; }
  let textos = [];
  try { textos = await w.executeJavaScript(JS_TEXTOS, true); } catch { /* */ }
  if (!Array.isArray(textos) || !textos.length) { aviso('traduccion', { tipo: 'error', texto: 'Esta página no tiene texto para traducir.' }); return; }
  const tandas = []; let t = [];
  textos.forEach((x, i) => { t.push([i, x]); if (t.length >= 70 || t.reduce((a, [, s]) => a + s.length, 0) > 5000) { tandas.push(t); t = []; } });
  if (t.length) tandas.push(t);
  aviso('traduccion', { tipo: 'inicio', total: tandas.length });
  let hechas = 0;
  for (const tanda of tandas) {
    if (yo !== traduccion || w.isDestroyed()) return;
    let tr2;
    try { tr2 = await cerebro.traducirLista(tanda.map(([, s]) => s), destino, cfg.ordenIA); }
    catch (e) { if (e.sinLlaves || e.status === 401 || e.status === 403) { aviso('traduccion', { tipo: 'error', texto: errorIA(e) }); return; } continue; }
    if (yo !== traduccion || w.isDestroyed()) return;
    const pares = tanda.map(([i], k) => [i, tr2[k]]);
    try { await w.executeJavaScript(`(() => { const L = ${JSON.stringify(pares)}; for (const [i, t] of L) { const n = window.__jarvisTxt && window.__jarvisTxt[i]; if (n && t) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), t); } })()`, true); } catch { return; }
    aviso('traduccion', { tipo: 'progreso', n: ++hechas, total: tandas.length });
  }
  if (yo === traduccion) aviso('traduccion', { tipo: 'fin' });
}

// ── Chat propio: JARVIS piensa aquí mismo y maneja el navegador con herramientas ──
let chatPropioTurno = 0;
async function herramienta(n, a) {
  const priv = () => (actual()?.privada ? { salida: { ok: false, error: 'Private tab: I do not read or send anything from private tabs.' } } : null);
  const dirs = { down: 'abajo', up: 'arriba', top: 'inicio', bottom: 'final' };
  switch (n) {
    case 'open_url': { const r = await control('abrir', { url: a.url, nueva: a.new_tab }); await esperarCarga(); return { salida: { ...r, titulo: wc()?.getTitle(), url: wc()?.getURL() } }; }
    case 'web_search': { const r = await control('buscar', { q: a.query, nueva: a.new_tab }); await esperarCarga(); return { salida: { ...r, url: wc()?.getURL() } }; }
    case 'read_page': {
      const r = await leerPagina(); const t = String(r.texto || ''); const partes = Math.max(1, Math.ceil(t.length / 15000)); const n = Math.min(partes, Math.max(1, Number(a.part) || 1));
      return { salida: { ok: r.ok, titulo: r.titulo, url: r.url, ...(r.pdf ? { pdf: true, paginas: r.paginas } : {}), parte: n, partes, texto: t.slice((n - 1) * 15000, n * 15000), error: r.error } };
    }
    case 'see_page': {
      const p = priv(); if (p) return p;
      const r = await control('ver'); let imagen = null;
      try { const im = await wc().capturePage(); const g = im.getSize().width > 1280 ? im.resize({ width: 1280 }) : im; imagen = { mime: 'image/jpeg', data: g.toJPEG(70).toString('base64') }; } catch { /* */ }
      return { salida: { ok: r.ok, titulo: r.titulo, url: r.url, error: r.error, elementos: (r.elementos || []).slice(0, 120) }, imagen };
    }
    case 'click': { const r = await control('clic', { id: a.id, texto: a.text }); await esperarCarga(4000); return { salida: { ...r, titulo: wc()?.getTitle() } }; }
    case 'type_text': { const r = await control('escribir', { id: a.id, campo: a.field, texto: a.text, enviar: a.submit }); if (a.submit) await esperarCarga(); return { salida: r }; }
    case 'scroll': return { salida: await control('desplazar', { dir: dirs[a.direction] || 'abajo' }) };
    case 'navigate': { const m = { back: 'atras', forward: 'adelante', reload: 'recargar', home: 'inicio' }; const r = await control(m[a.action] || 'recargar'); await esperarCarga(); return { salida: { ...r, url: wc()?.getURL() } }; }
    case 'tabs': {
      if (a.action === 'private') return { salida: await control('privada', { url: a.url }) };
      const m = { new: 'nueva', close: 'cerrar', next: 'siguiente', previous: 'anterior', go: 'ir' };
      const r = await control('pestana', { que: m[a.action], n: a.n, url: a.url }); if (a.url) await esperarCarga(); return { salida: r };
    }
    case 'walkthrough_page': { const p = priv(); if (p) return p; recorrer(true); return { salida: { ok: true, note: 'The walkthrough is running in the chat now.' }, fin: true }; }
    case 'summarize_page': return { salida: { ok: true, summary: await resumirActual() } };
    case 'translate_page': { const p = priv(); if (p) return p; traducirPagina(a.language); return { salida: { ok: true, note: 'The page is being translated now.' } }; }
    case 'read_aloud': return { salida: await control('leer-desde', { desde: a.from || '' }) };
    case 'take_photo': return { salida: a.what ? await control('foto-imagen', { que: a.what }) : await control('foto-pagina') };
    case 'remember': {
      if (cfg.memoriaJarvis === false) return { salida: { ok: false, error: 'Memory is turned off in Settings.' } };
      if (actual()?.privada) return { salida: { ok: false, error: 'Private tab: I do not remember anything from private tabs.' } };
      const r = memoria.agregar(a.fact); aviso('memoria', memoria.todas().length); return { salida: r };
    }
    case 'forget': { const r = memoria.quitar(a.what); aviso('memoria', memoria.todas().length); return { salida: r }; }
    case 'zoom': return { salida: await control('zoom', { dir: a.direction === 'in' ? 'mas' : a.direction === 'out' ? 'menos' : '' }) };
    case 'find_in_page': return { salida: await control('encontrar', { texto: a.text }) };
    case 'list_tabs': return { salida: { ok: true, activa: pestanas.findIndex((p) => p.id === activa) + 1, pestanas: pestanas.map((p, i) => ({ n: i + 1, titulo: p.dormida ? p.dormida.titulo : p.vista.webContents.getTitle(), url: p.privada ? '(private)' : urlDe(p) })) } };
    case 'read_tab': {
      const p = pestanas[Number(a.n) - 1];
      if (!p) return { salida: { ok: false, error: 'No such tab.' } };
      if (p.privada) return { salida: { ok: false, error: 'Private tab: I do not read it.' } };
      if (p.dormida) { despertar(p); await pausa(3500); }
      try {
        const r = await p.vista.webContents.executeJavaScript('({titulo: document.title, url: location.href, texto: (document.body ? document.body.innerText : "").replace(/\\s+/g, " ").slice(0, 12000)})', true);
        return { salida: { ok: true, ...r } };
      } catch (e) { return { salida: { ok: false, error: String(e.message || e) } }; }
    }
    case 'split_screen': { const r = dividir(a.on === undefined ? true : a.on, a.url); if (a.url) await esperarCarga(); return { salida: r }; }
    case 'picture_in_picture': return { salida: await videoFlotante() };
    case 'save_game_clip': return { salida: await clipThat() };
    case 'send_to_phone': return { salida: await enviarTelefono({ tipo: a.what === 'screenshot' ? 'captura' : 'pagina', nota: a.note }) };
    case 'youtube_subtitles': return { salida: await subtitulos(a.on !== false, a.language) };
    case 'watch_page': { const r = await vigilarActual(a.what === 'changes' ? 'cambios' : 'precio', a.target_price); return { salida: r }; }
    case 'browser_memory': {   // 🧠 [09-nov]
      if (cfg.memoriaNavegador === false || !cfg.guardarHistorial) return { salida: { ok: false, error: 'Browser memory is turned off in Settings.' } };
      const l = recuerdos.buscar(a.query || '', 12);
      return { salida: { ok: true, total: l.length, paginas: l, nota: 'Answer with the best matches: for each one write its title, when they saw it, and its full URL (so it becomes a clickable link).' } };
    }
    case 'live_dubbing': return { salida: await doblaje(a.on !== false, a.language) };   // 🗣 [09-nov]
    case 'look_through_camera': {   // 📸 busca lo que ves [09-nov]
      if (cfg.buscaLoQueVes === false) return { salida: { ok: false, error: '«Search what you see» is turned off in Settings.' } };
      let r = null; try { r = await win.webContents.executeJavaScript('window.fotoCamara ? window.fotoCamara() : null', true); } catch { /* */ }
      if (!r || !r.ok) return { salida: { ok: false, error: (r && r.error) || 'Could not use the camera.' } };
      return { salida: { ok: true, nota: 'This is a photo from the user\'s camera. Say what the object is (brand/model if visible) and use web_search to find it (where to buy, price or info) when useful.' }, imagen: { mime: 'image/jpeg', data: r.data } };
    }
    case 'browser_history': {
      if (!cfg.guardarHistorial) return { salida: { ok: false, error: 'History is turned off in settings.' } };
      const desde = a.days ? Date.now() - a.days * 864e5 : 0;
      const l = proteccion.historial.buscar(a.query || '', 400).filter((h) => h.t >= desde).slice(0, 60)
        .map((h) => ({ cuando: new Date(h.t).toLocaleString(), titulo: h.titulo, url: h.url, busqueda: busquedaDe(h.url) || undefined }));
      return { salida: { ok: true, total: l.length, items: l } };
    }
    default: return { salida: { ok: false, error: 'unknown tool' } };
  }
}
async function chatPropio(mensaje) {
  const yo = ++chatPropioTurno;
  let vivo = true;
  const foto = async () => {   // la «pantallita» del panel: lo que JARVIS está mirando
    if (!vivo || yo !== chatPropioTurno) return;
    try { const w = wc(); if (w && !w.isDestroyed() && !actual()?.privada) { const img = await w.capturePage(); aviso('vista', { img: img.resize({ width: 480 }).toDataURL(), titulo: w.getTitle() || '' }); } } catch { /* */ }
    if (vivo) setTimeout(foto, 1500);
  };
  let fotoEmpezada = false;   // la pantallita solo cuando de verdad maneja la página
  try {
    const r = await cerebro.chat(String(mensaje || '').slice(0, 4000), {
      cod: codIdioma(cfg), orden: cfg.ordenIA,
      pagina: async () => ({ titulo: wc()?.getTitle() || '', url: actual()?.privada ? '(private tab)' : (wc()?.getURL() || '') }),
      evento: (tipo, texto, detalle) => { if (yo !== chatPropioTurno) return; aviso('chat-ev', { tipo, texto, detalle }); if (!fotoEmpezada) { fotoEmpezada = true; foto(); } },
      ejecutar: herramienta,
      memoria: cfg.memoriaJarvis !== false && !actual()?.privada ? memoria.paraCerebro() : null,   // [04-nov]
    });
    if (yo !== chatPropioTurno || r.cancelado) return;
    if (r.texto) aviso('chat-ev', { tipo: 'final', texto: r.texto, voz: cfg.vozRespuestas });
  } catch (e) {
    if (yo === chatPropioTurno) aviso('chat-ev', { tipo: 'error', texto: errorIA(e), llave: Boolean(e && e.sinLlaves) });
  }
  vivo = false;
  if (yo === chatPropioTurno) aviso('chat-ev', { tipo: 'fin' });
}

// ══ Vigilante de precios y cambios [04-nov] ═════════════════════════════════════════════
const vigilante = require('./lib/vigilante');
const JS_PRECIO = `(() => {
  const num = (s) => { if (s == null) return null; s = String(s).replace(/\\s/g, ''); const m = s.match(/(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)/); if (!m) return null;
    let x = m[1]; if (/,\\d{1,2}$/.test(x) && !/\\.\\d{1,2}$/.test(x)) x = x.replace(/\\./g, '').replace(',', '.'); else x = x.replace(/,/g, ''); const n = parseFloat(x); return isFinite(n) && n > 0 && n < 1e7 ? n : null; };
  let precio = null, fuente = '';
  const probar = (v, f) => { if (precio == null) { const n = num(v); if (n) { precio = n; fuente = f; } } };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { const d = JSON.parse(s.textContent);
    for (const it of [].concat(d['@graph'] || d)) { const o = it && (it.offers || (it['@type'] === 'Offer' ? it : null)); for (const of of [].concat(o || [])) probar(of && (of.price ?? of.lowPrice), 'ld'); } } catch (e) {} }
  for (const sel of ['meta[itemprop=price]', 'meta[property="product:price:amount"]', 'meta[property="og:price:amount"]']) { const m = document.querySelector(sel); if (m) probar(m.content, 'meta'); }
  for (const sel of ['#corePrice_feature_div .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice', '#apex_desktop .a-offscreen',
    '[data-testid="customer-price"] span', '.priceView-customer-price span', '.price-current', '[itemprop=price]', '[data-test="product-price"]', '[data-testid="price-wrap"] [itemprop=price]', '.x-price-primary', '.product-price', '.price'])
  { const e = document.querySelector(sel); if (e) probar(e.getAttribute('content') || e.textContent, sel); }
  if (precio == null) { let mejor = null, tam = 0;
    for (const e of document.querySelectorAll('span,div,p,strong,b,ins')) { if (e.children.length > 3) continue; const t = (e.textContent || '').trim();
      if (t.length > 24 || !/[$€£]\\s?\\d/.test(t)) continue; const r = e.getBoundingClientRect(); if (!r.width || r.top > 1800) continue;
      const f = parseFloat(getComputedStyle(e).fontSize); if (f > tam) { tam = f; mejor = t; } }
    probar(mejor, 'grande'); }
  const raiz = document.querySelector('main, article, [role=main], #content, #contents') || document.body;
  const txt = (raiz.innerText || '').replace(/\\s+/g, ' ').trim();
  const mon = (txt.match(/[$€£]|US\\$|R\\$/) || ['$'])[0];
  return { titulo: document.title, url: location.href, precio, fuente, moneda: mon, texto: txt.slice(0, 6000) };
})()`;
async function precioConIA(r) {
  if (!r || r.precio || !cerebro.hayAlguna()) return r;
  try {
    const x = await cerebro.pensar({ sistema: 'You extract prices from web page text.', historia: [{ rol: 'user', texto: `Page: ${r.titulo}\n${String(r.texto).slice(0, 5000)}\n\nWhat is the current price of the main product on this page? Reply with ONLY the number (like 499.99), or NONE.` }], max: 50 }, cfg.ordenIA);
    const n = parseFloat(String(x.texto).replace(/[^\d.]/g, ''));
    if (isFinite(n) && n > 0) r.precio = n;
  } catch { /* sin IA */ }
  return r;
}
// lee una página en una ventana invisible (con tus cookies: ve el precio como tú)
async function leerOculto(url) {
  const w = new BrowserWindow({ show: false, width: 1366, height: 900, webPreferences: { partition: 'persist:jarvis', sandbox: true, contextIsolation: true, backgroundThrottling: false } });
  try {
    w.webContents.setAudioMuted(true); w.webContents.setUserAgent(uaChrome());
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    await Promise.race([w.loadURL(url), pausa(45000).then(() => { throw new Error('La página tardó demasiado'); })]);
    await pausa(4500);
    return await precioConIA(await w.webContents.executeJavaScript(JS_PRECIO, true));
  } finally { if (!w.isDestroyed()) w.destroy(); }
}
function textoAviso(v, a) {
  const en = codIdioma(cfg) !== 'es'; const m = v.moneda || '$';
  if (a.clase === 'objetivo') return en ? `It reached your price, sir! "${v.titulo}" now costs ${m}${a.ahora} (was ${m}${a.antes}).` : `¡Llegó a tu precio! «${v.titulo}» ahora cuesta ${m}${a.ahora} (antes ${m}${a.antes}).`;
  if (a.clase === 'bajo') return en ? `Price drop, sir: "${v.titulo}" now costs ${m}${a.ahora} (was ${m}${a.antes}).` : `Bajó el precio: «${v.titulo}» ahora cuesta ${m}${a.ahora} (antes ${m}${a.antes}).`;
  const f = a.frase && a.frase !== '-' ? a.frase : (en ? 'the page changed.' : 'la página cambió.');
  return en ? `Something new on "${v.titulo}": ${f}` : `Hay algo nuevo en «${v.titulo}»: ${f}`;
}
const opcionesVigilante = {
  leer: leerOculto,
  avisar: (v, a) => {
    const texto = textoAviso(v, a);
    try {
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        const n = new Notification({ title: 'JARVIS', body: texto, icon: path.join(__dirname, 'ui', 'icono.png') });
        n.on('click', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); nueva(v.url); } });
        n.show();
      }
    } catch { /* */ }
    aviso('vigilante', { texto, url: v.url });
  },
  juzgar: async (viejo, nuevo, titulo) => {
    if (!cerebro.hayAlguna()) return '-';
    const x = await cerebro.pensar({ sistema: 'You compare two versions of a web page.', historia: [{ rol: 'user',
      texto: `Page "${titulo}".\nBEFORE: ${viejo}\n\nNOW: ${nuevo}\n\nIs there something meaningfully new (a new video, post, product, article, stock or price change)? If yes, reply with ONE short sentence in ${cerebro.idiomaDe(codIdioma(cfg))} saying what is new. If nothing meaningful changed (only times, counters or ads), reply exactly SAME.` }], max: 120 }, cfg.ordenIA);
    return /^\s*SAME\b/i.test(x.texto) ? '' : x.texto.trim();
  },
};
async function vigilarActual(tipo, objetivo) {
  const p = actual();
  if (!p || p.privada) return { ok: false, error: 'En una pestaña privada no miro ni envío nada.' };
  const u = urlDe(p);
  if (!/^https?:/.test(u)) return { ok: false, error: 'Abre primero la página que quieres vigilar.' };
  const r = await precioConIA(await enPagina(JS_PRECIO));
  if (!r || r.error) return { ok: false, error: 'No pude leer la página.' };
  if (tipo !== 'cambios' && !r.precio) return { ok: false, error: 'No encontré el precio en esta página. Puedo vigilar sus cambios en vez del precio.' };
  const v = vigilante.agregar({ url: u, titulo: r.titulo, tipo, precio: r.precio, objetivo, texto: r.texto, moneda: r.moneda });
  return v ? { ok: true, id: v.id, tipo: v.tipo, precio: v.precio, moneda: v.moneda, titulo: v.titulo, objetivo: v.objetivo } : { ok: false, error: 'No pude guardarla.' };
}

// ══ Enviar al teléfono (Telegram) [04-nov] ═══════════════════════════════════════════════
const telefono = require('./lib/telefono');
async function enviarTelefono(o = {}) {
  const token = cerebro.llave('telegram'); const chat = cfg.telegramChat && cfg.telegramChat.id;
  if (!token || !chat) return { ok: false, error: 'Primero conecta tu teléfono en Configuración › Teléfono.', configurar: true };
  const p = actual(); const w = p && p.vista.webContents;
  const titulo = (p && p.dormida ? p.dormida.titulo : w && w.getTitle()) || ''; const u = p ? urlDe(p) : '';
  try {
    if (o.tipo === 'captura') {
      if (!w) return { ok: false, error: 'No hay página.' };
      const im = await w.capturePage(); const g = im.getSize().width > 1600 ? im.resize({ width: 1600 }) : im;
      await telefono.enviar(token, chat, { texto: `📸 ${titulo}\n${u}`, foto: g.toJPEG(85) });
    } else if (o.tipo === 'imagen' && o.url) {
      try { await telefono.enviar(token, chat, { texto: `🖼 ${titulo}\n${u}`, foto: o.url }); }
      catch { await telefono.enviar(token, chat, { texto: `🖼 ${o.url}\n\n— ${titulo}\n${u}` }); }   // la imagen no se deja bajar: va el enlace
    } else if (o.tipo === 'texto' && o.texto) {
      await telefono.enviar(token, chat, { texto: `“${String(o.texto).slice(0, 3000)}”\n\n— ${titulo}\n${u}` });
    } else if (o.tipo === 'enlace' && o.url) {
      await telefono.enviar(token, chat, { texto: `🔗 ${o.url}` });
    } else {
      if (!/^https?:/.test(u)) return { ok: false, error: 'Abre primero la página que quieres enviar.' };
      await telefono.enviar(token, chat, { texto: `🔗 ${titulo}\n${u}${o.nota ? `\n\n📝 ${o.nota}` : ''}` });
    }
    return { ok: true, tipo: o.tipo || 'pagina' };
  } catch (e) { return { ok: false, error: `Telegram: ${String(e.message || e).slice(0, 160)}` }; }
}

// ══ Subtítulos traducidos en vivo (YouTube los traduce con su propio reproductor) [04-nov] ══
const NOMBRE_NATIVO = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano' };
const esVideoYT = (u) => /youtube\.com\/(watch|live|shorts)|youtu\.be\//.test(String(u || ''));
function jsSubtitulos(lang, on, soloSiOtro) {
  const L = NOMBRE_NATIVO[lang] ? lang : 'es';
  return `(async () => {
    const p = document.getElementById('movie_player');
    if (!p || typeof p.getOption !== 'function') return 'sin-reproductor';
    if (!${Boolean(on)}) { try { p.setOption('captions', 'track', {}); p.unloadModule('captions'); } catch (e) {} return 'apagado'; }
    try { p.loadModule('captions'); } catch (e) {}
    let lista = [];
    for (let i = 0; i < 10 && !lista.length; i++) { try { lista = p.getOption('captions', 'tracklist') || []; } catch (e) {} if (!lista.length) await new Promise((r) => setTimeout(r, 500)); }
    if (!lista.length) return 'sin-subtitulos';
    const L = '${L}'; const de = (t) => String(t.languageCode || '').toLowerCase();
    const base = lista.find((t) => t.kind !== 'asr') || lista[0];
    if (${Boolean(soloSiOtro)} && de(base).startsWith(L)) { try { p.unloadModule('captions'); } catch (e) {} return 'mismo-idioma'; }
    const propia = lista.find((t) => de(t).startsWith(L) && t.kind !== 'asr') || lista.find((t) => de(t).startsWith(L));
    if (propia) { p.setOption('captions', 'track', propia); return 'original'; }
    p.setOption('captions', 'track', Object.assign({}, base, { translationLanguage: { languageCode: L, languageName: '${NOMBRE_NATIVO[L]}' } }));
    return 'traducido:' + de(base);
  })()`;
}
async function subtitulos(on = true, lang, w = wc(), auto = false) {
  if (!w || w.isDestroyed()) return { ok: false, error: 'No hay página.' };
  if (!esVideoYT(w.getURL())) return { ok: false, error: 'Esto funciona en videos de YouTube.' };
  let r = '';
  try { r = await w.executeJavaScript(jsSubtitulos(lang || cfg.idiomaSubtitulos || 'es', on, auto), true); } catch (e) { r = 'error'; }
  if (r === 'sin-subtitulos') return { ok: false, error: 'Este video no tiene subtítulos, ni automáticos: no hay nada que traducir.' };
  if (r === 'sin-reproductor' || r === 'error') return { ok: false, error: 'No encontré el reproductor de YouTube en esta página.' };
  return { ok: true, estado: r.split(':')[0], desde: r.split(':')[1] || '' };
}
// ══ 🗣 Doblaje en vivo [09-nov]: JARVIS lee en voz alta los subtítulos (traducidos) y baja el video ══
// En YouTube pone primero los subtítulos traducidos a tu idioma; en otras páginas usa los subtítulos que tenga el video.
function jsDoblaje(on) {
  return `(() => {
    const D = window.__jarvisDoblaje || (window.__jarvisDoblaje = { salida: [], ultimo: '', buf: '', bufT: 0, vol: null, reloj: 0, activo: false });
    const vid = () => document.querySelector('#movie_player video') || [...document.querySelectorAll('video')].find((v) => !v.paused) || document.querySelector('video');
    if (!${Boolean(on)}) { D.activo = false; clearInterval(D.reloj); D.reloj = 0; const v = vid(); if (v && D.vol != null) v.volume = D.vol; D.vol = null; D.salida = []; D.buf = ''; D.ultimo = ''; return 'apagado'; }
    const v0 = vid(); if (!v0) return 'sin-video';
    D.activo = true;
    const leer = () => {
      const v = vid(); let t = [...document.querySelectorAll('.ytp-caption-segment')].map((e) => e.textContent).join(' ');
      if (!t) { const l = document.querySelectorAll('.caption-visual-line'); t = [...(l.length ? l : document.querySelectorAll('.captions-text'))].map((e) => e.textContent).join(' '); }
      if (!t && v && v.textTracks) for (const tr of v.textTracks) { if (tr.mode === 'disabled') tr.mode = 'hidden'; if (tr.activeCues) t += ' ' + [...tr.activeCues].map((c) => c.text).join(' '); }
      return t.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
    };
    const nuevo = (antes, ahora) => { const a = antes.split(' '), b = ahora.split(' '); for (let k = Math.min(a.length, b.length); k > 0; k--) if (a.slice(a.length - k).join(' ') === b.slice(0, k).join(' ')) return b.slice(k).join(' '); return ahora; };
    clearInterval(D.reloj);
    D.reloj = setInterval(() => {
      const v = vid(); if (!D.activo || !v) return;
      if (v.volume > 0.151) { D.vol = v.volume; v.volume = 0.15; }   // el original, bajito
      const t = leer();
      if (t && t !== D.ultimo) { const n = nuevo(D.ultimo, t); D.ultimo = t; if (n) { D.buf = (D.buf ? D.buf + ' ' : '') + n; D.bufT = Date.now(); } }
      if (D.buf && (/[.!?…]$/.test(D.buf) || Date.now() - D.bufT > 1000 || D.buf.split(' ').length > 16)) { D.salida.push(D.buf); D.buf = ''; if (D.salida.length > 6) D.salida.splice(0, D.salida.length - 6); }
    }, 250);
    return 'encendido';
  })()`;
}
const JS_DOBLAJE_SACAR = `(() => { const d = window.__jarvisDoblaje; if (!d || !d.activo) return null; const v = document.querySelector('#movie_player video') || document.querySelector('video'); return { lineas: d.salida.splice(0), pausado: !v || v.paused }; })()`;
let doblajeW = null; let doblajeReloj = 0; let doblajeUrl = '';
async function doblaje(on = true, lang) {
  if (cfg.doblajeEnVivo === false) return { ok: false, error: 'El doblaje en vivo está apagado en Configuración › Funciones inteligentes.' };
  if (!on) { pararDoblaje(); return { ok: true, estado: 'apagado' }; }
  const w = wc(); if (!w || w.isDestroyed()) return { ok: false, error: 'No hay página.' };
  const L = String(lang || codIdioma(cfg) || 'es').slice(0, 2).toLowerCase();
  let sub = null;
  if (esVideoYT(w.getURL())) {
    if (await hayAnuncioYT(w)) {   // durante un anuncio YouTube no tiene los subtítulos: empieza solo al terminar
      (async () => { for (let i = 0; i < 60 && await hayAnuncioYT(w); i++) await pausa(2000); if (!w.isDestroyed() && cfg.doblajeEnVivo !== false) doblaje(true, L).catch(() => {}); })();
      return { ok: true, estado: 'esperando que termine el anuncio', nota: 'An ad is playing: dubbing starts by itself when it ends.' };
    }
    for (let i = 0; i < 3; i++) { sub = await subtitulos(true, L, w); if (sub.ok) break; await pausa(2500); }
    if (!sub.ok) return sub;
  }
  let r = 'error'; try { r = await w.executeJavaScript(jsDoblaje(true), true); } catch { /* */ }
  if (r === 'sin-video') return { ok: false, error: 'No veo ningún video en esta página.' };
  if (r !== 'encendido') return { ok: false, error: 'No pude empezar el doblaje en esta página.' };
  if (doblajeW && doblajeW !== w && !doblajeW.isDestroyed()) doblajeW.executeJavaScript(jsDoblaje(false), true).catch(() => {});
  doblajeW = w; doblajeUrl = w.getURL(); clearInterval(doblajeReloj);
  doblajeReloj = setInterval(async () => {
    if (!doblajeW || doblajeW.isDestroyed()) return pararDoblaje();
    const u = doblajeW.getURL();
    if (u !== doblajeUrl) {   // otro video de YouTube en la misma pestaña: subtítulos de nuevo
      doblajeUrl = u;
      if (esVideoYT(u)) {
        const ww = doblajeW;
        (async () => { await pausa(2500); for (let i = 0; i < 60 && !ww.isDestroyed() && await hayAnuncioYT(ww); i++) await pausa(2000); if (doblajeW === ww && !ww.isDestroyed()) subtitulos(true, L, ww).catch(() => {}); })();
      }
    }
    let x = null; try { x = await doblajeW.executeJavaScript(JS_DOBLAJE_SACAR, true); } catch { return; }
    if (x === null) { try { await doblajeW.executeJavaScript(jsDoblaje(true), true); } catch { /* */ } return; }   // la página se recargó: seguir
    if (x.pausado) aviso('doblaje', { callar: true, lang: L }); else if (x.lineas.length) aviso('doblaje', { lineas: x.lineas, lang: L });
  }, 400);
  aviso('doblaje', { on: true, lang: L });
  return { ok: true, estado: 'encendido', subtitulos: sub ? sub.estado : 'de la página', idioma: L };
}
async function hayAnuncioYT(w) {
  try { return await w.executeJavaScript("!!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting')", true); } catch { return false; }
}
function pararDoblaje() {
  clearInterval(doblajeReloj); doblajeReloj = 0;
  if (doblajeW && !doblajeW.isDestroyed()) doblajeW.executeJavaScript(jsDoblaje(false), true).catch(() => {});
  doblajeW = null; aviso('doblaje', { on: false });
}
const subtAuto = new WeakMap();
function subtitulosAlCargar(w) {
  if (!cfg.subtitulosAuto || !esVideoYT(w.getURL())) return;
  clearTimeout(subtAuto.get(w));
  subtAuto.set(w, setTimeout(() => { if (!w.isDestroyed()) subtitulos(true, cfg.idiomaSubtitulos, w, true).catch(() => {}); }, 3000));
}

// ══ Voz siempre activa: el modelo que reconoce «Jarvis» sin internet (Vosk, 39 MB, se baja una vez) [04-nov] ══
const VOZ_URL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
const VOZ_MODELO = path.join(CONF, 'voz', 'vosk-model-small-en-us-0.15.tar.gz');
let bajandoVoz = null;
async function modeloVoz() {
  try { if (fs.statSync(VOZ_MODELO).size > 30e6) return { ok: true, url: 'jarvisvoz://modelo/model.tar.gz' }; } catch { /* no está */ }
  if (!bajandoVoz) {
    bajandoVoz = (async () => {
      fs.mkdirSync(path.dirname(VOZ_MODELO), { recursive: true });
      const tmp = VOZ_MODELO + '.bajando';
      const r = await fetch(VOZ_URL, { signal: AbortSignal.timeout(10 * 60000) });
      if (!r.ok || !r.body) throw new Error(`descarga ${r.status}`);
      const total = Number(r.headers.get('content-length')) || 41e6;
      const f = fs.createWriteStream(tmp); let n = 0; let ultimo = 0;
      const lector = r.body.getReader();
      for (;;) {
        const { done, value } = await lector.read(); if (done) break;
        n += value.length; if (!f.write(Buffer.from(value))) await new Promise((ok) => f.once('drain', ok));
        const pct = Math.floor((n / total) * 100); if (pct !== ultimo) { ultimo = pct; aviso('oido-estado', { tipo: 'bajando', pct }); }
      }
      await new Promise((ok) => f.end(ok));
      if (fs.statSync(tmp).size < 30e6) throw new Error('descarga incompleta');
      fs.renameSync(tmp, VOZ_MODELO);
    })().finally(() => { bajandoVoz = null; });
  }
  try { await bajandoVoz; return { ok: true, url: 'jarvisvoz://modelo/model.tar.gz' }; }
  catch (e) { return { ok: false, error: `No pude bajar el modelo de voz: ${String(e.message || e).slice(0, 100)}` }; }
}

// ── ✋ Control con gestos: el detector de manos (7,5 MB) se baja la primera vez [04-nov] ──
const GESTOS_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const GESTOS_MODELO = path.join(CONF, 'gestos', 'hand_landmarker.task');
let bajandoGestos = null;
// 👁 detector de caras (230 KB) para la pausa automática y el guardián de privacidad [09-nov]
const CARAS_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const CARAS_MODELO = path.join(CONF, 'gestos', 'blaze_face_short_range.tflite');
async function modeloCaras() {   // si falla no pasa nada: los gestos siguen funcionando
  try { if (fs.statSync(CARAS_MODELO).size > 100e3) return; } catch { /* no está */ }
  try {
    fs.mkdirSync(path.dirname(CARAS_MODELO), { recursive: true });
    const r = await fetch(CARAS_URL, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 100e3) { fs.writeFileSync(CARAS_MODELO + '.bajando', b); fs.renameSync(CARAS_MODELO + '.bajando', CARAS_MODELO); }
  } catch { /* sin internet */ }
}
async function modeloGestos() {
  await modeloCaras();
  try { if (fs.statSync(GESTOS_MODELO).size > 5e6) return { ok: true }; } catch { /* no está */ }
  if (!bajandoGestos) {
    bajandoGestos = (async () => {
      fs.mkdirSync(path.dirname(GESTOS_MODELO), { recursive: true });
      const r = await fetch(GESTOS_URL, { signal: AbortSignal.timeout(5 * 60000) });
      if (!r.ok) throw new Error(`descarga ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length < 5e6) throw new Error('descarga incompleta');
      fs.writeFileSync(GESTOS_MODELO + '.bajando', b); fs.renameSync(GESTOS_MODELO + '.bajando', GESTOS_MODELO);
    })().finally(() => { bajandoGestos = null; });
  }
  try { await bajandoGestos; return { ok: true }; } catch (e) { return { ok: false, error: `No pude bajar el detector de manos: ${String(e.message || e).slice(0, 100)}` }; }
}
// lo que hace cada gesto
async function gesto(g) {
  const w = wc();
  switch (g) {
    case 'siguiente': moverPestana(1); break;
    case 'anterior': moverPestana(-1); break;
    case 'arriba': if (w) w.executeJavaScript('window.scrollBy({ top: -Math.round(innerHeight * 0.45), behavior: "smooth" })', true).catch(() => {}); break;
    case 'abajo': if (w) w.executeJavaScript('window.scrollBy({ top: Math.round(innerHeight * 0.45), behavior: "smooth" })', true).catch(() => {}); break;
    case 'cerrar': cerrarPestana(); break;
    case 'zoom-mas': zoom(1); break;
    case 'zoom-menos': zoom(-1); break;
    case 'pausa': {
      if (mini && !mini.isDestroyed()) { mini.webContents.executeJavaScript('(() => { const v = document.querySelector("video"); if (v) { v.paused ? v.play() : v.pause(); } })()', true).catch(() => {}); break; }
      if (w) return w.executeJavaScript('(() => { const vs = [...document.querySelectorAll("video")]; const v = vs.find((x) => !x.paused) || vs.find((x) => x.offsetWidth > 0) || vs[0]; if (!v) return false; if (v.paused) v.play(); else v.pause(); return true; })()', true).catch(() => false);
      break;
    }
    // 👁 con la cámara encendida [09-nov]: te vas → pausa; vuelves → sigue; otra cara mirando → página tapada
    case 'lanzar': return cfg.lanzarTelefono === false ? { ok: false, error: 'off' } : enviarTelefono({});   // 📲 [09-nov]
    case 'ausente': return enTodas(JS_AUSENTE);
    case 'presente': return enTodas(JS_PRESENTE);
    case 'guardia': return enTodas(jsGuardia());
    case 'guardia-off': return enTodas(JS_GUARDIA_FUERA);
    default: return false;
  }
  return true;
}
const JS_AUSENTE = `(() => { let n = 0; for (const v of document.querySelectorAll('video,audio')) if (!v.paused && !v.ended) { v.pause(); v.setAttribute('data-jarvis-ausente', '1'); n++; } return n; })()`;
const JS_PRESENTE = `(() => { let n = 0; for (const v of document.querySelectorAll('[data-jarvis-ausente]')) { v.removeAttribute('data-jarvis-ausente'); const p = v.play(); if (p && p.catch) p.catch(() => {}); n++; } return n; })()`;
const JS_GUARDIA_FUERA = `(() => { clearTimeout(window.__jarvisGuardiaT); const x = document.getElementById('__jarvis_guardia'); if (x) x.remove(); return 0; })()`;
// la tapa se quita sola a los 3,5 s si nadie la renueva (así no se queda pegada en ninguna pestaña)
function jsGuardia() {
  const txt = codIdioma(cfg) === 'es' ? '👁  Alguien más está mirando tu pantalla\nLa página se ve cuando se vaya' : '👁  Someone else is looking at your screen\nThe page comes back when they leave';
  return `(() => { let d = document.getElementById('__jarvis_guardia');
    if (!d) { d = document.createElement('div'); d.id = '__jarvis_guardia';
      for (const [k, v] of [['position', 'fixed'], ['inset', '0'], ['z-index', '2147483647'], ['display', 'flex'], ['align-items', 'center'], ['justify-content', 'center'],
        ['background', 'rgba(3,8,14,.55)'], ['backdrop-filter', 'blur(30px)'], ['-webkit-backdrop-filter', 'blur(30px)'], ['color', '#38d6ff'], ['font', '600 20px system-ui,sans-serif'],
        ['text-align', 'center'], ['white-space', 'pre-line'], ['padding', '24px'], ['pointer-events', 'none'], ['text-shadow', '0 0 12px rgba(56,214,255,.6)']]) d.style.setProperty(k, v, 'important');
      d.textContent = ${JSON.stringify(txt)}; document.documentElement.appendChild(d); }
    clearTimeout(window.__jarvisGuardiaT); window.__jarvisGuardiaT = setTimeout(() => { const x = document.getElementById('__jarvis_guardia'); if (x) x.remove(); }, 3500); return 1; })()`;
}
function vistasTodas() {
  return [...pestanas.filter((p) => p.vista && !p.dormida).map((p) => p.vista.webContents), mini && !mini.isDestroyed() ? mini.webContents : null]
    .filter((w) => w && !w.isDestroyed());
}
async function enTodas(js) {
  const r = await Promise.all(vistasTodas().map((w) => w.executeJavaScript(js, true).catch(() => 0)));
  return r.reduce((a, b) => a + (Number(b) || 0), 0);
}

// ══ Cyber HUD: escáner de amenazas, mapa de conexiones, monitor del sistema, efectos y «clip that» [04-nov] ══
const escaner = require('./lib/escaner');
const monitor = require('./lib/monitor');
const clip = require('./lib/clip');
const enIngles = () => codIdioma(cfg) !== 'es';
// los efectos van en un «mundo aparte» del JavaScript de la página: la web no los ve ni los puede tocar
const enPaginaAparte = (w, js) => w.executeJavaScriptInIsolatedWorld(1999, [{ code: js }]).catch(() => {});
function efectoEscaneo(w, r) {
  const n = r.rastreadores + r.anuncios;
  const riesgo = { bajo: enIngles() ? 'LOW' : 'BAJO', medio: enIngles() ? 'MEDIUM' : 'MEDIO', alto: enIngles() ? 'HIGH' : 'ALTO' }[r.nivel];
  const txt = enIngles() ? `◈ SCAN COMPLETE · ${n} BLOCKED · ${r.terceros} THIRD PARTIES · RISK ${riesgo}` : `◈ ESCANEO COMPLETO · ${n} BLOQUEADOS · ${r.terceros} TERCEROS · RIESGO ${riesgo}`;
  const color = { bajo: '#38d6ff', medio: '#ffc861', alto: '#ff5c7a' }[r.nivel];
  enPaginaAparte(w, `(() => { if (window.__jarvisScan) return; window.__jarvisScan = 1; const raiz = document.documentElement;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;top:-130px;height:130px;z-index:2147483647;pointer-events:none;background:linear-gradient(180deg,transparent,${color}1c 70%,${color}aa 97%,transparent);transition:top 1.05s cubic-bezier(.6,.1,.3,1)';
    raiz.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => { d.style.top = '105vh'; })); setTimeout(() => d.remove(), 1300);
    const t = document.createElement('div'); t.textContent = ${JSON.stringify(txt)};
    t.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;pointer-events:none;font:600 12px/1.2 Rajdhani,Segoe UI,sans-serif;letter-spacing:1.5px;color:${color};background:rgba(4,12,20,.9);border:1px solid ${color};border-radius:8px;padding:8px 12px;box-shadow:0 0 18px ${color}66;opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s';
    raiz.appendChild(t); setTimeout(() => { t.style.opacity = '1'; t.style.transform = 'none'; }, 950); setTimeout(() => { t.style.opacity = '0'; }, 4200); setTimeout(() => t.remove(), 4700); })()`);
}
function efectoHolograma(w) {
  enPaginaAparte(w, `(() => { const raiz = document.documentElement; const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(56,214,255,.13) 0 2px,transparent 2px 5px),linear-gradient(90deg,rgba(56,214,255,.22),transparent 28%,transparent 72%,rgba(56,214,255,.22));opacity:1;transition:opacity .5s ease-out';
    raiz.appendChild(d); try { document.body.animate([{ filter: 'saturate(1.7) brightness(1.18) hue-rotate(-12deg)', transform: 'translateX(-3px)' }, { filter: 'none', transform: 'translateX(2px)' }, { filter: 'none', transform: 'none' }], { duration: 280 }); } catch (e) {}
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.opacity = '0'; })); setTimeout(() => d.remove(), 600); })()`);
}
async function escanear(p) {
  if (!cfg.escaner || !p || p.dormida || p.vista.webContents.isDestroyed()) return;
  const w = p.vista.webContents; const u = w.getURL();
  if (!/^https?:/.test(u)) { p.escaneo = null; if (p.id === activa) aviso('escaner', null); return; }
  try { escaner.formularios(w.id, await w.executeJavaScriptInIsolatedWorld(1999, [{ code: `({ password: !!document.querySelector('input[type=password]'), inseguro: location.protocol === 'https:' && [...document.forms].some((f) => /^http:/i.test(f.action || '')) })` }])); } catch { /* */ }
  await pausa(1200);   // lo que la página pide justo después de cargar también cuenta
  if (w.isDestroyed() || w.getURL() !== u) return;
  const r = escaner.resumen(w.id, u);
  p.escaneo = r;
  if (p.id === activa || (dividida && (p.id === dividida.a || p.id === dividida.b))) {
    aviso('escaner', r);
    if (r.nivel === 'alto') aviso('amenaza', { host: proteccion.host(u), pistas: r.pistas });
  }
  if (cfg.efectos && !p.privada) efectoEscaneo(w, r);
}
async function mapaConexiones() {
  const p = actual(); if (!p || p.privada) return { ok: false, error: 'En una pestaña privada no miro ni envío nada.' };
  const u = urlDe(p); if (!/^https?:/.test(u)) return { ok: false, error: 'Abre una página web para ver su mapa de conexiones.' };
  const r = escaner.resumen(p.vista.webContents.id, u);
  const g = await escaner.ubicar(r.hosts.map((h) => h.host));
  const info = new Map(r.hosts.map((h) => [h.host, h]));
  return { ok: true, ...r, yo: g.yo, servidores: g.servidores.map((s) => ({ ...s, bloqueado: (info.get(s.host) || {}).bloqueado || '', propio: (info.get(s.host) || {}).propio || false })) };
}
let clipEnCurso = false;
async function clipThat() {
  if (clipEnCurso) return { ok: false, error: tr('Ya estoy guardando un clip.') };
  clipEnCurso = true; aviso('clip', { tipo: 'inicio' });
  try {
    const r = await clip.guardar(cfg.clipMetodo, cfg.carpetaClips);
    if (!r.ok) { r.error = tr(r.error); aviso('clip', { tipo: 'error', texto: r.error }); return r; }
    let enviado = false; let grande = false; let errorTel = '';
    const token = cerebro.llave('telegram'); const chat = cfg.telegramChat && cfg.telegramChat.id;
    if (cfg.clipTelefono && token && chat) {
      try { const x = await telefono.enviarVideo(token, chat, r.ruta, `🎮 ${gaming ? gaming.juego : 'Clip'} · JARVIS`); enviado = Boolean(x.ok); grande = Boolean(x.grande); }
      catch (e) { errorTel = String(e.message || e).slice(0, 120); }
    }
    const fin = { tipo: 'listo', ruta: r.ruta, mb: Math.round(r.tam / 1048576), enviado, grande, errorTel, telefono: Boolean(token && chat && cfg.clipTelefono) };
    aviso('clip', fin); return { ok: true, ...fin };
  } finally { clipEnCurso = false; }
}

// ── descargas: a Descargas, y si es un programa, botón "Instalar" ───────
function descargas(ses) {
  ses.on('will-download', (_e, item) => {
    const carpeta = cfg.carpetaDescargas && fs.existsSync(cfg.carpetaDescargas) ? cfg.carpetaDescargas : DESCARGAS;
    fs.mkdirSync(carpeta, { recursive: true });
    let destino = path.join(carpeta, item.getFilename());
    if (cfg.preguntarDonde) item.setSaveDialogOptions({ defaultPath: destino, title: 'Guardar descarga' });
    else {
      for (let n = 1; fs.existsSync(destino); n++) destino = path.join(carpeta, item.getFilename().replace(/(\.[^.]+)?$/, ` (${n})$1`));
      item.setSavePath(destino);
    }
    const id = crypto.randomBytes(4).toString('hex');
    const enviar = (estadoD) => { const r = item.getSavePath() || destino; aviso('descarga', { id, nombre: path.basename(r), ruta: r, estado: estadoD,
      recibido: item.getReceivedBytes(), total: item.getTotalBytes(), programa: /\.(deb|appimage|flatpakref|exe|msi|sh|run|bat|cmd)$/i.test(r) && cfg.avisarProgramas, instalable: ES_LINUX && /\.(deb|appimage|flatpakref|exe|msi)$/i.test(r) }); };
    item.on('updated', () => enviar('bajando'));
    item.once('done', (_e2, s2) => { enviar(s2 === 'completed' ? 'listo' : 'fallo'); if (s2 === 'completed') revisarDescarga(id, item.getSavePath() || destino); });
    enviar('bajando');
  });
}

// ════════════════════════════════════════════════════════════════════════
// [04-nov, pedido del usuario: «cerebro local, escáner de descargas, terminal de comandos y centro de mando…
//  añádelas en la configuración por si las quiero activar o desactivar»]
// ════════════════════════════════════════════════════════════════════════
const antivirus = require('./lib/antivirus');
const memoria = require('./lib/memoria');
const recuerdos = require('./lib/recuerdos');   // 🧠 memoria del navegador [09-nov]
const net = require('net');
const dnsP = require('dns').promises;

// ── 🎙 Dictado por voz: hablas y el texto aparece en la caja donde estás escribiendo ──
async function dictar(wav) {
  if (cfg.dictado === false) return { ok: false };
  const w = wc(); if (!w) return { ok: false };
  let t = '';
  try { t = String(await cerebro.transcribir(Buffer.from(wav || []), codIdioma(cfg), cfg.ordenIA) || '').trim(); }
  catch (e) { return { ok: false, error: e && e.sinAudio ? tr('Para dictar necesito una llave de Gemini u OpenAI.') : errorIA(e) }; }
  if (!t) return { ok: false, error: tr('No te entendí.') };
  if (cfg.dictadoIdioma) {   // dictar en otro idioma: hablas en español y se escribe en inglés (o al revés)
    try { const r = await cerebro.pensar({ sistema: 'You translate dictated text. Reply with ONLY the translation, keeping the tone. No quotes, no notes.', historia: [{ rol: 'user', texto: `Translate into ${cerebro.idiomaDe(cfg.dictadoIdioma)}:\n${t}` }], max: 800 }, cfg.ordenIA); if (r.texto) t = r.texto.trim(); } catch { /* queda como se dijo */ }
  }
  w.focus(); w.insertText(t + ' ');
  return { ok: true, texto: t };
}

// ── 📄 Hablar con PDFs y documentos ──
const docCache = new Map();   // url → { texto, paginas, titulo }
const esPdfUrl = (u) => /\.pdf([?#]|$)/i.test(String(u || '')) || /arxiv\.org\/pdf\//i.test(String(u || ''));
async function esPdf(p) {
  const u = urlDe(p); if (esPdfUrl(u)) return true;
  if (p.esPdf !== undefined && p.esPdfUrl === u) return p.esPdf;
  const t = await p.vista.webContents.executeJavaScript('document.contentType', true).catch(() => '');
  p.esPdfUrl = u; p.esPdf = t === 'application/pdf'; return p.esPdf;
}
async function textoPdf(p) {
  const u = urlDe(p); const c = docCache.get(u); if (c) return c;
  let bytes;
  if (u.startsWith('file:')) bytes = await fs.promises.readFile(require('url').fileURLToPath(u));
  else { const r = await p.vista.webContents.session.fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); bytes = Buffer.from(await r.arrayBuffer()); }
  if (bytes.length > 80e6) throw new Error('el PDF pesa más de 80 MB');
  const { extractText, getDocumentProxy } = await import('unpdf');
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(doc, { mergePages: false });
  const hay = text.some((t) => String(t).trim());
  const x = { paginas: totalPages, titulo: decodeURIComponent(u.split(/[?#]/)[0].split('/').pop() || 'PDF'), texto: hay ? text.map((t, i) => `[Page ${i + 1}]\n${String(t).trim()}`).join('\n\n').slice(0, 400000) : '' };
  docCache.set(u, x); if (docCache.size > 8) docCache.delete(docCache.keys().next().value);
  return x;
}
// abrir un documento de tu PC: PDF, Word, texto
async function abrirDocumento() {
  const r = await dialog.showOpenDialog(win, { title: tr('Abrir documento'), properties: ['openFile'], defaultPath: DESCARGAS,
    filters: [{ name: tr('Documentos'), extensions: ['pdf', 'docx', 'txt', 'md', 'csv', 'json', 'html', 'htm'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const ruta = r.filePaths[0]; const { pathToFileURL } = require('url');
  if (/\.docx$/i.test(ruta)) {   // Word → página HTML oscura que JARVIS puede leer
    try {
      const mammoth = require('mammoth'); const h = await mammoth.convertToHtml({ path: ruta });
      const dir = path.join(CONF, 'documentos'); fs.mkdirSync(dir, { recursive: true });
      const nombre = path.basename(ruta).replace(/\.docx$/i, '');
      const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
      const salida = path.join(dir, nombre.replace(/[^\w .-]/g, '_') + '.html');
      fs.writeFileSync(salida, `<!doctype html><meta charset="utf-8"><title>${esc(nombre)}</title><style>body{max-width:820px;margin:40px auto;padding:0 24px;background:#0b1118;color:#dbe7ef;font:16px/1.65 Segoe UI,sans-serif}h1,h2,h3{color:#7fe9ff}a{color:#38d6ff}table{border-collapse:collapse}td,th{border:1px solid #2a3a48;padding:6px 10px}img{max-width:100%}</style><h1>${esc(nombre)}</h1>${h.value}`);
      nueva(pathToFileURL(salida).href);
    } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 120) }; }
  } else nueva(pathToFileURL(ruta).href);
  abrirPanel(true); aviso('panel-pestana', 'jarvis');
  return { ok: true };
}

// ── ⬆ Actualizaciones automáticas [04-nov] ──
const actualizar = require('./lib/actualizar');
let nuevaVersion = null; let instalando = false;
async function revisarActualizacion(manual) {
  if (process.platform !== 'win32' || (!manual && cfg.actualizarAuto === false)) return null;
  const r = await actualizar.buscar(app.getVersion()).catch(() => null);
  if (r && (!nuevaVersion || nuevaVersion.version !== r.version)) { nuevaVersion = r; aviso('actualizacion', { version: r.version }); avisarEstado(); }
  return r;
}
function actualizarAhora() {
  if (!nuevaVersion || instalando) return false;
  instalando = true; actualizar.instalar(nuevaVersion.ruta, true);   // se instala y el navegador vuelve a abrirse solo
  setTimeout(() => app.quit(), 400); return true;
}

// ── Importar de Chrome / Edge / Brave y ser el navegador predeterminado [04-nov] ──
const importar = require('./lib/importar');
const { urlsDeArgs, registrarNavegador, esPredeterminado, NOMBRE_REG } = require('./lib/windows');
async function importarDe(id, que = {}) {
  const r = { favoritos: 0, historial: 0 };
  if (que.favoritos !== false) {
    const ya = new Set(datos.favoritos.map((f) => f.url));
    for (const f of importar.favoritos(id)) if (!ya.has(f.url)) { datos.favoritos.push(f); ya.add(f.url); r.favoritos++; }
    guardarDatos();
  }
  if (que.historial !== false) {
    const sqlDir = path.join(__dirname, 'node_modules', 'sql.js', 'dist');
    try { r.historial = proteccion.historial.importar(await importar.historial(id, sqlDir)); }
    catch (e) { r.errorHistorial = String(e.message || e).slice(0, 120); }
  }
  avisarEstado();
  return r;
}
async function hacerPredeterminado() {
  const r = await registrarNavegador(); if (!r.ok) return r;
  shell.openExternal(`ms-settings:defaultapps?registeredAppUser=${NOMBRE_REG}`);   // Windows pide que lo elijas tú
  return { ok: true };
}

// ── 🎨 Temas HUD: la página de inicio se tiñe girando el color (las fotos e iconos se quedan como son) ──
const GIRO_TEMA = { rojo: 161, verde: -45, morado: 71, dorado: -153 };
const esInicio = (u) => { try { return new URL(u).pathname === new URL(INICIO).pathname; } catch { return false; } };
function temaInicio(w) {
  try {
    if (!esInicio(w.getURL())) return;
    const g = GIRO_TEMA[cfg.tema]; if (!g) return;
    w.insertCSS(`html { filter: hue-rotate(${g}deg); } img, video, picture, .icono img { filter: hue-rotate(${-g}deg); }`).catch(() => {});
  } catch { /* */ }
}
function cambioTema() {
  for (const p of pestanas) { try { if (esInicio(urlDe(p))) p.vista.webContents.reload(); } catch { /* */ } }
  if (mandoAbierto()) mandoWin.webContents.send('estado', estado());
}

// ── 🧠 Cerebro local: el Qwen de la PC (llama-server) ───────────────────
let qwenProc = null;
function comandoQwen() {
  const bat = cfg.localBat || 'C:\\IA-Local\\Iniciar-Qwen.bat';
  let texto = ''; try { texto = fs.readFileSync(bat, 'utf8'); } catch { return null; }
  const dir = (/^\s*cd\s+(?:\/d\s+)?(.+?)\s*$/im.exec(texto) || [])[1] || path.dirname(bat);
  const linea = texto.split(/\r?\n/).find((l) => /^\s*"?[^"\s]*llama-server(\.exe)?"?\s/i.test(l));
  if (!linea) return null;
  const partes = linea.match(/"[^"]*"|\S+/g).map((x) => x.replace(/^"|"$/g, ''));
  const exe = path.isAbsolute(partes[0]) ? partes[0] : path.join(dir, partes[0].replace(/^\.[\\/]/, ''));
  return fs.existsSync(exe) ? { exe, args: partes.slice(1), dir } : null;
}
let arrancando = null;
async function arrancarQwen() {
  if (await cerebro.localVivo()) return true;
  if (gaming) return false;   // jugando no se carga un modelo de 20 GB
  if (arrancando) return arrancando;
  arrancando = (async () => {
    if (!qwenProc) {
      const c = comandoQwen(); if (!c) { aviso('local', { estado: 'falta' }); return false; }
      try { qwenProc = spawn(c.exe, c.args, { cwd: c.dir, windowsHide: true, stdio: 'ignore' }); } catch { return false; }
      qwenProc.on('exit', () => { qwenProc = null; aviso('local', { estado: 'apagado' }); });
      aviso('local', { estado: 'arrancando' });
    }
    for (let i = 0; i < 75; i++) {
      await pausa(2000);
      if (await cerebro.localVivo()) { aviso('local', { estado: 'listo' }); return true; }
      if (!qwenProc) return false;
    }
    return false;
  })();
  try { return await arrancando; } finally { arrancando = null; }
}
function apagarQwen() { if (qwenProc) { try { qwenProc.kill(); } catch { /* */ } qwenProc = null; } }
function configurarLocal() {
  cerebro.configurarLocal({ activo: Boolean(cfg.cerebroLocal), url: cfg.localUrl || 'http://127.0.0.1:8080', primero: Boolean(cfg.localPrimero),
    arrancar: cfg.localArrancar !== false ? arrancarQwen : null });
  if (!cfg.cerebroLocal) apagarQwen();
}
async function estadoLocal() {
  return { activo: Boolean(cfg.cerebroLocal), vivo: await cerebro.localVivo(), propio: Boolean(qwenProc), arrancando: Boolean(arrancando),
    bat: cfg.localBat || 'C:\\IA-Local\\Iniciar-Qwen.bat', encontrado: Boolean(comandoQwen()), url: cfg.localUrl || 'http://127.0.0.1:8080' };
}

// ── 🛡 Escáner de descargas ─────────────────────────────────────────────
const revisadas = [];   // últimas descargas revisadas (para la terminal y el centro de mando)
async function revisarDescarga(id, ruta) {
  if (cfg.escanerDescargas === false) return;
  const nombre = path.basename(ruta);
  aviso('descarga-revision', { id, nombre, ruta, veredicto: 'revisando' });
  const r = await antivirus.revisar(ruta, cerebro.llave('virustotal')).catch((e) => ({ veredicto: 'sin-revisar', motores: [], error: String(e.message || e) }));
  const x = { id, nombre, ruta, t: Date.now(), ...r };
  revisadas.unshift(x); revisadas.length = Math.min(revisadas.length, 30);
  aviso('descarga-revision', x);
  if (r.veredicto === 'peligroso' || r.veredicto === 'quitado') {
    try {
      const { Notification } = require('electron');
      if (Notification.isSupported()) new Notification({ title: 'JARVIS · ' + tr('Descarga peligrosa'), body: `${nombre}: ${r.veredicto === 'quitado' ? tr('Windows lo quitó por seguridad.') : tr('no lo abras.')}`, icon: path.join(__dirname, 'ui', 'icono.png') }).show();
    } catch { /* */ }
  }
}

// ── ⌨ Terminal de comandos (Ctrl+K): vive en lib/terminal.js ──
let ultimoMonitor = null;
const { terminal, COMANDOS } = require('./lib/terminal')({
  aUrl, nueva, navegar, actual, wc, activarPestana, cerrarPestana, reabrirPestana, urlDe, abrirPanel, aviso, avisarEstado, memoriaMB, cambioGaming,
  configurarLocal, arrancarQwen, apagarQwen, estadoLocal, centroMando: (on) => centroMando(on), dividir, videoFlotante, clipThat, traducirPagina, enviarTelefono, abrirConfig,
  tr, enIngles, INICIO, revisadas,
  cfg: () => cfg, gaming: () => gaming, pestanas: () => pestanas, activa: () => activa, qwenProc: () => qwenProc, ultimoMonitor: () => ultimoMonitor,
});

// ── 🖥 Centro de mando: pantalla fija en el monitor vertical ─────────────
let mandoWin = null;
const CANALES_MANDO = new Set(['estado', 'monitor', 'amenaza', 'descarga', 'descarga-revision', 'local', 'chat-ev', 'clip', 'vigilante', 'mando-voz', 'mando-msg', 'escaner']);
function pantallasLista() {
  const { screen } = require('electron');
  const prim = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({ id: String(d.id), n: i + 1, ancho: d.size.width, alto: d.size.height, vertical: d.size.height > d.size.width, principal: d.id === prim }));
}
function pantallaMando() {
  const { screen } = require('electron');
  const todas = screen.getAllDisplays();
  if (cfg.pantallaMando && cfg.pantallaMando !== 'auto') { const d = todas.find((x) => String(x.id) === String(cfg.pantallaMando)); if (d) return d; }
  const delNav = win ? screen.getDisplayMatching(win.getBounds()) : screen.getPrimaryDisplay();
  return todas.find((d) => d.size.height > d.size.width && d.id !== delNav.id) || todas.find((d) => d.id !== delNav.id) || null;
}
function centroMando(on) {
  if (!on) { if (mandoWin && !mandoWin.isDestroyed()) mandoWin.destroy(); mandoWin = null; return { ok: true }; }
  const d = pantallaMando();
  if (mandoWin && !mandoWin.isDestroyed()) { mandoWin.showInactive(); return { ok: true }; }
  const b = d ? { x: d.workArea.x + 40, y: d.workArea.y + 40, width: 400, height: 600 } : { width: 520, height: 900 };   // nace dentro de ese monitor
  mandoWin = new BrowserWindow({ ...b, frame: false, show: false, backgroundColor: '#02060b', skipTaskbar: Boolean(d), title: 'JARVIS · Command Center', icon: path.join(__dirname, 'ui', 'icono.png'),
    resizable: true, fullscreenable: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
  mandoWin.loadFile(path.join(__dirname, 'ui', 'mando.html'));
  // pantalla completa EN ese monitor: con escalas distintas (125 % / 100 %) un setBounds solo sale del tamaño equivocado
  mandoWin.once('ready-to-show', () => {
    mandoWin.showInactive();
    if (!d) return;
    const ajustar = () => { if (!mandoAbierto()) return; mandoWin.setBounds(d.bounds); mandoWin.setFullScreen(true); };
    setTimeout(ajustar, 150);
    setTimeout(() => { if (mandoAbierto() && Math.abs(mandoWin.getBounds().width - d.bounds.width) > 8) { mandoWin.setFullScreen(false); mandoWin.setBounds(d.bounds); mandoWin.setBounds(d.bounds); } }, 900);   // por si Windows no lo estiró
  });
  mandoWin.webContents.on('will-navigate', (e) => e.preventDefault());
  mandoWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mandoWin.on('closed', () => { mandoWin = null; });
  return { ok: true, pantalla: d ? `${d.size.width}×${d.size.height}` : 'ventana' };
}
function mandoAbierto() { return Boolean(mandoWin && !mandoWin.isDestroyed()); }

// ── ventana de configuración ────────────────────────────────────────────
function abrirConfig(seccion = '') {
  if (ventanaConfig && !ventanaConfig.isDestroyed()) { ventanaConfig.show(); ventanaConfig.focus(); if (seccion) ventanaConfig.loadFile(path.join(__dirname, 'ui', 'config.html'), { query: { s: seccion } }); return; }
  ventanaConfig = new BrowserWindow({ width: 1000, height: 680, minWidth: 760, minHeight: 480, frame: false, backgroundColor: '#04090f', parent: win || undefined,
    title: 'Configuración — Navegador JARVIS', icon: path.join(__dirname, 'ui', 'icono.png'),
    webPreferences: { preload: path.join(__dirname, 'preload-config.js'), contextIsolation: true, sandbox: true } });
  ventanaConfig.loadFile(path.join(__dirname, 'ui', 'config.html'), { query: seccion ? { s: seccion } : {} });
  ventanaConfig.webContents.on('will-navigate', (e) => e.preventDefault());
  ventanaConfig.on('closed', () => { ventanaConfig = null; });
}
ipcMain.handle('nav-config', async (_e, accion, d) => {
  if (!deLaInterfaz(_e, ['config.html'])) return null;
  switch (accion) {
    case 'leer': return cfg;
    case 'buscadores': return proteccion.BUSCADORES;
    case 'poner': {
      const permitidas = Object.keys(proteccion.PREDETERMINADA).filter((k) => !['telegramChat', 'telegramBot'].includes(k));
      for (const [k, v] of Object.entries(d || {})) if (permitidas.includes(k)) cfg[k] = v;
      proteccion.guardarConfig(cfg); acomodar(); avisarEstado();
      if (d && 'vozSiempre' in d) aviso('oido', Boolean(cfg.vozSiempre));   // encender o apagar el oído al momento
      if (d && ['cerebroLocal', 'localPrimero', 'localArrancar', 'localUrl', 'localBat'].some((k) => k in d)) { configurarLocal(); aviso('llaves'); }
      if (d && 'tema' in d) cambioTema();
      if (d && ('centroMando' in d || 'pantallaMando' in d)) { if ('pantallaMando' in d) centroMando(false); centroMando(Boolean(cfg.centroMando)); }
      return cfg;
    }
    case 'restablecer': cfg = { ...proteccion.PREDETERMINADA, permisos: {}, emergentesPermitidas: {} }; proteccion.guardarConfig(cfg); return cfg;
    case 'carpeta': return cfg.carpetaDescargas || DESCARGAS;
    case 'elegir-carpeta': {
      const r = await dialog.showOpenDialog(ventanaConfig, { properties: ['openDirectory', 'createDirectory'], defaultPath: cfg.carpetaDescargas || DESCARGAS });
      if (r.canceled || !r.filePaths[0]) return null;
      cfg.carpetaDescargas = r.filePaths[0]; proteccion.guardarConfig(cfg); return cfg.carpetaDescargas;
    }
    case 'historial': return proteccion.historial.buscar(d || '');
    case 'historial-quitar': proteccion.historial.quitar(d); return true;
    case 'abrir': nueva(String(d || '')); win?.focus(); return true;
    case 'borrar-datos': return borrarDatos(d || {});
    case 'acerca': return { version: require('./package.json').version, chromium: process.versions.chrome, electron: process.versions.electron, bloqueados: proteccion.bloqueados() + anuncios.bloqueados(), adblock: anuncios.listo() };
    // cerebro propio: llaves (la interfaz nunca recibe la llave, solo si está puesta)
    case 'llaves': return cerebro.estadoLlaves();
    case 'poner-llave': if (!d || !cerebro.PROVEEDORES.includes(d.proveedor)) return null; cerebro.ponerLlave(d.proveedor, d.valor); aviso('llaves'); return cerebro.estadoLlaves();
    case 'probar-ia': {
      try { const r = await cerebro.pensar({ sistema: 'Reply with one short friendly sentence.', historia: [{ rol: 'user', texto: `Say hello to the user in ${cerebro.idiomaDe(codIdioma(cfg))}.` }], max: 200 }, d ? [d] : cfg.ordenIA); return { ok: true, texto: r.texto, quien: cerebro.ultimo() }; }
      catch (e) { return { ok: false, texto: errorIA(e) }; }
    }
    case 'jarvis-vivo': return jarvisVivo();
    case 'reiniciar': app.relaunch(); app.exit(0); return true;
    case 'vigilancias': return vigilante.todas();
    // Teléfono (Telegram): la llave del bot va cifrada; la ventana solo sabe si está puesta
    case 'memoria': return memoria.todas();
    case 'memoria-poner': return memoria.agregar(d, 'manual');
    case 'memoria-quitar': return memoria.quitar(d);
    case 'memoria-borrar': return memoria.borrarTodo();
    case 'actualizacion': return { actual: app.getVersion(), nueva: nuevaVersion ? nuevaVersion.version : '', carpeta: actualizar.carpeta() };
    case 'actualizar-buscar': { const r = await revisarActualizacion(true); return { actual: app.getVersion(), nueva: r ? r.version : '' }; }
    case 'actualizar-ya': return actualizarAhora();
    case 'importar-perfiles': return importar.perfiles();
    case 'importar': return importarDe(d && d.id, d || {});
    case 'predeterminado': return hacerPredeterminado();
    case 'predeterminado-estado': return esPredeterminado();
    case 'local-estado': return estadoLocal();
    case 'local-arrancar': return arrancarQwen();
    case 'local-elegir': {
      const r = await dialog.showOpenDialog(ventanaConfig, { properties: ['openFile'], filters: [{ name: 'Iniciar Qwen (.bat)', extensions: ['bat', 'cmd'] }], defaultPath: cfg.localBat || 'C:\\IA-Local' });
      if (r.canceled || !r.filePaths[0]) return null;
      cfg.localBat = r.filePaths[0]; proteccion.guardarConfig(cfg); configurarLocal(); return estadoLocal();
    }
    case 'pantallas': return pantallasLista();
    case 'vt-estado': return { llave: Boolean((cerebro.estadoLlaves().virustotal || {}).puesta), final: (cerebro.estadoLlaves().virustotal || {}).final || '' };
    case 'vt-llave': {
      const v = String(d || '').trim();
      if (v) {   // prueba la llave con la huella del archivo de prueba EICAR (inofensivo, todos los antivirus lo conocen)
        try { const r = await fetch('https://www.virustotal.com/api/v3/files/275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', { headers: { 'x-apikey': v }, signal: AbortSignal.timeout(15000) });
          if (r.status === 401 || r.status === 403) return { ok: false, error: 'VirusTotal no aceptó esa llave.' }; }
        catch { return { ok: false, error: 'No pude hablar con VirusTotal (¿internet?).' }; }
      }
      cerebro.ponerLlave('virustotal', v); return { ok: true };
    }
    case 'telegram-estado': { const l = cerebro.estadoLlaves().telegram || {}; return { llave: Boolean(l.puesta), bot: cfg.telegramBot, chat: cfg.telegramChat }; }
    case 'telegram-llave': {
      try { const bot = await telefono.probarBot(String(d || '').trim()); cerebro.ponerLlave('telegram', String(d).trim()); cfg.telegramBot = bot; cfg.telegramChat = null; proteccion.guardarConfig(cfg); return { ok: true, bot }; }
      catch (e) { return { ok: false, error: e.status === 401 || e.status === 404 ? 'Esa llave del bot no es válida.' : `Telegram: ${e.message}` }; }
    }
    case 'telegram-conectar': {
      const token = cerebro.llave('telegram'); if (!token) return { ok: false, error: 'Primero pega la llave del bot.' };
      try {
        const chat = await telefono.buscarChat(token);
        if (!chat) return { ok: false, error: `Escríbele cualquier cosa a tu bot @${(cfg.telegramBot && cfg.telegramBot.usuario) || ''} en Telegram y vuelve a pulsar «Conectar».` };
        cfg.telegramChat = chat; proteccion.guardarConfig(cfg);
        await telefono.enviar(token, chat.id, { texto: codIdioma(cfg) === 'es' ? '✅ JARVIS Browser conectado. Desde ahora te mando aquí las páginas que me pidas.' : '✅ JARVIS Browser connected. From now on I will send the pages you ask for here.' });
        return { ok: true, chat };
      } catch (e) { return { ok: false, error: `Telegram: ${e.message}` }; }
    }
    case 'elegir-carpeta-clips': {
      const r = await dialog.showOpenDialog(ventanaConfig, { properties: ['openDirectory'], defaultPath: cfg.carpetaClips || clip.carpetaVideos() });
      if (r.canceled || !r.filePaths[0]) return null;
      cfg.carpetaClips = r.filePaths[0]; proteccion.guardarConfig(cfg); return cfg.carpetaClips;
    }
    case 'carpeta-videos': return cfg.carpetaClips || clip.carpetaVideos();
    case 'clip': return clipThat();
    case 'telegram-quitar': cerebro.ponerLlave('telegram', ''); cfg.telegramBot = null; cfg.telegramChat = null; proteccion.guardarConfig(cfg); return true;
    case 'vigilancia-quitar': vigilante.quitar(d); return vigilante.todas();
    case 'vigilancia-revisar': await vigilante.revisarYa(d, opcionesVigilante); return vigilante.todas();
    case 'extensiones': return { carpeta: extensiones.carpeta(), lista: extensiones.resumen(cfg.extensionesApagadas) };
    case 'ext-recargar': extensiones.leer(); await extensiones.aplicar(session.fromPartition('persist:jarvis'), cfg.extensionesApagadas); return { carpeta: extensiones.carpeta(), lista: extensiones.resumen(cfg.extensionesApagadas) };
    case 'ext-carpeta': shell.openPath(extensiones.carpeta()); return true;
    case 'ext-poner': {
      if (!d || !d.id) return null;
      cfg.extensionesApagadas = { ...(cfg.extensionesApagadas || {}) };
      if (d.activa) delete cfg.extensionesApagadas[d.id]; else cfg.extensionesApagadas[d.id] = true;
      proteccion.guardarConfig(cfg);
      await extensiones.aplicar(session.fromPartition('persist:jarvis'), cfg.extensionesApagadas);
      return extensiones.resumen(cfg.extensionesApagadas);
    }
    case 'cerrar': ventanaConfig?.close(); return true;
    default: return null;
  }
});
async function borrarDatos(o) {
  const desde = o.periodo ? Date.now() - o.periodo : 0;
  if (o.historial) { proteccion.historial.borrar(desde); recuerdos.borrar(desde); }
  for (const ses of [session.fromPartition('persist:jarvis'), session.fromPartition('jarvis-privado')]) {
    if (o.cache) await ses.clearCache();
    if (o.cookies) await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'websql'] });
  }
  if (o.permisos) { cfg.permisos = {}; cfg.emergentesPermitidas = {}; proteccion.guardarConfig(cfg); }
  return { ok: true };
}

// permisos que pide una página: se pregunta en la barra de avisos
const permisosPendientes = new Map();
function preguntarPermiso(info, cb) {
  const id = crypto.randomBytes(4).toString('hex');
  permisosPendientes.set(id, { ...info, cb });
  aviso('permiso', { id, host: info.host, permiso: info.permiso, tipos: info.tipos });
  setTimeout(() => { const p = permisosPendientes.get(id); if (p) { permisosPendientes.delete(id); p.cb(false); aviso('permiso-fin', id); } }, 60000);
}

// ── ventana ─────────────────────────────────────────────────────────────
function crear() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 720, minHeight: 480, frame: false, backgroundColor: '#03080e', show: false,
    title: 'Navegador JARVIS', icon: path.join(__dirname, 'ui', 'icono.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  // 🔒 la ventana de la interfaz nunca navega a otra cosa (p. ej. si sueltas un enlace encima) ni abre ventanas [seguridad 05-nov]
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-redirect', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url: u }) => { if (deUnaPagina(u)) nueva(u); return { action: 'deny' }; });
  win.once('ready-to-show', () => { if (!CAPTURA) win.maximize(); win.show(); });
  win.on('resize', acomodar);
  win.on('close', guardarPestanas);
  win.on('closed', () => { centroMando(false); apagarQwen(); });
  win.webContents.on('before-input-event', (e, i) => atajos(e, i));
  win.webContents.on('console-message', (e, ...a) => { const t = (e && e.message) || a[1] || ''; const nivel = (e && e.level) ?? a[0]; if (/error|warn|2|3/.test(String(nivel))) { consolaUI.push(String(t).slice(0, 300)); if (consolaUI.length > 40) consolaUI.shift(); } });
  win.webContents.once('did-finish-load', () => {
    const pedidas = urlsDeArgs(process.argv);
    const casa = cfg.inicio === 'pagina' && cfg.paginaInicio ? cfg.paginaInicio : INICIO;
    const abrir = pedidas.length ? pedidas : (cfg.inicio === 'restaurar' && datos.pestanas.length ? datos.pestanas.slice(0, 12) : [casa]);
    if (cfg.panelAlAbrir) abrirPanel(true);
    abrir.forEach((u, i) => nueva(u, i === 0));
    if (pedidas.length) activarPestana(pestanas[pestanas.length - 1].id);
    avisarEstado();
    if (CAPTURA) setTimeout(() => capturar(CAPTURA, true), 9000);
  });
}

// Pruebas: foto de la ventana entera (interfaz + página) y salir
async function capturar(ruta, salir) {
  try {
    const { nativeImage } = require('electron');
    const [ancho, alto] = win.getContentSize();
    const base = await win.webContents.capturePage();
    const pag = tapado ? null : await wc().capturePage();   // terminal o lista abiertas: la página está escondida
    const lienzo = base.toBitmap();
    if (!pag) { fs.writeFileSync(ruta, base.toPNG()); return; }
    const b = pag.getSize(); const pb = pag.toBitmap();
    const f = win.webContents.getZoomFactor() * (base.getSize().width / ancho);
    const ox = 0; const oy = Math.round(ARRIBA * f);
    const W = base.getSize().width;
    for (let y = 0; y < b.height && y + oy < base.getSize().height; y++) {
      pb.copy(lienzo, ((y + oy) * W + ox) * 4, y * b.width * 4, (y * b.width + Math.min(b.width, W)) * 4);
    }
    fs.writeFileSync(ruta, nativeImage.createFromBitmap(lienzo, base.getSize()).toPNG());
    void alto;
  } catch (e) { fs.writeFileSync(ruta + '.txt', String(e.stack || e)); }
  if (salir) app.quit();
}

ipcMain.handle('nav', async (_e, accion, d) => {
  if (!deLaInterfaz(_e, ['index.html', 'mando.html'])) return null;   // 🔒 solo la interfaz del navegador puede pedir esto
  switch (accion) {
    case 'estado': return estado();
    case 'ajustes': abrirConfig(d); return true;
    case 'privada': nueva(INICIO, true, true); return true;
    case 'barra-aviso': extraArriba = d ? 44 : 0; acomodar(); return true;
    case 'sugerencias': return sugerencias(d);
    case 'telefono': return enviarTelefono(d || {});
    case 'mapa': return mapaConexiones();
    case 'escaneo': return actual() ? actual().escaneo || null : null;
    case 'clip': return clipThat();
    case 'subtitulos': return subtitulos(d !== false);
    case 'voz-modelo': return modeloVoz();
    case 'oido': return Boolean(cfg.vozSiempre);
    case 'vigilar': return vigilarActual(d && d.tipo, d && d.objetivo);
    case 'dividir': return dividir();
    case 'pip': return videoFlotante();
    case 'tapar': tapado = Boolean(d); acomodar(); return true;
    case 'terminal': return terminal(d);
    case 'actualizar-ya': return actualizarAhora();
    case 'gestos-modelo': return modeloGestos();
    case 'dictar': return dictar(d);
    case 'abrir-documento': return abrirDocumento();
    case 'gesto': return gesto(String(d || ''));
    case 'terminal-comandos': return COMANDOS;
    case 'mando': { const on = d === undefined ? !mandoAbierto() : Boolean(d); cfg.centroMando = on; proteccion.guardarConfig(cfg); return centroMando(on); }
    case 'mando-datos': return { idioma: codIdioma(cfg), estado: estado(), monitor: ultimoMonitor, revisadas: revisadas.slice(0, 8), local: await estadoLocal(), escaneo: actual() ? actual().escaneo || null : null };
    case 'mando-voz': if (mandoAbierto()) mandoWin.webContents.send('mando-voz', d); return true;
    case 'mando-cerrar': cfg.centroMando = false; proteccion.guardarConfig(cfg); centroMando(false); return true;
    case 'borrar-descarga': { const x = revisadas.find((r) => r.ruta === d); if (!x || !fs.existsSync(d)) return false; await shell.trashItem(d); return true; }   // a la papelera, al pulsar el botón
    case 'mostrar-descarga': if (fs.existsSync(d)) shell.showItemInFolder(d); return true;
    case 'permiso-respuesta': {
      const p = permisosPendientes.get(d.id); if (!p) return false;
      permisosPendientes.delete(d.id); p.cb(Boolean(d.permitir));
      if (d.recordar && p.host) { cfg.permisos[p.host] = { ...(cfg.permisos[p.host] || {}), [p.permiso]: Boolean(d.permitir) }; proteccion.guardarConfig(cfg); }
      return true;
    }
    case 'emergente-permitir': if (d.host) { cfg.emergentesPermitidas[d.host] = true; proteccion.guardarConfig(cfg); } if (d.url) nueva(d.url); return true;
    case 'ir': navegar(d); return true;
    case 'nueva': nueva(d || INICIO); return true;
    case 'activar': activarPestana(d); return true;
    case 'cerrar': cerrarPestana(d); return true;
    case 'atras': wc()?.navigationHistory.goBack(); return true;
    case 'adelante': wc()?.navigationHistory.goForward(); return true;
    case 'recargar': if (actual()?.cargando) wc()?.stop(); else wc()?.reload(); return true;
    case 'inicio': navegar(INICIO); return true;
    case 'zoom': zoom(d); return true;
    case 'favorito': alternarFavorito(); return true;
    case 'panel': abrirPanel(d); return true;
    case 'buscar-en': if (d) wc()?.findInPage(d, { findNext: true }); else wc()?.stopFindInPage('clearSelection'); return true;
    case 'min': win.minimize(); return true;
    case 'max': if (win.isMaximized()) win.unmaximize(); else win.maximize(); return true;
    case 'salir': win.close(); return true;
    case 'preguntar': {
      if (/^(resume esta p[aá]gina|summari[sz]e this page)/i.test(String(d || ''))) return { ok: true, respuesta: await resumirActual() };
      const pag = await leerPagina();
      if (!pag.ok) return { ok: false, respuesta: pag.error || 'No pude leer la página.' };
      if (await conJarvis()) return backend('/api/navegador/preguntar', { pregunta: d, titulo: pag.titulo, url: pag.url, texto: pag.texto });
      try { return { ok: true, respuesta: await cerebro.preguntarPagina(String(d || ''), pag, codIdioma(cfg), cfg.ordenIA) }; } catch (e) { return { ok: false, respuesta: errorIA(e) }; }
    }
    case 'resumir': return { ok: true, respuesta: await resumirActual() };
    case 'traducir': traducirPagina(d); return true;
    case 'chat-nuevo': cerebro.olvidar(); return true;
    case 'leer-voz': { const pag = await control('leer'); return backend('/api/decir', { texto: (pag.texto || '').slice(0, 1500) }, 8000); }
    case 'tts': return vozBytes(String(d || '').slice(0, 600));
    case 'tts-doblaje': return cerebro.vozDoblaje(String((d && d.texto) || '').slice(0, 1000), (d && d.lang) || 'es');   // 🗣 voz nativa [09-nov]
    case 'leyendo': leyendo = Boolean(d); avisarEstado(); return true;
    case 'leer-pagina': return control('leer-desde', { desde: '' });
    case 'foto-pagina': return control('foto-pagina');
    case 'abrir-foto': if (fs.existsSync(d)) shell.openPath(d); return true;
    case 'describir': {
      const pag = await control('describir'); if (!pag.ok) return { ok: false, respuesta: pag.error || 'No pude ver la página.' };
      if (await conJarvis()) return backend('/api/navegador/describir', pag, 120000);
      try { return { ok: true, respuesta: await cerebro.describirPagina(pag, codIdioma(cfg), cfg.ordenIA) }; } catch (e) { return { ok: false, respuesta: errorIA(e) }; }
    }
    case 'decir': return backend('/api/decir', { texto: String(d || '').slice(0, 1500) }, 8000);
    case 'chat': if (await conJarvis()) return chatJarvis(d); chatPropio(d); return true;
    case 'recorrer': recorrer(false); return true;
    case 'recorrer-parar': recorrido++; return true;
    case 'chat-parar': if (chatEnCurso) { try { chatEnCurso.destroy(); } catch { /* */ } } cerebro.parar(); chatPropioTurno++; return true;
    case 'jarvis-vivo': {   // qué mostrar en el panel: JARVIS de fondo, cerebro propio o falta una llave
      const conectar = Boolean(cfg.conectarJarvis);
      const vivo = conectar ? await jarvisVivo() : false;
      return { vivo, conectar, llaves: cerebro.hayAlguna() };
    }
    case 'encender-jarvis': return encenderJarvis();
    case 'escuchar': return backend('/api/voz-local/escuchar', {}, 5000);
    case 'transcribir': if (!(await conJarvis())) {   // solo: Gemini u OpenAI pasan el audio a texto
      try { return { ok: true, texto: await cerebro.transcribir(Buffer.from(d || []), codIdioma(cfg), cfg.ordenIA) }; }
      catch (e) { return { ok: false, texto: '', error: errorIA(e) }; }
    } return new Promise((resolve) => {   // 🎙 del panel: el audio grabado → texto (Whisper del cerebro) [28-oct]
      const cuerpo = Buffer.from(d || []);
      const r = http.request({ host: '127.0.0.1', port: 8765, path: '/api/escuchar-audio', method: 'POST', timeout: 90000,
        headers: { 'Content-Type': 'audio/wav', 'Content-Length': cuerpo.length } }, (res) => {
        let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => { try { resolve(JSON.parse(t)); } catch { resolve({ ok: false, texto: '' }); } });
      });
      r.on('error', () => resolve({ ok: false, texto: '', apagado: true }));
      r.on('timeout', () => { r.destroy(); resolve({ ok: false, texto: '' }); });
      r.end(cuerpo);
    });
    case 'abrir-descarga': if (fs.existsSync(d)) shell.openPath(d); return true;
    case 'carpeta-descargas': shell.openPath(DESCARGAS); return true;
    case 'instalar': if (ES_LINUX && fs.existsSync(d)) spawn('/usr/local/bin/jarvis-instalar-app', [d], { detached: true, stdio: 'ignore' }).unref(); return true;
    default: return false;
  }
});

app.on('second-instance', (_e, argv) => {
  if (!win) return;
  const u = urlsDeArgs(argv);
  u.forEach((x) => nueva(x));
  if (!u.length) nueva(INICIO);
  if (win.isMinimized()) win.restore(); win.show(); win.focus();
});

app.whenReady().then(() => {
  if (idioma && !cfg.idioma && ES_LINUX) idioma.alCambiar(() => { app.relaunch(); app.exit(0); });   // JARVIS OS: sigue el idioma del sistema
  nativeTheme.themeSource = 'dark';   // las páginas que tienen modo oscuro lo usan
  const ses = session.fromPartition('persist:jarvis');
  app.userAgentFallback = uaChrome();
  const privada = session.fromPartition('jarvis-privado');
  privada.setUserAgent(uaChrome());
  for (const x of [ses, privada]) proteccion.aplicar(x, () => cfg, preguntarPermiso, anuncios.filtrar, (id, u, b) => escaner.peticion(id, u, b));
  monitor.iniciar((d) => { ultimoMonitor = d; aviso('monitor', d); }, () => mandoAbierto() || (cfg.monitorSistema !== false && win && !win.isDestroyed() && win.isVisible() && !win.isMinimized() && !gaming));
  configurarLocal();
  anuncios.iniciar().then((ok) => { if (ok) for (const x of [ses, privada]) anuncios.cosmetica(x, ipcMain, () => cfg.bloquearAnuncios); });
  juegos.iniciar(cambioGaming, () => cfg.modoGaming !== false);
  vigilante.iniciar(opcionesVigilante, () => Boolean(gaming));   // mientras juegas no revisa nada
  protocol.handle('jarvisvoz', async (req) => {
    const cors = { 'Access-Control-Allow-Origin': '*' };
    try {
      const u = new URL(req.url);
      if (u.hostname === 'gestos') {   // detector de manos (MediaPipe) para el control con gestos [04-nov]
        const nombre = decodeURIComponent(u.pathname).replace(/^\/+/, '');
        if (!/^(vision_bundle\.mjs|wasm\/vision_wasm(_nosimd)?_internal\.(js|wasm)|hand_landmarker\.task|blaze_face_short_range\.tflite)$/.test(nombre)) return new Response('', { status: 404, headers: cors });
        const ruta = nombre === 'hand_landmarker.task' ? GESTOS_MODELO : nombre === 'blaze_face_short_range.tflite' ? CARAS_MODELO : path.join(__dirname, 'node_modules', '@mediapipe', 'tasks-vision', nombre);
        const tipo = nombre.endsWith('.wasm') ? 'application/wasm' : /\.m?js$/.test(nombre) ? 'text/javascript' : 'application/octet-stream';
        return new Response(await fs.promises.readFile(ruta), { headers: { 'Content-Type': tipo, ...cors } });
      }
      return new Response(await fs.promises.readFile(VOZ_MODELO), { headers: { 'Content-Type': 'application/gzip', ...cors } });
    } catch { return new Response('', { status: 404, headers: cors }); }
  });
  try { extensiones.preparar(app.getPath('documents')); extensiones.leer(); extensiones.aplicar(ses, cfg.extensionesApagadas).catch(() => {}); } catch { /* */ }
  descargas(privada);
  if (cfg.dnsSeguro) {
    try { app.configureHostResolver({ secureDnsMode: 'secure', secureDnsServers: ['https://dns.quad9.net/dns-query'] }); } catch { /* versión vieja */ }
  }
  descargas(ses);
  Menu.setApplicationMenu(null);
  crear();
  if (!CAPTURA) iniciarControl();
  if (cfg.centroMando && !CAPTURA) setTimeout(() => centroMando(true), 2500);
  if (!CAPTURA) { setTimeout(() => revisarActualizacion(), 20000); setInterval(() => revisarActualizacion(), 30 * 60000); }
});
app.on('window-all-closed', () => app.quit());
let yaBorrado = false;
app.on('will-quit', () => {   // la versión nueva se instala sola al cerrar el navegador
  if (nuevaVersion && !instalando && cfg.actualizarAuto !== false) { instalando = true; try { actualizar.instalar(nuevaVersion.ruta, false); } catch { /* */ } }
});
app.on('before-quit', (e) => {
  if (cfg.borrarAlCerrar && !yaBorrado) { e.preventDefault(); yaBorrado = true; borrarDatos({ historial: true, cookies: true, cache: true }).finally(() => app.quit()); }
});
