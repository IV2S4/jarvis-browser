'use strict';
// tema de colores [04-nov]: se lee de las variables CSS --c1 / --c2
const TEMA = { c1: '56,214,255', c2: '127,233,255' };
function leerTema() { const cs = getComputedStyle(document.documentElement); TEMA.c1 = cs.getPropertyValue('--c1').trim().replace(/\s/g, '') || TEMA.c1; TEMA.c2 = cs.getPropertyValue('--c2').trim().replace(/\s/g, '') || TEMA.c2; }
function ponerTema(t) { const v = t && t !== 'cian' ? t : ''; if ((document.documentElement.dataset.tema || '') === v) return; if (v) document.documentElement.dataset.tema = v; else delete document.documentElement.dataset.tema; leerTema(); }
// Interfaz del Navegador JARVIS (la página la pinta main.js en una vista aparte)
const $ = (id) => document.getElementById(id);
const H = (accion, d) => window.nav.hacer(accion, d);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let E = { pestanas: [], activa: null, favoritos: [] };
let escribiendo = false;

function host(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'file:') return 'INICIO JARVIS';
    return x.hostname.replace(/^www\./, '') || u;
  } catch { return u || ''; }
}
function bonita(u) {
  if (!u || u === E.inicio || u.startsWith('file:') || u === 'about:blank') return '';
  return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function pintar(e) {
  if (E.activa != null && e.activa !== E.activa) sonido('pestana');
  E = e; ponerTema(e.tema);
  if ($('act-chip')) { $('act-chip').hidden = !e.actualizacion; $('act-ver').textContent = e.actualizacion ? 'v' + e.actualizacion : ''; }
  if ($('doc-barra')) { $('doc-barra').hidden = !e.documento; $('c-doc').hidden = e.documento === undefined; }
  document.body.classList.toggle('cargando', e.cargando);
  document.body.classList.toggle('panel', e.panel);
  $('panel').hidden = !e.panel;
  // pestañas
  const nav = $('pestanas');
  nav.innerHTML = e.pestanas.map((p) => `<div class="pest${p.id === e.activa ? ' activa' : ''}${p.privada ? ' privada' : ''}${p.lado ? ' lado-' + p.lado : ''}${p.dormida ? ' dormida' : ''}" data-id="${p.id}" title="${esc(p.titulo)}${p.privada ? ' · privada' : ''}">
      ${p.cargando ? '<i class="giro"></i>' : (p.icono ? `<img src="${esc(p.icono)}" alt="" />` : '<i class="sin-icono"></i>')}
      <span class="t">${p.privada ? '🕶 ' : ''}${p.dormida ? '💤 ' : ''}${esc(p.url.startsWith('file:') ? (p.privada ? 'Pestaña privada' : 'Inicio') : p.titulo)}</span>${p.sonido ? '<span class="son">♪</span>' : ''}
      <span class="x" data-cerrar="${p.id}" title="Cerrar (Ctrl+W)">×</span></div>`).join('');
  nav.querySelectorAll('img').forEach((im) => im.addEventListener('error', () => { im.outerHTML = '<i class="sin-icono"></i>'; }));
  // barra
  if (!escribiendo) $('direccion').value = bonita(e.url);
  $('b-atras').disabled = !e.atras; $('b-adelante').disabled = !e.adelante;
  const s = $('seguro');
  if (!e.url || e.url.startsWith('file:')) { s.textContent = 'JARVIS'; s.className = 'seguro local'; }
  else if (e.url.startsWith('https:')) { s.textContent = 'SEGURO'; s.className = 'seguro'; }
  else { s.textContent = 'NO SEGURO'; s.className = 'seguro no'; }
  $('zoom').hidden = e.zoom === 100; $('zoom').textContent = `${e.zoom}%`;
  $('b-fav').classList.toggle('si', e.favorito);
  $('b-dividir').classList.toggle('si', Boolean(e.dividida));
  document.body.classList.toggle('dividida', Boolean(e.dividida));
  document.body.classList.toggle('verticales', Boolean(e.verticales));
  const g = $('gaming'); g.hidden = !e.gaming;
  if (e.gaming) g.textContent = e.gaming.liberado ? `MODO GAMING · ${e.gaming.juego} · ${e.gaming.liberado} MB LIBERADOS` : `MODO GAMING · ${e.gaming.juego}`;
  // estado
  $('e-host').textContent = e.cargando ? `CARGANDO ${host(e.url)}…` : (host(e.url) || 'EN LÍNEA');
  $('e-pest').textContent = `${e.pestanas.length} ${e.pestanas.length === 1 ? 'PESTAÑA' : 'PESTAÑAS'}`;
  $('e-zoom').textContent = `${e.zoom}%`;
  $('p-pagina').textContent = e.titulo && !e.url.startsWith('file:') ? e.titulo : 'Lee y entiende esta página por ti';
  pintarFavs();
  const nombre = (document.documentElement.lang || 'es').startsWith('es') ? 'Navegador JARVIS' : 'JARVIS Browser';
  document.title = e.titulo ? `${e.titulo} — ${nombre}` : nombre;
}
function pintarFavs() {
  $('p-favs').innerHTML = (E.favoritos || []).map((f) => `<div class="fav" data-url="${esc(f.url)}"><img src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(host(f.url))}" alt="" />
      <span>${esc(f.titulo)}<small>${esc(bonita(f.url))}</small></span></div>`).join('')
    || '<div class="vacio">Sin favoritos. Toca la ★ en la barra (o Ctrl+D) para guardar una página.</div>';
}

// ── eventos de la interfaz ──
$('pestanas').addEventListener('mousedown', (ev) => {
  const x = ev.target.closest('[data-cerrar]');
  const p = ev.target.closest('.pest');
  if (!p) return;
  if (x || ev.button === 1) { ev.preventDefault(); H('cerrar', Number(p.dataset.id)); return; }
  H('activar', Number(p.dataset.id));
});
$('pestanas').addEventListener('dblclick', (ev) => { if (!ev.target.closest('.pest')) H('nueva'); });
$('mas').addEventListener('click', () => H('nueva'));
$('privada').addEventListener('click', () => H('privada'));
$('b-config').addEventListener('click', () => H('ajustes'));
document.querySelectorAll('#ventana button').forEach((b) => b.addEventListener('click', () => H(b.dataset.v)));
document.querySelector('.arrastre').addEventListener('dblclick', () => H('max'));
$('b-atras').addEventListener('click', () => H('atras'));
$('b-adelante').addEventListener('click', () => H('adelante'));
$('b-recargar').addEventListener('click', () => H('recargar'));
$('b-inicio').addEventListener('click', () => H('inicio'));
$('b-fav').addEventListener('click', () => H('favorito'));
$('b-dividir').addEventListener('click', () => H('dividir'));
$('b-pip').addEventListener('click', async () => {
  const r = await H('pip');
  if (r && !r.ok && r.error) { H('panel', true); pestPanel('jarvis'); msg2('j', r.error); }
});
$('b-jarvis').addEventListener('click', () => H('panel', !E.panel));
$('b-descargas').addEventListener('click', () => { H('panel', true); pestPanel('desc'); });
$('omni').addEventListener('submit', (ev) => {
  ev.preventDefault(); escribiendo = false;
  const s = sugs[sugSel]; H('ir', s ? s.url : $('direccion').value); cerrarSugs(); $('direccion').blur();
});
// historial en la barra: al escribir salen lo que ya buscaste y las páginas que visitaste [28-oct]
let sugs = []; let sugSel = -1; let sugT = null;
function cerrarSugs() { sugs = []; sugSel = -1; $('sugerencias').hidden = true; $('sugerencias').innerHTML = ''; H('tapar', false); }
function pintarSugs() {
  const caja = $('sugerencias');
  if (!sugs.length) { cerrarSugs(); return; }
  caja.innerHTML = sugs.map((s, i) => `<div class="sug${i === sugSel ? ' sel' : ''}" data-i="${i}">
      ${s.tipo === 'busqueda' ? '<i class="ico-b">⌕</i>' : `<img src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(host(s.url))}" alt="" />`}
      <span class="t">${esc(s.titulo || bonita(s.url))}${s.fav ? ' <b>★</b>' : ''}</span>
      <small>${s.tipo === 'busqueda' ? 'Búsqueda anterior' : esc(bonita(s.url))}</small></div>`).join('');
  caja.querySelectorAll('img').forEach((im) => im.addEventListener('error', () => { im.style.visibility = 'hidden'; }));
  const r = $('omni').getBoundingClientRect();
  caja.style.left = r.left + 'px'; caja.style.width = r.width + 'px'; caja.style.top = (r.bottom + 6) + 'px';
  caja.hidden = false; H('tapar', true);
}
$('direccion').addEventListener('input', () => {
  clearTimeout(sugT);
  sugT = setTimeout(async () => { sugs = await H('sugerencias', $('direccion').value) || []; sugSel = -1; pintarSugs(); }, 90);
});
$('sugerencias').addEventListener('mousedown', (ev) => {
  const d = ev.target.closest('.sug'); if (!d) return;
  ev.preventDefault(); const s = sugs[Number(d.dataset.i)]; escribiendo = false; cerrarSugs(); H('ir', s.url); $('direccion').blur();
});
$('direccion').addEventListener('focus', () => { escribiendo = true; $('direccion').value = E.url && !E.url.startsWith('file:') ? E.url : ''; setTimeout(() => $('direccion').select(), 0); });
$('direccion').addEventListener('blur', () => { escribiendo = false; $('direccion').value = bonita(E.url); cerrarSugs(); });
$('direccion').addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { if (sugs.length) cerrarSugs(); else $('direccion').blur(); }
  else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && sugs.length) {
    ev.preventDefault();
    const n = sugs.length;
    if (ev.key === 'ArrowDown') sugSel = sugSel + 1 >= n ? -1 : sugSel + 1;
    else sugSel = sugSel - 1 < -1 ? n - 1 : sugSel - 1;
    pintarSugs();
  }
});
$('p-favs').addEventListener('click', (ev) => { const f = ev.target.closest('.fav'); if (f) H('ir', f.dataset.url); });
$('abrir-desc').addEventListener('click', () => H('carpeta-descargas'));

// buscar en la página
function abrirBuscar() { $('buscar-en').hidden = false; $('buscar-texto').focus(); $('buscar-texto').select(); }
$('buscar-texto').addEventListener('input', (ev) => H('buscar-en', ev.target.value));
$('buscar-texto').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') H('buscar-en', ev.target.value); if (ev.key === 'Escape') cerrarBuscar(); });
function cerrarBuscar() { $('buscar-en').hidden = true; $('buscar-n').textContent = ''; H('buscar-en', ''); }
$('buscar-cerrar').addEventListener('click', cerrarBuscar);

// panel
function pestPanel(cual) {
  document.querySelectorAll('.p-tabs button').forEach((b) => b.classList.toggle('activo', b.dataset.p === cual));
  for (const c of ['jarvis', 'chat', 'favs', 'desc', 'escaner']) $(`p-${c}`).hidden = c !== cual;
  if (cual === 'escaner') { $('p-escaner').scrollTop = 0; pintarMapa(); } else pararMapa();
}
document.querySelectorAll('.p-tabs button').forEach((b) => b.addEventListener('click', () => pestPanel(b.dataset.p)));
function msg(clase, texto) {
  const d = document.createElement('div'); d.className = `msg ${clase}`; d.textContent = texto;
  $('charla').appendChild(d); $('charla').scrollTop = $('charla').scrollHeight; return d;
}
async function preguntar(q) {
  if (!q.trim()) return;
  pestPanel('chat');
  msg('u', q);
  const espera = msg('j pensando', 'Leyendo la página');
  $('panel').classList.add('pensando');
  const r = await H('preguntar', q);
  $('panel').classList.remove('pensando');
  espera.classList.remove('pensando');
  espera.textContent = (r && r.respuesta) || 'No pude responder ahora.';
  $('charla').scrollTop = $('charla').scrollHeight;
}
document.querySelectorAll('.rapidos [data-q]').forEach((b) => b.addEventListener('click', () => preguntar(b.dataset.q)));
async function resumirAqui(enChat) {   // resumen de la página o del video de YouTube [28-oct]
  if (enChat) { H('panel', true); pestPanel('jarvis'); msg2('u', 'Resume esta página'); } else { pestPanel('chat'); msg('u', 'Resume esta página'); }
  const espera = enChat ? msg2('j pensando', 'Resumiendo') : msg('j pensando', 'Resumiendo');
  $('panel').classList.add('pensando');
  const r = await H('resumir');
  $('panel').classList.remove('pensando'); espera.classList.remove('pensando');
  espera.textContent = (r && r.respuesta) || 'No pude resumirla ahora.';
  if (r && r.ok && r.respuesta) decirEnCola(r.respuesta);
}
$('p-resumir').addEventListener('click', () => resumirAqui(false));
$('p-traducir').addEventListener('click', () => H('traducir'));
$('c-resumir').addEventListener('click', () => resumirAqui(true));
$('c-traducir').addEventListener('click', () => H('traducir'));
$('c-ves').addEventListener('click', () => { callarCola(); H('recorrer'); });
$('c-nuevo').addEventListener('click', () => { callarCola(); H('chat-parar'); H('chat-nuevo'); $('charla2').innerHTML = ''; msg2('j', 'Listo, señor: chat nuevo. ¿En qué le ayudo?'); });
// traducción de la página: el avance abajo en la barra
let tradT = null;
window.nav.en('traduccion', (ev) => {
  const e = $('traduciendo'); clearTimeout(tradT); e.hidden = false;
  if (ev.tipo === 'inicio') e.textContent = 'TRADUCIENDO…';
  else if (ev.tipo === 'progreso') e.textContent = `TRADUCIENDO ${ev.n}/${ev.total}`;
  else if (ev.tipo === 'fin') { e.textContent = 'PÁGINA TRADUCIDA · F5 = ORIGINAL'; tradT = setTimeout(() => { e.hidden = true; }, 6000); }
  else if (ev.tipo === 'error') { e.hidden = true; H('panel', true); pestPanel('jarvis'); msg2('j', ev.texto || 'No pude traducir la página.'); }
});
$('p-voz').addEventListener('click', () => H('leer-pagina'));
$('p-ves').addEventListener('click', () => { pestPanel('jarvis'); H('recorrer'); });
$('p-foto').addEventListener('click', () => H('foto-pagina'));
// vigilante: JARVIS revisa la página cada hora y te avisa si baja el precio o hay algo nuevo [04-nov]
function vigilado(r) {
  H('panel', true); pestPanel('jarvis');
  if (!r || !r.ok) { msg2('j', (r && r.error) || 'No pude vigilar esta página.'); return; }
  msg2('j', r.tipo === 'precio' ? `Vigilando «${r.titulo}»: ahora cuesta ${r.moneda || '$'}${r.precio}. Te aviso si baja.` : `Vigilando «${r.titulo}»: te aviso si hay algo nuevo.`);
}
$('p-vigilar').addEventListener('click', async () => vigilado(await H('vigilar', { tipo: 'precio' })));
$('p-vigilar2').addEventListener('click', async () => vigilado(await H('vigilar', { tipo: 'cambios' })));
window.nav.en('vigilado', vigilado);
// teléfono y subtítulos [04-nov]
function resultadoTelefono(r) {
  H('panel', true); pestPanel('jarvis');
  if (r && r.ok) msg2('j', r.tipo === 'captura' ? 'Listo, señor: le mandé la foto de la página a su teléfono.' : 'Listo, señor: se lo mandé a su teléfono.');
  else { const m = msg2('j', (r && r.error) || 'No pude mandarlo.'); if (r && r.configurar) { const b = document.createElement('button'); b.className = 'abrir-alerta'; b.textContent = 'Conectar mi teléfono'; b.addEventListener('click', () => H('ajustes', 'telefono')); m.appendChild(b); } }
}
$('p-telefono').addEventListener('click', async () => resultadoTelefono(await H('telefono', { tipo: 'pagina' })));
$('c-telefono').addEventListener('click', async () => resultadoTelefono(await H('telefono', { tipo: 'pagina' })));
window.nav.en('telefono', resultadoTelefono);
let subtOn = false;
$('p-subtitulos').addEventListener('click', async () => {
  subtOn = !subtOn;
  const r = await H('subtitulos', subtOn);
  H('panel', true); pestPanel('jarvis');
  if (!r || !r.ok) { subtOn = false; msg2('j', (r && r.error) || 'No pude poner los subtítulos.'); return; }
  msg2('j', r.estado === 'apagado' ? 'Subtítulos apagados.' : r.estado === 'traducido' ? 'Listo: subtítulos traducidos en vivo.' : 'Listo: subtítulos puestos (el video ya está en su idioma).');
});

// ── Voz siempre activa: el «oído» reconoce «Jarvis» dentro de la PC (Vosk) y entonces graba la orden [04-nov] ──
let oido = null; let despertado = 0;
function estadoOido(t) { const e = $('oido'); e.hidden = !t; e.textContent = t || ''; document.body.classList.toggle('oyendo', /ACTIVO/.test(t || '')); }
const hablandoAhora = () => hablandoCola || Boolean(audioActual) || (window.speechSynthesis && speechSynthesis.speaking);
function pitido() { try { const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.12, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.2); setTimeout(() => c.close(), 400); } catch { /* */ } }
function despierta() {
  if (grabando || Date.now() - despertado < 3000) return;
  despertado = Date.now(); pitido();
  H('panel', true); pestPanel('jarvis'); callarCola();
  $('p-mic').click();   // graba lo que dices después de «Jarvis» y se lo pasa a JARVIS
}
function cargarScript(src) { return new Promise((ok, mal) => { if (window.Vosk) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('no cargó ' + src)); document.head.appendChild(s); }); }
async function encenderOido() {
  if (oido) return;
  const yo = {}; oido = yo;
  estadoOido('PREPARANDO OÍDO…');
  const r = await H('voz-modelo');
  if (oido !== yo) return;
  if (!r || !r.ok) { oido = null; estadoOido(''); H('panel', true); pestPanel('jarvis'); msg2('j', (r && r.error) || 'No pude preparar la voz siempre activa.'); return; }
  try {
    await cargarScript('../node_modules/vosk-browser/dist/vosk.js');
    const model = await Promise.race([window.Vosk.createModel(r.url), new Promise((_ok, mal) => setTimeout(() => mal(new Error('el modelo de voz no cargó en 60 s')), 60000))]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    const ctx = new AudioContext();
    const rec = new model.KaldiRecognizer(ctx.sampleRate, JSON.stringify(['jarvis', 'hey jarvis', '[unk]']));
    const oye = (t) => { if (/\bjarvis\b/i.test(t || '')) despierta(); };
    rec.on('partialresult', (m) => oye(m.result && m.result.partial));
    rec.on('result', (m) => oye(m.result && m.result.text));
    const fuente = ctx.createMediaStreamSource(stream); const nodo = ctx.createScriptProcessor(4096, 1, 1);
    nodo.onaudioprocess = (e) => { if (!grabando && !hablandoAhora()) { try { rec.acceptWaveform(e.inputBuffer); } catch { /* */ } } };
    fuente.connect(nodo); nodo.connect(ctx.destination);
    Object.assign(yo, { model, stream, ctx, rec, fuente, nodo, listo: true });
    if (oido !== yo) { apagarOido(yo); return; }
    estadoOido('OÍDO ACTIVO · DI «JARVIS»');
  } catch (e) { apagarOido(yo); oido = null; estadoOido(''); H('panel', true); pestPanel('jarvis'); msg2('j', 'No pude encender la voz siempre activa: ' + (e.message || e)); }
}
function apagarOido(o = oido) {
  if (o === oido) { oido = null; estadoOido(''); }
  if (!o || !o.listo) return;
  try { o.nodo.disconnect(); o.fuente.disconnect(); } catch { /* */ }
  try { o.stream.getTracks().forEach((t) => t.stop()); } catch { /* */ }
  try { o.ctx.close(); } catch { /* */ }
  try { o.rec.remove(); } catch { /* */ }
  try { o.model.terminate(); } catch { /* */ }
}
window.nav.en('oido', (on) => (on ? encenderOido() : apagarOido()));
window.nav.en('oido-estado', (e) => { if (e.tipo === 'bajando') estadoOido(`BAJANDO MODELO DE VOZ ${e.pct}%`); });
H('oido').then((on) => { if (on) encenderOido(); });
window.nav.en('vigilante', ({ texto, url }) => {
  H('panel', true); pestPanel('jarvis');
  const m = msg2('j alerta', texto);
  const b = document.createElement('button'); b.className = 'abrir-alerta'; b.textContent = 'Abrir página'; b.addEventListener('click', () => H('nueva', url));
  m.appendChild(b); $('charla2').scrollTop = $('charla2').scrollHeight;
  decirEnCola(texto);
});
async function describir() {
  pestPanel('chat'); msg('u', '¿Qué ves en esta página?');
  const espera = msg('j pensando', 'Mirando la página'); $('panel').classList.add('pensando');
  const r = await H('describir');
  $('panel').classList.remove('pensando'); espera.classList.remove('pensando');
  espera.textContent = (r && r.respuesta) || 'No pude ver la página ahora.';
}

// ── lectura en voz alta: trozos cortos, el siguiente se prepara mientras suena el actual ──
let lectura = 0;
let audioActual = null;
function trozos(texto) {
  const frases = texto.replace(/\s+\n/g, '\n').split(/(?<=[.!?…:;])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
  const out = []; let t = '';
  for (const f of frases) { if ((t + ' ' + f).length > 260 && t) { out.push(t); t = f; } else t = t ? `${t} ${f}` : f; }
  if (t) out.push(t);
  return out;
}
function parar() { lectura++; if (audioActual) { try { audioActual.pause(); } catch { /* nada */ } audioActual = null; } try { speechSynthesis.cancel(); } catch { /* */ } $('leyendo').hidden = true; H('leyendo', false); }
// sin internet ni JARVIS: la voz del propio Windows [28-oct]
function vozSistema(texto) {
  return new Promise((fin) => {
    try {
      const u = new SpeechSynthesisUtterance(texto);
      const lang = (document.documentElement.lang || 'en').slice(0, 2);
      const voces = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
      const pref = { en: /george|ryan|thomas|guy|david/i, es: /pablo|jorge|raul|alvaro/i, pt: /daniel|antonio/i, fr: /paul|henri/i, de: /stefan|conrad/i, it: /cosimo|diego/i }[lang] || /male/i;
      const v = voces.find((x) => pref.test(x.name)) || voces[0];
      if (v) u.voice = v; u.lang = v ? v.lang : lang;
      u.onend = fin; u.onerror = fin; speechSynthesis.speak(u);
    } catch { fin(); }
  });
}
async function sonar(bytes, texto, guardar) {
  if (!bytes) return vozSistema(texto);
  const wav = bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70;   // «RIFF»: voz de Gemini
  const url = URL.createObjectURL(new Blob([bytes], { type: wav ? 'audio/wav' : 'audio/mpeg' }));
  await new Promise((fin) => { const a = new Audio(url); guardar(a); orbeSigue(a); a.onended = fin; a.onerror = fin; a.play().catch(fin); });
  URL.revokeObjectURL(url); nivelVoz(0);
}
async function leer({ texto, desde }) {
  parar(); const yo = ++lectura;
  $('leyendo').hidden = false; $('leyendo-desde').textContent = desde ? `«${desde}»` : '';
  H('leyendo', true);
  const partes = trozos(texto);
  let siguiente = partes.length ? H('tts', partes[0]) : null;
  for (let i = 0; i < partes.length && yo === lectura; i++) {
    const bytes = await siguiente;
    siguiente = i + 1 < partes.length ? H('tts', partes[i + 1]) : null;
    if (yo !== lectura) break;
    await sonar(bytes, partes[i], (a) => { audioActual = a; });
  }
  if (yo === lectura) parar();
}
$('leyendo').addEventListener('click', parar);
window.nav.en('leer', leer);
window.nav.en('callar', parar);
window.nav.en('respuesta', ({ texto, pregunta, voz }) => {
  pestPanel('chat'); if (pregunta) msg('u', pregunta);
  msg('j', texto); if (voz) leer({ texto, desde: '' });
});
window.nav.en('foto', ({ ruta, nombre }) => {
  H('panel', true); pestPanel('chat');
  const m = msg('j', `📸 Guardé la foto${nombre ? ` de «${nombre}»` : ''} en Imágenes › JARVIS.`);
  const im = document.createElement('img'); im.src = 'file://' + ruta.replace(/\\/g, '/'); im.title = 'Abrir'; im.addEventListener('click', () => H('abrir-foto', ruta));
  m.appendChild(im); $('charla').scrollTop = $('charla').scrollHeight;
});
$('p-form').addEventListener('submit', (ev) => { ev.preventDefault(); const q = $('p-q').value; $('p-q').value = ''; preguntar(q); });

// descargas
const descs = new Map();
function pintarDescargas() {
  const lista = [...descs.values()].reverse();
  $('descargas').innerHTML = lista.map((d) => {
    const pct = d.total ? Math.round(d.recibido * 100 / d.total) : 0;
    const acc = d.estado === 'listo' ? (d.instalable ? `<button class="inst" data-inst="${esc(d.ruta)}">Instalar</button>` : `<button data-abrir="${esc(d.ruta)}">Abrir</button>`)
      : d.estado === 'fallo' ? '<small>Falló</small>' : `<small>${pct}%</small>`;
    return `<div class="desc"><span>${esc(d.nombre)}<small>${d.estado === 'listo' ? 'Listo · en Descargas' : d.estado === 'fallo' ? 'No se pudo descargar' : 'Descargando…'}</small>
      ${d.estado === 'bajando' ? `<div class="barra-d"><i style="width:${pct}%"></i></div>` : ''}${d.estado === 'listo' && d.programa ? '<small class="aviso-prog">⚠ Es un programa: ábrelo solo si confías en la página.</small>' : ''}</span>${acc}</div>`;
  }).join('') || '<div class="vacio">Sin descargas todavía.</div>';
  const bajando = lista.filter((d) => d.estado === 'bajando').length;
  $('b-descargas').classList.toggle('bajando', bajando > 0);
  $('desc-n').hidden = !bajando; $('desc-n').textContent = bajando;
}
$('descargas').addEventListener('click', (ev) => {
  const i = ev.target.closest('[data-inst]'); const a = ev.target.closest('[data-abrir]');
  if (i) H('instalar', i.dataset.inst); if (a) H('abrir-descarga', a.dataset.abrir);
});

// ── avisos de main.js ──
window.nav.en('estado', pintar);
window.nav.en('foco-direccion', () => $('direccion').focus());
window.nav.en('foco-buscar', abrirBuscar);
window.nav.en('encontrado', (r) => { $('buscar-n').textContent = r.total ? `${r.actual}/${r.total}` : '0/0'; });
window.nav.en('completa', (on) => document.body.classList.toggle('completa', on));
window.nav.en('preguntar', (q) => { pestPanel('chat'); preguntar(q); });
window.nav.en('descarga', (d) => {
  const nuevo = !descs.has(d.id); descs.set(d.id, d); pintarDescargas();
  if (nuevo || (d.estado === 'listo' && (d.programa || d.instalable))) { H('panel', true); pestPanel('desc'); }
});
const NOMBRES = { abrir: 'ABRIENDO', buscar: 'BUSCANDO', clic: 'HACIENDO CLIC', escribir: 'ESCRIBIENDO', desplazar: 'DESPLAZANDO', pestana: 'PESTAÑAS',
  atras: 'ATRÁS', adelante: 'ADELANTE', ajustes: 'CONFIGURACIÓN', privada: 'PESTAÑA PRIVADA', recargar: 'RECARGANDO', ver: 'ANALIZANDO PÁGINA', zoom: 'ZOOM', panel: 'ASISTENTE', tecla: 'TECLADO' };
let mandoT = null;
window.nav.en('control', (acc) => {
  document.body.classList.add('mando'); $('mando-acc').textContent = NOMBRES[acc] || String(acc).toUpperCase();
  clearTimeout(mandoT); mandoT = setTimeout(() => document.body.classList.remove('mando'), 2600);
});

// reloj HUD
function reloj() { const d = new Date(); $('e-hora').textContent = d.toLocaleTimeString(((document.documentElement.lang || 'es').startsWith('es') ? 'es-PR' : document.documentElement.lang), { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
setInterval(reloj, 1000); reloj();
H('estado').then(pintar);

// ── barra de avisos (permisos que piden las páginas, ventanas emergentes bloqueadas) ──
const avisos = [];
const PERMISOS = { media: 'usar tu cámara o micrófono', geolocation: 'saber tu ubicación', notifications: 'enviarte notificaciones', midi: 'usar instrumentos MIDI',
  'clipboard-read': 'leer lo que copiaste', 'display-capture': 'grabar tu pantalla', hid: 'usar un dispositivo USB', serial: 'usar un puerto serie', usb: 'usar un dispositivo USB' };
function mostrarAviso() {
  const a = avisos[0];
  document.body.classList.toggle('infobar', Boolean(a)); $('infobar').hidden = !a; H('barra-aviso', Boolean(a));
  if (!a) return;
  $('infobar').className = a.tipo === 'emergente' || a.tipo === 'precio' ? 'info' : a.tipo === 'amenaza' || a.tipo === 'estafa' ? 'peligro' : '';
  $('ib-ico').textContent = a.tipo === 'emergente' ? '🧱' : a.tipo === 'amenaza' ? '⚠' : a.tipo === 'estafa' ? '🛡' : a.tipo === 'precio' ? '💰' : '🔐';
  $('ib-texto').innerHTML = a.texto;
  $('ib-botones').innerHTML = a.botones.map((b, i) => `<button class="${b.clase || ''}" data-i="${i}">${esc(b.t)}</button>`).join('');
  $('ib-botones').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { a.botones[Number(b.dataset.i)].f(); avisos.shift(); mostrarAviso(); }));
}
window.nav.en('permiso', (p) => {
  const que = p.permiso === 'media' && p.tipos && p.tipos.length === 1 ? (p.tipos[0] === 'video' ? 'usar tu cámara' : 'usar tu micrófono') : (PERMISOS[p.permiso] || p.permiso);
  avisos.push({ id: p.id, tipo: 'permiso', texto: `<b>${esc(p.host)}</b> quiere ${esc(que)}.`,
    botones: [{ t: 'Permitir', clase: 'si', f: () => H('permiso-respuesta', { id: p.id, permitir: true, recordar: true }) },
      { t: 'Solo esta vez', f: () => H('permiso-respuesta', { id: p.id, permitir: true, recordar: false }) },
      { t: 'Bloquear', clase: 'no', f: () => H('permiso-respuesta', { id: p.id, permitir: false, recordar: true }) }] });
  mostrarAviso();
});
window.nav.en('permiso-fin', (id) => { const i = avisos.findIndex((a) => a.id === id); if (i >= 0) { avisos.splice(i, 1); mostrarAviso(); } });
// ══ Cyber HUD [04-nov] ══════════════════════════════════════════════════════════════
const enIng = () => !(document.documentElement.lang || 'es').startsWith('es');
const T = (es, en) => (enIng() ? en : es);   // textos que JARVIS también dice en voz alta
// sonidos de interfaz: sintetizados aquí mismo, muy bajitos
let ctxSonido = null;
function sonido(tipo) {
  if (!E.sonidos) return;
  try {
    ctxSonido = ctxSonido || new AudioContext();
    const c = ctxSonido; const t = c.currentTime;
    const tono = (f, ini, dur, vol = 0.035, forma = 'sine', f2) => { const o = c.createOscillator(); const g = c.createGain(); o.type = forma; o.frequency.setValueAtTime(f, t + ini); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + ini + dur);
      g.gain.setValueAtTime(0.0001, t + ini); g.gain.exponentialRampToValueAtTime(vol, t + ini + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + ini + dur); o.connect(g); g.connect(c.destination); o.start(t + ini); o.stop(t + ini + dur + 0.02); };
    if (tipo === 'pestana') tono(1500, 0, 0.05, 0.02);
    else if (tipo === 'enviar') { tono(900, 0, 0.06); tono(1350, 0.06, 0.08); }
    else if (tipo === 'escaneo') tono(500, 0, 0.35, 0.018, 'sine', 1600);
    else if (tipo === 'alerta') { tono(320, 0, 0.16, 0.06, 'square'); tono(320, 0.22, 0.16, 0.06, 'square'); }
    else if (tipo === 'clip') { tono(700, 0, 0.07); tono(1050, 0.08, 0.07); tono(1400, 0.16, 0.1); }
  } catch { /* */ }
}
// orbe: late con la voz de JARVIS y con la tuya
function nivelVoz(v) { document.body.style.setProperty('--voz', String(Math.max(0, Math.min(1, v || 0)).toFixed(3))); }
let ctxOrbe = null;
function orbeSigue(a) {
  if (!E.efectos) return;
  try {
    ctxOrbe = ctxOrbe || new AudioContext();
    const fuente = ctxOrbe.createMediaElementSource(a); const an = ctxOrbe.createAnalyser(); an.fftSize = 256;
    fuente.connect(an); an.connect(ctxOrbe.destination);
    const datos = new Uint8Array(an.frequencyBinCount);
    const paso = () => { if (a.ended || a.paused && a.currentTime > 0) { nivelVoz(0); return; } an.getByteTimeDomainData(datos); let s = 0; for (const x of datos) s += ((x - 128) / 128) ** 2; nivelVoz(Math.sqrt(s / datos.length) * 4); requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  } catch { /* */ }
}
// escáner: escudo en la barra de dirección + panel «Escáner»
let escaneo = null;
const NIVEL_TXT = { get bajo() { return T('RIESGO BAJO', 'RISK LOW'); }, get medio() { return T('RIESGO MEDIO', 'RISK MEDIUM'); }, get alto() { return T('RIESGO ALTO', 'RISK HIGH'); } };
function pintarEscudo(r) {
  escaneo = r;
  const b = $('escudo'); b.hidden = !r; if (!r) return;
  b.className = 'nivel-' + r.nivel; $('escudo-n').textContent = r.rastreadores + r.anuncios;
  b.title = `${NIVEL_TXT[r.nivel]} · ${r.rastreadores + r.anuncios} ${T('bloqueados', 'blocked')}`;
  if (!$('p-escaner').hidden) pintarPanelEscaner();
}
const PISTAS_ES = { 'sin-https': 'La conexión no está cifrada (sin HTTPS).', certificado: 'El certificado de seguridad de la página tiene un error.', ip: 'La dirección es un número (IP), no un nombre: típico de estafas.',
  'letras-disfrazadas': 'El nombre usa letras disfrazadas para parecerse a otra web.', 'dominio-raro': 'Usa una terminación de dominio muy usada en estafas.', 'muchos-subdominios': 'Tiene demasiados subdominios.',
  'muchos-guiones': 'El nombre tiene muchos guiones, típico de páginas falsas.', 'password-sin-https': 'Pide contraseña sin conexión segura.', 'formulario-inseguro': 'Un formulario envía datos sin cifrar.' };
const PISTAS_EN = { 'sin-https': 'The connection is not encrypted (no HTTPS).', certificado: 'The page\'s security certificate has an error.', ip: 'The address is a number (IP), not a name: typical of scams.',
  'letras-disfrazadas': 'The name uses disguised letters to look like another site.', 'dominio-raro': 'It uses a domain ending common in scams.', 'muchos-subdominios': 'It has too many subdomains.',
  'muchos-guiones': 'The name has many hyphens, typical of fake pages.', 'password-sin-https': 'It asks for a password without a secure connection.', 'formulario-inseguro': 'A form sends data unencrypted.' };
const pista = (p) => (p.startsWith('marca:') ? T(`Usa el nombre «${p.slice(6)}» en un dominio que no es suyo.`, `It uses the name “${p.slice(6)}” on a domain that isn't theirs.`) : ((enIng() ? PISTAS_EN : PISTAS_ES)[p] || p));
function pintarPanelEscaner() {
  const r = escaneo; const t = $('esc-tarjeta');
  if (!r) { t.className = ''; $('esc-nivel').textContent = T('Sin escanear', 'Not scanned'); $('esc-host').textContent = T('Abre una página web', 'Open a web page'); ['rastreadores', 'anuncios', 'terceros'].forEach((k) => { $('esc-' + k).textContent = '0'; }); $('esc-https').textContent = '—'; $('esc-pistas').innerHTML = ''; $('esc-hosts').innerHTML = ''; return; }
  t.className = 'nivel-' + r.nivel;
  $('esc-nivel').textContent = NIVEL_TXT[r.nivel]; $('esc-host').textContent = host(r.url);
  $('esc-rastreadores').textContent = r.rastreadores; $('esc-anuncios').textContent = r.anuncios; $('esc-terceros').textContent = r.terceros;
  $('esc-https').textContent = r.https ? 'HTTPS' : 'HTTP';
  $('esc-pistas').innerHTML = (r.pistas || []).map((p) => `<div>⚠ ${esc(pista(p))}</div>`).join('');
  $('esc-hosts').innerHTML = (r.hosts || []).map((h) => `<div class="h ${h.bloqueado ? 'bloq' : h.propio ? 'propio' : ''}"><span>${esc(h.host)}</span><small>${h.bloqueado ? (h.bloqueado === 'rastreador' ? T('RASTREADOR BLOQUEADO', 'TRACKER BLOCKED') : T('ANUNCIO BLOQUEADO', 'AD BLOCKED')) : h.propio ? T('PROPIO', 'OWN') : `${h.n}×`}</small></div>`).join('');
}
window.nav.en('escaner', (r) => { const nuevo = r && (!escaneo || escaneo.url !== r.url); pintarEscudo(r); if (nuevo && E.efectos) sonido('escaneo'); });
// 🛡 tienda sospechosa [09-nov]
window.nav.en('estafa', (a) => {
  sonido('alerta');
  const alto = a.riesgo === 'alto';
  avisos.unshift({ tipo: 'estafa', host: a.host, texto: `<b>${esc(a.host)}</b> ${alto ? T('parece una ESTAFA', 'looks like a SCAM') : T('podría ser una estafa', 'might be a scam')}${a.resumen ? ': ' + esc(a.resumen) : ''}<br><small>${(a.motivos || []).map((m) => '• ' + esc(m)).join(' ')}</small>`,
    botones: [{ t: T('Salir de aquí', 'Get me out'), clase: 'si', f: () => H('atras') }, { t: T('Preguntar a JARVIS', 'Ask JARVIS'), f: () => { H('panel', true); pestPanel('chat'); chatear(T('¿Esta tienda es confiable? Revísala a fondo.', 'Is this store legit? Check it thoroughly.')); } }, { t: T('Seguir igual', 'Continue anyway'), clase: 'no', f: () => {} }] });
  decirEnCola(T(`Cuidado, señor: ${a.host} ${alto ? 'parece una estafa' : 'podría ser una estafa'}.`, `Careful, sir: ${a.host} ${alto ? 'looks like a scam' : 'might be a scam'}.`));
  mostrarAviso();
});
// 🖼 comparación de precios con foto de cada tienda, en el chat [09-nov]
window.nav.en('precio-chat', (x) => {
  const a = x.aqui; const mon = (a.moneda || 'USD') === 'USD' ? '$' : ''; const f = (n) => mon + Number(n).toFixed(2) + (mon ? '' : ' ' + a.moneda);
  const hay = a.precio > 0; const minimo = Math.min(...x.ofertas.map((o) => o.precio), hay ? a.precio : Infinity);
  const d = document.createElement('div'); d.className = 'msg j precios';
  const logo = (web) => `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(web || '')}`;
  const tarjeta = (o, aquiMismo) => {
    const ahorro = hay ? a.precio - o.precio : 0;
    const foto = o.foto || logo(o.web);
    return `<a class="tarjeta${aquiMismo ? ' aqui' : ''}${o.precio === minimo ? ' barata' : ''}" ${aquiMismo ? '' : `data-url="${esc(o.url)}"`} title="${esc(o.url || '')}">
      <div class="foto">${`<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer" />`}</div>
      <span class="web"><img src="${esc(logo(o.web))}" alt="" />${esc(o.web || o.tienda)}</span>
      <b>${esc(o.tienda)}</b><span class="pr">${f(o.precio)}</span>
      <small>${aquiMismo ? T('aquí', 'here') + (a.estado === 'used' ? ' · ' + T('usado', 'used') : '') : o.precio === minimo ? '🏆 ' + T('el más barato', 'cheapest') + (hay && ahorro > 0.5 ? ' · ' + T('ahorras', 'save') + ' ' + f(ahorro) : '') : hay && ahorro > 0.5 ? T('ahorras', 'save') + ' ' + f(ahorro) : hay && ahorro < -0.5 ? '+' + f(-ahorro) : T('abrir ›', 'open ›')}</small></a>`;
  };
  const lista = [...x.ofertas].sort((p, q) => p.precio - q.precio);
  d.innerHTML = `<div class="cab">💰 ${T('Comparación de precios', 'Price comparison')}<small>${esc(String(a.nombre || '').slice(0, 90))}</small></div>
    <div class="tarjetas">${hay ? tarjeta({ tienda: a.tienda, web: a.tienda, precio: a.precio, foto: a.foto }, true) : ''}${lista.map((o) => tarjeta(o, false)).join('')}</div>`;
  d.querySelectorAll('.foto img').forEach((im) => im.addEventListener('error', () => { im.parentNode.textContent = '🛒'; }));
  d.querySelectorAll('.web img').forEach((im) => im.addEventListener('error', () => { im.remove(); }));
  $('charla2').appendChild(d); $('charla2').scrollTop = $('charla2').scrollHeight;
});
// 💰 más barato en otra tienda [09-nov]
window.nav.en('precio', (a) => {
  const m = a.mejor; const ahorro = (a.precio - m.precio).toFixed(2); const sim = (x) => (a.moneda === 'USD' ? '$' : '') + Number(x).toFixed(2) + (a.moneda === 'USD' ? '' : ' ' + a.moneda);
  sonido('pestana');
  avisos.push({ tipo: 'precio', texto: `${T('Más barato en', 'Cheaper at')} <b>${esc(m.tienda)}</b>: ${sim(m.precio)} <small>(${T('aquí', 'here')} ${sim(a.precio)} · ${T('ahorras', 'you save')} ${sim(ahorro)})</small>${a.otras && a.otras.length ? `<br><small>${T('También', 'Also')}: ${a.otras.map((o) => `${esc(o.tienda)} ${sim(o.precio)}`).join(' · ')}</small>` : ''}`,
    botones: [{ t: T('Abrir en', 'Open at') + ' ' + m.tienda, clase: 'si', f: () => H('nueva', m.url) }, { t: T('Cerrar', 'Close'), clase: 'no', f: () => {} }] });
  mostrarAviso();
});
window.nav.en('amenaza', (a) => {
  sonido('alerta');
  avisos.unshift({ tipo: 'amenaza', host: a.host, texto: `<b>${esc(a.host)}</b> ${T('parece peligrosa', 'looks dangerous')}: ${esc((a.pistas || []).map(pista).join(' ').slice(0, 240))}`,
    botones: [{ t: T('Salir de aquí', 'Get me out'), clase: 'si', f: () => H('atras') }, { t: T('Ver detalles', 'Details'), f: () => { H('panel', true); pestPanel('escaner'); } }, { t: T('Seguir igual', 'Continue anyway'), clase: 'no', f: () => {} }] });
  decirEnCola(T(`Cuidado, señor: ${a.host} parece peligrosa.`, `Careful, sir: ${a.host} looks dangerous.`));
  mostrarAviso();
});
$('escudo').addEventListener('click', () => { H('panel', true); pestPanel('escaner'); });
H('escaneo').then(pintarEscudo);

// mapa de conexiones: globo de puntos con líneas de luz hacia cada servidor
let mapaAnim = 0; let mapaDatos = null;
function pararMapa() { cancelAnimationFrame(mapaAnim); mapaAnim = 0; }
async function pintarMapa() {
  pintarPanelEscaner();
  $('mapa-txt').textContent = T('Localizando servidores…', 'Locating servers…');
  requestAnimationFrame(() => { if (!$('p-escaner').hidden) dibujarMapa(); });   // el mundo se ve ya; las líneas llegan después
  const r = await H('mapa');
  if ($('p-escaner').hidden) return;
  if (!r || !r.ok) { mapaDatos = null; $('mapa-txt').textContent = (r && r.error) || T('Sin mapa', 'No map'); dibujarMapa(); return; }
  mapaDatos = r; const paises = new Set(r.servidores.map((s) => s.cc));
  $('mapa-txt').textContent = T(`${r.servidores.length} servidores · ${paises.size} países`, `${r.servidores.length} servers · ${paises.size} countries`);
  const lista = new Map(r.servidores.map((s) => [s.host, s]));
  $('esc-hosts').querySelectorAll('.h').forEach((d) => { const s = lista.get(d.firstChild.textContent); if (s && !d.querySelector('.donde')) { const e = document.createElement('em'); e.className = 'donde'; e.textContent = `${bandera(s.cc)} ${s.ciudad || s.pais}`; d.firstChild.after(e); } });
  dibujarMapa();
}
const bandera = (cc) => (cc && cc.length === 2 ? `[${cc.toUpperCase()}]` : '[—]');   // Windows no dibuja emojis de banderas
let bitsMapa = null;
function dibujarMapa() {
  const cv = $('mapa'); const dpr = Math.min(2, devicePixelRatio || 1);
  const W = cv.clientWidth || cv.parentElement.clientWidth || 340; const H2 = Math.round(W * 0.5);
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H2 * dpr; cv.style.height = H2 + 'px'; }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const M = window.MAPA_MUNDO;
  if (!bitsMapa && M) bitsMapa = Uint8Array.from(atob(M.b64), (ch) => ch.charCodeAt(0));
  const xy = (lat, lon) => [((lon + 180) / 360) * W, ((M.latMax - lat) / (2 * M.latMax)) * H2];
  const t0 = performance.now();
  const frame = (ahora) => {
    c.clearRect(0, 0, W, H2);
    // tierra de puntos
    c.fillStyle = `rgba(${TEMA.c1},.28)`;
    const cw = W / M.W, ch = H2 / M.H;
    for (let r = 0; r < M.H; r++) for (let k = 0; k < M.W; k++) { const i = r * M.W + k; if (bitsMapa[i >> 3] & (1 << (7 - (i & 7)))) c.fillRect(k * cw + cw * 0.25, r * ch + ch * 0.25, Math.max(1, cw * 0.5), Math.max(1, ch * 0.5)); }
    if (mapaDatos && mapaDatos.yo) {
      const [x0, y0] = xy(mapaDatos.yo.lat, mapaDatos.yo.lon);
      const t = (ahora - t0) / 1000;
      mapaDatos.servidores.forEach((s, n) => {
        const [x1, y1] = xy(s.lat, s.lon);
        const col = s.bloqueado ? '255,92,122' : s.propio ? '61,255,181' : TEMA.c1;
        const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - Math.max(12, Math.hypot(x1 - x0, y1 - y0) * 0.3);
        c.strokeStyle = `rgba(${col},.35)`; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke();
        const k = ((t * 0.5 + n * 0.17) % 1); const px = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * x1; const py = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * y1;
        c.fillStyle = `rgba(${col},.95)`; c.beginPath(); c.arc(px, py, 1.8, 0, 7); c.fill();
        const pul = 2.5 + Math.sin(t * 3 + n) * 1; c.beginPath(); c.arc(x1, y1, pul, 0, 7); c.fill();
      });
      const pul = 3 + Math.sin(t * 4) * 1.2;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x0, y0, pul, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x0, y0, pul + 4 + ((t * 8) % 8), 0, 7); c.stroke();
    }
    if (!$('p-escaner').hidden) mapaAnim = requestAnimationFrame(frame); else mapaAnim = 0;
  };
  cancelAnimationFrame(mapaAnim); mapaAnim = requestAnimationFrame(frame);
}

// monitor del sistema: mini-gráficas en la barra de abajo
const hist = { cpu: [], ram: [], gpu: [], red: [] };
function chispa(cv, datos, max, color) {
  const c = cv.getContext('2d'); const W = cv.width, H2 = cv.height; c.clearRect(0, 0, W, H2);
  c.strokeStyle = color; c.lineWidth = 1.2; c.beginPath();
  datos.forEach((v, i) => { const x = (i / 21) * W; const y = H2 - 1 - (Math.min(v, max) / max) * (H2 - 2); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
  c.stroke(); c.lineTo(((datos.length - 1) / 21) * W, H2); c.lineTo(0, H2); c.closePath(); c.fillStyle = color.replace(/[\d.]+\)$/, '.15)'); c.fill();
}
const tasa = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)}M` : b >= 1024 ? `${Math.round(b / 1024)}K` : `${Math.round(b)}B`);
window.nav.en('monitor', (d) => {
  $('monitor').hidden = !E.monitor;
  const push = (k, v) => { hist[k].push(v); if (hist[k].length > 22) hist[k].shift(); };
  push('cpu', d.cpu); push('ram', d.ram);
  chispa($('m-cpu').querySelector('canvas'), hist.cpu, 100, `rgba(${TEMA.c1},1)`); $('m-cpu').querySelector('b').textContent = `${d.cpu}%`;
  chispa($('m-ram').querySelector('canvas'), hist.ram, 100, 'rgba(154,233,255,1)'); $('m-ram').querySelector('b').textContent = `${d.ram}%`;
  $('m-cpu').classList.toggle('alto', d.cpu > 85); $('m-ram').classList.toggle('alto', d.ram > 90);
  if (d.gpu) {
    $('m-gpu').hidden = false; push('gpu', d.gpu.uso);
    chispa($('m-gpu').querySelector('canvas'), hist.gpu, 100, 'rgba(61,255,181,1)'); $('m-gpu').querySelector('b').textContent = `${d.gpu.uso}%`;
    $('m-gpu').querySelector('i').textContent = `${d.gpu.temp}°`; $('m-gpu').classList.toggle('alto', d.gpu.temp >= 83);
  }
  if (d.red) { push('red', d.red.bajada); const mx = Math.max(65536, ...hist.red); chispa($('m-red').querySelector('canvas'), hist.red, mx, 'rgba(255,200,97,1)'); $('m-red').querySelector('b').textContent = `↓${tasa(d.red.bajada)} ↑${tasa(d.red.subida)}`; }
});

// «Jarvis, clip that»
window.nav.en('clip', (e) => {
  H('panel', true); pestPanel('jarvis');
  if (e.tipo === 'inicio') { sonido('clip'); msg2('j', T('Guardando la jugada…', 'Saving the play…')); return; }
  let t;
  if (e.tipo === 'error') t = e.texto || T('No pude guardar el clip.', 'I couldn\'t save the clip.');
  else if (e.enviado) t = T('Clip guardado y enviado a su teléfono, señor.', 'Clip saved and sent to your phone, sir.');
  else if (e.grande) t = T(`Clip guardado, señor. Pesa ${e.mb} MB: demasiado para Telegram (máximo 50 MB), quedó en su PC.`, `Clip saved, sir. It's ${e.mb} MB: too big for Telegram (50 MB max), so it stays on your PC.`);
  else if (e.errorTel) t = T(`Clip guardado en su PC, pero Telegram falló: ${e.errorTel}`, `Clip saved on your PC, but Telegram failed: ${e.errorTel}`);
  else t = e.telefono ? T('Clip guardado, señor.', 'Clip saved, sir.') : T('Clip guardado en su PC, señor. Conecte su teléfono en Configuración para recibirlos allí.', 'Clip saved on your PC, sir. Connect your phone in Settings to get them there.');
  const m = msg2(e.tipo === 'error' ? 'j' : 'j alerta', t);
  if (e.ruta) { const b = document.createElement('button'); b.className = 'abrir-alerta'; b.textContent = T('Ver el clip', 'Watch the clip'); b.addEventListener('click', () => H('abrir-foto', e.ruta)); m.appendChild(b); }
  decirEnCola(t);
});

window.nav.en('emergente', (e) => {
  if (avisos.some((a) => a.tipo === 'emergente' && a.host === e.host)) return;
  avisos.push({ tipo: 'emergente', host: e.host, texto: `Bloqueé una ventana emergente de <b>${esc(e.host)}</b>.`,
    botones: [{ t: 'Permitir en este sitio', clase: 'si', f: () => H('emergente-permitir', { host: e.host, url: e.url }) }, { t: 'Cerrar', f: () => {} }] });
  mostrarAviso();
});

// ── Chat con JARVIS (todo, no solo la página) + pantallita en vivo [28-oct] ──
let chatResp = null;
let chatTexto = '';
function msg2(clase, texto) {
  const d = document.createElement('div'); d.className = `msg ${clase}`; d.textContent = texto;
  $('charla2').appendChild(d); $('charla2').scrollTop = $('charla2').scrollHeight; return d;
}
async function revisarJarvis() {
  const s = await H('jarvis-vivo') || {};
  // aviso arriba del chat solo si no tengo con qué pensar
  const sinCerebro = !s.llaves && !(s.conectar && s.vivo);
  $('apagado').hidden = !sinCerebro;
  if (sinCerebro) {
    $('apagado-txt').textContent = s.conectar ? 'El JARVIS de fondo está apagado y no tengo llave de IA propia.' : 'Para pensar necesito una llave de IA (la de Gemini es gratis).';
    $('encender').hidden = !s.conectar; $('poner-llave').hidden = false;
  }
  return s;
}
$('poner-llave').addEventListener('click', () => H('ajustes', 'ia'));
window.nav.en('llaves', () => revisarJarvis());          // llave nueva en Configuración: quitar el aviso al momento
window.addEventListener('focus', () => revisarJarvis());
setInterval(revisarJarvis, 20000);
// 🌐 «Jarvis, abre YouTube» → JARVIS lo escribe arriba en la barra y abre la página (al momento, sin gastar IA) [05-nov]
const SITIOS = {
  'google': 'google.com', 'google chrome': 'google.com', 'chrome': 'google.com', 'el google': 'google.com',
  'youtube': 'youtube.com', 'you tube': 'youtube.com', 'yutub': 'youtube.com', 'youtube music': 'music.youtube.com',
  'github': 'github.com', 'git hub': 'github.com', 'facebook': 'facebook.com', 'face': 'facebook.com', 'instagram': 'instagram.com',
  'whatsapp': 'web.whatsapp.com', 'whats app': 'web.whatsapp.com', 'guasap': 'web.whatsapp.com', 'gmail': 'mail.google.com', 'mi correo': 'mail.google.com', 'correo': 'mail.google.com',
  'netflix': 'netflix.com', 'amazon': 'amazon.com', 'tiktok': 'tiktok.com', 'tik tok': 'tiktok.com', 'twitter': 'x.com', 'reddit': 'reddit.com',
  'spotify': 'open.spotify.com', 'chatgpt': 'chatgpt.com', 'chat gpt': 'chatgpt.com', 'claude': 'claude.ai', 'gemini': 'gemini.google.com',
  'ai studio': 'aistudio.google.com', 'aistudio': 'aistudio.google.com', 'wikipedia': 'wikipedia.org', 'linkedin': 'linkedin.com', 'twitch': 'twitch.tv', 'kick': 'kick.com',
  'discord': 'discord.com/app', 'google drive': 'drive.google.com', 'drive': 'drive.google.com', 'google maps': 'maps.google.com', 'maps': 'maps.google.com', 'mapas': 'maps.google.com',
  'google fotos': 'photos.google.com', 'google photos': 'photos.google.com', 'calendario': 'calendar.google.com', 'google calendar': 'calendar.google.com',
  'traductor': 'translate.google.com', 'google translate': 'translate.google.com', 'translate': 'translate.google.com', 'pinterest': 'pinterest.com', 'ebay': 'ebay.com',
  'walmart': 'walmart.com', 'telegram': 'web.telegram.org', 'outlook': 'outlook.live.com', 'hotmail': 'outlook.live.com', 'roblox': 'roblox.com',
  'steam': 'store.steampowered.com', 'epic games': 'store.epicgames.com', 'canva': 'canva.com', 'notion': 'notion.so', 'figma': 'figma.com',
  'mercado libre': 'mercadolibre.com', 'prime video': 'primevideo.com', 'amazon prime': 'primevideo.com', 'disney plus': 'disneyplus.com', 'disney+': 'disneyplus.com',
  'hbo max': 'max.com', 'yahoo': 'yahoo.com', 'bing': 'bing.com', 'duckduckgo': 'duckduckgo.com', 'paypal': 'paypal.com', 'xbox': 'xbox.com',
  'playstation': 'playstation.com', 'hugging face': 'huggingface.co', 'stack overflow': 'stackoverflow.com', 'higgsfield': 'higgsfield.ai',
};
const BUSCAR_EN = {
  youtube: 'https://www.youtube.com/results?search_query=', google: 'https://www.google.com/search?q=', amazon: 'https://www.amazon.com/s?k=',
  github: 'https://github.com/search?q=', wikipedia: 'https://es.wikipedia.org/w/index.php?search=', spotify: 'https://open.spotify.com/search/',
  tiktok: 'https://www.tiktok.com/search?q=', 'mercado libre': 'https://listado.mercadolibre.com/', ebay: 'https://www.ebay.com/sch/i.html?_nkw=',
};
const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function sitioDeVoz(q) {
  const t = q.trim().replace(/^[\s¡¿]+|[\s.!?]+$/g, '').replace(/^(hey|oye|ok)?[\s,]*j[ae]rv[ie]s[\s,.:]*/i, '').replace(/^(por favor|please)[\s,]+/i, '').trim();
  // «busca gatos en YouTube» / «search cats on YouTube»
  const b = t.match(/^(b[uú]sca(me)?|pon(me)?|search( for)?|look up|find|play)\s+(.+?)\s+(en|on|in)\s+(youtube|google|amazon|github|wikipedia|spotify|tiktok|mercado libre|ebay)$/i);
  if (b) { const sitio = sinTildes(b[7]); return { url: BUSCAR_EN[sitio] + encodeURIComponent(b[5]), escribir: b[5], nombre: b[7], busqueda: true }; }
  const m = t.match(/^(abre(me)?|[aá]bre(me)?|abrir|ve a|vete a|v[aá]monos a|ll[eé]vame a|ir a|entra (a|en)|navega a|open( up)?|go to|take me to|launch|visit|bring up)\s+(.+)$/i);
  if (!m) return null;
  let obj = m[m.length - 1].replace(/\s+(en|in)\s+(una|otra|la|a|another)?\s*(nueva\s+|new\s+)?(pesta[nñ]a|tab)(\s+nueva)?$/i, '').replace(/\s+(por favor|please)$/i, '').trim();
  const explicita = /\b(p[aá]gina|web|sitio|website|site|page)\b/i.test(obj);
  obj = obj.replace(/^(la|el|una|un|the|mi|my)\s+/i, '').replace(/^(p[aá]gina|web|sitio|website|site|page)(\s+web)?\s*/i, '').replace(/^(de|del|of)\s+/i, '').replace(/^(la|el|the)\s+/i, '').replace(/\s+(website|web\s*site|site|homepage|home\s*page|page|web|p[aá]gina)$/i, '').trim();   // «the GitHub website» → GitHub
  const clave = sinTildes(obj).replace(/\s+punto\s+/g, '.').replace(/^www\./, '');
  if (!clave || /\b(pesta[nñ]a|tab|ventana|window|documento|archivo|file|configuraci[oó]n|ajustes|settings|descargas|downloads|historial|history|favoritos|bookmarks)\b/.test(clave)) return null;
  if (SITIOS[clave]) return { url: 'https://' + SITIOS[clave], escribir: SITIOS[clave].split('/')[0], nombre: obj };
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(clave.replace(/\s+/g, ''))) { const d = clave.replace(/\s+/g, ''); return { url: 'https://' + d, escribir: d, nombre: d }; }
  // otra página que no está en la lista: el primer resultado de la búsqueda (DuckDuckGo «\» = voy directo)
  if (explicita) return { url: 'https://duckduckgo.com/?q=' + encodeURIComponent('\\' + obj), escribir: obj, nombre: obj };
  return null;
}
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function abrirPorVoz(s, porVoz) {
  const es = (document.documentElement.lang || 'es').startsWith('es');
  const dicho = s.busqueda ? (es ? `Buscando «${s.escribir}» en ${s.nombre}, señor.` : `Searching ${s.nombre} for “${s.escribir}”, sir.`) : (es ? `Abriendo ${s.nombre}, señor.` : `Opening ${s.nombre}, sir.`);
  msg2('j', dicho); if (porVoz) decirEnCola(dicho);
  const enInicio = !E.url || E.url.startsWith('file:');   // en la página de inicio se abre ahí mismo; si no, en una pestaña nueva
  if (!enInicio) { await H('nueva'); await espera(220); }
  const d = $('direccion'); escribiendo = true; d.focus(); await espera(60); d.value = '';   // deja que el foco termine (antes se comía la 1.ª letra)
  for (const c of s.escribir) { d.value += c; await espera(c === ' ' ? 30 : 45); }   // se ve cómo lo escribe
  await espera(180);
  H('ir', s.url); escribiendo = false; d.blur();
}
async function chatear(q, porVoz = false) {
  q = (q || '').trim();
  if (!q) return;
  callarCola(); sonido('enviar');
  const sitio = sitioDeVoz(q);
  if (sitio) { H('panel', true); pestPanel('jarvis'); msg2('u', q); abrirPorVoz(sitio, porVoz); return; }
  if (/^(jarvis[,\s]+)?(clip (that|it|this)|cl[ií]pea(lo)?( eso)?|guarda (eso|la jugada|el clip)|graba (eso|la jugada)|save (that|the) (clip|play))\s*[.!]*$/i.test(q)) { msg2('u', q); H('clip'); return; }
  if (/^(jarvis[,\s]+)?((qu[eé]|q)\s+(ves|hay)(\s+(en|aqu[ií]|ah[ií]))?(\s+(la|esta)\s+p[aá]gina)?|descr[ií]be(me)?\s+(la|esta)\s+p[aá]gina|what do you see|describe (this|the) page)\s*[?.!]*$/i.test(q)) {
    msg2('u', q); H('recorrer'); return;
  }
  H('panel', true); pestPanel('jarvis');
  msg2('u', q);
  chatTexto = ''; chatResp = msg2('j pensando', 'Pensando'); trabajando(true);
  $('panel').classList.add('pensando');
  H('chat', q);
}
// ── Piloto automático: los pasos van saliendo en el mensaje, y el informe final puede traer tabla [04-nov] ──
function md(texto) {   // markdown sencillo y seguro (tablas, listas, negrita, enlaces)
  const enl = (s) => s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_m, t, u) => `<a data-url="${u}">${t}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, a, u) => `${a}<a data-url="${u}">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[(\d{1,2}(?::\d{2}){1,2})\](?!\()/g, (_m, t) => `<a class="ts" data-t="${t.split(':').reduce((s, x) => s * 60 + Number(x), 0)}">⏱ ${t}</a>`);   // 🎬 minutos del video [09-nov]
  const lineas = esc(texto).split('\n'); const out = []; let i = 0;
  while (i < lineas.length) {
    const l = lineas[i].trim();
    if (l.startsWith('|')) {
      const filas = []; while (i < lineas.length && lineas[i].trim().startsWith('|')) { filas.push(lineas[i].trim()); i++; }
      const celdas = (f) => f.replace(/^\||\|$/g, '').split('|').map((c) => enl(c.trim()));
      const cuerpo = filas.filter((f) => !/^\|?\s*:?-{2,}/.test(f));
      out.push(`<table>${cuerpo.map((f, n) => `<tr>${celdas(f).map((c) => (n === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    if (/^([-*•]|\d+\.)\s+/.test(l)) {
      const items = []; while (i < lineas.length && /^([-*•]|\d+\.)\s+/.test(lineas[i].trim())) { items.push(enl(lineas[i].trim().replace(/^([-*•]|\d+\.)\s+/, ''))); i++; }
      out.push(`<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`); continue;
    }
    out.push(l ? `<p>${enl(l.replace(/^#+\s*/, ''))}</p>` : ''); i++;
  }
  return out.join('');
}
const paraVoz = (t) => String(t || '').split('\n').filter((l) => !l.trim().startsWith('|')).map((l) => l.replace(/^\s*([-*•]|\d+\.)\s+/, '')).join('. ')
  .replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[*#_`>|]/g, '').replace(/(\.\s*){2,}/g, '. ').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim();
function pasosDe(m) { let ol = m.querySelector('.pasos'); if (!ol) { ol = document.createElement('ol'); ol.className = 'pasos'; m.prepend(ol); } return ol; }
function cuerpoDe(m) { let c = m.querySelector('.cuerpo'); if (!c) { c = document.createElement('div'); c.className = 'cuerpo'; m.appendChild(c); } return c; }
$('charla2').addEventListener('click', (e) => {
  const t = e.target.closest('a[data-t]'); if (t) { e.preventDefault(); H('video-ir', Number(t.dataset.t)); return; }   // ⏱ salta a ese momento del video
  const a = e.target.closest('a[data-url]'); if (a) { e.preventDefault(); H('nueva', a.dataset.url); }
});
function trabajando(on) { $('p-parar').hidden = !on; $('p-enviar').hidden = on; }
$('p-parar').addEventListener('click', () => {
  H('chat-parar'); callarCola();
  if (chatResp) { chatResp.classList.remove('pensando'); cuerpoDe(chatResp).textContent = 'Detenido.'; chatResp = null; }
  $('panel').classList.remove('pensando'); trabajando(false);
});
window.nav.en('chat-ev', (ev) => {
  if (!chatResp) return;
  trabajando(!['fin', 'apagado', 'error'].includes(ev.tipo));
  if (ev.tipo === 'token') { chatTexto += ev.texto; chatResp.classList.remove('pensando'); cuerpoDe(chatResp).textContent = chatTexto.replace(/<think>[\s\S]*?<\/think>/g, ''); }
  else if (ev.tipo === 'herramienta') {
    if (chatResp.firstChild && chatResp.firstChild.nodeType === 3) chatResp.firstChild.remove();   // el «Pensando» del principio
    const li = document.createElement('li'); li.textContent = ev.texto;
    if (ev.detalle) { const s = document.createElement('small'); s.textContent = ev.detalle; li.append(' ', s); }
    const ol = pasosDe(chatResp); ol.querySelectorAll('li.ahora').forEach((x) => x.classList.remove('ahora')); li.className = 'ahora'; ol.appendChild(li);
  }
  else if (ev.tipo === 'final' && ev.texto && !chatTexto) {
    chatTexto = ev.texto; chatResp.classList.remove('pensando');
    if (chatResp.firstChild && chatResp.firstChild.nodeType === 3) chatResp.firstChild.remove();
    chatResp.querySelectorAll('.pasos li.ahora').forEach((x) => x.classList.remove('ahora'));
    cuerpoDe(chatResp).innerHTML = md(chatTexto);
    if (ev.voz) decirEnCola(paraVoz(ev.texto));
  }
  else if (ev.tipo === 'apagado') { chatResp.classList.remove('pensando'); chatResp.textContent = 'El cerebro de JARVIS está apagado.'; $('apagado').hidden = false; }
  else if (ev.tipo === 'error') { chatResp.classList.remove('pensando'); if (chatResp.firstChild && chatResp.firstChild.nodeType === 3) chatResp.firstChild.remove(); cuerpoDe(chatResp).textContent = ev.texto || 'Algo falló.'; if (ev.llave) revisarJarvis(); }
  if (ev.tipo === 'fin' || ev.tipo === 'apagado' || ev.tipo === 'error') {
    $('panel').classList.remove('pensando');
    if (chatTexto && ev.tipo === 'fin') cuerpoDe(chatResp).innerHTML = md(chatTexto.replace(/<think>[\s\S]*?<\/think>/g, ''));   // enlaces y minutos tocables también al escribir en vivo [09-nov]
    if (!chatTexto && ev.tipo === 'fin') { chatResp.classList.remove('pensando'); if (chatResp.firstChild && chatResp.firstChild.nodeType === 3) chatResp.firstChild.remove(); chatResp.querySelectorAll('.pasos li.ahora').forEach((x) => x.classList.remove('ahora')); cuerpoDe(chatResp).textContent = 'Listo.'; }
    chatResp = null;
    setTimeout(() => { if (!chatResp) $('vista').hidden = true; }, 4000);
  }
  $('charla2').scrollTop = $('charla2').scrollHeight;
});
window.nav.en('vista', ({ img, titulo }) => {
  if (!chatResp) return;
  $('vista').hidden = false; $('vista-img').src = img; $('vista-txt').textContent = titulo ? `👁 ${titulo}` : '';
});
window.nav.en('chat-externo', (q) => chatear(q));
window.nav.en('panel-pestana', (c) => { if ($(`p-${c}`)) pestPanel(c); });
$('p-form2').addEventListener('submit', (ev) => { ev.preventDefault(); const q = $('p-q2').value; $('p-q2').value = ''; chatear(q); });
// 🎙 graba aquí mismo (el micrófono de la PC), para solo al callarte, y el cerebro lo pasa a texto [28-oct]
let grabando = null;
function aWav(muestras, sr) {
  const destino = 16000, paso = sr / destino, n = Math.floor(muestras.length / paso);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, destino, true); v.setUint32(28, destino * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, muestras[Math.floor(i * paso)])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Uint8Array(buf);
}
async function pararGrabacion() {
  const g = grabando; if (!g) return; grabando = null;
  clearTimeout(g.tope); g.proc.disconnect(); g.fuente.disconnect(); g.stream.getTracks().forEach((t) => t.stop());
  const sr = g.ctx.sampleRate; g.ctx.close();
  $('p-mic').classList.remove('activo');
  const total = g.trozos.reduce((a, t) => a + t.length, 0);
  if (total < sr * 0.4) { $('p-q2').placeholder = 'Escríbele a JARVIS…'; return; }
  const todo = new Float32Array(total); let o = 0; for (const t of g.trozos) { todo.set(t, o); o += t.length; }
  $('p-q2').placeholder = 'Entendiendo…';
  const r = await H('transcribir', aWav(todo, sr));
  $('p-q2').placeholder = 'Escríbele a JARVIS…';
  if (r && r.texto) {   // «Jarvis, abre YouTube» → «abre YouTube»
    const limpio = r.texto.replace(/^\s*(hey|oye|ok)?[\s,]*j[ae]rv[ie]s[\s,.:!¡]*/i, '').trim();
    if (limpio) chatear(limpio, true); else { const si = (document.documentElement.lang || 'es').startsWith('es') ? '¿Sí, señor?' : 'Yes, sir?'; msg2('j', si); decirEnCola(si); }
  }
  else if (r && r.apagado) { $('apagado').hidden = false; msg2('j', 'El cerebro de JARVIS está apagado: pulse «Encender JARVIS».'); }
  else if (r && r.error) msg2('j', r.error);
  else msg2('j', 'No le entendí. ¿Me lo repite?');
}
$('p-mic').addEventListener('click', async () => {
  if (grabando) { pararGrabacion(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { msg2('j', 'No tengo permiso para usar el micrófono (o no hay ninguno conectado).'); return; }
  const ctx = new AudioContext(); const fuente = ctx.createMediaStreamSource(stream); const proc = ctx.createScriptProcessor(4096, 1, 1);
  const g = { stream, ctx, fuente, proc, trozos: [], hablo: false, silencio: 0 };
  proc.onaudioprocess = (e) => {
    const x = e.inputBuffer.getChannelData(0); g.trozos.push(new Float32Array(x));
    let s = 0; for (let i = 0; i < x.length; i += 8) s += x[i] * x[i];
    const nivel = Math.sqrt(s / (x.length / 8));
    nivelVoz(Math.min(1, nivel * 6));   // el orbe late con tu voz
    if (nivel > 0.02) { g.hablo = true; g.silencio = 0; } else if (g.hablo) { g.silencio += x.length / ctx.sampleRate; if (g.silencio > 1.4) pararGrabacion(); }
  };
  fuente.connect(proc); proc.connect(ctx.destination);
  g.tope = setTimeout(pararGrabacion, 15000);
  grabando = g; $('p-mic').classList.add('activo'); $('p-q2').placeholder = '🎙 Te escucho… (pulsa otra vez para terminar)';
});
$('encender').addEventListener('click', async () => {
  const r = await H('encender-jarvis'); msg2('j', (r && r.texto) || '');
  for (let i = 0; i < 30; i++) { await new Promise((ok) => setTimeout(ok, 2000)); if ((await revisarJarvis()).vivo) { msg2('j', 'JARVIS ya está encendido. ¿En qué le ayudo?'); break; } }
});
revisarJarvis();

// «¿Qué ves?» parte por parte, con la foto de cada parte en el chat [28-oct]
const partes = new Map();
window.nav.en('recorrido', (ev) => {
  H('panel', true); pestPanel('jarvis');
  if (ev.tipo === 'inicio') { partes.clear(); callarCola(); msg2('j', `Voy a recorrer la página${ev.titulo ? ` «${ev.titulo}»` : ''} y le cuento lo que veo, parte por parte.`); $('panel').classList.add('pensando'); }
  if (ev.tipo === 'parte') {
    const d = document.createElement('div'); d.className = 'msg j parte';
    d.innerHTML = `<b>Parte ${ev.n} de ${ev.total}</b>`;
    if (ev.img) { const im = document.createElement('img'); im.src = ev.img; im.className = 'foto-parte'; d.appendChild(im); }
    const t = document.createElement('div'); t.className = 'pensando'; t.textContent = 'Mirando'; d.appendChild(t);
    $('charla2').appendChild(d); partes.set(ev.n, t);
  }
  if (ev.tipo === 'texto') { const t = partes.get(ev.n); if (t) { t.className = ''; t.textContent = ev.texto; } decirEnCola(ev.texto); }
  if (ev.tipo === 'fin' || ev.tipo === 'error') { $('panel').classList.remove('pensando'); if (ev.texto) msg2('j', ev.texto); }
  $('charla2').scrollTop = $('charla2').scrollHeight;
});

// Voz del recorrido: cada parte se lee en voz alta en cuanto sale en el chat (en orden, sin pisarse) [28-oct]
let colaVoz = [];
let hablandoCola = false;
let turnoCola = 0;
let audioCola = null;
function callarCola() { turnoCola++; colaVoz = []; hablandoCola = false; if (audioCola) { try { audioCola.pause(); } catch { /* */ } audioCola = null; } try { speechSynthesis.cancel(); } catch { /* */ } }
function decirEnCola(texto) {
  if (!texto) return;
  colaVoz.push(...trozos(texto));
  if (!hablandoCola) hablarCola();
}
async function hablarCola() {
  const yo = turnoCola;
  hablandoCola = true;
  const pedir = () => { const t = colaVoz.shift(); return { t, p: H('tts', t) }; };
  let siguiente = colaVoz.length ? pedir() : null;
  while (siguiente && yo === turnoCola) {
    const bytes = await siguiente.p; const texto = siguiente.t;
    siguiente = colaVoz.length ? pedir() : null;
    if (yo !== turnoCola) break;
    await sonar(bytes, texto, (a) => { audioCola = a; });
    // la siguiente parte puede llegar mientras hablaba
    if (!siguiente && colaVoz.length && yo === turnoCola) siguiente = pedir();
  }
  if (yo === turnoCola) hablandoCola = false;
}
window.nav.en('callar', callarCola);

// ════ [04-nov] Terminal de comandos (Ctrl+K) · escáner de descargas · cerebro local · centro de mando ════
const term = { abierta: false, historial: [], pos: -1, comandos: [], arrancada: false };
try { term.historial = JSON.parse(localStorage.getItem('jb_term') || '[]'); } catch { /* */ }
function termLinea(t, c = '', escribir = true) {
  const d = document.createElement('div'); d.className = 'tl ' + c;
  $('term-salida').appendChild(d);
  if (!escribir || t.length > 160) d.textContent = t;
  else { let i = 0; const paso = Math.max(1, Math.ceil(t.length / 18)); const f = () => { i += paso; d.textContent = t.slice(0, i); if (i < t.length) requestAnimationFrame(f); }; f(); }
  $('term-salida').scrollTop = $('term-salida').scrollHeight;
  return d;
}
async function abrirTerminal() {
  if (!E.terminal) return;
  term.abierta = true; $('terminal').hidden = false; document.body.classList.add('con-terminal'); H('tapar', true); sonido('escaneo');
  if (!term.arrancada) {
    term.arrancada = true; term.comandos = await H('terminal-comandos') || [];
    const ini = ['J.A.R.V.I.S  BROWSER TERMINAL  v1.1', `${new Date().toLocaleString()}  ·  ${E.pestanas.length} tabs  ·  session secure`, T('Escribe «help» para ver los comandos. Lo que no sea un comando se lo pregunto a JARVIS.', 'Type “help” for commands. Anything else goes to JARVIS.'), ''];
    for (const [n, l] of ini.entries()) setTimeout(() => termLinea(l, n === 0 ? 'titulo' : 'tenue'), n * 90);
  }
  setTimeout(() => $('term-in').focus(), 30);
}
function cerrarTerminal() { term.abierta = false; $('terminal').hidden = true; document.body.classList.remove('con-terminal'); H('tapar', false); }
window.nav.en('terminal', () => (term.abierta ? cerrarTerminal() : abrirTerminal()));
$('term-in').addEventListener('keydown', async (ev) => {
  const inp = $('term-in');
  if (ev.key === 'Escape') { ev.preventDefault(); return cerrarTerminal(); }
  if (ev.key === 'k' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); return cerrarTerminal(); }
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
    ev.preventDefault(); if (!term.historial.length) return;
    term.pos = ev.key === 'ArrowUp' ? Math.min(term.historial.length - 1, term.pos + 1) : Math.max(-1, term.pos - 1);
    inp.value = term.pos >= 0 ? term.historial[term.pos] : ''; return;
  }
  if (ev.key === 'Tab') {
    ev.preventDefault(); const v = inp.value.trim().toLowerCase(); if (!v || v.includes(' ')) return;
    const m = term.comandos.filter((c) => c.startsWith(v));
    if (m.length === 1) inp.value = m[0] + ' '; else if (m.length) termLinea('  ' + m.join('   '), 'tenue', false);
    return;
  }
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  const q = inp.value.trim(); inp.value = ''; term.pos = -1;
  if (!q) return;
  termLinea(`jarvis@browser:~$ ${q}`, 'eco', false); sonido('enviar');
  term.historial = [q, ...term.historial.filter((x) => x !== q)].slice(0, 60);
  try { localStorage.setItem('jb_term', JSON.stringify(term.historial)); } catch { /* */ }
  const espera = termLinea('…', 'tenue', false);
  const r = await H('terminal', q).catch(() => null); espera.remove();
  if (!r) return termLinea('✕ error', 'mal');
  if (r.limpiar) $('term-salida').innerHTML = '';
  (r.lineas || []).forEach((l, n) => setTimeout(() => termLinea(l.t, l.c), n * 35));
  if (r.cerrar) setTimeout(cerrarTerminal, Math.min(900, 250 + (r.lineas || []).length * 40));
});
$('terminal').addEventListener('mousedown', (ev) => { if (ev.target.id === 'terminal') { ev.preventDefault(); $('term-in').focus(); } });
$('term-x').addEventListener('click', cerrarTerminal);

// escáner de descargas: el veredicto de Windows Defender / VirusTotal en cada descarga
const VEREDICTO = {
  revisando: () => ['🛡 ' + T('Revisando con el antivirus…', 'Scanning with antivirus…'), 'rev'],
  limpio: () => ['🛡 ' + T('Limpio · sin amenazas', 'Clean · no threats'), 'ok'],
  sospechoso: () => ['⚠ ' + T('Sospechoso · ten cuidado', 'Suspicious · be careful'), 'aviso'],
  peligroso: () => ['☠ ' + T('PELIGROSO · no lo abras', 'DANGEROUS · do not open'), 'mal'],
  quitado: () => ['☠ ' + T('Windows lo quitó por seguridad', 'Windows removed it for safety'), 'mal'],
  'sin-revisar': () => ['🛡 ' + T('No se pudo revisar', 'Could not be scanned'), 'tenue'],
};
window.nav.en('descarga-revision', (x) => {
  const d = descs.get(x.id); if (!d) return;
  d.revision = x; pintarDescargas();
  if (x.veredicto === 'peligroso' || x.veredicto === 'quitado') {
    sonido('alerta'); H('panel', true); pestPanel('desc');
    decirEnCola(T(`Cuidado, señor: la descarga ${x.nombre} es peligrosa. No la abra.`, `Careful, sir: the download ${x.nombre} is dangerous. Do not open it.`));
  } else if (x.veredicto === 'sospechoso') sonido('alerta');
});
const pintarDescargasViejo = pintarDescargas;
pintarDescargas = function () {   // eslint-disable-line no-func-assign
  pintarDescargasViejo();
  const lista = [...descs.values()].reverse();
  $('descargas').querySelectorAll('.desc').forEach((el, i) => {
    const d = lista[i]; if (!d || !d.revision) return;
    const [txt, cls] = (VEREDICTO[d.revision.veredicto] || VEREDICTO['sin-revisar'])();
    const det = (d.revision.motores || []).map((m) => (m.motor === 'virustotal' ? (m.total ? `VirusTotal ${m.malos}/${m.total}` : m.estado === 'desconocido' ? T('VirusTotal: archivo nuevo', 'VirusTotal: new file') : '') : m.estado === 'no-disponible' ? T('Defender no disponible', 'Defender unavailable') : 'Defender ✓')).filter(Boolean).join(' · ');
    const s = document.createElement('small'); s.className = 'veredicto ' + cls; s.textContent = txt + (det ? ` — ${det}` : '');
    el.querySelector('span').appendChild(s);
    if (['peligroso', 'sospechoso'].includes(d.revision.veredicto)) {
      const b = el.querySelector('button[data-abrir]'); if (b) b.remove();
      const x = document.createElement('button'); x.className = 'papelera'; x.dataset.papelera = d.ruta; x.textContent = T('A la papelera', 'Move to bin'); el.appendChild(x);
    }
  });
};
$('descargas').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-papelera]'); if (!b) return;
  if (await H('borrar-descarga', b.dataset.papelera)) { b.textContent = T('En la papelera ✓', 'In the bin ✓'); b.disabled = true; }
});

// cerebro local: estado en la barra de abajo
window.nav.en('local', (x) => {
  const e = $('local-chip');
  const t = { arrancando: '🧠 ' + T('ENCENDIENDO QWEN…', 'STARTING QWEN…'), listo: '🧠 QWEN ONLINE', apagado: '', falta: '🧠 ' + T('NO ENCUENTRO QWEN', 'QWEN NOT FOUND') }[x.estado] || '';
  e.hidden = !t; e.textContent = t; e.className = x.estado;
  if (x.estado === 'listo') setTimeout(() => { if (e.className === 'listo') e.hidden = true; }, 6000);
});

// centro de mando: el orbe de allá late con la voz de acá
let ultVozMando = 0;
const nivelVozViejo = nivelVoz;
nivelVoz = function (v) {   // eslint-disable-line no-func-assign
  nivelVozViejo(v);
  if (E.mando) { const t = performance.now(); if (t - ultVozMando > 90 || !v) { ultVozMando = t; H('mando-voz', Number(v || 0).toFixed(2)); } }
};

// ⬆ actualización lista: clic = actualizar ahora (se instala y vuelve a abrirse solo) [04-nov]
$('act-chip').addEventListener('click', () => { $('act-chip').textContent = '⬆ ' + T('ACTUALIZANDO…', 'UPDATING…'); H('actualizar-ya'); });

// ════ 🗣 Doblaje en vivo [09-nov]: la voz que lee los subtítulos traducidos del video ════
// Siempre una voz NATIVA del idioma (pedido del usuario): 1) la voz de Windows de ese idioma, si está instalada;
// 2) la voz de tu IA (OpenAI o Gemini) hablando como nativo; 3) si no hay ninguna, solo subtítulos (nunca con acento extranjero).
const doblajeUI = { lang: 'es', cola: [], sonando: false, turno: 0, audio: null, nube: true, avisado: false };
function doblajeCallar() { doblajeUI.turno++; doblajeUI.cola = []; doblajeUI.sonando = false; try { speechSynthesis.cancel(); } catch { /* */ } if (doblajeUI.audio) { try { doblajeUI.audio.pause(); } catch { /* */ } doblajeUI.audio = null; } }
function doblajeVoz() { return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(doblajeUI.lang)); }
async function doblajeHablar() {
  const yo = doblajeUI.turno; doblajeUI.sonando = true;
  while (doblajeUI.cola.length && yo === doblajeUI.turno) {
    const t = doblajeUI.cola.shift();
    const bytes = await H('tts-doblaje', { texto: t, lang: doblajeUI.lang }); if (yo !== doblajeUI.turno) break;
    if (!bytes) { doblajeUI.nube = false; doblajeSinVoz(); break; }
    await sonar(bytes, t, (a) => { doblajeUI.audio = a; });
  }
  if (yo === doblajeUI.turno) doblajeUI.sonando = false;
}
function doblajeSinVoz() {
  if (doblajeUI.avisado) return; doblajeUI.avisado = true;
  const n = ({ es: T('español', 'Spanish'), en: T('inglés', 'English'), pt: T('portugués', 'Portuguese'), fr: T('francés', 'French'), de: T('alemán', 'German'), it: T('italiano', 'Italian') })[doblajeUI.lang] || doblajeUI.lang;
  msg2('j', T(`🗣 No tengo una voz nativa en ${n}, así que te dejo solo los subtítulos traducidos (para no leerlos con acento extranjero). Para escucharlo doblado: instala gratis la voz en ${n} de Windows (Configuración › Hora e idioma › Voz › Agregar voces) o pon tu llave de OpenAI o Gemini en Configuración.`,
    `🗣 I don't have a native ${n} voice, so I'm leaving only the translated subtitles (rather than reading them with a foreign accent). To hear it dubbed: install Windows' free ${n} voice (Settings › Time & language › Speech › Add voices) or add your OpenAI or Gemini key in Settings.`));
}
function doblajeDecir(t) {
  const voces = doblajeVoz();
  if (voces.length) {   // voz de Windows del idioma: al momento y sin internet
    if (speechSynthesis.pending) speechSynthesis.cancel();   // se quedó atrás: salta a lo más nuevo
    const u = new SpeechSynthesisUtterance(t);
    const v = voces.find((x) => /natural|online/i.test(x.name)) || voces[0]; u.voice = v; u.lang = v.lang;
    u.rate = speechSynthesis.speaking ? 1.3 : 1.12; speechSynthesis.speak(u);
    return;
  }
  if (!doblajeUI.nube) return doblajeSinVoz();
  doblajeUI.cola.push(t); if (doblajeUI.cola.length > 2) doblajeUI.cola.splice(0, doblajeUI.cola.length - 2);
  if (!doblajeUI.sonando) doblajeHablar();
}
window.nav.en('doblaje', (d) => {
  if (!d) return;
  if (d.lang) doblajeUI.lang = String(d.lang).slice(0, 2).toLowerCase();
  if (d.on === true) { doblajeUI.nube = true; doblajeUI.avisado = false; }
  if (d.on === false || d.callar) { doblajeCallar(); return; }
  for (const l of d.lineas || []) doblajeDecir(l);
});
