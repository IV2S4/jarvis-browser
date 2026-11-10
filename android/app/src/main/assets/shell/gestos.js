'use strict';
// ✋ Control con gestos en el teléfono [05-nov]: la cámara frontal ve tu mano y JARVIS hace lo que indicas.
// Igual que en la PC, todo se procesa dentro del teléfono (ninguna imagen sale de él).
// Apagado al abrir la app: se enciende y se apaga con ☰ › Gestos (o tocando el chip ✋ de arriba).
//   👉 / 👈 mover la mano de lado → pestaña siguiente / anterior
//   ✋ palma abierta quieta (1 s)  → pausa / sigue el video
//   ☝ un dedo arriba              → sube la página
//   ✌ dos dedos                   → baja la página
//   👍 pulgar arriba (1 s)          → llama a JARVIS (micrófono)
//   ✊ puño cerrado (1,5 s)          → cierra la pestaña
//   🤏 pellizco y sube / baja la mano → zoom del texto más / menos
const BASE_GESTOS = 'https://appassets.androidplatform.net/';
const G = { activo: false, cargando: false, stream: null, video: null, detector: null, reloj: 0,
  pose: '', poseDesde: 0, rastro: [], enfriar: 0, repetir: 0, chipT: 0, pinzaY: 0 };

function gChip(texto, clase = '') {
  const c = $('gestos-chip'); c.hidden = false; c.className = clase; $('gestos-txt').textContent = texto;
}
function gFeedback(icono, es, en) {
  gChip(`${icono} ${T(es, en)}`, 'accion'); H('vibrar', { ms: 15 });
  clearTimeout(G.chipT); G.chipT = setTimeout(gChipListo, 1300);
}
function gChipListo() {
  if (!G.activo) return;
  if (G.guardia) gChip('👁 ' + T('ALGUIEN MIRA', 'SOMEONE LOOKING'), 'error'); else gChip('✋', 'listo');
}

async function gCargar() {
  if (G.detector) return G.detector;
  gChip('✋ ' + T('BAJANDO DETECTOR…', 'DOWNLOADING…'), 'cargando');
  const m = await H('gestos-modelo');   // la primera vez baja el detector de manos (7,5 MB) al teléfono
  if (!m || !m.ok) throw new Error((m && m.error) || T('No pude bajar el detector de manos', "Couldn't download the hand detector"));
  gChip('✋ ' + T('PREPARANDO…', 'LOADING…'), 'cargando');
  const vision = await import(BASE_GESTOS + 'assets/gestos/vision_bundle.mjs');
  const archivos = await vision.FilesetResolver.forVisionTasks(BASE_GESTOS + 'assets/gestos/wasm');
  const opciones = (delegate) => ({ baseOptions: { modelAssetPath: BASE_GESTOS + 'datos/gestos/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5 });
  // en el WebView de Android el modo GPU falla a menudo sin avisar (cada cuadro da error): CPU es lo seguro [05-nov]
  G.vision = vision; G.archivos = archivos; G.opciones = opciones;
  try { G.detector = await vision.HandLandmarker.createFromOptions(archivos, opciones('CPU')); G.modo = 'CPU'; }
  catch { G.detector = await vision.HandLandmarker.createFromOptions(archivos, opciones('GPU')); G.modo = 'GPU'; }
  // 👁 detector de caras (pausa automática y guardián de privacidad) [09-nov]; si falta, los gestos siguen igual
  try {
    G.caras = await vision.FaceDetector.createFromOptions(archivos, { baseOptions: { modelAssetPath: BASE_GESTOS + 'datos/gestos/blaze_face_short_range.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO', minDetectionConfidence: 0.6 });
  } catch { G.caras = null; }
  return G.detector;
}

async function gEncender() {
  if (G.activo || G.cargando) return;
  G.cargando = true;
  try {
    // permiso de Android para la cámara: la primera vez Android pregunta y esperamos tu respuesta
    if ((await H('permiso', { tipo: 'camara' })) === false) {
      await new Promise((ok) => { G.alPermiso = ok; setTimeout(ok, 30000); });
      if ((await H('permiso', { tipo: 'camara' })) === false) throw new Error(T('Sin permiso para la cámara', 'No camera permission'));
    }
    await gCargar();
    G.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } } });
    G.video = document.createElement('video'); G.video.muted = true; G.video.playsInline = true; G.video.srcObject = G.stream;
    await G.video.play();
    G.activo = true; gChip('✋', 'listo'); toast(T('Gestos encendidos: muéstrale tu mano a la cámara de adelante', 'Gestures on: show your hand to the front camera'), 3500);
    G.errores = 0; G.vistoMano = 0; G.vistoT = performance.now(); G.ausente = false; G.reloj = setInterval(gCuadro, 90);
  } catch (e) {
    gApagar(); toast('✋ ' + (e && e.name === 'NotAllowedError' ? T('La cámara está bloqueada', 'Camera is blocked') : String((e && e.message) || e)), 4000);
  } finally { G.cargando = false; }
}
function gApagar() {
  clearInterval(G.reloj); G.reloj = 0; G.activo = false;
  if (G.guardia) gGuardia(false);
  G.ausente = false; G.vistoT = 0;
  if (G.stream) G.stream.getTracks().forEach((t) => t.stop());   // apaga la cámara (y su lucecita)
  G.stream = null; G.video = null; G.rastro = []; G.pose = '';
  $('gestos-chip').hidden = true;
}
function alternarGestos() { if (G.activo || G.cargando) { gApagar(); toast(T('Gestos apagados', 'Gestures off')); } else gEncender(); }
window.alternarGestos = alternarGestos;
nav.en('permisos', () => { if (G.alPermiso) { const f = G.alPermiso; G.alPermiso = null; f(); } });
window.gestosActivos = () => G.activo;
$('gestos-chip').addEventListener('click', alternarGestos);
// si sales de la app, la cámara se apaga sola (y no se vuelve a encender hasta que la pidas)
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.activo || G.cargando)) gApagar(); });

