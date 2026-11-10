'use strict';
// Navegador JARVIS — configuración y protección [2026-10-27]
//  · Bloqueo de anuncios y rastreadores (lista propia, sin internet)
//  · HTTPS siempre (con aviso si la página no lo tiene)
//  · DNS seguro (Quad9: frena dominios de virus y estafas conocidas)
//  · "No rastrear" (DNT + GPC), permisos por sitio, historial, borrar datos al cerrar
const fs = require('fs');
const os = require('os');
const path = require('path');

const CONF = path.join(os.homedir(), '.config', 'jarvis');
const ARCHIVO = path.join(CONF, 'navegador-config.json');
const HISTORIAL = path.join(CONF, 'navegador-historial.json');

const PREDETERMINADA = {
  inicio: 'restaurar',            // restaurar | jarvis | pagina
  paginaInicio: '',
  buscador: 'google',             // google | duckduckgo | bing | brave
  zoom: 100,
  bloquearRastreadores: true,
  soloHttps: true,
  dnsSeguro: true,
  noRastrear: true,
  bloquearEmergentes: true,
  preguntarPermisos: true,
  borrarAlCerrar: false,
  guardarHistorial: true,
  carpetaDescargas: '',
  preguntarDonde: false,
  avisarProgramas: true,
  controlJarvis: true,
  panelAlAbrir: false,
  // [28-oct] navegador independiente
  idioma: '',                     // '' = en Windows inglés; en JARVIS OS el del sistema · en | es | pt | fr | de | it
  conectarJarvis: process.platform === 'linux',   // usar el JARVIS de fondo si está encendido (en JARVIS OS siempre está)
  ordenIA: ['gemini', 'claude', 'openai'],
  vozRespuestas: true,            // JARVIS dice en voz alta lo que contesta en el chat
  vozMotor: 'auto',               // auto (OpenAI si hay llave, si no Windows) | sistema | openai | gemini
  bloquearAnuncios: true,         // listas completas (EasyList/uBlock)
  extensionesApagadas: {},
  modoGaming: true,
  // [04-nov] teléfono, subtítulos y voz siempre activa
  telegramChat: null,             // { id, nombre } (lo pone el navegador al conectar)
  telegramBot: null,              // { usuario, nombre }
  subtitulosAuto: true,           // YouTube: subtítulos traducidos solos si el video está en otro idioma
  idiomaSubtitulos: 'es',
  vozSiempre: false,
  pestanasVerticales: false,      // pestañas en una columna a la izquierda
  // [04-nov] Cyber HUD
  escaner: true,                  // escáner de amenazas en cada página
  efectos: true,                  // barrido de escaneo, holograma al cambiar de pestaña, orbe que reacciona
  sonidosUI: true,                // sonidos de interfaz sutiles
  monitorSistema: true,           // CPU, RAM, GPU e internet en la barra de abajo
  clipMetodo: 'nvidia',           // nvidia (Alt+F10) | xbox (Win+Alt+G)
  clipTelefono: true,             // mandar el clip al teléfono
  cerebroLocal: false,            // [04-nov] pensar también con el Qwen de la PC (llama-server)
  localPrimero: false,            // usarlo antes que Gemini (si no, solo cuando las de internet fallan)
  localArrancar: true,            // encender Qwen solo cuando haga falta (nunca mientras juegas)
  localUrl: '',                   // vacío = http://127.0.0.1:8080
  localBat: '',                   // vacío = C:\IA-Local\Iniciar-Qwen.bat
  escanerDescargas: true,         // cada descarga pasa por Windows Defender (+ VirusTotal si hay llave)
  terminal: true,                 // Ctrl+K: terminal de comandos
  centroMando: false,             // pantalla fija en el monitor vertical
  pantallaMando: 'auto',
  actualizarAuto: true,           // [04-nov] instalar solas las versiones nuevas al cerrar el navegador
  dictado: true,                  // [04-nov] Ctrl+Mayús+D: dictar en cualquier caja de texto
  dictadoIdioma: '',              // vacío = escribe lo que dices tal cual; 'en', 'es'… = lo traduce a ese idioma
  documentos: true,               // hablar con PDFs y documentos (visor de PDF + lectura del texto)
  tema: 'cian',                   // [04-nov] cian · rojo · verde · morado · dorado
  memoriaJarvis: true,            // JARVIS recuerda lo que le cuentas entre sesiones
  gestos: false,                  // control con gestos (cámara de la PC o del celular)
  camaraGestos: '',               // vacío = la cámara predeterminada
  gestosVista: true,              // mini cámara con la mano dibujada en la barra de abajo
  camaraPausa: true,              // [09-nov] con la cámara encendida: si te vas, el video se pausa (y sigue al volver)
  camaraGuardian: true,
  lanzarTelefono: true,           // [09-nov] ✊ agarrar la página y 🖐 lanzarla → te llega al teléfono
  memoriaNavegador: true,         // [09-nov] guarda un pedacito del texto de cada página (solo en esta PC) para encontrarla después
  doblajeEnVivo: true,            // [09-nov] «Jarvis, dobla este video»: lee en voz alta los subtítulos traducidos
  buscaLoQueVes: true,            // [09-nov] «Jarvis, ¿qué es esto?» enseñándole algo a la cámara           // [09-nov] con la cámara encendida: si otra persona mira tu pantalla, la página se tapa
  carpetaClips: '',               // vacío = buscar en Vídeos              // escuchar «Jarvis…» sin tocar el micrófono (se enciende en Configuración)               // al abrir un juego: pestañas de fondo dormidas y prioridad baja [04-nov]
  permisos: {},                   // { "sitio.com": { media: true, geolocation: false } }
  emergentesPermitidas: {},       // { "sitio.com": true }
};

