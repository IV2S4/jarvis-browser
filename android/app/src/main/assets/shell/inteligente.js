'use strict';
// 🚀 Funciones inteligentes del teléfono [09-nov] — cada una se apaga en Ajustes › Funciones inteligentes.
//   🧠 Memoria del navegador: un pedacito del texto de cada página (solo en el teléfono) para encontrarla después.
//   🗣 Doblaje en vivo: lee en voz alta, con la voz NATIVA del idioma (la de Google/Samsung), los subtítulos traducidos.
//   📸 Busca lo que ves: la cámara de atrás; apuntas, tocas el botón y JARVIS te dice qué es y lo busca.

// ═══════════ 🧠 memoria del navegador ═══════════
let recuerdos = []; let recuerdosT = 0; let recordarT = 0;
Datos.cargar('recuerdos', []).then((v) => { recuerdos = Array.isArray(v) ? v : []; });
const SENSIBLE = /(^|\.)(bank|banco|banking|paypal|mail\.google|outlook\.live|accounts\.google|login\.|signin\.|auth\.)|chase\.com|bankofamerica|wellsfargo|popular\.com|bancopopular|coinbase|binance/i;
const JS_RECUERDO = `(() => {
  if (document.querySelector('input[type=password]')) return null;
  const m = (n) => { const e = document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]'); return e ? e.content : ''; };
  const alts = [...document.images].map((i) => i.alt).filter((a) => a && a.length > 3).slice(0, 25).join(' · ');
  return { url: location.href, titulo: document.title, desc: m('description') || m('og:description'), alts, texto: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 2500) };
})()`;
const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
nav.en('navegado', (h) => {
  if (cfg.memoriaNavegador === false || !cfg.guardarHistorial || !h || !/^https?:/.test(h.url) || E.privada) return;
  let host = ''; try { host = new URL(h.url).hostname; } catch { return; }
  if (SENSIBLE.test(host)) return;
  clearTimeout(recordarT);
  recordarT = setTimeout(async () => {
    if (E.privada) return;
    const d = await enPagina(JS_RECUERDO); if (!d || !d.url || d.url.split('#')[0] !== h.url.split('#')[0]) return;
    let texto = [d.desc, d.alts, d.texto].filter(Boolean).join(' · ').slice(0, 3000);
    for (const r of [/\b(?:\d[ -]?){13,19}\b/g, /\b\d{3}-?\d{2}-?\d{4}\b/g]) texto = texto.replace(r, '…');
    const url = d.url.split('#')[0];
    recuerdos = recuerdos.filter((x) => x.url !== url); recuerdos.push({ url, titulo: String(d.titulo || '').slice(0, 200), texto, t: Date.now() });
    if (recuerdos.length > 1500) recuerdos = recuerdos.slice(-1500);
    clearTimeout(recuerdosT); recuerdosT = setTimeout(() => Datos.guardar('recuerdos', recuerdos), 3000);
  }, 3500);
});
function buscarRecuerdos(consulta, max = 12) {
  const palabras = [...new Set(normal(consulta).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2))].map((w) => (w.length > 5 ? w.slice(0, -2) : w));
  const res = [];
  for (const x of recuerdos) {
    const ti = normal(x.titulo); const te = normal(x.texto); const u = normal(x.url); let p = 0;
    for (const w of palabras) { if (ti.includes(w)) p += 3; if (te.includes(w)) p += 1; if (u.includes(w)) p += 1; }
    if (p > 0 || !palabras.length) res.push([p + x.t / 1e13, x]);
  }
  return res.sort((a, b) => b[0] - a[0]).slice(0, max).map(([, x]) => {
    const n = normal(x.texto); const w = palabras.find((q) => n.includes(q)); const i = w ? n.indexOf(w) : 0;
    return { cuando: new Date(x.t).toLocaleString(), titulo: x.titulo, url: x.url, trozo: x.texto.slice(Math.max(0, i - 90), i + 160) };
  });
}
function borrarRecuerdos() { recuerdos = []; Datos.guardar('recuerdos', recuerdos); }

