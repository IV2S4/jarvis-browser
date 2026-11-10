'use strict';
// JARVIS en el teléfono: panel, chat con herramientas (piloto automático), voz, resumir, traducir, teléfono, memoria [04-nov]
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const codIdioma = () => IDIOMA;
const enPagina = async (codigo, id) => { const r = await H('js', id ? { codigo, id } : { codigo }); return r; };
// código asíncrono en la página: Android no espera promesas, así que se guarda el resultado y se pregunta hasta que esté
async function enPaginaAsync(codigo, max = 15000, id) {
  const k = '__jr' + Math.random().toString(36).slice(2, 9);
  await enPagina(`(() => { window.${k} = { hecho: false }; Promise.resolve(${codigo}).then((v) => { window.${k} = { hecho: true, v }; }).catch(() => { window.${k} = { hecho: true, v: null }; }); return 1; })()`, id);
  const t0 = Date.now();
  while (Date.now() - t0 < max) { await pausa(200); const r = await enPagina(`(() => { const x = window.${k}; if (x && x.hecho) { delete window.${k}; return { v: x.v }; } return null; })()`, id); if (r) return r.v; }
  return null;
}
async function esperarCarga(max = 9000) { const t0 = Date.now(); await pausa(500); while (Date.now() - t0 < max) { const e = await H('estado'); if (!e || !e.cargando) return; await pausa(300); } }
const priv = () => (E.privada ? { salida: { ok: false, error: 'Private tab: I do not read or send anything from private tabs.' } } : null);

// ── llaves ──
async function revisarLlaves() {
  const ll = (await H('llaves')) || {};
  const puestas = {}; for (const k of Object.keys(ll)) puestas[k] = Boolean(ll[k] && ll[k].puesta);
  Cerebro.ponerPuestas(puestas);
  Cerebro.configurarLocal({ activo: Boolean(cfg.localActivo && cfg.qwenPC), url: cfg.qwenPC || 'http://192.168.1.10:8080', primero: false });
  $('sin-llave').hidden = Cerebro.hayAlguna();
  return ll;
}
window.alArrancar.push(revisarLlaves);
$('poner-llave').addEventListener('click', () => abrirAjustes('ia'));

// ── panel ──
function abrirPanel(cual = 'chat') { abrirCapa('panel'); pestPanel(cual); }
function pestPanel(c) {
  document.querySelectorAll('.p-tabs button').forEach((b) => b.classList.toggle('activo', b.dataset.p === c));
  for (const x of ['chat', 'pagina', 'escaner', 'desc']) $('p-' + x).hidden = x !== c;
  $('panel-sub').textContent = E.inicio ? 'JARVIS Browser' : (E.titulo || hostDe(E.url));
  if (c === 'escaner' && window.pintarEscaner) pintarEscaner(true);
  if (c === 'chat') setTimeout(() => { $('charla').scrollTop = $('charla').scrollHeight; }, 50);
}
document.querySelectorAll('.p-tabs button').forEach((b) => b.addEventListener('click', () => pestPanel(b.dataset.p)));
$('panel-x').addEventListener('click', () => cerrarCapa('panel'));

