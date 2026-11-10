'use strict';
// 🗣 Conversación en vivo con JARVIS [09-nov]: como una llamada. Pulsa «🗣 En vivo» y habla;
// JARVIS contesta con voz al momento y lo puedes interrumpir. El micrófono va en trocitos al proceso principal
// (que habla con Gemini Live); aquí solo se graba, se reproduce la voz y se pintan las frases.
// 🎬 También el botón «Capítulos» de los videos de YouTube.
const V = { on: false, listo: false, ctxIn: null, ctxOut: null, stream: null, fuente: null, proc: null, sonando: [], t: 0, tu: null, el: null, barra: null };

function vivoBarra() {
  if (V.barra) return V.barra;
  const b = document.createElement('div'); b.id = 'vivo-barra'; b.hidden = true;
  b.innerHTML = '<div class="orbe-vivo"><i></i><i></i><i></i></div><div class="vivo-txt"><b></b><small></small></div><button class="vivo-fin">■</button>';
  const rap = document.querySelector('.rapidos'); rap.parentNode.insertBefore(b, rap);
  b.querySelector('.vivo-fin').addEventListener('click', () => vivoApagar());
  V.barra = b; return b;
}
function vivoEstado(t, sub = '') {
  const b = vivoBarra(); b.hidden = !V.on; b.querySelector('b').textContent = t; b.querySelector('small').textContent = sub;
  b.classList.toggle('habla', V.sonando.length > 0);
}
const b64DeInt16 = (i16) => { const u = new Uint8Array(i16.buffer); let s = ''; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s); };

async function vivoEncender() {
  if (V.on) return vivoApagar();
  H('panel', true); pestPanel('chat');
  V.on = true; V.listo = false; vivoEstado(T('Conectando…', 'Connecting…'));
  const r = await H('vivo', true);
  if (!r || !r.ok) { V.on = false; vivoEstado(''); msg2('j', (r && r.error) || T('No pude empezar la conversación en vivo.', "Couldn't start the live conversation.")); return; }
}
async function vivoMicro() {
  try {
    V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  } catch (e) { msg2('j', T('No puedo usar el micrófono: ', "Can't use the microphone: ") + String((e && e.name) || e)); vivoApagar(); return; }
  V.ctxIn = new AudioContext({ sampleRate: 16000 });
  V.fuente = V.ctxIn.createMediaStreamSource(V.stream);
  V.proc = V.ctxIn.createScriptProcessor(2048, 1, 1);
  V.proc.onaudioprocess = (e) => {
    if (!V.listo) return;
    const f = e.inputBuffer.getChannelData(0); const i16 = new Int16Array(f.length); let suma = 0;
    for (let k = 0; k < f.length; k++) { const x = Math.max(-1, Math.min(1, f[k])); i16[k] = x * 0x7fff; suma += x * x; }
    // mientras JARVIS habla por los parlantes, solo pasa tu voz si es clara (para que no se interrumpa con su propio eco)
    if (V.sonando.length && Math.sqrt(suma / f.length) < 0.045) i16.fill(0);
    H('vivo-audio', b64DeInt16(i16));
  };
  V.fuente.connect(V.proc); V.proc.connect(V.ctxIn.destination);
}
function vivoSonar(b64) {
  if (!V.ctxOut) V.ctxOut = new AudioContext({ sampleRate: 24000 });
  const bin = atob(b64); const n = bin.length >> 1; const buf = V.ctxOut.createBuffer(1, n, 24000); const ch = buf.getChannelData(0);
  for (let k = 0; k < n; k++) { let v = bin.charCodeAt(2 * k) | (bin.charCodeAt(2 * k + 1) << 8); if (v >= 0x8000) v -= 0x10000; ch[k] = v / 0x8000; }
  const src = V.ctxOut.createBufferSource(); src.buffer = buf; src.connect(V.ctxOut.destination);
  const ahora = V.ctxOut.currentTime; if (V.t < ahora + 0.03) V.t = ahora + 0.06;
  src.start(V.t); V.t += buf.duration; V.sonando.push(src);
  src.onended = () => { V.sonando = V.sonando.filter((x) => x !== src); if (!V.sonando.length && V.on) vivoEstado(T('Te escucho…', 'Listening…'), T('Habla cuando quieras', 'Speak any time')); };
  vivoEstado(T('JARVIS habla…', 'JARVIS speaking…'), T('Puedes interrumpirlo', 'You can interrupt'));
}
function vivoCallar() { for (const s of V.sonando) { try { s.stop(); } catch { /* */ } } V.sonando = []; V.t = 0; }
function vivoApagar(error) {
  const estaba = V.on; V.on = false; V.listo = false;
  H('vivo', false); vivoCallar();
  if (V.proc) { try { V.proc.disconnect(); V.fuente.disconnect(); } catch { /* */ } }
  if (V.stream) V.stream.getTracks().forEach((t) => t.stop());   // apaga el micrófono
  if (V.ctxIn) V.ctxIn.close().catch(() => {});
  V.stream = V.ctxIn = V.proc = V.fuente = null; V.tu = V.el = null;
  vivoEstado('');
  if (error) msg2('j', '🗣 ' + error);
  else if (estaba) msg2('j', T('🗣 Conversación en vivo terminada.', '🗣 Live conversation ended.'));
  $('c-vivo').classList.remove('activo');
}
window.nav.en('vivo', async (ev) => {
  if (!V.on) return;
  if (ev.estado === 'listo') {
    await vivoMicro(); if (!V.on) return;
    V.listo = true; $('c-vivo').classList.add('activo'); sonido('pestana');
    vivoEstado(T('Te escucho…', 'Listening…'), T('Habla cuando quieras · ■ para terminar', 'Speak any time · ■ to end'));
    return;
  }
  if (ev.estado === 'fin' || ev.estado === 'error') { vivoApagar(ev.error); return; }
  if (ev.interrumpido) { vivoCallar(); V.el = null; vivoEstado(T('Te escucho…', 'Listening…')); }
  if (ev.audio) vivoSonar(ev.audio);
  if (ev.tu) { if (!V.tu) V.tu = msg2('u', ''); V.tu.textContent += ev.tu; V.el = null; }
  if (ev.jarvis) { if (!V.el) V.el = msg2('j', ''); V.el.textContent += ev.jarvis; V.tu = null; }
  if (ev.herramienta) { const d = msg2('j paso', '⚙ ' + ev.herramienta.replace(/_/g, ' ')); d.style.opacity = '.6'; }
  if (ev.turno) { V.tu = null; V.el = null; }
  $('charla2').scrollTop = $('charla2').scrollHeight;
});
$('c-vivo').addEventListener('click', vivoEncender);

