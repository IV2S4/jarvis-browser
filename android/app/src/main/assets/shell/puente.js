'use strict';
// Puente con la parte nativa (MainActivity.java): H('acción', datos) → promesa con la respuesta; nav.en('canal', fn) para los avisos.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const espera = new Map(); let sigPeticion = 1;
window.__r = (id, v) => { const f = espera.get(id); if (f) { espera.delete(id); f(v); } };
function H(accion, datos) {
  return new Promise((ok) => {
    const id = 'p' + (sigPeticion++);
    espera.set(id, ok);
    try { window.Android.h(id, accion, JSON.stringify(datos === undefined ? {} : (typeof datos === 'object' && datos !== null ? datos : { v: datos }))); }
    catch (e) { espera.delete(id); ok(null); }
  });
}
const oyentes = {};
const nav = { en: (canal, fn) => { (oyentes[canal] = oyentes[canal] || []).push(fn); } };
window.__ev = (canal, d) => { for (const f of oyentes[canal] || []) { try { f(d); } catch (e) { console.error(canal, e); } } };

// internet por la parte nativa: sin CORS, y las llaves {{LLAVE:x}} se ponen allí
const Nativo = {
  async fetch(url, o = {}) {
    const cuerpo = o.body;
    const r = await H('fetch', { url: String(url), method: o.method || 'GET', headers: o.headers || {}, body: typeof cuerpo === 'string' ? cuerpo : (cuerpo == null ? null : JSON.stringify(cuerpo)),
      timeout: (o.signal && o.signal.ms) || o.timeout || 60000, ...(o.form ? { form: o.form, archivo: o.archivo } : {}) }) || { ok: false, status: 0, text: '' };
    return { ok: r.ok, status: r.status, headers: { get: (k) => (/content-type/i.test(k) ? r.tipo : null) },
      text: async () => r.text || '', json: async () => JSON.parse(r.text || 'null'), base64: async () => r.b64 || '' };
  },
};

// datos guardados en el teléfono (archivos de la app): configuración, favoritos, historial, memoria…
const Datos = {
  async cargar(clave, def) { const v = await H('cargar', { clave }); return v == null ? def : v; },
  guardar(clave, valor) { return H('guardar', { clave, valor: JSON.stringify(valor) }); },
};

// idioma: inglés por defecto (como en la PC); español si lo eliges en Ajustes
let IDIOMA = 'en';
const T = (es, en) => (IDIOMA === 'es' ? es : en);

function toast(t, ms = 2400) { const e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, ms); }
