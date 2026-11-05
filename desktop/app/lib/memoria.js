'use strict';
// Memoria de JARVIS [04-nov]: lo que le cuentas (gustos, proyectos, cómo te gusta que te hable)
// queda guardado en ESTA PC (~/.config/jarvis/navegador-memoria.json) y JARVIS lo usa en las próximas charlas.
// Nunca guarda contraseñas, tarjetas ni números de identificación.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ARCH = path.join(os.homedir(), '.config', 'jarvis', 'navegador-memoria.json');
const MAX = 120;
let lista = null;

function cargar() {
  if (lista) return lista;
  try { const j = JSON.parse(fs.readFileSync(ARCH, 'utf8')); lista = Array.isArray(j) ? j.filter((x) => x && x.texto) : []; } catch { lista = []; }
  return lista;
}
function guardar() {
  fs.mkdirSync(path.dirname(ARCH), { recursive: true });
  fs.writeFileSync(ARCH, JSON.stringify(lista, null, 1), { mode: 0o600 });
}
// lo que nunca se guarda
const PROHIBIDO = [
  /\b(?:\d[ -]?){13,19}\b/,                                   // tarjetas / cuentas
  /\b\d{3}-?\d{2}-?\d{4}\b/,                                   // seguro social
  /\b(contraseña|password|passwd|clave|pin|cvv|token|api.?key)\b\s*(?:es|is|:|=)\s*\S{3,}/i,
  /\b(sk|pk|AIza|ghp|xox[bp])[-_A-Za-z0-9]{12,}/,               // llaves de APIs
];
const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function todas() { return cargar().slice().sort((a, b) => b.t - a.t); }
function agregar(texto, origen = 'chat') {
  const t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (t.length < 3) return { ok: false, error: 'empty' };
  if (PROHIBIDO.some((r) => r.test(t))) return { ok: false, error: 'I never store passwords, card numbers, IDs or keys.' };
  cargar();
  const n = normal(t);
  const igual = lista.find((x) => normal(x.texto) === n);
  if (igual) { igual.t = Date.now(); guardar(); return { ok: true, ya: true, id: igual.id }; }
  lista.push({ id: crypto.randomBytes(4).toString('hex'), texto: t, t: Date.now(), origen });
  if (lista.length > MAX) lista.sort((a, b) => b.t - a.t).length = MAX;
  guardar();
  return { ok: true, total: lista.length };
}
// por id exacto, o por palabras («olvida lo de mi trabajo»)
function quitar(que) {
  cargar();
  const q = String(que || '').trim();
  let fuera = lista.filter((x) => x.id === q);
  if (!fuera.length && q) {
    const palabras = normal(q).split(' ').filter((w) => w.length > 2);
    fuera = lista.filter((x) => { const n = normal(x.texto); return palabras.length && palabras.every((w) => n.includes(w)); });
  }
  if (!fuera.length) return { ok: false, quitadas: 0 };
  lista = lista.filter((x) => !fuera.includes(x));
  guardar();
  return { ok: true, quitadas: fuera.length, textos: fuera.map((x) => x.texto) };
}
function borrarTodo() { lista = []; guardar(); return true; }
// para el cerebro: las más recientes primero, sin pasarse de tamaño
function paraCerebro(maxChars = 3500) {
  const out = []; let n = 0;
  for (const x of todas()) { if (n + x.texto.length > maxChars) break; out.push(x.texto); n += x.texto.length + 3; }
  return out;
}

module.exports = { todas, agregar, quitar, borrarTodo, paraCerebro, ARCH };