// ── mensajes ──
function md(texto) {   // markdown sencillo y seguro (tablas, listas, negrita, enlaces) — igual que en la PC
  const enl = (s) => s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_m, t, u) => `<a data-url="${u}">${t}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, a, u) => `${a}<a data-url="${u}">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 34)}</a>`).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[(\d{1,2}(?::\d{2}){1,2})\](?!\()/g, (_m, t) => `<a class="ts" data-t="${t.split(':').reduce((s, x) => s * 60 + Number(x), 0)}">⏱ ${t}</a>`);   // 🎬 minutos del video [09-nov]
  const lineas = esc(texto).split('\n'); const out = []; let i = 0;
  while (i < lineas.length) {
    const l = lineas[i].trim();
    if (l.startsWith('|')) { const f = []; while (i < lineas.length && lineas[i].trim().startsWith('|')) { f.push(lineas[i].trim()); i++; }
      const cel = (x) => x.replace(/^\||\|$/g, '').split('|').map((c) => enl(c.trim())); const cuerpo = f.filter((x) => !/^\|?\s*:?-{2,}/.test(x));
      out.push(`<table>${cuerpo.map((x, n) => `<tr>${cel(x).map((c) => (n === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</table>`); continue; }
    if (/^([-*•]|\d+\.)\s+/.test(l)) { const it = []; while (i < lineas.length && /^([-*•]|\d+\.)\s+/.test(lineas[i].trim())) { it.push(enl(lineas[i].trim().replace(/^([-*•]|\d+\.)\s+/, ''))); i++; } out.push(`<ul>${it.map((x) => `<li>${x}</li>`).join('')}</ul>`); continue; }
    out.push(l ? `<p>${enl(l.replace(/^#+\s*/, ''))}</p>` : ''); i++;
  }
  return out.join('');
}
const paraVoz = (t) => String(t || '').split('\n').filter((l) => !l.trim().startsWith('|')).map((l) => l.replace(/^\s*([-*•]|\d+\.)\s+/, '')).join('. ')
  .replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[*#_`>|]/g, '').replace(/(\.\s*){2,}/g, '. ').replace(/\s+/g, ' ').trim();
function msg(clase, texto, html) {
  const d = document.createElement('div'); d.className = `msg ${clase}`;
  if (html) d.innerHTML = html; else d.textContent = texto;
  $('charla').appendChild(d); $('charla').scrollTop = $('charla').scrollHeight; return d;
}
$('charla').addEventListener('click', (ev) => {
  const t = ev.target.closest('a[data-t]'); if (t) { irAlMinuto(Number(t.dataset.t)); cerrarCapa('panel'); return; }   // ⏱ salta a ese momento del video
  const a = ev.target.closest('a[data-url]'); if (a) { H('nueva', { url: a.dataset.url }); cerrarCapa('panel'); }
});
function saludo() { $('charla').innerHTML = ''; msg('j', T('Hola, señor. Pídame lo que quiera: buscar, abrir páginas, resumir o traducir esta página, o «¿qué ves?».', 'Hello, sir. Ask me anything: search, open pages, summarize or translate this page, or “what do you see?”.')); }
window.alArrancar.push(async () => {
  saludo();
  $('chips-chat').innerHTML = [['resumir', T('Resumir', 'Summarize')], ['traducir', T('Traducir página', 'Translate page')], ['ves', T('¿Qué ves?', 'What do you see?')], ['telefono', T('Al teléfono', 'Send to phone')], ['nuevo', T('Nuevo chat', 'New chat')], ['vivo', '🗣 ' + T('En vivo', 'Live')]]
    .map(([k, t]) => `<button data-q="${k}">${t}</button>`).join('');
  $('grid-pagina').innerHTML = [['resumir', '📝', T('Resumir', 'Summarize')], ['puntos', '📌', T('Puntos clave', 'Key points')], ['traducir', '🌐', T('Traducir', 'Translate')], ['leer', '🔊', T('Leer en voz alta', 'Read aloud')],
    ['ves', '👁', T('¿Qué ves?', 'What do you see?')], ['foto', '📸', T('Foto', 'Photo')], ['vigilar', '🔔', T('Vigilar precio', 'Watch price')], ['cambios', '👀', T('Vigilar cambios', 'Watch changes')],
    ['telefono', '📱', T('Al teléfono', 'Send to phone')], ['subtitulos', '💬', T('Subtítulos YT', 'YT subtitles')], ['pip', '▣', T('Video flotante', 'Floating video')], ['buscar', '🔎', T('Buscar', 'Find in page')],
    ['doblar', '🗣', T('Doblar video', 'Dub video')], ['camara', '📸', T('¿Qué es esto?', 'What is this?')], ['capitulos', '🎬', T('Capítulos', 'Chapters')], ['precios', '💰', T('Comparar precios', 'Compare prices')],
    ['a-pc', '💻', T('Seguir en la PC', 'Continue on PC')], ['de-pc', '📲', T('Traer de la PC', 'Get from PC')]]
    .map(([k, i, t]) => `<button data-a="${k}">${i}<span>${t}</span></button>`).join('');
});
$('chips-chat').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-q]'); if (!b) return;
  const k = b.dataset.q;
  if (k === 'resumir') resumirAqui(); else if (k === 'traducir') traducirPagina(); else if (k === 'ves') verPagina(); else if (k === 'telefono') enviarTelefono();
  else if (k === 'nuevo') { Cerebro.olvidar(); saludo(); }
  else if (k === 'vivo') vivoEncender();   // 🗣 [09-nov]
});
$('grid-pagina').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-a]'); if (!b) return; const k = b.dataset.a; const resp = $('pag-resp');
  const decir = (t) => { resp.innerHTML = md(t); };
  if (k === 'resumir') { decir(T('Resumiendo…', 'Summarizing…')); decir(await resumirTexto()); }
  else if (k === 'puntos') { decir(T('Pensando…', 'Thinking…')); decir(await preguntar(T('Dame los puntos clave de esta página en una lista corta.', 'Give me the key points of this page as a short list.'))); }
  else if (k === 'traducir') traducirPagina();
  else if (k === 'leer') { const p = await leerPagina(); if (p.ok) hablar(String(p.texto).slice(0, 3500), true); }
  else if (k === 'ves') { pestPanel('chat'); verPagina(); }
  else if (k === 'foto') { const f = await H('foto', { ancho: 1440, calidad: 88 }); if (f) { await H('guardar-foto', { b64: f }); toast('📸 ' + T('Guardada en Imágenes/JARVIS', 'Saved to Pictures/JARVIS')); } }
  else if (k === 'vigilar' || k === 'cambios') { const r = await vigilarActual(k === 'vigilar' ? 'precio' : 'cambios'); decir(r.texto); }
  else if (k === 'telefono') enviarTelefono();
  else if (k === 'subtitulos') { const r = await enPaginaAsync(jsSubtitulos(IDIOMA, true, false)); decir(r && r.ok ? T('Subtítulos traducidos puestos ✓', 'Translated subtitles on ✓') : T('Abre un video de YouTube primero.', 'Open a YouTube video first.')); }
  else if (k === 'pip') { cerrarCapa('panel'); H('pip'); }
  else if (k === 'buscar') { cerrarCapa('panel'); abrirBuscar(); }
  else if (k === 'doblar') { decir(T('Preparando el doblaje…', 'Starting dubbing…')); const r = DOB.id ? (pararDoblaje(), { ok: true, estado: 'off' }) : await doblaje(true, IDIOMA);
    decir(r.ok ? (r.estado === 'off' ? T('Doblaje apagado', 'Dubbing off') : r.estado === 'on' ? T('🗣 Doblaje en vivo encendido. Toca otra vez para apagarlo.', '🗣 Live dubbing on. Tap again to turn it off.') : T('Hay un anuncio: el doblaje empieza solo cuando termine.', 'An ad is playing: dubbing starts by itself when it ends.')) : String(r.error)); }
  else if (k === 'a-pc') { const r = await seguirEnPC(); decir(r.ok ? T('💻 Listo: ya está abierto en la PC.', '💻 Done: it is open on the PC.') : String(r.error)); }
  else if (k === 'de-pc') { const r = await traerDePC(); decir(r.ok ? T('📲 Abierto lo que tenías en la PC.', '📲 Opened what you had on the PC.') : String(r.error)); }
  else if (k === 'capitulos') { pestPanel('chat'); chatear(T('Dame los capítulos de este video, cada uno con su minuto.', 'Give me the chapters of this video, each with its timestamp.')); }
  else if (k === 'precios') { pestPanel('chat'); chatear(T('¿Este producto está más barato en otra tienda? Compara precios.', 'Is this product cheaper in another store? Compare prices.')); }
  else if (k === 'camara') { pestPanel('chat'); chatear(T('¿Qué es esto que te enseño con la cámara? Dime qué es y búscalo.', 'What is this I\'m showing you with the camera? Tell me what it is and search it.')); }
});

