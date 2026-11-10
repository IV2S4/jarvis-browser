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
  clearTimeout(G.chipT); G.chipT = setTimeout(gChipListo, 1300);
}
function gChipListo() {
  if (!G.activo) return;
  if (G.guardia) gChip('👁 ' + T('ALGUIEN MIRA', 'SOMEONE LOOKING'), 'error'); else gChip('✋', 'listo');
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
  // 👁 detector de caras (pausa automática y guardián de privacidad); si no está, los gestos siguen igual [09-nov]
  try {
    G.caras = await vision.FaceDetector.createFromOptions(archivos, { baseOptions: { modelAssetPath: 'jarvisvoz://gestos/blaze_face_short_range.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO', minDetectionConfidence: 0.6 });
  } catch { G.caras = null; }
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
    G.vistoT = performance.now(); G.ausente = false;
    G.reloj = setInterval(gCuadro, 70);
  } catch (e) {
    G.error = String((e && (e.name === 'NotFoundError' ? T('No encuentro ninguna cámara', 'No camera found') : e.name === 'NotAllowedError' ? T('La cámara está bloqueada', 'Camera is blocked') : e.message)) || e);
    gChip('✋ ' + T('SIN CÁMARA', 'NO CAMERA'), 'error'); $('gestos-chip').title = G.error;
    gApagar(true);
  } finally { G.cargando = false; }
}
function gApagar(dejarChip) {
  clearInterval(G.reloj); G.reloj = 0; G.activo = false;
  if (G.guardia) gGuardia(false);
  G.ausente = false; G.vistoT = 0;
  if (G.stream) G.stream.getTracks().forEach((t) => t.stop());   // apaga la luz de la cámara
  G.stream = null; G.video = null; G.rastro = []; G.pose = '';
  if (!dejarChip) $('gestos-chip').hidden = true;
}
// La cámara NO se enciende sola al abrir el navegador: solo cuando pulsas ✋ en la barra de abajo [05-nov]
let gQuiero = false;
function gChipApagado() { gChip('✋ ' + T('GESTOS OFF', 'GESTURES OFF'), 'apagado'); $('gestos-chip').title = T('Pulsa para encender la cámara y usar los gestos', 'Click to turn on the camera and use gestures'); }
// ¿hay que tener la cámara encendida? (solo si la pediste, y apagada mientras juegas o con la ventana escondida)
function gRevisar() {
  const quiero = Boolean(E.gestos) && gQuiero && !document.hidden && !E.gaming;
  if (quiero && G.activo && G.camara !== E.camaraGestos) { gApagar(); gEncender(); return; }
  if (quiero && !G.activo && !G.error) gEncender();
  else if (!quiero && G.activo) gApagar();
  if (!E.gestos) { G.error = ''; gQuiero = false; $('gestos-chip').hidden = true; }
  else if (!gQuiero && !G.activo && !G.cargando) gChipApagado();
  $('gesto-cam').hidden = !E.gestosVista || !G.activo;
}
document.addEventListener('visibilitychange', gRevisar);
window.nav.en('estado', () => setTimeout(gRevisar, 0));
$('gestos-chip').addEventListener('click', () => {   // ✋ enciende / apaga la cámara de los gestos
  G.error = '';
  if (G.activo || G.cargando) { gQuiero = false; gApagar(true); gChipApagado(); $('gesto-cam').hidden = true; sonido('pestana'); return; }
  gQuiero = true; gRevisar();
});

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
  gVigilar(Boolean(lm), ahora);
  if (E.gestosVista) gDibujar(lm);
  if (!lm) { G.pose = ''; G.rastro = []; return; }
  const p = forma(lm);
  if (p !== G.pose) { G.pose = p; G.poseDesde = ahora; G.repetir = 0; G.pinzaY = lm[9].y; }
  const quieto = ahora - G.poseDesde;
  // deslizar la mano de lado (la imagen viene en espejo: la mano a tu derecha va hacia x más pequeño)
  G.rastro.push({ x: lm[9].x, y: lm[9].y, t: ahora }); G.rastro = G.rastro.filter((r) => ahora - r.t < 450);
  if (ahora < G.enfriar) return;
  // 📲 lanzar al teléfono [09-nov]: ✊ agarras la página y la lanzas de lado abriendo la mano 🖐
  if (p === 'puno' && quieto > 250) G.agarre = { t: ahora, x: lm[9].x };
  if (E.lanzarTelefono && G.agarre && ['palma', 'otra'].includes(p) && ahora - G.agarre.t < 900 && Math.abs(lm[9].x - G.agarre.x) > 0.18) {
    G.agarre = null; G.enfriar = ahora + 2500; G.rastro = []; G.poseDesde = ahora;
    gFeedback('📲', 'LANZANDO…', 'THROWING…');
    H('gesto', 'lanzar').then((r) => {
      if (r && r.ok) gFeedback('📲', '¡EN TU TELÉFONO!', 'SENT TO YOUR PHONE!');
      else gFeedback('⚠', r && r.configurar ? 'CONECTA EL TELÉFONO EN CONFIGURACIÓN' : 'NO SE PUDO ENVIAR', r && r.configurar ? 'CONNECT YOUR PHONE IN SETTINGS' : "COULDN'T SEND");
    });
    return;
  }
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

