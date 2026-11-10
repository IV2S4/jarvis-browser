'use strict';
// 🗣 Conversación en vivo con JARVIS [09-nov]: como una llamada, con Gemini Live.
// El micrófono llega aquí en trocitos (PCM 16 kHz), va a Gemini por WebSocket, y la voz de JARVIS (PCM 24 kHz)
// vuelve a la interfaz para sonar. Puedes interrumpirlo: Gemini avisa «interrupted» y la interfaz se calla.
// La llave de Gemini nunca sale de este proceso (la interfaz no la ve).
const URL_LIVE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MODELOS = ['gemini-3.8-live', 'gemini-3.1-flash-live-preview', 'gemini-live-2.5-flash-preview'];
// herramientas que JARVIS puede usar mientras hablan (las mismas del chat, sin las de autopiloto visual)
const PERMITIDAS = ['play_video', 'see_page', 'click', 'type_text', 'media_control', 'open_url', 'web_search', 'tabs', 'scroll', 'navigate', 'read_page', 'summarize_page', 'translate_page', 'zoom', 'find_in_page',
  'browser_history', 'browser_memory', 'remember', 'send_to_phone', 'youtube_subtitles', 'live_dubbing', 'ask_video', 'check_scam', 'compare_prices', 'picture_in_picture', 'list_tabs', 'watch_page'];

let ses = null;   // { ws, modelo, listo, cerrar }

function declaraciones(HERRAMIENTAS) {
  return HERRAMIENTAS.filter((h) => PERMITIDAS.includes(h.nombre)).map((h) => ({ name: h.nombre, description: h.desc, ...(h.params ? { parameters: h.params } : {}) }));
}
const texto = (data) => (typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));

// on: { llave, sistema, HERRAMIENTAS, ejecutar(nombre, args) → salida, avisar(evento) }
function empezar(o, intento = 0) {
  parar(true);
  const modelo = MODELOS[intento]; if (!modelo) { o.avisar({ estado: 'error', error: 'No pude conectar con Gemini Live.' }); return; }
  let ws;
  try { ws = new WebSocket(`${URL_LIVE}?key=${encodeURIComponent(o.llave)}`); } catch (e) { o.avisar({ estado: 'error', error: String(e.message || e) }); return; }
  const yo = { ws, modelo, listo: false, cerrado: false };
  ses = yo;
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    ws.send(JSON.stringify({ setup: {
      model: `models/${modelo}`,
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } } },
      systemInstruction: { parts: [{ text: o.sistema }] },
      tools: [{ functionDeclarations: declaraciones(o.HERRAMIENTAS) }],
      inputAudioTranscription: {}, outputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 600 } },
    } }));
  };
  ws.onmessage = async (e) => {
    let m = null; try { m = JSON.parse(texto(e.data)); } catch { return; }
    if (m.setupComplete) { yo.listo = true; o.avisar({ estado: 'listo', modelo }); return; }
    if (m.goAway) o.avisar({ estado: 'pronto-fin' });
    const sc = m.serverContent;
    if (sc) {
      if (sc.interrupted) o.avisar({ interrumpido: true });
      for (const p of (sc.modelTurn && sc.modelTurn.parts) || []) if (p.inlineData && p.inlineData.data) o.avisar({ audio: p.inlineData.data });
      if (sc.inputTranscription && sc.inputTranscription.text) o.avisar({ tu: sc.inputTranscription.text });
      if (sc.outputTranscription && sc.outputTranscription.text) o.avisar({ jarvis: sc.outputTranscription.text });
      if (sc.turnComplete) o.avisar({ turno: true });
    }
    if (m.toolCall && m.toolCall.functionCalls) {
      const respuestas = [];
      for (const f of m.toolCall.functionCalls) {
        o.avisar({ herramienta: f.name });
        let salida = null;
        yo.seguidos = f.name === yo.ultima ? (yo.seguidos || 0) + 1 : 1; yo.ultima = f.name;
        if (f.name === 'see_page' && yo.seguidos > 2) salida = { ok: false, error: 'You already called see_page several times. Stop: use click with an id from the list you already got, or play_video for YouTube.' };   // anti-bucle
        else { try { salida = await o.ejecutar(f.name, f.args || {}); } catch (err) { salida = { ok: false, error: String(err.message || err) }; } }
        respuestas.push({ id: f.id, name: f.name, response: { result: JSON.parse(JSON.stringify(salida ?? null)) } });
      }
      if (ses === yo && ws.readyState === 1) ws.send(JSON.stringify({ toolResponse: { functionResponses: respuestas } }));
    }
  };
  ws.onclose = (e) => {
    if (yo.cerrado) return;
    yo.cerrado = true;
    if (!yo.listo && ses === yo && intento + 1 < MODELOS.length && e.code !== 1000) { empezar(o, intento + 1); return; }   // ese modelo no está: el siguiente
    if (ses === yo) ses = null;
    const r = String(e.reason || '');
    o.avisar({ estado: 'fin', inesperado: yo.listo, motivo: r.slice(0, 160), error: yo.listo ? '' : (/quota|exhausted|429/i.test(r) ? 'Se acabó la cuota gratis de Gemini Live por hoy.' : /key|API_KEY|permission/i.test(r) ? 'La llave de Gemini no sirve para Live.' : r || 'Gemini cerró la conexión.') });
  };
  ws.onerror = () => { /* onclose dice qué pasó */ };
}
function audio(b64) { if (ses && ses.listo && ses.ws.readyState === 1) ses.ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } } })); }
function textoUsuario(t) { if (ses && ses.listo && ses.ws.readyState === 1) ses.ws.send(JSON.stringify({ realtimeInput: { text: String(t) } })); }
function parar(silencio) {
  if (!ses) return;
  const s = ses; ses = null; s.cerrado = true;
  try { if (s.ws.readyState === 1) s.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); } catch { /* */ }
  try { s.ws.close(1000); } catch { /* */ }
  void silencio;
}
const activo = () => Boolean(ses);
module.exports = { empezar, audio, textoUsuario, parar, activo };