// ── leer la página ──
async function leerPagina() {
  if (E.privada) return { ok: false, error: T('En una pestaña privada no miro ni envío nada.', "In a private tab I don't read or send anything.") };
  if (E.inicio) return { ok: false, error: T('Abre una página primero.', 'Open a page first.') };
  const r = await enPagina('({titulo: document.title, url: location.href, texto: (document.body ? document.body.innerText : "").replace(/\\n{3,}/g, "\\n\\n").slice(0, 60000)})');
  return { ok: Boolean(r && r.url), ...(r || {}) };
}
function errorIA(e) {
  if (e && e.sinLlaves) return T('Para pensar necesito una llave de IA. Póngala en Ajustes › Cerebro de JARVIS (la de Gemini es gratis).', 'I need an AI key to think. Add one in Settings › JARVIS brain (Gemini is free).');
  return T('La IA no respondió: ', "The AI didn't respond: ") + String((e && e.message) || e).slice(0, 160);
}
async function resumirTexto() {
  const pag = await leerPagina(); if (!pag.ok) return pag.error;
  if (/youtube\.com\/watch/.test(pag.url || '')) { const s = await enPaginaAsync(JS_SUBTITULOS); if (typeof s === 'string' && s.length > 200) pag.transcripcion = s; }
  try { return await Cerebro.resumir(pag, codIdioma(), cfg.ordenIA); } catch (e) { return errorIA(e); }
}
async function preguntar(q) {
  const pag = await leerPagina(); if (!pag.ok) return pag.error;
  try { return await Cerebro.preguntarPagina(q, pag, codIdioma(), cfg.ordenIA); } catch (e) { return errorIA(e); }
}
async function resumirAqui() {
  abrirPanel('chat'); msg('u', T('Resume esta página', 'Summarize this page'));
  const m = msg('j pensando', T('Resumiendo…', 'Summarizing…')); const t = await resumirTexto();
  m.className = 'msg j'; m.innerHTML = md(t); if (cfg.vozRespuestas) hablar(t);
}
async function verPagina() {
  abrirPanel('chat'); msg('u', T('¿Qué ves?', 'What do you see?'));
  const m = msg('j pensando', T('Mirando…', 'Looking…'));
  if (E.privada || E.inicio) { m.className = 'msg j'; m.textContent = E.privada ? T('En una pestaña privada no miro nada.', "I don't look at private tabs.") : T('Estamos en la página de inicio, señor.', "We're on the start page, sir."); return; }
  const r = await enPagina(JS_DESCRIBIR); const captura = await H('foto', { ancho: 900 });
  if (captura) { $('vista').hidden = false; $('vista-img').src = 'data:image/jpeg;base64,' + captura; $('vista-txt').textContent = '👁 ' + (E.titulo || ''); }
  try { const t = await Cerebro.describirPagina({ ...(r || {}), captura }, codIdioma(), cfg.ordenIA); m.className = 'msg j'; m.innerHTML = md(t); hablar(t); }
  catch (e) { m.className = 'msg j'; m.textContent = errorIA(e); }
  setTimeout(() => { $('vista').hidden = true; }, 8000);
}

// ── traducir la página en su sitio ──
let traduccion = 0;
async function traducirPagina(cod) {
  const yo = ++traduccion;
  if (E.privada) return toast(T('En una pestaña privada no envío nada.', "I don't send anything from private tabs."));
  if (!Cerebro.hayAlguna()) return toast(errorIA({ sinLlaves: true }), 4000);
  const destino = (cod && Cerebro.NOMBRE_IDIOMA[cod]) ? cod : codIdioma();
  const textos = await enPagina(JS_TEXTOS);
  if (!Array.isArray(textos) || !textos.length) return toast(T('Esta página no tiene texto para traducir.', 'This page has no text to translate.'));
  const tandas = []; let t = [];
  textos.forEach((x, i) => { t.push([i, x]); if (t.length >= 60 || t.reduce((a, [, s]) => a + s.length, 0) > 4500) { tandas.push(t); t = []; } });
  if (t.length) tandas.push(t);
  $('h-chips').innerHTML = `<span class="verde">🌐 ${T('TRADUCIENDO', 'TRANSLATING')} 0/${tandas.length}</span>`;
  let n = 0;
  for (const tanda of tandas) {
    if (yo !== traduccion) return;
    let tr; try { tr = await Cerebro.traducirLista(tanda.map(([, s]) => s), destino, cfg.ordenIA); } catch (e) { if (e.sinLlaves || e.status === 401 || e.status === 403) { toast(errorIA(e)); break; } continue; }
    const pares = tanda.map(([i], k) => [i, tr[k]]);
    await enPagina(`(() => { const L = ${JSON.stringify(pares)}; for (const [i, t] of L) { const n = window.__jarvisTxt && window.__jarvisTxt[i]; if (n && t) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), t); } })()`);
    $('h-chips').innerHTML = `<span class="verde">🌐 ${T('TRADUCIENDO', 'TRANSLATING')} ${++n}/${tandas.length}</span>`;
  }
  setTimeout(() => { $('h-chips').innerHTML = ''; }, 1500);
}