const BUSCADORES = {
  google: { nombre: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { nombre: 'DuckDuckGo (privado)', url: 'https://duckduckgo.com/?q=' },
  bing: { nombre: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { nombre: 'Brave Search (privado)', url: 'https://search.brave.com/search?q=' },
};

// Anuncios y rastreadores más comunes (se bloquea el dominio y todos sus subdominios)
const BLOQUEO = new Set([
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com', 'googletagmanager.com',
  'googletagservices.com', 'adservice.google.com', 'pagead2.googlesyndication.com', 'app-measurement.com',
  'connect.facebook.net', 'pixel.facebook.com', 'an.facebook.com', 'ads.linkedin.com', 'px.ads.linkedin.com', 'analytics.twitter.com',
  'ads-twitter.com', 'static.ads-twitter.com', 'ads.tiktok.com', 'analytics.tiktok.com', 'business-api.tiktok.com',
  'scorecardresearch.com', 'quantserve.com', 'quantcount.com', 'chartbeat.com', 'chartbeat.net', 'hotjar.com', 'hotjar.io',
  'mouseflow.com', 'fullstory.com', 'crazyegg.com', 'clarity.ms', 'mixpanel.com', 'segment.io', 'segment.com', 'amplitude.com',
  'heapanalytics.com', 'newrelic.com', 'nr-data.net', 'optimizely.com', 'kissmetrics.com', 'statcounter.com', 'yandex.ru/metrika',
  'mc.yandex.ru', 'adnxs.com', 'adsrvr.org', 'advertising.com', 'adform.net', 'adroll.com', 'amazon-adsystem.com',
  'criteo.com', 'criteo.net', 'casalemedia.com', 'contextweb.com', 'openx.net', 'pubmatic.com', 'rubiconproject.com',
  'smartadserver.com', 'taboola.com', 'outbrain.com', 'revcontent.com', 'mgid.com', 'zedo.com', 'yieldmo.com', 'teads.tv',
  'sharethrough.com', 'media.net', 'bidswitch.net', 'lijit.com', 'sovrn.com', 'indexww.com', 'spotxchange.com', 'spotx.tv',
  'moatads.com', 'doubleverify.com', 'adsafeprotected.com', 'serving-sys.com', 'eyeota.net', 'bluekai.com', 'krxd.net',
  'demdex.net', 'omtrdc.net', 'everesttech.net', 'agkn.com', 'rlcdn.com', 'tapad.com', 'mathtag.com', 'turn.com',
  'exelator.com', 'crwdcntrl.net', 'adsymptotic.com', 'zemanta.com', 'popads.net', 'popcash.net', 'propellerads.com',
  'exoclick.com', 'juicyads.com', 'trafficjunky.net', 'adcash.com', 'hilltopads.net', 'onclickads.net', 'adsterra.com',
  'bat.bing.com', 'snap.licdn.com', 'tr.snapchat.com', 'sc-static.net', 'ct.pinterest.com', 'trk.pinterest.com',
  'branch.io', 'appsflyer.com', 'adjust.com', 'kochava.com', 'onesignal.com', 'pushcrew.com', 'pushwoosh.com',
  'imasdk.googleapis.com', 'pagead2.googleadservices.com', 'stats.g.doubleclick.net', 'ad.doubleclick.net',
]);

function leerConfig() {
  try { return { ...PREDETERMINADA, ...JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) }; } catch { return { ...PREDETERMINADA }; }
}
function guardarConfig(c) {
  fs.mkdirSync(CONF, { recursive: true });
  fs.writeFileSync(ARCHIVO, JSON.stringify(c, null, 1), { mode: 0o600 });
}
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function bloqueado(h) {
  if (!h) return false;
  const partes = h.split('.');
  for (let i = 0; i < partes.length - 1; i++) if (BLOQUEO.has(partes.slice(i).join('.'))) return true;
  return false;
}
const esLocal = (h) => !h || h === 'localhost' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith('.local') || h.endsWith('.localhost');
function buscar(cfg, q) { return (BUSCADORES[cfg.buscador] || BUSCADORES.google).url + encodeURIComponent(q); }
function emergentePermitida(cfg, url) { return Boolean(cfg.emergentesPermitidas[host(url)]); }

// ── historial ──
const historial = (() => {
  let lista = [];
  try { lista = JSON.parse(fs.readFileSync(HISTORIAL, 'utf8')); } catch { /* vacío */ }
  let espera = null;
  const guardar = () => { clearTimeout(espera); espera = setTimeout(() => { try { fs.mkdirSync(CONF, { recursive: true }); fs.writeFileSync(HISTORIAL, JSON.stringify(lista), { mode: 0o600 }); } catch { /* nada */ } }, 1500); };
  return {
    anotar(url, titulo) {
      if (!/^https?:/.test(url)) return;
      const ult = lista[lista.length - 1];
      if (ult && ult.url === url && Date.now() - ult.t < 30000) return;
      lista.push({ url, titulo: titulo || '', t: Date.now() });
      if (lista.length > 3000) lista = lista.slice(-3000);
      guardar();
    },
    importar(traidos) {   // historial traído de Chrome/Edge/Brave [04-nov]: se mezcla por fecha, sin repetir
      const ya = new Set(lista.map((x) => x.url));
      const nuevos = (traidos || []).filter((x) => /^https?:/.test(x.url) && !ya.has(x.url)).map((x) => ({ url: x.url, titulo: x.titulo || '', t: x.t }));
      lista = [...lista, ...nuevos].sort((a, b) => a.t - b.t).slice(-3000);
      guardar();
      return nuevos.length;
    },
    titulo(url, titulo) {
      for (let i = lista.length - 1; i >= Math.max(0, lista.length - 5); i--) if (lista[i].url === url) { lista[i].titulo = titulo; guardar(); return; }
    },
    buscar(q = '', max = 300) {
      const n = String(q).toLowerCase();
      return lista.filter((x) => !n || x.url.toLowerCase().includes(n) || (x.titulo || '').toLowerCase().includes(n)).slice(-max).reverse();
    },
    quitar(t) { lista = lista.filter((x) => x.t !== t); guardar(); },
    borrar(desde = 0) { lista = desde ? lista.filter((x) => x.t < desde) : []; guardar(); },
  };
})();

// ── protección de una sesión (normal o privada) ──
const httpPermitido = new Set();   // sitios sin HTTPS que el usuario decidió abrir igual (solo esta vez)
let bloqueados = 0;
function aplicar(ses, obtenerCfg, preguntarPermiso, filtroExtra, observar) {
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    const cfg = obtenerCfg();
    const h = host(d.url);
    const ver = (b) => { if (observar && d.webContentsId) { try { observar(d.webContentsId, d.url, b); } catch { /* */ } } };   // escáner de amenazas [04-nov]
    if (cfg.bloquearRastreadores && d.resourceType !== 'mainFrame' && bloqueado(h)) { bloqueados++; ver('rastreador'); return cb({ cancel: true }); }
    if (cfg.soloHttps && d.resourceType === 'mainFrame' && d.url.startsWith('http://') && !esLocal(h) && !httpPermitido.has(h)) {
      return cb({ redirectURL: 'https://' + d.url.slice(7) });
    }
    if (cfg.bloquearAnuncios && filtroExtra && !esLocal(h) && filtroExtra(d, (r) => { ver(r && (r.cancel || r.redirectURL) ? 'anuncio' : ''); cb(r); })) return;   // bloqueador completo de anuncios [28-oct]
    ver('');
    cb({});
  });
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    const cfg = obtenerCfg();
    if (cfg.noRastrear) { d.requestHeaders.DNT = '1'; d.requestHeaders['Sec-GPC'] = '1'; }
    cb({ requestHeaders: d.requestHeaders });
  });
  const SIEMPRE = ['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'window-management'];
  const PREGUNTAR = ['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'clipboard-read', 'display-capture', 'hid', 'serial', 'usb'];
  ses.setPermissionRequestHandler((wc, permiso, cb, detalles) => {
    if (SIEMPRE.includes(permiso)) return cb(true);
    const cfg = obtenerCfg();
    const h = host((detalles && detalles.requestingUrl) || wc.getURL());
    const guardado = cfg.permisos[h] && cfg.permisos[h][permiso];
    if (guardado !== undefined) return cb(Boolean(guardado));
    if (!PREGUNTAR.includes(permiso) || !cfg.preguntarPermisos) return cb(false);
    preguntarPermiso({ host: h, permiso, tipos: (detalles && detalles.mediaTypes) || [] }, cb);
  });
  ses.setPermissionCheckHandler((_wc, permiso, origen) => {
    if (SIEMPRE.includes(permiso)) return true;
    const cfg = obtenerCfg();
    const p = cfg.permisos[host(origen)];
    return Boolean(p && p[permiso]);
  });
}

module.exports = { leerConfig, guardarConfig, PREDETERMINADA, BUSCADORES, host, bloqueado, esLocal, buscar, emergentePermitida,
  historial, aplicar, httpPermitido, bloqueados: () => bloqueados };