// ── qué forma tiene la mano (igual que en la PC) ──
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function forma(lm) {
  const extendido = (punta, medio) => dist(lm[punta], lm[0]) > dist(lm[medio], lm[0]) * 1.12;
  const i = extendido(8, 6); const m = extendido(12, 10); const r = extendido(16, 14); const p = extendido(20, 18);
  const tam = dist(lm[0], lm[9]);
  if (dist(lm[4], lm[8]) < tam * 0.25 && dist(lm[8], lm[0]) > dist(lm[5], lm[0]) * 1.05) return 'pinza';
  const pulgar = lm[4].y < lm[3].y && lm[3].y < lm[2].y && (lm[5].y - lm[4].y) > tam * 0.45;
  if (pulgar && !i && !m && !r && !p) return 'pulgar';
  if (i && m && r && p) return 'palma';
  if (i && m && !r && !p) return 'victoria';
  if (i && !m && !r && !p) return 'indice';
  if (!i && !m && !r && !p) return 'puno';
  return 'otra';
}

// ── lo que hace cada gesto en el teléfono ──
function gHacer(accion) {
  const ids = (E.pestanas || []).map((p) => p.id); const k = ids.indexOf(E.activa);
  switch (accion) {
    case 'siguiente': if (ids.length > 1) H('activar', { id: ids[(k + 1) % ids.length] }); break;
    case 'anterior': if (ids.length > 1) H('activar', { id: ids[(k - 1 + ids.length) % ids.length] }); break;
    case 'arriba': H('js', { codigo: 'window.scrollBy({top:-Math.round(innerHeight*0.45),behavior:"smooth"})' }); break;
    case 'abajo': H('js', { codigo: 'window.scrollBy({top:Math.round(innerHeight*0.45),behavior:"smooth"})' }); break;
    case 'cerrar': if (E.activa) H('cerrar', { id: E.activa }); break;
    case 'zoom-mas': H('zoom', { pct: (E.zoom || 100) + 10 }); break;
    case 'zoom-menos': H('zoom', { pct: (E.zoom || 100) - 10 }); break;
    case 'pausa': H('js', { codigo: '(()=>{const vs=[...document.querySelectorAll("video")];const v=vs.find(x=>!x.paused)||vs.find(x=>x.offsetWidth>0)||vs[0];if(!v)return false;v.paused?v.play():v.pause();return true})()' }); break;
    case 'jarvis': abrirPanel('chat'); setTimeout(() => $('mic').click(), 250); break;
  }
}