// ── voz: hablar (Android) y escuchar (micrófono → Gemini, entiende cualquier idioma) ──
let colaVoz = Promise.resolve();
async function hablar(texto, largo) {
  const t = paraVoz(texto); if (!t) return;
  if (cfg.vozMotor && cfg.vozMotor !== 'sistema') {
    const a = await Cerebro.voz(t.slice(0, largo ? 3000 : 1200), codIdioma(), cfg.vozMotor).catch(() => null);
    if (a && a.b64) { const au = new Audio(`data:${a.mime};base64,${a.b64}`); siguirOrbe(au); au.play().catch(() => {}); return; }
  }
  H('tts', { texto: t.slice(0, largo ? 3900 : 1500), lang: IDIOMA });
  document.body.style.setProperty('--voz', '.6'); setTimeout(() => document.body.style.setProperty('--voz', '0'), Math.min(9000, t.length * 55));
}
function siguirOrbe(au) {
  try { const c = new AudioContext(); const s = c.createMediaElementSource(au); const an = c.createAnalyser(); an.fftSize = 256; s.connect(an); an.connect(c.destination);
    const d = new Uint8Array(an.frequencyBinCount); const f = () => { an.getByteFrequencyData(d); const v = d.reduce((a, b) => a + b, 0) / d.length / 120; document.body.style.setProperty('--voz', Math.min(1, v).toFixed(2)); if (!au.paused) requestAnimationFrame(f); else document.body.style.setProperty('--voz', '0'); }; au.onplay = f;
  } catch { /* */ }
}
function aWav(muestras, sr) {
  const destino = 16000; const paso = sr / destino; const n = Math.floor(muestras.length / paso);
  const buf = new ArrayBuffer(44 + n * 2); const v = new DataView(buf); const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, destino, true); v.setUint32(28, destino * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, muestras[Math.floor(i * paso)])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  const b = new Uint8Array(buf); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(bin);
}
let grabando = null;
async function grabar(alTerminar) {   // graba hasta que te callas y devuelve el texto
  if (grabando) { pararGrabacion(); return; }
  if (!(await H('permiso', { tipo: 'microfono' }))) { toast(T('Dale permiso al micrófono y vuelve a tocar 🎙', 'Allow the microphone and tap 🎙 again')); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { toast(T('No pude usar el micrófono.', "Couldn't use the microphone.")); return; }
  const ctx = new AudioContext(); const fuente = ctx.createMediaStreamSource(stream); const proc = ctx.createScriptProcessor(4096, 1, 1);
  const g = { stream, ctx, fuente, proc, trozos: [], hablo: false, silencio: 0, alTerminar };
  proc.onaudioprocess = (e) => {
    const x = e.inputBuffer.getChannelData(0); g.trozos.push(new Float32Array(x));
    let s = 0; for (let i = 0; i < x.length; i += 8) s += x[i] * x[i]; const nivel = Math.sqrt(s / (x.length / 8));
    document.body.style.setProperty('--voz', Math.min(1, nivel * 6).toFixed(2));
    if (nivel > 0.02) { g.hablo = true; g.silencio = 0; } else if (g.hablo) { g.silencio += x.length / ctx.sampleRate; if (g.silencio > 1.6) pararGrabacion(); }
  };
  fuente.connect(proc); proc.connect(ctx.destination); g.tope = setTimeout(pararGrabacion, 30000);
  grabando = g; $('mic').classList.add('activo'); H('vibrar', { ms: 25 }); H('tts-parar');
}
async function pararGrabacion() {
  const g = grabando; if (!g) return; grabando = null;
  clearTimeout(g.tope); g.proc.disconnect(); g.fuente.disconnect(); g.stream.getTracks().forEach((t) => t.stop());
  const sr = g.ctx.sampleRate; g.ctx.close(); $('mic').classList.remove('activo'); document.body.style.setProperty('--voz', '0');
  const total = g.trozos.reduce((a, t) => a + t.length, 0); if (!g.hablo || total < sr * 0.4) return;
  const todo = new Float32Array(total); let o = 0; for (const t of g.trozos) { todo.set(t, o); o += t.length; }
  $('q').placeholder = T('Entendiendo…', 'Understanding…');
  try { const t = await Cerebro.transcribir(aWav(todo, sr), codIdioma(), cfg.ordenIA); g.alTerminar(String(t || '').trim()); }
  catch (e) { toast(e && e.sinAudio ? T('Para entender la voz necesito la llave de Gemini.', 'To understand speech I need a Gemini key.') : errorIA(e), 4000); }
  $('q').placeholder = T('Escríbele a JARVIS…', 'Message JARVIS…');
}
$('mic').addEventListener('click', () => grabar((t) => { const l = t.replace(/^\s*(hey|oye|ok)?[\s,]*j[ae]rv[ie]s[\s,.:!¡]*/i, '').trim(); if (l) chatear(l, true); }));

// ── el chat: JARVIS maneja el navegador con herramientas (piloto automático) ──
let turnoChat = 0;
async function herramienta(n, a) {
  const dirs = { down: 'abajo', up: 'arriba', top: 'inicio', bottom: 'final' };
  switch (n) {
    case 'open_url': { const url = aUrl(a.url); if (a.new_tab) await H('nueva', { url }); else await H('ir', { url }); await esperarCarga(); const e = await H('estado'); return { salida: { ok: true, titulo: e.titulo, url: e.url } }; }
    case 'web_search': { const url = aUrl(a.query + (a.query.includes('.') && !a.query.includes(' ') ? ' ' : '')); if (a.new_tab) await H('nueva', { url }); else await H('ir', { url: (BUSCADORES[cfg.buscador] || BUSCADORES.google)[1] + encodeURIComponent(a.query) }); await esperarCarga(); return { salida: { ok: true, url: (await H('estado')).url } }; }
    case 'read_page': { const r = await leerPagina(); const t = String(r.texto || ''); const partes = Math.max(1, Math.ceil(t.length / 15000)); const k = Math.min(partes, Math.max(1, Number(a.part) || 1)); return { salida: { ok: r.ok, titulo: r.titulo, url: r.url, parte: k, partes, texto: t.slice((k - 1) * 15000, k * 15000), error: r.error } }; }
    case 'see_page': { const p = priv(); if (p) return p; const el = await enPagina(JS_VER); const f = await H('foto', { ancho: 900 }); const e = await H('estado');
      return { salida: { ok: Array.isArray(el), titulo: e.titulo, url: e.url, elementos: (Array.isArray(el) ? el : []).slice(0, 120) }, imagen: f ? { mime: 'image/jpeg', data: f } : null }; }
    case 'click': { const r = await enPagina(`(() => { const el = ${buscarElemento(a.id, a.text)}; if (!el) return false; setTimeout(() => el.click(), 300); return (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 80) || true; })()`);
      if (!r) return { salida: { ok: false, error: 'Element not found.' } }; await pausa(900); await esperarCarga(4000); return { salida: { ok: true, clic: r, url: (await H('estado')).url } }; }
    case 'type_text': {
      const r = await enPagina(`(() => { const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
        const campos = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),textarea,[contenteditable=true],[role=textbox],[role=searchbox],[role=combobox]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2; });
        let el = ${a.id ? `document.querySelector('[data-jarvis-id="${Number(a.id)}"]')` : 'null'}; const q = norm(${JSON.stringify(a.field || '')});
        if (!el && q) el = campos.find((e) => [e.placeholder, e.getAttribute('aria-label'), e.name, e.id, e.title].some((t) => norm(t).includes(q)));
        if (!el) { const x = document.activeElement; el = (x && campos.includes(x)) ? x : (campos.find((e) => e.type === 'search' || e.getAttribute('role') === 'searchbox') || campos[0]); }
        if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus();
        const t = ${JSON.stringify(String(a.text || ''))};
        if ('value' in el) { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); set && set.set ? set.set.call(el, t) : (el.value = t); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        else document.execCommand('insertText', false, t);
        ${a.submit ? `setTimeout(() => { const f = el.form; if (f) { f.requestSubmit ? f.requestSubmit() : f.submit(); } else { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); } }, 150);` : ''}
        return true; })()`);
      if (!r) return { salida: { ok: false, error: 'No text field found.' } }; if (a.submit) await esperarCarga(); return { salida: { ok: true } };
    }
    case 'scroll': { const d = dirs[a.direction] || 'abajo'; await enPagina(d === 'inicio' ? 'scrollTo({top:0,behavior:"smooth"})' : d === 'final' ? 'scrollTo({top:document.body.scrollHeight,behavior:"smooth"})' : `scrollBy({top:${d === 'arriba' ? -1 : 1}*innerHeight*0.8,behavior:"smooth"})`); return { salida: { ok: true } }; }
    case 'navigate': { const m = { back: 'atras', forward: 'adelante', reload: 'recargar', home: 'inicio' }; await H(m[a.action] || 'recargar'); await esperarCarga(); return { salida: { ok: true, url: (await H('estado')).url } }; }
    case 'tabs': {
      if (a.action === 'new' || a.action === 'private') { await H('nueva', { url: a.url ? aUrl(a.url) : INICIO, privada: a.action === 'private' }); if (a.url) await esperarCarga(); return { salida: { ok: true } }; }
      if (a.action === 'close') { await H('cerrar', {}); return { salida: { ok: true } }; }
      const i = E.pestanas.findIndex((p) => p.id === E.activa); const L = E.pestanas.length;
      const destino = a.action === 'go' ? E.pestanas[Number(a.n) - 1] : E.pestanas[(i + (a.action === 'next' ? 1 : -1) + L) % L];
      if (destino) await H('activar', { id: destino.id }); return { salida: { ok: Boolean(destino) } };
    }
    case 'walkthrough_page': verPagina(); return { salida: { ok: true, note: 'Describing the page in the chat now.' }, fin: true };
    case 'summarize_page': return { salida: { ok: true, summary: await resumirTexto() } };
    case 'translate_page': { const p = priv(); if (p) return p; traducirPagina(a.language); return { salida: { ok: true, note: 'Translating the page now.' } }; }
    case 'read_aloud': { const r = await leerPagina(); if (r.ok) hablar(String(r.texto).slice(0, 3500), true); return { salida: { ok: r.ok } }; }
    case 'take_photo': { const f = await H('foto', { ancho: 1440, calidad: 88 }); if (f) await H('guardar-foto', { b64: f }); return { salida: { ok: Boolean(f), saved: 'Pictures/JARVIS' } }; }
    case 'remember': { if (cfg.memoriaJarvis === false) return { salida: { ok: false, error: 'Memory is off.' } }; if (E.privada) return { salida: { ok: false, error: 'Private tab.' } }; return { salida: recordar(a.fact) }; }
    case 'forget': return { salida: olvidarMemoria(a.what) };
    case 'zoom': { const z = a.direction === 'in' ? (E.zoom || 100) + 10 : a.direction === 'out' ? (E.zoom || 100) - 10 : 100; return { salida: { ok: true, zoom: await H('zoom', { pct: z }) } }; }
    case 'find_in_page': abrirBuscar(); $('buscar-q').value = a.text || ''; H('buscar-en-pagina', { texto: a.text || '' }); return { salida: { ok: true } };
    case 'list_tabs': return { salida: { ok: true, activa: E.pestanas.findIndex((p) => p.id === E.activa) + 1, pestanas: E.pestanas.map((p, i) => ({ n: i + 1, titulo: p.titulo, url: p.privada ? '(private)' : p.url })) } };
    case 'read_tab': { const p = E.pestanas[Number(a.n) - 1]; if (!p) return { salida: { ok: false, error: 'No such tab.' } }; if (p.privada) return { salida: { ok: false, error: 'Private tab.' } };
      const r = await enPagina('({titulo: document.title, url: location.href, texto: (document.body ? document.body.innerText : "").replace(/\\s+/g, " ").slice(0, 12000)})', p.id); return { salida: { ok: Boolean(r), ...(r || {}) } }; }
    case 'split_screen': return { salida: { ok: false, error: 'Split screen is a PC feature; on the phone use Android split screen (Recent apps › Split screen).' } };
    case 'picture_in_picture': return { salida: { ok: await H('pip') } };
    case 'save_game_clip': return { salida: { ok: false, error: 'Game clips are a PC feature (NVIDIA).' } };
    case 'send_to_phone': return { salida: await enviarTelefono({ captura: a.what === 'screenshot', nota: a.note, silencioso: true }) };
    case 'youtube_subtitles': { const r = await enPaginaAsync(jsSubtitulos((a.language || IDIOMA).slice(0, 2), a.on !== false, false)); return { salida: r || { ok: false } }; }
    case 'watch_page': return { salida: await vigilarActual(a.what === 'changes' ? 'cambios' : 'precio', a.target_price) };
    case 'check_scam': return { salida: await revisarEstafaAhora() };   // 🛡 [09-nov]
    case 'deep_research': return { salida: investigarFondo(String(a.topic || '').slice(0, 300)) };   // 🕵 [09-nov]
    case 'continue_on_pc': return { salida: await seguirEnPC() };   // 🔄 [09-nov]
    case 'compare_prices': return { salida: await compararAhora(a.product) };   // 💰 [09-nov]
    case 'ask_video': {   // 🎬 [09-nov]
      if (cfg.preguntaVideo === false) return { salida: { ok: false, error: '«Ask the video» is turned off in Settings.' } };
      if (!esYT(E.url)) return { salida: { ok: false, error: 'Open a YouTube video first.' } };
      try { return { salida: { ok: true, respuesta: await Cerebro.preguntarVideo(E.url, a.question || 'Give me the chapters of this video.', IDIOMA), nota: 'Give this answer keeping every [MM:SS] timestamp exactly as written: they become buttons that jump to that moment.' } }; }
      catch (e) { return { salida: { ok: false, error: String(e.message || e) } }; }
    }
    case 'browser_memory': {   // 🧠 [09-nov]
      if (cfg.memoriaNavegador === false || !cfg.guardarHistorial) return { salida: { ok: false, error: 'Browser memory is turned off in Settings.' } };
      const l = buscarRecuerdos(a.query || ''); return { salida: { ok: true, total: l.length, paginas: l } };
    }
    case 'live_dubbing': return { salida: await doblaje(a.on !== false, a.language) };   // 🗣 [09-nov]
    case 'look_through_camera': {   // 📸 [09-nov]
      const r = await fotoConCamara(); if (!r.ok) return { salida: r };
      return { salida: { ok: true, nota: 'Photo from the phone camera. Say what it is and search it with web_search if useful.' }, imagen: { mime: 'image/jpeg', data: r.data } };
    }
    case 'browser_history': { const desde = a.days ? Date.now() - a.days * 864e5 : 0; const q = String(a.query || '').toLowerCase();
      const l = historial.filter((h) => h.t >= desde && (!q || (h.titulo + h.url).toLowerCase().includes(q))).slice(-60).reverse().map((h) => ({ cuando: new Date(h.t).toLocaleString(), titulo: h.titulo, url: h.url, busqueda: busquedaDe(h.url) || undefined }));
      return { salida: { ok: true, total: l.length, items: l } }; }
    default: return { salida: { ok: false, error: 'unknown tool' } };
  }
}
let chatResp = null; let chatTexto = '';
function trabajando(on) { document.body.classList.toggle('pensando', on); $('parar').hidden = !on; $('enviar').hidden = on; }
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
const esperaMs = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function abrirPorVoz(s, porVoz) {
  const dicho = s.busqueda ? T(`Buscando «${s.escribir}» en ${s.nombre}, señor.`, `Searching ${s.nombre} for “${s.escribir}”, sir.`) : T(`Abriendo ${s.nombre}, señor.`, `Opening ${s.nombre}, sir.`);
  msg('j', dicho); if (porVoz) hablar(dicho);
  await esperaMs(500); cerrarCapa('panel');
  if (!E.inicio) { await H('nueva', { url: INICIO }); await esperaMs(250); }
  // se ve cómo lo escribe arriba (sin abrir el teclado del teléfono)
  const d = $('dir'); window.dirAnimando = true; d.value = '';
  try { for (const c of s.escribir) { d.value += c; await esperaMs(c === ' ' ? 30 : 45); } await esperaMs(200); }
  finally { window.dirAnimando = false; }
  H('vibrar', { ms: 12 }); H('ir', { url: s.url });
}
async function chatear(q, porVoz = false) {
  q = String(q || '').trim(); if (!q) return;
  const sitio = sitioDeVoz(q);
  if (sitio) { abrirPanel('chat'); msg('u', q); abrirPorVoz(sitio, porVoz); return; }
  if (/^(jarvis[,\s]+)?((qu[eé]|q)\s+(ves|hay)(\s+(en|aqu[ií]))?(\s+(la|esta)\s+p[aá]gina)?|descr[ií]be(me)?\s+(la|esta)\s+p[aá]gina|what do you see|describe (this|the) page)\s*[?.!]*$/i.test(q)) { verPagina(); return; }
  abrirPanel('chat'); msg('u', q);
  const m = msg('j pensando', T('Pensando…', 'Thinking…')); trabajando(true);
  const yo = ++turnoChat; let pasos = null;
  try {
    const r = await Cerebro.chat(q, {
      cod: codIdioma(), orden: cfg.ordenIA, memoria: cfg.memoriaJarvis !== false && !E.privada ? memoria.slice(-80).map((x) => x.texto) : null,
      pagina: async () => ({ titulo: E.titulo || '', url: E.privada ? '(private tab)' : (E.inicio ? '' : E.url || '') }),
      evento: (tipo, texto, detalle) => {
        if (yo !== turnoChat || tipo !== 'herramienta') return;
        if (!pasos) { m.className = 'msg j'; m.textContent = ''; pasos = document.createElement('ol'); pasos.className = 'pasos'; m.appendChild(pasos); }
        pasos.querySelectorAll('li.ahora').forEach((x) => x.classList.remove('ahora'));
        const li = document.createElement('li'); li.className = 'ahora'; li.textContent = (IDIOMA === 'es' ? texto : (ETIQ_EN[texto] || texto)) + (detalle ? ' · ' + detalle : ''); pasos.appendChild(li);
        $('charla').scrollTop = $('charla').scrollHeight;
      },
      ejecutar: herramienta,
    });
    if (yo !== turnoChat || r.cancelado) return;
    m.className = 'msg j'; const cuerpo = document.createElement('div'); cuerpo.innerHTML = md(r.texto); m.appendChild(cuerpo);
    if (pasos) pasos.querySelectorAll('li.ahora').forEach((x) => x.classList.remove('ahora'));
    if (cfg.vozRespuestas) hablar(r.texto);
  } catch (e) { if (yo === turnoChat) { m.className = 'msg j'; m.textContent = errorIA(e); if (e && e.sinLlaves) $('sin-llave').hidden = false; } }
  finally { if (yo === turnoChat) trabajando(false); $('charla').scrollTop = $('charla').scrollHeight; }
}
const ETIQ_EN = { Abriendo: 'Opening', Buscando: 'Searching', Leyendo: 'Reading', Mirando: 'Looking', 'Haciendo clic': 'Clicking', Escribiendo: 'Typing', Desplazando: 'Scrolling', Navegando: 'Navigating',
  Pestañas: 'Tabs', 'Recorriendo la página': 'Walking through', Resumiendo: 'Summarizing', 'Traduciendo la página': 'Translating', Recordando: 'Remembering', Olvidando: 'Forgetting', Zoom: 'Zoom' };