// 🎬 Capítulos del video (y los botones solo donde sirven)
const esVideoYT = (u) => /youtube\.com\/(watch|live|shorts)|youtu\.be\//.test(String(u || ''));
$('c-video').addEventListener('click', () => chatear(T('Dame los capítulos de este video, cada uno con su minuto.', 'Give me the chapters of this video, each with its timestamp.')));
// 🕵 investigador en segundo plano · 🔄 continuar en el otro dispositivo [09-nov]
let invMsg = null;
window.nav.en('investigacion', (x) => {
  if (!x) return;
  if (x.estado === 'empezando') { invMsg = msg2('j', T(`🕵 Investigando «${x.tema}»… puedes seguir navegando, te aviso al terminar.`, `🕵 Researching "${x.tema}"… keep browsing, I'll let you know.`)); return; }
  if (x.estado === 'trabajando' && invMsg) { invMsg.textContent = T(`🕵 Investigando «${x.tema}» · `, `🕵 Researching "${x.tema}" · `) + (x.paso === 'plan' ? T('planeando…', 'planning…') : x.paso === 'informe' ? T('escribiendo el informe…', 'writing the report…') : T('buscando ', 'searching ') + x.paso); return; }
  if (x.estado === 'listo') { sonido('pestana'); msg2('j', T(`🕵 Informe listo: «${x.tema}» (${x.fuentes} fuentes). Lo abrí en una pestaña nueva. ${x.resumen || ''}`, `🕵 Report ready: "${x.tema}" (${x.fuentes} sources). Opened in a new tab. ${x.resumen || ''}`)); decirEnCola(T(`Señor, su informe sobre ${x.tema} está listo.`, `Sir, your report on ${x.tema} is ready.`)); invMsg = null; return; }
  if (x.estado === 'error') { msg2('j', '🕵 ' + T('No pude terminar la investigación: ', "Couldn't finish the research: ") + x.error); invMsg = null; }
});
window.nav.en('continuar', (x) => {
  if (!x) return;
  if (x.emparejado) { msg2('j', T(`🔄 Teléfono emparejado: ${x.emparejado}.`, `🔄 Phone paired: ${x.emparejado}.`)); sonido('pestana'); }
  if (x.abierto) { sonido('pestana'); }
});
$('c-continuar').addEventListener('click', async () => {
  const r = await H('continuar-telefono');
  msg2('j', r && r.ok ? T('📱 Listo: en unos segundos te sale en el teléfono (con JARVIS Browser abierto).', '📱 Done: it will show on your phone in a few seconds (with JARVIS Browser open).') : (r && r.error) || '');
});
window.nav.en('estado', (e) => {
  $('c-continuar').hidden = !(e && e.continuar && /^https?:/.test(e.url || ''));
  $('c-video').hidden = !(e && e.preguntaVideo !== false && esVideoYT(e.url));
  $('c-vivo').hidden = Boolean(e && e.conversacionVivo === false);
  if (e && e.conversacionVivo === false && V.on) vivoApagar();
});
