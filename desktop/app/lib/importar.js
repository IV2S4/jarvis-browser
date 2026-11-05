'use strict';
// Importar de Chrome (y Edge / Brave, que guardan igual) [04-nov]
// · Favoritos: el archivo «Bookmarks» (JSON).
// · Historial: la base «History» (SQLite) — se copia primero porque Chrome la tiene abierta.
// · Contraseñas: NO. Chrome las cifra con una llave atada a Chrome («app-bound encryption»), y este navegador
//   por diseño no guarda contraseñas: siguen en tu cuenta de Google (passwords.google.com).
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const NAVEGADORES = [
  { id: 'chrome', nombre: 'Google Chrome', dir: path.join(LOCAL, 'Google', 'Chrome', 'User Data') },
  { id: 'edge', nombre: 'Microsoft Edge', dir: path.join(LOCAL, 'Microsoft', 'Edge', 'User Data') },
  { id: 'brave', nombre: 'Brave', dir: path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data') },
];

// → [{ id:'chrome|Default', navegador, perfil, nombre }]
function perfiles() {
  const out = [];
  for (const n of NAVEGADORES) {
    if (!fs.existsSync(n.dir)) continue;
    let info = {};
    try { info = JSON.parse(fs.readFileSync(path.join(n.dir, 'Local State'), 'utf8')).profile.info_cache || {}; } catch { /* */ }
    let dirs = Object.keys(info);
    if (!dirs.length) { try { dirs = fs.readdirSync(n.dir).filter((d) => d === 'Default' || /^Profile \d+$/.test(d)); } catch { /* */ } }
    for (const d of dirs) {
      const p = path.join(n.dir, d);
      if (!fs.existsSync(path.join(p, 'Bookmarks')) && !fs.existsSync(path.join(p, 'History'))) continue;
      const x = info[d] || {};
      out.push({ id: `${n.id}|${d}`, navegador: n.nombre, perfil: d, nombre: `${n.nombre} — ${x.name || d}${x.user_name ? ` (${x.user_name})` : ''}` });
    }
  }
  return out;
}
function carpeta(id) {
  const [nav, perfil] = String(id || '').split('|');
  const n = NAVEGADORES.find((x) => x.id === nav);
  if (!n || !/^(Default|Profile \d+|[\w -]+)$/.test(perfil || '')) return null;
  return path.join(n.dir, perfil);
}

function favoritos(id) {
  const dir = carpeta(id); if (!dir) return [];
  let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, 'Bookmarks'), 'utf8')); } catch { return []; }
  const out = [];
  const recorrer = (nodo) => {
    if (!nodo) return;
    if (nodo.type === 'url' && /^https?:/.test(nodo.url || '')) out.push({ url: nodo.url, titulo: nodo.name || nodo.url });
    for (const h of nodo.children || []) recorrer(h);
  };
  for (const r of Object.values(j.roots || {})) recorrer(r);
  return out;
}

async function historial(id, sqlDir, max = 3000) {
  const dir = carpeta(id); if (!dir) return [];
  const origen = path.join(dir, 'History'); if (!fs.existsSync(origen)) return [];
  const copia = path.join(os.tmpdir(), `jarvis-historial-${process.pid}.db`);
  fs.copyFileSync(origen, copia);
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({ locateFile: (f) => path.join(sqlDir, f) });
    const db = new SQL.Database(fs.readFileSync(copia));
    const r = db.exec(`SELECT url, title, last_visit_time FROM urls WHERE hidden = 0 AND url LIKE 'http%' ORDER BY last_visit_time DESC LIMIT ${Number(max) || 3000}`);
    db.close();
    // Chrome cuenta microsegundos desde 1601
    return ((r[0] && r[0].values) || []).map(([url, titulo, t]) => ({ url, titulo: titulo || '', t: Math.round(Number(t) / 1000 - 11644473600000) })).filter((x) => x.t > 0);
  } finally { try { fs.unlinkSync(copia); } catch { /* */ } }
}

module.exports = { perfiles, favoritos, historial };