function gCuadro() {
  if (!G.activo || !G.video || G.video.readyState < 2) return;
  const ahora = performance.now();
  let res = null;
  try { res = G.detector.detectForVideo(G.video, ahora); G.errores = 0; }
  catch (e) {   // si el detector falla seguido, se rehace con el otro modo (y si tampoco, se avisa)
    if (++G.errores === 8) {
      const otro = G.modo === 'CPU' ? 'GPU' : 'CPU';
      G.vision.HandLandmarker.createFromOptions(G.archivos, G.opciones(otro)).then((d) => { G.detector = d; G.modo = otro; G.errores = 0; })
        .catch(() => { gChip('✋ ERROR', 'error'); toast('✋ ' + T('El detector de manos no funciona en este teléfono: ', 'Hand detector failed on this phone: ') + String((e && e.message) || e).slice(0, 120), 6000); });
    }
    return;
  }
  const lm = res && res.landmarks && res.landmarks[0];
  gVigilar(Boolean(lm), ahora);
  gDibujar(lm);
  if (!lm) { G.pose = ''; G.rastro = []; if (G.vistoMano && ahora - G.vistoMano > 800 && $('gestos-chip').className === 'mano') gChipListo(); return; }
  const p = forma(lm);
  G.vistoMano = ahora;
  if ($('gestos-chip').className !== 'accion') gChip(({ palma: '✋', indice: '☝', victoria: '✌', puno: '✊', pulgar: '👍', pinza: '🤏' })[p] || '🖐', 'mano');   // así ves que te reconoce la mano
  if (p !== G.pose) { G.pose = p; G.poseDesde = ahora; G.repetir = 0; G.pinzaY = lm[9].y; }
  const quieto = ahora - G.poseDesde;
  // la cámara de adelante no viene en espejo: tu mano hacia tu derecha va hacia x más pequeño
  G.rastro.push({ x: lm[9].x, y: lm[9].y, t: ahora }); G.rastro = G.rastro.filter((r) => ahora - r.t < 450);
  if (ahora < G.enfriar) return;
  if (G.rastro.length >= 4 && ['palma', 'otra'].includes(p)) {
    const xs = G.rastro.map((r) => r.x); const ys = G.rastro.map((r) => r.y);
    const dx = G.rastro[G.rastro.length - 1].x - G.rastro[0].x; const dy = Math.max(...ys) - Math.min(...ys);
    if (Math.abs(dx) > 0.26 && dy < 0.16 && Math.max(...xs) - Math.min(...xs) <= Math.abs(dx) + 0.05) {
      if (dx < 0) { gHacer('siguiente'); gFeedback('👉', 'SIGUIENTE PESTAÑA', 'NEXT TAB'); } else { gHacer('anterior'); gFeedback('👈', 'PESTAÑA ANTERIOR', 'PREVIOUS TAB'); }
      G.enfriar = ahora + 900; G.rastro = []; G.poseDesde = ahora; return;
    }
  }
  const movimiento = G.rastro.length > 1 ? Math.hypot(G.rastro[G.rastro.length - 1].x - G.rastro[0].x, G.rastro[G.rastro.length - 1].y - G.rastro[0].y) : 0;
  if (p === 'palma' && quieto > 1000 && movimiento < 0.05) { gHacer('pausa'); gFeedback('✋', 'PAUSA / SIGUE', 'PLAY / PAUSE'); G.enfriar = ahora + 1600; G.poseDesde = ahora; return; }
  if (p === 'pulgar' && quieto > 800) { gFeedback('👍', 'TE ESCUCHO', 'LISTENING'); gHacer('jarvis'); G.enfriar = ahora + 3000; G.poseDesde = ahora; return; }
  if (p === 'puno' && quieto > 1500) { gHacer('cerrar'); gFeedback('✊', 'PESTAÑA CERRADA', 'TAB CLOSED'); G.enfriar = ahora + 2500; G.poseDesde = ahora; return; }
  if (p === 'pinza' && quieto > 250) {
    const dy = G.pinzaY - lm[9].y;
    if (dy > 0.07) { gHacer('zoom-mas'); gFeedback('🤏', 'ZOOM +', 'ZOOM IN'); G.pinzaY = lm[9].y; }
    else if (dy < -0.07) { gHacer('zoom-menos'); gFeedback('🤏', 'ZOOM −', 'ZOOM OUT'); G.pinzaY = lm[9].y; }
    return;
  }
  if ((p === 'indice' || p === 'victoria') && quieto > 350 && ahora > G.repetir) {
    if (p === 'indice') { gHacer('arriba'); gFeedback('☝', 'ARRIBA', 'SCROLL UP'); } else { gHacer('abajo'); gFeedback('✌', 'ABAJO', 'SCROLL DOWN'); }
    G.repetir = ahora + 650;
  }
}

