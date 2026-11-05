'use strict';
// tema de colores [04-nov]: se lee de las variables CSS --c1 / --c2
const TEMA = { c1: '56,214,255', c2: '127,233,255' };
function leerTema() { const cs = getComputedStyle(document.documentElement); TEMA.c1 = cs.getPropertyValue('--c1').trim().replace(/\s/g, '') || TEMA.c1; TEMA.c2 = cs.getPropertyValue('--c2').trim().replace(/\s/g, '') || TEMA.c2; }
function ponerTema(t) { const v = t && t !== 'cian' ? t : ''; if ((document.documentElement.dataset.tema || '') === v) return; if (v) document.documentElement.dataset.tema = v; else delete document.documentElement.dataset.tema; leerTema(); }
// Centro de mando JARVIS [04-nov]: reloj, orbe que late con la voz, sistema en vivo, página activa con su mapa y registro de eventos.
const $ = (id) => document.getElementById(id);
const H = (accion, d) => window.nav.hacer(accion, d);
let idioma = 'en';
const T = (es, en) => (idioma === 'es' ? es : en);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dpr = () => Math.min(2, devicePixelRatio || 1);
function lienzo(cv) {
  const r = cv.getBoundingClientRect(); const k = dpr();
  const W = Math.max(10, Math.round(r.width)); const Hh = Math.max(10, Math.round(r.height));
  if (cv.width !== W * k || cv.height !== Hh * k) { cv.width = W * k; cv.height = Hh * k; }
  const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); return [c, W, Hh];
}

// ── reloj ──
function reloj() {
  const d = new Date(); const loc = idioma === 'es' ? 'es-PR' : 'en-US';
  $('hora').textContent = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('fecha').textContent = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
}
setInterval(reloj, 1000);

// ── registro de eventos ──
function log(texto, clase = '') {
  const d = document.createElement('div'); d.className = clase;
  d.innerHTML = `<i>${new Date().toLocaleTimeString('en-GB')}</i>${esc(texto)}`;
  $('log').prepend(d);
  while ($('log').children.length > 40) $('log').lastChild.remove();
}

// ── estado del orbe ──
let voz = 0; let vozSuave = 0; let pensando = false; let gaming = null; let alertaHasta = 0;
function modo() {
  document.body.classList.toggle('habla', voz > 0.02);
  document.body.classList.toggle('gaming', Boolean(gaming));
  document.body.classList.toggle('alerta', Date.now() < alertaHasta);
  $('modo').textContent = Date.now() < alertaHasta ? 'ALERT' : voz > 0.02 ? 'SPEAKING' : pensando ? 'THINKING' : gaming ? 'GAMING MODE' : 'STANDBY';
}
window.nav.en('mando-voz', (v) => { voz = Number(v) || 0; modo(); });

// ── fondo: rejilla y partículas suaves ──
const parts = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), v: 0.0002 + Math.random() * 0.0006 }));
function fondo() {
  const [c, W, Hh] = lienzo($('fondo'));
  c.clearRect(0, 0, W, Hh);
  c.strokeStyle = `rgba(${TEMA.c1},.045)`; c.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, Hh); c.stroke(); }
  for (let y = 0; y < Hh; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.fillStyle = `rgba(${TEMA.c2},.35)`;
  for (const p of parts) { p.y -= p.v; if (p.y < 0) { p.y = 1; p.x = Math.random(); } c.fillRect(p.x * W, p.y * Hh, 1.5, 1.5); }
}

