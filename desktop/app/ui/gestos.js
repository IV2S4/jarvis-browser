'use strict';
// ✋ Control con gestos [04-nov]: la cámara de la PC (o la del celular conectada como cámara)
// ve tu mano y JARVIS hace lo que indicas. Todo se procesa dentro de tu PC: ninguna imagen sale de aquí.
//   👉 / 👈 mover la mano de lado → pestaña siguiente / anterior
//   ✋ palma abierta quieta (1 s)  → pausa / sigue el video
//   ☝ un dedo arriba              → sube la página
//   ✌ dos dedos                   → baja la página
//   👍 pulgar arriba (1 s)          → llama a JARVIS (micrófono)
//   ✊ puño cerrado (1,5 s)          → cierra la pestaña
//   🤏 pellizco (pulgar + índice) y sube / baja la mano → zoom más / menos
const G = { activo: false, cargando: false, stream: null, video: null, detector: null, camara: null, reloj: 0,
  pose: '', poseDesde: 0, rastro: [], enfriar: 0, repetir: 0, chipT: 0, error: '', pinzaY: 0 };

function gChip(texto, clase = '') {
  const c = $('gestos-chip'); c.hidden = !E.gestos; c.className = clase;
  $('gestos-txt').textContent = texto;
}
function gFeedback(icono, es, en) {
  gChip(`${icono} ${T(es, en)}`, 'accion'); sonido('pestana');
  clearTimeout(G.chipT); G.chipT = setTimeout(() => { if (G.activo) gChip('✋', 'listo'); }, 1300);
}