// ── 👁 la cámara también vigila [09-nov] (se apagan en Ajustes › Funciones inteligentes) ──
//   💤 Pausa automática: si no hay nadie frente a la cámara 4 s, pausa el video; al volver, sigue solo.
//   👁 Guardián de privacidad: si se ven 2 caras o más (alguien mirando tu teléfono), la página se tapa hasta que se vaya.
const JS_AUSENTE = `(() => { let n = 0; for (const v of document.querySelectorAll('video,audio')) if (!v.paused && !v.ended) { v.pause(); v.setAttribute('data-jarvis-ausente', '1'); n++; } return n; })()`;
const JS_PRESENTE = `(() => { let n = 0; for (const v of document.querySelectorAll('[data-jarvis-ausente]')) { v.removeAttribute('data-jarvis-ausente'); const p = v.play(); if (p && p.catch) p.catch(() => {}); n++; } return n; })()`;
const JS_GUARDIA_FUERA = `(() => { clearTimeout(window.__jarvisGuardiaT); const x = document.getElementById('__jarvis_guardia'); if (x) x.remove(); return 0; })()`;
function jsGuardia() {
  const txt = T('👁  Alguien más está mirando tu pantalla\nLa página se ve cuando se vaya', '👁  Someone else is looking at your screen\nThe page comes back when they leave');
  return `(() => { let d = document.getElementById('__jarvis_guardia');
    if (!d) { d = document.createElement('div'); d.id = '__jarvis_guardia';
      for (const [k, v] of [['position', 'fixed'], ['inset', '0'], ['z-index', '2147483647'], ['display', 'flex'], ['align-items', 'center'], ['justify-content', 'center'],
        ['background', 'rgba(3,8,14,.55)'], ['backdrop-filter', 'blur(30px)'], ['-webkit-backdrop-filter', 'blur(30px)'], ['color', '#38d6ff'], ['font', '600 18px system-ui,sans-serif'],
        ['text-align', 'center'], ['white-space', 'pre-line'], ['padding', '24px'], ['pointer-events', 'none']]) d.style.setProperty(k, v, 'important');
      d.textContent = ${JSON.stringify(txt)}; document.documentElement.appendChild(d); }
    clearTimeout(window.__jarvisGuardiaT); window.__jarvisGuardiaT = setTimeout(() => { const x = document.getElementById('__jarvis_guardia'); if (x) x.remove(); }, 3500); return 1; })()`;
}
function gVigilar(hayMano, ahora) {
  const pausaOn = cfg.camaraPausa !== false; const guardiaOn = cfg.camaraGuardian !== false;
  if (!G.caras || !(pausaOn || guardiaOn)) { if (G.guardia) gGuardia(false); return; }
  if (ahora - (G.carasT || 0) < 350) return;
  G.carasT = ahora;
  let n = 0;
  try { const r = G.caras.detectForVideo(G.video, ahora); n = ((r && r.detections) || []).filter((d) => !d.categories || !d.categories[0] || d.categories[0].score >= 0.6).length; }
  catch { return; }
  if (n > 0 || hayMano) {
    G.vistoT = ahora;
    if (G.ausente) { G.ausente = false; enPagina(JS_PRESENTE).then((k) => { if (k) gFeedback('👋', 'DE VUELTA: SIGUE', 'WELCOME BACK'); }); }
  } else if (pausaOn && !G.ausente && G.vistoT && ahora - G.vistoT > 4000) {
    G.ausente = true; enPagina(JS_AUSENTE).then((k) => { if (k) gFeedback('💤', 'TE FUISTE: PAUSA', 'AWAY: PAUSED'); });
  }
  if (guardiaOn && n >= 2) { G.unoT = 0; G.dosT = G.dosT || ahora; if (!G.guardia && ahora - G.dosT > 1200) gGuardia(true); }
  else { G.dosT = 0; if (G.guardia) { G.unoT = G.unoT || ahora; if (!guardiaOn || ahora - G.unoT > 2000) gGuardia(false); } }
  if (G.guardia && ahora - (G.guardiaT || 0) > 1500) { G.guardiaT = ahora; enPagina(jsGuardia()); }
}
function gGuardia(on) {
  G.guardia = on; G.guardiaT = performance.now(); G.unoT = 0;
  document.body.classList.toggle('guardia', on);
  enPagina(on ? jsGuardia() : JS_GUARDIA_FUERA);
  if (on) H('vibrar', { ms: 40 });
  gChipListo();
}

// mini cámara en el chip: tu mano dibujada como esqueleto holográfico
const HUESOS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function gDibujar(lm) {
  const cv = $('gesto-cam'); const c = cv.getContext('2d'); const W = cv.width; const Hh = cv.height;
  c.save(); c.clearRect(0, 0, W, Hh);
  c.translate(W, 0); c.scale(-1, 1);   // como un espejo
  c.globalAlpha = 0.4; try { c.drawImage(G.video, 0, 0, W, Hh); } catch { /* */ } c.globalAlpha = 1;
  if (lm) {
    const col = getComputedStyle(document.body).getPropertyValue('--c1').trim() || '56,214,255';
    c.strokeStyle = `rgb(${col})`; c.lineWidth = 1.6; c.shadowColor = `rgb(${col})`; c.shadowBlur = 4;
    for (const [a, b] of HUESOS) { c.beginPath(); c.moveTo(lm[a].x * W, lm[a].y * Hh); c.lineTo(lm[b].x * W, lm[b].y * Hh); c.stroke(); }
    c.fillStyle = '#fff'; for (const q of lm) { c.beginPath(); c.arc(q.x * W, q.y * Hh, 1.2, 0, 7); c.fill(); }
  }
  c.restore();
}