// ── orbe ──
function orbe(t) {
  const [c, W, Hh] = lienzo($('orbe'));
  c.clearRect(0, 0, W, Hh);
  vozSuave += (voz - vozSuave) * 0.25;
  const cx = W / 2; const cy = Hh / 2 - 8; const R = Math.min(W, Hh) * 0.36;
  const alerta = Date.now() < alertaHasta;
  const col = alerta ? '255,92,122' : gaming ? '61,255,181' : TEMA.c1;
  const s = t / 1000;
  // anillos
  const anillo = (r, ancho, vel, trazo, hueco, alfa) => {
    c.save(); c.translate(cx, cy); c.rotate(s * vel); c.strokeStyle = `rgba(${col},${alfa})`; c.lineWidth = ancho; c.setLineDash([trazo, hueco]);
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); c.restore();
  };
  anillo(R, 2, 0.4, 60, 22, 0.8);
  anillo(R * 0.86, 1, -0.7, 4, 7, 0.6);
  anillo(R * 1.12, 1, 0.15, 120, 40, 0.35);
  anillo(R * 0.7, 3, pensando ? 3 : 1.2, 30, 50, 0.7);
  // marcas
  c.save(); c.translate(cx, cy); c.strokeStyle = `rgba(${col},.4)`; c.lineWidth = 1;
  for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; const r1 = R * 1.22; const r2 = r1 + (i % 5 ? 4 : 9); c.beginPath(); c.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); c.stroke(); }
  c.restore();
  // núcleo: late con la voz
  const pulso = 0.5 + 0.5 * Math.sin(s * (pensando ? 6 : 2));
  const rn = R * (0.36 + vozSuave * 0.28 + pulso * 0.03);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rn * 1.9);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.25, `rgba(${col},.85)`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rn * 1.9, 0, Math.PI * 2); c.fill();
  // ondas de voz
  if (vozSuave > 0.02) {
    c.strokeStyle = `rgba(${col},.55)`; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2; const r = R * 0.62 + Math.sin(a * 8 + s * 9) * vozSuave * 14 + Math.sin(a * 3 - s * 5) * vozSuave * 8; const x = cx + Math.cos(a) * r; const y = cy + Math.sin(a) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
}