// ── 📸 Busca lo que ves [09-nov]: JARVIS toma una foto con la cámara (solo cuando se lo pides) ──
window.fotoCamara = async () => {
  let s = null;
  try {
    const pedir = (id) => navigator.mediaDevices.getUserMedia({ audio: false, video: { ...(id ? { deviceId: { exact: id } } : {}), width: { ideal: 1280 }, height: { ideal: 720 } } });
    try { s = await pedir(E.camaraGestos); } catch (e) { if (!E.camaraGestos) throw e; s = await pedir(''); }
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = s; await v.play();
    await new Promise((ok) => setTimeout(ok, 1200));   // que la cámara ajuste la luz
    const c = document.createElement('canvas'); const w = v.videoWidth || 640; const h = v.videoHeight || 480; const k = Math.min(1, 1024 / w);
    c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    sonido('pestana');
    return { ok: true, data: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
  } catch (e) {
    return { ok: false, error: e && e.name === 'NotAllowedError' ? 'The camera is blocked' : e && e.name === 'NotFoundError' ? 'No camera found' : String((e && e.message) || e) };
  } finally { if (s) s.getTracks().forEach((t) => t.stop()); }
};

// ── 👁 la cámara también vigila [09-nov] ──
//   💤 Pausa automática: si nadie está frente a la cámara 4 s, pausa lo que suena; al volver, sigue solo.
//   👁 Guardián de privacidad: si se ven 2 caras o más (alguien detrás de ti), la página se tapa hasta que se vaya.
function gVigilar(hayMano, ahora) {
  if (!G.caras || !(E.camaraPausa || E.camaraGuardian)) { if (G.guardia) gGuardia(false); return; }
  if (ahora - (G.carasT || 0) < 300) return;   // ~3 veces por segundo basta
  G.carasT = ahora;
  let n = 0;
  try { const r = G.caras.detectForVideo(G.video, ahora); n = ((r && r.detections) || []).filter((d) => !d.categories || !d.categories[0] || d.categories[0].score >= 0.6).length; }
  catch { return; }
  if (n > 0 || hayMano) {
    G.vistoT = ahora;
    if (G.ausente) { G.ausente = false; H('gesto', 'presente').then((k) => { if (k) gFeedback('👋', 'DE VUELTA: SIGUE', 'WELCOME BACK'); }); }
  } else if (E.camaraPausa && !G.ausente && G.vistoT && ahora - G.vistoT > 4000) {
    G.ausente = true; H('gesto', 'ausente').then((k) => { if (k) gFeedback('💤', 'TE FUISTE: PAUSA', 'AWAY: PAUSED'); });
  }
  if (E.camaraGuardian && n >= 2) {
    G.unoT = 0; G.dosT = G.dosT || ahora;
    if (!G.guardia && ahora - G.dosT > 1200) gGuardia(true);
  } else {
    G.dosT = 0;
    if (G.guardia) { G.unoT = G.unoT || ahora; if (!E.camaraGuardian || ahora - G.unoT > 2000) gGuardia(false); }
  }
  if (G.guardia && ahora - (G.guardiaT || 0) > 1500) { G.guardiaT = ahora; H('gesto', 'guardia'); }   // renueva la tapa (páginas nuevas, otra pestaña)
}
function gGuardia(on) {
  G.guardia = on; G.guardiaT = performance.now(); G.unoT = 0;
  document.body.classList.toggle('guardia', on);
  H('gesto', on ? 'guardia' : 'guardia-off');
  if (on) sonido('pestana');
  gChipListo();
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