// ═══════════ 🗣 doblaje en vivo ═══════════
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
      if (v.volume > 0.151) { D.vol = v.volume; v.volume = 0.15; }
      const t = leer();
      if (t && t !== D.ultimo) { const n = nuevo(D.ultimo, t); D.ultimo = t; if (n) { D.buf = (D.buf ? D.buf + ' ' : '') + n; D.bufT = Date.now(); } }
      if (D.buf && (/[.!?…]$/.test(D.buf) || Date.now() - D.bufT > 1000 || D.buf.split(' ').length > 16)) { D.salida.push(D.buf); D.buf = ''; if (D.salida.length > 6) D.salida.splice(0, D.salida.length - 6); }
    }, 250);
    return 'encendido';
  })()`;
}
const JS_DOBLAJE_SACAR = `(() => { const d = window.__jarvisDoblaje; if (!d || !d.activo) return null; const v = document.querySelector('#movie_player video') || document.querySelector('video'); return { lineas: d.salida.splice(0), pausado: !v || v.paused }; })()`;
const DOB = { reloj: 0, id: 0, lang: 'es', url: '' };
const esYT = (u) => /^https:\/\/(www\.|m\.)?youtube\.com\/(watch|shorts)|^https:\/\/youtu\.be\//.test(u || '');
const hayAnuncio = () => enPagina("!!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting, .ad-showing')");
async function doblaje(on = true, lang) {
  if (cfg.doblajeEnVivo === false) return { ok: false, error: 'Live dubbing is turned off in Settings › Smart features.' };
  if (!on) { pararDoblaje(); return { ok: true, estado: 'off' }; }
  const L = String(lang || IDIOMA || 'es').slice(0, 2).toLowerCase();
  if (!(await H('tts-idioma', { lang: L }))) return { ok: false, error: `This phone has no native ${L} voice installed (Android Settings › Text-to-speech › Google › Install voice data). Only subtitles.` };
  if (esYT(E.url)) {
    if (await hayAnuncio()) {   // durante un anuncio no hay subtítulos: empieza solo al terminar
      (async () => { for (let i = 0; i < 60 && await hayAnuncio(); i++) await pausa(2000); doblaje(true, L); })();
      return { ok: true, estado: 'waiting for the ad to end', nota: 'Dubbing starts by itself when the ad ends.' };
    }
    let s = null; for (let i = 0; i < 3 && !(s && s.ok); i++) { s = await enPaginaAsync(jsSubtitulos(L, true, false)); if (!(s && s.ok)) await pausa(2500); }
    if (!(s && s.ok)) return { ok: false, error: 'This video has no subtitles (not even automatic ones).' };
  }
  const r = await enPagina(jsDoblaje(true));
  if (r === 'sin-video') return { ok: false, error: 'There is no video on this page.' };
  if (r !== 'encendido') return { ok: false, error: 'Could not start dubbing here.' };
  if (DOB.id && DOB.id !== E.activa) enPagina(jsDoblaje(false), DOB.id);
  DOB.id = E.activa; DOB.lang = L; DOB.url = E.url; clearInterval(DOB.reloj);
  DOB.reloj = setInterval(async () => {
    if (!E.pestanas.some((p) => p.id === DOB.id)) return pararDoblaje();
    const p = E.pestanas.find((x) => x.id === DOB.id);
    if (p && p.url !== DOB.url) {   // otro video en la misma pestaña: subtítulos otra vez
      DOB.url = p.url;
      if (esYT(p.url)) setTimeout(async () => { for (let i = 0; i < 60 && await hayAnuncio(); i++) await pausa(2000); enPaginaAsync(jsSubtitulos(DOB.lang, true, false), 15000, DOB.id); }, 2500);
    }
    const x = await enPagina(JS_DOBLAJE_SACAR, DOB.id);
    if (x === null) { enPagina(jsDoblaje(true), DOB.id); return; }
    if (!x) return;
    if (x.pausado) { H('tts-parar'); return; }
    for (const l of x.lineas || []) H('tts', { texto: l, lang: DOB.lang, velocidad: 1.12, cola: true, nativa: true });
  }, 400);
  toast('🗣 ' + T('Doblaje en vivo encendido', 'Live dubbing on'));
  return { ok: true, estado: 'on', idioma: L };
}
function pararDoblaje() {
  clearInterval(DOB.reloj); DOB.reloj = 0;
  if (DOB.id) enPagina(jsDoblaje(false), DOB.id);
  DOB.id = 0; H('tts-parar');
}

// ═══════════ 📸 busca lo que ves (cámara de atrás) ═══════════
function fotoConCamara() {
  return new Promise(async (resolve) => {
    if (cfg.buscaLoQueVes === false) { resolve({ ok: false, error: '«Search what you see» is turned off in Settings.' }); return; }
    if ((await H('permiso', { tipo: 'camara' })) === false) {
      await new Promise((ok) => { const f = () => ok(); nav.en('permisos', f); setTimeout(ok, 30000); });
      if ((await H('permiso', { tipo: 'camara' })) === false) { resolve({ ok: false, error: 'No camera permission.' }); return; }
    }
    let s = null;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } }); }
    catch (e) { resolve({ ok: false, error: e && e.name === 'NotAllowedError' ? 'Camera blocked' : String((e && e.message) || e) }); return; }
    H('cubrir', { on: true });
    const capa = document.createElement('div'); capa.id = 'camara-busca';
    capa.innerHTML = `<video playsinline muted autoplay></video><p>${T('Apunta a lo que quieres buscar', 'Point at what you want to search')}</p>
      <div><button class="x">✕</button><button class="disparo" aria-label="Foto">📸</button></div>`;
    document.body.appendChild(capa);
    const v = capa.querySelector('video'); v.srcObject = s; v.play().catch(() => {});
    const cerrar = (r) => { s.getTracks().forEach((t) => t.stop()); capa.remove(); if (!pilaCapas.length) H('cubrir', { on: false }); resolve(r); };
    const limite = setTimeout(() => cerrar({ ok: false, error: 'The user did not take the photo.' }), 90000);
    capa.querySelector('.x').onclick = () => { clearTimeout(limite); cerrar({ ok: false, error: 'The user cancelled the photo.' }); };
    capa.querySelector('.disparo').onclick = () => {
      clearTimeout(limite); H('vibrar', { ms: 30 });
      const c = document.createElement('canvas'); const w = v.videoWidth || 960; const h = v.videoHeight || 720; const k = Math.min(1, 1024 / Math.max(w, h));
      c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      cerrar({ ok: true, data: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
    };
  });
}
