'use strict';
// Extensiones del Navegador JARVIS [2026-10-28]
// Carpeta: Documentos/JARVIS Browser/Extensions. Cada extensión es una subcarpeta:
//  · Extensión de Chrome descomprimida (manifest.json con "manifest_version") → se carga tal cual.
//  · Extensión JARVIS: manifest.json con { "jarvis": 1, "name", "description", "matches": ["*://*.youtube.com/*"], "js": ["x.js"], "css": ["x.css"] }
//    → sus scripts y estilos se ponen en las páginas que coinciden (como Tampermonkey).
const fs = require('fs');
const path = require('path');

let carpeta = '';
let lista = [];          // { id, nombre, desc, tipo: 'chrome'|'jarvis', dir, matches, js, css, error }
let cargadasChrome = new Map();

const LEEME = `JARVIS Browser — Extensions
===========================

Put each extension in its own folder here, then restart the browser
(or press "Reload extensions" in Settings › Extensions).

1) Chrome extensions: download the extension as an unpacked folder (with manifest.json inside)
   and copy that folder here.

2) JARVIS extensions (simple scripts): a folder with a manifest.json like this:

   {
     "jarvis": 1,
     "name": "My extension",
     "description": "What it does",
     "matches": ["*://*.youtube.com/*"],
     "js": ["script.js"],
     "css": ["style.css"]
   }

   script.js runs on every page that matches. Ask JARVIS (Claude) to write new ones for you.
`;

function preparar(documentos) {
  carpeta = path.join(documentos, 'JARVIS Browser', 'Extensions');
  try {
    fs.mkdirSync(carpeta, { recursive: true });
    const leeme = path.join(carpeta, 'README.txt');
    if (!fs.existsSync(leeme)) fs.writeFileSync(leeme, LEEME);
  } catch { /* sin permiso */ }
  return carpeta;
}

function patron(m) {
  if (m === '<all_urls>') return /^https?:\/\//;
  const x = m.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + x + '$');
}

function leer() {
  lista = [];
  let dirs = [];
  try { dirs = fs.readdirSync(carpeta, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return lista; }
  for (const nombre of dirs) {
    const dir = path.join(carpeta, nombre);
    let man = null;
    try { man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { lista.push({ id: nombre, nombre, desc: '', tipo: '?', dir, error: 'Falta manifest.json o está mal escrito' }); continue; }
    if (man.manifest_version) {
      lista.push({ id: nombre, nombre: String(man.name || nombre).startsWith('__MSG_') ? nombre : String(man.name || nombre), desc: String(man.description || '').startsWith('__MSG_') ? '' : String(man.description || ''), tipo: 'chrome', dir });
    } else if (man.jarvis) {
      const leerArchivos = (l) => (Array.isArray(l) ? l : []).map((f) => { try { return fs.readFileSync(path.join(dir, path.basename(f)), 'utf8'); } catch { return ''; } }).filter(Boolean);
      lista.push({ id: nombre, nombre: String(man.name || nombre), desc: String(man.description || ''), tipo: 'jarvis', dir,
        matches: (Array.isArray(man.matches) && man.matches.length ? man.matches : ['<all_urls>']).map(patron), js: leerArchivos(man.js), css: leerArchivos(man.css) });
    } else lista.push({ id: nombre, nombre, desc: '', tipo: '?', dir, error: 'No es una extensión de Chrome ni de JARVIS' });
  }
  return lista;
}

// carga las de Chrome en la sesión; las apagadas se quitan
async function aplicar(ses, apagadas = {}) {
  const ext = ses.extensions || ses;   // Electron nuevo: ses.extensions
  for (const e of lista) {
    if (e.tipo !== 'chrome') continue;
    const quiere = !apagadas[e.id];
    const ya = cargadasChrome.get(e.id);
    if (quiere && !ya) {
      try { const x = await ext.loadExtension(e.dir, { allowFileAccess: false }); cargadasChrome.set(e.id, x.id); e.error = ''; }
      catch (err) { e.error = String(err.message || err).slice(0, 160); }
    } else if (!quiere && ya) {
      try { ext.removeExtension(ya); } catch { /* */ } cargadasChrome.delete(e.id);
    }
  }
}

// en cada página: las extensiones JARVIS que coinciden con la dirección
function inyectar(webContents, apagadas = {}) {
  const url = webContents.getURL();
  if (!/^https?:/.test(url)) return;
  for (const e of lista) {
    if (e.tipo !== 'jarvis' || apagadas[e.id] || !e.matches.some((rx) => rx.test(url))) continue;
    for (const c of e.css) webContents.insertCSS(c).catch(() => {});
    for (const j of e.js) webContents.executeJavaScript(`try{${j}\n}catch(e){console.warn('[JARVIS ext ${e.id.replace(/'/g, '')}]', e)}`, true).catch(() => {});
  }
}

const resumen = (apagadas = {}) => lista.map((e) => ({ id: e.id, nombre: e.nombre, desc: e.desc, tipo: e.tipo, error: e.error || '', activa: !apagadas[e.id] }));

module.exports = { preparar, leer, aplicar, inyectar, resumen, carpeta: () => carpeta };
