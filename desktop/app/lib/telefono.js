'use strict';
// Enviar al teléfono por Telegram [04-nov]
// Usa un bot propio del usuario (lo crea con @BotFather). La llave del bot se guarda cifrada con las demás
// (cerebro.js, «telegram»); aquí solo se habla con la API de Telegram.
async function api(token, metodo, cuerpo) {
  const opciones = { method: 'POST', signal: AbortSignal.timeout(25000) };
  if (cuerpo instanceof FormData) opciones.body = cuerpo;
  else { opciones.headers = { 'Content-Type': 'application/json' }; opciones.body = JSON.stringify(cuerpo || {}); }
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, opciones);
  let j = null; try { j = await r.json(); } catch { /* */ }
  if (!j || !j.ok) {
    const e = new Error((j && j.description) || `Telegram respondió ${r.status}`);
    e.status = r.status; throw e;
  }
  return j.result;
}

// ¿la llave del bot sirve? → { usuario, nombre }
async function probarBot(token) {
  const yo = await api(token, 'getMe');
  return { usuario: yo.username, nombre: yo.first_name };
}

// el chat de la persona: el último que le escribió algo al bot
async function buscarChat(token) {
  const ups = await api(token, 'getUpdates', { timeout: 0, allowed_updates: ['message'] });
  for (let i = ups.length - 1; i >= 0; i--) {
    const m = ups[i].message;
    if (m && m.chat && m.chat.type === 'private') return { id: m.chat.id, nombre: m.chat.first_name || m.chat.username || '' };
  }
  return null;
}

// texto, o foto (Buffer JPEG/PNG o URL) con su texto
async function enviar(token, chat, { texto, foto, nombreFoto }) {
  if (foto && Buffer.isBuffer(foto)) {
    const fd = new FormData();
    fd.append('chat_id', String(chat));
    if (texto) fd.append('caption', String(texto).slice(0, 1000));
    fd.append('photo', new Blob([foto], { type: 'image/jpeg' }), nombreFoto || 'captura.jpg');
    return api(token, 'sendPhoto', fd);
  }
  if (foto) return api(token, 'sendPhoto', { chat_id: chat, photo: foto, caption: String(texto || '').slice(0, 1000) });
  return api(token, 'sendMessage', { chat_id: chat, text: String(texto || '').slice(0, 4000), link_preview_options: { is_disabled: false } });
}

// video (clips de juego): los bots de Telegram aceptan hasta 50 MB
async function enviarVideo(token, chat, ruta, texto) {
  const fs = require('fs'); const path = require('path');
  const tam = fs.statSync(ruta).size;
  if (tam > 49 * 1024 * 1024) return { grande: true, tam };
  const fd = new FormData();
  fd.append('chat_id', String(chat));
  if (texto) fd.append('caption', String(texto).slice(0, 1000));
  fd.append('supports_streaming', 'true');
  fd.append('video', new Blob([await fs.promises.readFile(ruta)], { type: 'video/mp4' }), path.basename(ruta));
  const r = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: 'POST', body: fd, signal: AbortSignal.timeout(180000) });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error((j && j.description) || `Telegram respondió ${r.status}`);
  return { ok: true, tam };
}

module.exports = { probarBot, buscarChat, enviar, enviarVideo };