$('form-chat').addEventListener('submit', (ev) => { ev.preventDefault(); const q = $('q').value; $('q').value = ''; chatear(q); });
$('parar').addEventListener('click', () => { turnoChat++; Cerebro.parar(); trabajando(false); H('tts-parar'); });

// ── memoria ──
function recordar(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (t.length < 3) return { ok: false };
  if (/\b(?:\d[ -]?){13,19}\b|\b(contraseña|password|clave|pin|cvv|token|api.?key)\b\s*(?:es|is|:|=)\s*\S{3,}/i.test(t)) return { ok: false, error: 'I never store passwords, cards or keys.' };
  if (!memoria.some((x) => x.texto.toLowerCase() === t.toLowerCase())) { memoria.push({ id: Math.random().toString(16).slice(2, 10), texto: t, t: Date.now() }); if (memoria.length > 120) memoria.shift(); Datos.guardar('memoria', memoria); }
  return { ok: true, total: memoria.length };
}
function olvidarMemoria(que) {
  const ws = String(que || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const antes = memoria.length; memoria = memoria.filter((x) => !(x.id === que || (ws.length && ws.every((w) => x.texto.toLowerCase().includes(w)))));
  Datos.guardar('memoria', memoria); return { ok: antes !== memoria.length, quitadas: antes - memoria.length };
}

// ── mandar al teléfono / a Telegram ──
async function enviarTelefono(o = {}) {
  const ll = await H('llaves'); const chat = cfg.telegramChat && cfg.telegramChat.id;
  const url = o.url || E.url;
  if (!(ll && ll.telegram && ll.telegram.puesta) || !chat) {   // sin Telegram: el menú de compartir de Android
    if (!o.silencioso) H('compartir', { texto: url, titulo: E.titulo });
    return { ok: false, error: 'Telegram is not connected; opened the Android share menu.' };
  }
  try {
    let r;
    if (o.captura) { const f = await H('foto', { ancho: 1440, calidad: 85 }); r = await Nativo.fetch('https://api.telegram.org/bot{{LLAVE:telegram}}/sendPhoto', { method: 'POST', form: { chat_id: String(chat), caption: `📸 ${E.titulo || ''}\n${url}`.slice(0, 1000) }, archivo: { campo: 'photo', nombre: 'jarvis.jpg', mime: 'image/jpeg', b64: f } }); }
    else r = await Nativo.fetch('https://api.telegram.org/bot{{LLAVE:telegram}}/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: `${o.nota ? o.nota + '\n' : ''}🔗 ${E.titulo || ''}\n${url}` }) });
    const ok = r.ok; toast(ok ? '📱 ' + T('Enviado a Telegram', 'Sent to Telegram') : T('Telegram no lo aceptó', "Telegram didn't accept it"));
    return { ok };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ── vigilante de precios y cambios (revisa cada hora mientras la app está abierta) ──
let vigilancias = [];
window.alArrancar.push(async () => { vigilancias = (await Datos.cargar('vigilancias', [])) || []; setTimeout(revisarVigilancias, 60000); setInterval(revisarVigilancias, 10 * 60000); });
async function vigilarActual(tipo, objetivo) {
  if (E.privada || E.inicio) return { ok: false, texto: T('Abre una página normal primero.', 'Open a regular page first.') };
  const r = await enPagina(JS_PRECIO);
  const v = { id: Math.random().toString(16).slice(2, 10), url: E.url, titulo: E.titulo, tipo, objetivo: objetivo || null, precio: r && r.precio, moneda: (r && r.moneda) || '$', t: Date.now(), ultima: Date.now() };
  if (tipo === 'cambios') { const t = await enPagina('(document.body ? document.body.innerText : "").slice(0, 8000)'); v.texto = String(t || ''); }
  else if (!v.precio) return { ok: false, texto: T('No encontré un precio en esta página.', "I couldn't find a price on this page.") };
  vigilancias = vigilancias.filter((x) => x.url !== v.url || x.tipo !== tipo); vigilancias.push(v); Datos.guardar('vigilancias', vigilancias);
  return { ok: true, texto: tipo === 'precio' ? T(`🔔 Vigilando el precio: ${v.moneda}${v.precio}. Te aviso si baja.`, `🔔 Watching the price: ${v.moneda}${v.precio}. I'll tell you if it drops.`) : T('👀 Vigilando cambios en esta página.', '👀 Watching this page for changes.') };
}
async function revisarVigilancias() {
  if (cfg.vigilar === false) return;
  for (const v of vigilancias) {
    if (Date.now() - (v.ultima || 0) < 55 * 60000) continue;
    v.ultima = Date.now();
    try {
      if (v.tipo === 'precio') {
        const r = await H('oculto', { url: v.url, js: JS_PRECIO, espera: 3000 });
        if (r && r.precio && v.precio && r.precio < v.precio) {
          const t = T(`Bajó de precio: ${v.titulo} — ${v.moneda}${v.precio} → ${v.moneda}${r.precio}`, `Price drop: ${v.titulo} — ${v.moneda}${v.precio} → ${v.moneda}${r.precio}`);
          H('notificar', { titulo: '🔔 JARVIS', texto: t }); v.precio = r.precio;
        }
      } else {
        const t = await H('oculto', { url: v.url, js: '(document.body ? document.body.innerText : "").slice(0, 8000)', espera: 3000 });
        if (typeof t === 'string' && v.texto && t !== v.texto) {
          let frase = '';
          try { const x = await Cerebro.pensar({ sistema: 'You compare two versions of a web page.', historia: [{ rol: 'user', texto: `Page "${v.titulo}".\nBEFORE: ${v.texto.slice(0, 3500)}\n\nNOW: ${t.slice(0, 3500)}\n\nIf there is something meaningfully new, reply with ONE short sentence in ${Cerebro.idiomaDe(IDIOMA)} saying what. Otherwise reply exactly SAME.` }], max: 120 }, cfg.ordenIA); frase = x.texto.trim(); } catch { /* */ }
          if (frase && !/^SAME/i.test(frase)) H('notificar', { titulo: '👀 ' + v.titulo, texto: frase });
          v.texto = t;
        }
      }
    } catch { /* la próxima vez */ }
  }
  Datos.guardar('vigilancias', vigilancias);
}