async function gCargar() {
  if (G.detector) return G.detector;
  const m = await H('gestos-modelo');
  if (!m || !m.ok) throw new Error((m && m.error) || 'model');
  const vision = await import('jarvisvoz://gestos/vision_bundle.mjs');
  const archivos = await vision.FilesetResolver.forVisionTasks('jarvisvoz://gestos/wasm');
  const opciones = (delegate) => ({ baseOptions: { modelAssetPath: 'jarvisvoz://gestos/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5 });
  try { G.detector = await vision.HandLandmarker.createFromOptions(archivos, opciones('GPU')); }
  catch { G.detector = await vision.HandLandmarker.createFromOptions(archivos, opciones('CPU')); }
  return G.detector;
}

async function gEncender() {
  if (G.activo || G.cargando) return;
  G.cargando = true; G.error = ''; gChip('✋ ' + T('PREPARANDO…', 'LOADING…'), 'cargando');
  try {
    await gCargar();
    const pedir = (id) => navigator.mediaDevices.getUserMedia({ audio: false, video: { ...(id ? { deviceId: { exact: id } } : {}), width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } } });
    try { G.stream = await pedir(E.camaraGestos); } catch (e) { if (!E.camaraGestos) throw e; G.stream = await pedir(''); }   // la elegida no está: la predeterminada
    G.camara = E.camaraGestos;
    G.video = document.createElement('video'); G.video.muted = true; G.video.playsInline = true; G.video.srcObject = G.stream;
    await G.video.play();
    G.activo = true; gChip('✋', 'listo');
    G.reloj = setInterval(gCuadro, 70);
  } catch (e) {
    G.error = String((e && (e.name === 'NotFoundError' ? T('No encuentro ninguna cámara', 'No camera found') : e.name === 'NotAllowedError' ? T('La cámara está bloqueada', 'Camera is blocked') : e.message)) || e);
    gChip('✋ ' + T('SIN CÁMARA', 'NO CAMERA'), 'error'); $('gestos-chip').title = G.error;
    gApagar(true);
  } finally { G.cargando = false; }
}
function gApagar(dejarChip) {
  clearInterval(G.reloj); G.reloj = 0; G.activo = false;
  if (G.stream) G.stream.getTracks().forEach((t) => t.stop());   // apaga la luz de la cámara
  G.stream = null; G.video = null; G.rastro = []; G.pose = '';
  if (!dejarChip) $('gestos-chip').hidden = true;
}
// ¿hay que tener la cámara encendida? (apagada mientras juegas o con la ventana escondida)
function gRevisar() {
  const quiero = Boolean(E.gestos) && !document.hidden && !E.gaming;
  if (quiero && G.activo && G.camara !== E.camaraGestos) { gApagar(); gEncender(); return; }
  if (quiero && !G.activo && !G.error) gEncender();
  else if (!quiero && G.activo) gApagar();
  if (!E.gestos) { G.error = ''; $('gestos-chip').hidden = true; }
  $('gesto-cam').hidden = !E.gestosVista;
}
document.addEventListener('visibilitychange', gRevisar);
window.nav.en('estado', () => setTimeout(gRevisar, 0));
$('gestos-chip').addEventListener('click', () => { G.error = ''; gRevisar(); });

// ── qué forma tiene la mano ──
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function forma(lm) {
  const extendido = (punta, medio) => dist(lm[punta], lm[0]) > dist(lm[medio], lm[0]) * 1.12;
  const i = extendido(8, 6); const m = extendido(12, 10); const r = extendido(16, 14); const p = extendido(20, 18);
  const tam = dist(lm[0], lm[9]);
  // pellizco: punta del pulgar con punta del índice, y el índice NO doblado dentro de la mano (eso sería un puño)
  if (dist(lm[4], lm[8]) < tam * 0.25 && dist(lm[8], lm[0]) > dist(lm[5], lm[0]) * 1.05) return 'pinza';
  const pulgar = lm[4].y < lm[3].y && lm[3].y < lm[2].y && (lm[5].y - lm[4].y) > tam * 0.45;
  if (pulgar && !i && !m && !r && !p) return 'pulgar';
  if (i && m && r && p) return 'palma';
  if (i && m && !r && !p) return 'victoria';
  if (i && !m && !r && !p) return 'indice';
  if (!i && !m && !r && !p) return 'puno';
  return 'otra';
}
function gHacer(accion) { H('gesto', accion); }

function gCuadro() {
  if (!G.activo || !G.video || G.video.readyState < 2) return;
  const ahora = performance.now();
  let res = null; try { res = G.detector.detectForVideo(G.video, ahora); } catch { return; }
  const lm = res && res.landmarks && res.landmarks[0];
  if (E.gestosVista) gDibujar(lm);
  if (!lm) { G.pose = ''; G.rastro = []; return; }
  const p = forma(lm);
  if (p !== G.pose) { G.pose = p; G.poseDesde = ahora; G.repetir = 0; G.pinzaY = lm[9].y; }
  const quieto = ahora - G.poseDesde;
  // deslizar la mano de lado (la imagen viene en espejo: la mano a tu derecha va hacia x más pequeño)
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
  if (p === 'pulgar' && quieto > 800) {
    gFeedback('👍', 'TE ESCUCHO', 'LISTENING'); G.enfriar = ahora + 3000; G.poseDesde = ahora;
    if (typeof despierta === 'function') despierta(); else if ($('p-mic')) $('p-mic').click();
    return;
  }
  if (p === 'puno' && quieto > 1500) { gHacer('cerrar'); gFeedback('✊', 'PESTAÑA CERRADA', 'TAB CLOSED'); G.enfriar = ahora + 2500; G.poseDesde = ahora; return; }
  if (p === 'pinza' && quieto > 250) {   // como un regulador: sube la mano para acercar, bájala para alejar
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

// mini cámara en la barra de abajo: tu mano dibujada como esqueleto holográfico
const HUESOS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function gDibujar(lm) {
  const cv = $('gesto-cam'); const c = cv.getContext('2d'); const W = cv.width; const Hh = cv.height;
  c.save(); c.clearRect(0, 0, W, Hh);
  c.translate(W, 0); c.scale(-1, 1);   // como un espejo
  c.globalAlpha = 0.35; try { c.drawImage(G.video, 0, 0, W, Hh); } catch { /* */ } c.globalAlpha = 1;
  if (lm) {
    c.strokeStyle = `rgb(${TEMA.c1})`; c.lineWidth = 1.4; c.shadowColor = `rgb(${TEMA.c1})`; c.shadowBlur = 4;
    for (const [a, b] of HUESOS) { c.beginPath(); c.moveTo(lm[a].x * W, lm[a].y * Hh); c.lineTo(lm[b].x * W, lm[b].y * Hh); c.stroke(); }
    c.fillStyle = '#fff'; for (const q of lm) { c.beginPath(); c.arc(q.x * W, q.y * Hh, 1.1, 0, 7); c.fill(); }
  }
  c.restore();
}
setTimeout(gRevisar, 1500);