// ── medidores circulares y gráfica ──
const hist = { cpu: [], gpu: [], ram: [] };
function medidor(id, v, max, texto, rojoDesde) {
  const el = $(id); const cv = el.querySelector('canvas'); const [c, W] = lienzo(cv);
  const r = W / 2 - 7; const k = Math.max(0, Math.min(1, (v || 0) / max));
  const col = v >= rojoDesde ? '#ff5c7a' : v >= rojoDesde * 0.85 ? '#ffc94d' : `rgb(${TEMA.c1})`;
  c.clearRect(0, 0, W, W); c.lineCap = 'round';
  c.strokeStyle = `rgba(${TEMA.c1},.12)`; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, W / 2, r, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
  c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.arc(W / 2, W / 2, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * k)); c.stroke(); c.shadowBlur = 0;
  el.querySelector('b').textContent = texto;
}
function grafica() {
  const [c, W, Hh] = lienzo($('grafica'));
  c.clearRect(0, 0, W, Hh);
  c.strokeStyle = `rgba(${TEMA.c1},.08)`; for (let y = 0; y <= Hh; y += Hh / 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  const linea = (datos, color) => {
    if (datos.length < 2) return;
    c.strokeStyle = color; c.lineWidth = 1.6; c.beginPath();
    datos.forEach((v, i) => { const x = (i / 59) * W; const y = Hh - 2 - (v / 100) * (Hh - 4); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke(); c.lineTo(((datos.length - 1) / 59) * W, Hh); c.lineTo(0, Hh); c.closePath(); c.fillStyle = color.replace(/[\d.]+\)$/, '.08)'); c.fill();
  };
  linea(hist.ram, `rgba(${TEMA.c2},.6)`); linea(hist.gpu, 'rgba(61,255,181,.9)'); linea(hist.cpu, `rgba(${TEMA.c1},1)`);
}
const tasa = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB/s` : b >= 1024 ? `${Math.round(b / 1024)} KB/s` : `${Math.round(b || 0)} B/s`);
let tempAvisada = false;
function monitor(m) {
  if (!m) return;
  const push = (k, v) => { hist[k].push(v); if (hist[k].length > 60) hist[k].shift(); };
  push('cpu', m.cpu); push('ram', m.ram); push('gpu', m.gpu ? m.gpu.uso : 0);
  medidor('g-cpu', m.cpu, 100, `${m.cpu}%`, 90); medidor('g-ram', m.ram, 100, `${m.ram}%`, 90);
  if (m.gpu) {
    medidor('g-gpu', m.gpu.uso, 100, `${m.gpu.uso}%`, 98); medidor('g-temp', m.gpu.temp, 95, `${m.gpu.temp}°`, 83); $('vram').textContent = `${m.gpu.vram}%`;
    if (m.gpu.temp >= 85 && !tempAvisada) { tempAvisada = true; log(T(`GPU caliente: ${m.gpu.temp}°C`, `GPU running hot: ${m.gpu.temp}°C`), 'mal'); alertaHasta = Date.now() + 4000; }
    if (m.gpu.temp < 78) tempAvisada = false;
  }
  if (m.red) { $('bajada').textContent = tasa(m.red.bajada); $('subida').textContent = tasa(m.red.subida); }
  grafica();
}
window.nav.en('monitor', monitor);

// ── página activa + mapa de conexiones ──
let E = null; let mapaDatos = null; let bits = null; let urlMapa = ''; let mapaT = null;
function pintarEstado(e) {
  const antes = E; E = e; ponerTema(e.tema);
  const p = (e.pestanas || []).find((x) => x.id === e.activa) || {};
  $('p-titulo').textContent = p.titulo || '—';
  let host = ''; try { host = new URL(e.url).hostname.replace(/^www\./, ''); } catch { /* */ }
  $('p-host').textContent = host || T('página de inicio', 'start page');
  const ico = p.icono || (host ? `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(host)}` : '');
  $('p-ico').style.visibility = ico ? 'visible' : 'hidden'; if (ico && $('p-ico').src !== ico) $('p-ico').src = ico;
  $('f-pest').textContent = `${(e.pestanas || []).length} TABS`;
  const g = e.gaming;
  if (g && !gaming) log(T(`Modo gaming: ${g.juego}`, `Gaming mode: ${g.juego}`), 'ok');
  if (!g && gaming) log(T('Modo gaming apagado', 'Gaming mode off'));
  gaming = g; $('modo-sub').textContent = g ? `${g.juego}${g.liberado ? ` · ${g.liberado} MB ${T('liberados', 'freed')}` : ''}` : (host ? host : T('Todo en orden', 'All systems nominal'));
  if (!antes || antes.url !== e.url) { clearTimeout(mapaT); mapaT = setTimeout(cargarMapa, 1800); }
  modo();
}
window.nav.en('estado', pintarEstado);
function pintarEscaneo(r) {
  const el = $('riesgo');
  if (!r) { el.textContent = '—'; el.className = 'riesgo'; ['d-rast', 'd-anun', 'd-terc'].forEach((i) => { $(i).textContent = '0'; }); $('d-https').textContent = '—'; return; }
  el.textContent = `RISK ${String(r.nivel === 'bajo' ? 'LOW' : r.nivel === 'medio' ? 'MEDIUM' : 'HIGH')}`; el.className = `riesgo ${r.nivel}`;
  $('d-rast').textContent = r.rastreadores; $('d-anun').textContent = r.anuncios; $('d-terc').textContent = r.terceros; $('d-https').textContent = r.https ? 'HTTPS' : 'HTTP';
}
window.nav.en('escaner', (r) => { pintarEscaneo(r); clearTimeout(mapaT); mapaT = setTimeout(cargarMapa, 1200); });
async function cargarMapa() {
  const r = await H('mapa').catch(() => null);
  if (!r || !r.ok) { mapaDatos = null; $('mapa-txt').textContent = T('Abre una página web para ver sus conexiones', 'Open a web page to see its connections'); return; }
  mapaDatos = r; urlMapa = r.url; pintarEscaneo(r);
  const paises = new Set(r.servidores.map((s) => s.cc)).size;
  $('mapa-txt').textContent = `${r.servidores.length} ${T('servidores', 'servers')} · ${paises} ${T('países', 'countries')}${r.yo ? ` · ${T('tú', 'you')}: ${r.yo.ciudad || r.yo.pais}` : ''}`;
}
setInterval(() => { if (urlMapa) cargarMapa(); }, 45000);
function mapa(t) {
  const M = window.MAPA_MUNDO; if (!M) return;
  const cv = $('mapa'); const ancho = cv.getBoundingClientRect().width || 300;
  cv.style.height = Math.round(ancho * 0.42) + 'px';
  const [c, W, Hh] = lienzo(cv);
  if (!bits) bits = Uint8Array.from(atob(M.b64), (ch) => ch.charCodeAt(0));
  c.clearRect(0, 0, W, Hh);
  const xy = (lat, lon) => [((lon + 180) / 360) * W, ((M.latMax - lat) / (2 * M.latMax)) * Hh];
  c.fillStyle = `rgba(${TEMA.c1},.26)`;
  const cw = W / M.W; const ch = Hh / M.H;
  for (let r = 0; r < M.H; r++) for (let k = 0; k < M.W; k++) { const i = r * M.W + k; if (bits[i >> 3] & (1 << (7 - (i & 7)))) c.fillRect(k * cw + cw * 0.25, r * ch + ch * 0.25, Math.max(1, cw * 0.5), Math.max(1, ch * 0.5)); }
  if (!mapaDatos || !mapaDatos.yo) return;
  const s = t / 1000; const [x0, y0] = xy(mapaDatos.yo.lat, mapaDatos.yo.lon);
  mapaDatos.servidores.forEach((v, n) => {
    const [x1, y1] = xy(v.lat, v.lon);
    const col = v.bloqueado ? '255,92,122' : v.propio ? '61,255,181' : TEMA.c1;
    const cx = (x0 + x1) / 2; const cy = Math.min(y0, y1) - Math.max(12, Math.hypot(x1 - x0, y1 - y0) * 0.3);
    c.strokeStyle = `rgba(${col},.35)`; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke();
    const k = (s * 0.5 + n * 0.17) % 1;
    c.fillStyle = `rgba(${col},.95)`; c.beginPath(); c.arc((1 - k) ** 2 * x0 + 2 * (1 - k) * k * cx + k * k * x1, (1 - k) ** 2 * y0 + 2 * (1 - k) * k * cy + k * k * y1, 1.8, 0, 7); c.fill();
    c.beginPath(); c.arc(x1, y1, 2.5 + Math.sin(s * 3 + n), 0, 7); c.fill();
  });
  const pul = 3 + Math.sin(s * 4) * 1.2;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x0, y0, pul, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x0, y0, pul + 4 + ((s * 8) % 8), 0, 7); c.stroke();
}

// ── eventos que llegan del navegador ──
window.nav.en('amenaza', (a) => { alertaHasta = Date.now() + 6000; log(T(`AMENAZA: ${a.host} parece peligrosa`, `THREAT: ${a.host} looks dangerous`), 'mal'); modo(); });
window.nav.en('descarga', (d) => { if (d.estado === 'listo') log(T(`Descarga lista: ${d.nombre}`, `Download complete: ${d.nombre}`)); });
window.nav.en('descarga-revision', (x) => {
  if (x.veredicto === 'revisando') return log(T(`Escaneando ${x.nombre}…`, `Scanning ${x.nombre}…`));
  const m = { limpio: [T('LIMPIO', 'CLEAN'), 'ok'], sospechoso: [T('SOSPECHOSO', 'SUSPICIOUS'), 'aviso'], peligroso: [T('PELIGROSO', 'DANGEROUS'), 'mal'], quitado: [T('QUITADO POR WINDOWS', 'REMOVED BY WINDOWS'), 'mal'], 'sin-revisar': [T('SIN REVISAR', 'NOT SCANNED'), ''] }[x.veredicto] || ['?', ''];
  log(`🛡 ${x.nombre}: ${m[0]}`, m[1]);
  if (m[1] === 'mal') { alertaHasta = Date.now() + 6000; modo(); }
});
window.nav.en('local', (x) => {
  const t = { arrancando: T('Encendiendo Qwen local…', 'Starting local Qwen…'), listo: T('Qwen local en línea', 'Local Qwen online'), apagado: T('Qwen local apagado', 'Local Qwen offline'), falta: T('No encuentro el Qwen local', 'Local Qwen not found') }[x.estado];
  if (t) log('🧠 ' + t, x.estado === 'listo' ? 'ok' : x.estado === 'falta' ? 'mal' : '');
  refrescarCerebro();
});
let respuesta = '';
window.nav.en('chat-ev', (ev) => {
  if (ev.tipo === 'token') { pensando = true; respuesta += ev.texto || ''; }
  else if (ev.tipo === 'herramienta') { pensando = true; log(`⚙ ${ev.texto}${ev.detalle ? ' · ' + ev.detalle : ''}`, 'jarvis'); }
  else if (ev.tipo === 'final') { respuesta = ev.texto || respuesta; }
  else if (ev.tipo === 'error') { pensando = false; log(`JARVIS: ${ev.texto || 'error'}`, 'mal'); }
  if (ev.tipo === 'fin') {
    pensando = false;
    const r = String(respuesta).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/[*#|`]/g, '').replace(/\s+/g, ' ').trim();
    if (r) log(`JARVIS: ${r.slice(0, 140)}`, 'jarvis');
    respuesta = '';
  }
  modo();
});
window.nav.en('clip', (c) => { if (c.tipo === 'listo') log(`🎬 Clip ${c.mb} MB${c.enviado ? T(' · enviado al teléfono', ' · sent to phone') : ''}`, 'ok'); else if (c.tipo === 'error') log(`🎬 ${c.texto}`, 'aviso'); });
window.nav.en('vigilante', (v) => { log(`🔔 ${v.texto}`, 'aviso'); alertaHasta = Date.now() + 3000; });

