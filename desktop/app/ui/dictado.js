'use strict';
// 🎙 Dictado por voz [04-nov]: Ctrl+Mayús+D (o clic derecho › «Dictar aquí») en cualquier caja
// de cualquier página: hablas, JARVIS lo pasa a texto y lo escribe donde está el cursor. Se para solo al callarte.
const D = { g: null, t: 0 };
function dChip(texto, clase = '') {
  const e = $('dictado-chip'); clearTimeout(D.t);
  e.hidden = !texto; e.textContent = texto; e.className = clase;
}
async function dEmpezar() {
  if (!E.dictado) return;
  if (D.g) return dParar();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { dChip('🎙 ' + T('SIN MICRÓFONO', 'NO MICROPHONE'), 'error'); D.t = setTimeout(() => dChip(''), 3000); return; }
  const ctx = new AudioContext(); const fuente = ctx.createMediaStreamSource(stream); const proc = ctx.createScriptProcessor(4096, 1, 1);
  const g = { stream, ctx, fuente, proc, trozos: [], hablo: false, silencio: 0 };
  proc.onaudioprocess = (e) => {
    const x = e.inputBuffer.getChannelData(0); g.trozos.push(new Float32Array(x));
    let s = 0; for (let i = 0; i < x.length; i += 8) s += x[i] * x[i];
    const nivel = Math.sqrt(s / (x.length / 8)); nivelVoz(Math.min(1, nivel * 6));
    if (nivel > 0.02) { g.hablo = true; g.silencio = 0; } else if (g.hablo) { g.silencio += x.length / ctx.sampleRate; if (g.silencio > 2.2) dParar(); }
  };
  fuente.connect(proc); proc.connect(ctx.destination);
  g.tope = setTimeout(dParar, 60000);   // un minuto como máximo por vez
  D.g = g; pitido();
  dChip('🎙 ' + T('DICTANDO… habla (Ctrl+Mayús+D termina)', 'DICTATING… speak (Ctrl+Shift+D ends)'), 'grabando');
}
async function dParar() {
  const g = D.g; if (!g) return; D.g = null;
  clearTimeout(g.tope); g.proc.disconnect(); g.fuente.disconnect(); g.stream.getTracks().forEach((t) => t.stop());
  const sr = g.ctx.sampleRate; g.ctx.close(); nivelVoz(0);
  const total = g.trozos.reduce((a, t) => a + t.length, 0);
  if (!g.hablo || total < sr * 0.4) { dChip(''); return; }
  const todo = new Float32Array(total); let o = 0; for (const t of g.trozos) { todo.set(t, o); o += t.length; }
  dChip('✍ ' + T('ESCRIBIENDO…', 'TYPING…'), 'escribiendo');
  const r = await H('dictar', aWav(todo, sr)).catch(() => null);
  if (r && r.ok) { dChip('✓ ' + T('ESCRITO', 'TYPED'), 'ok'); sonido('enviar'); }
  else dChip('✕ ' + ((r && r.error) || T('No te entendí', "I didn't catch that")), 'error');
  D.t = setTimeout(() => dChip(''), r && r.ok ? 2000 : 5000);
}
window.nav.en('dictar', dEmpezar);

// 📄 documentos: botones rápidos y «Abrir documento»
const DOC_EN = {
  'Resume este documento: de qué trata y sus puntos clave.': 'Summarize this document: what it is about and its key points.',
  'Dame los puntos clave de este documento en una lista.': 'Give me the key points of this document as a list.',
  'Hazme un cuestionario de 5 preguntas de opción múltiple sobre este documento, con las respuestas al final.': 'Make me a 5-question multiple-choice quiz about this document, with the answers at the end.',
  'Explícame este documento como si tuviera 12 años.': 'Explain this document to me as if I were 12.',
};
document.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => chatear(T(b.dataset.doc, DOC_EN[b.dataset.doc] || b.dataset.doc))));
$('c-doc').addEventListener('click', () => H('abrir-documento'));