async function refrescarCerebro() {
  const d = await H('mando-datos').catch(() => null); if (!d) return;
  $('f-cerebro').textContent = d.local.activo ? `BRAIN · ${d.local.vivo ? 'QWEN ONLINE' : 'QWEN STANDBY'}` : 'BRAIN · CLOUD';
}
$('cerrar').addEventListener('click', () => H('mando-cerrar'));

// ── arranque ──
(async () => {
  const d = await H('mando-datos').catch(() => null);
  if (d) {
    idioma = d.idioma || 'en'; reloj(); pintarEstado(d.estado); pintarEscaneo(d.escaneo); if (d.monitor) monitor(d.monitor);
    refrescarCerebro();
    for (const x of (d.revisadas || []).slice(0, 4).reverse()) log(`🛡 ${x.nombre}: ${x.veredicto}`, x.veredicto === 'limpio' ? 'ok' : x.veredicto === 'peligroso' ? 'mal' : '');
  }
  reloj();
  log(T('Centro de mando en línea', 'Command center online'), 'ok');
  cargarMapa();
  // 30 cuadros por segundo; jugando, 8 (que el juego tenga toda la tarjeta gráfica)
  let ultimo = 0;
  const cuadro = (t) => { requestAnimationFrame(cuadro); if (t - ultimo < (gaming ? 125 : 33)) return; ultimo = t; fondo(); orbe(t); mapa(t); };
  requestAnimationFrame(cuadro);
  for (const id of ['g-cpu', 'g-ram', 'g-gpu', 'g-temp']) medidor(id, 0, 100, id === 'g-cpu' || id === 'g-ram' ? '0%' : '—', 100);
})();
