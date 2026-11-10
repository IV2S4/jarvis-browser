'use strict';
// 🧠 Memoria del navegador [09-nov]: de cada página que visitas se guarda un pedacito de su
// texto (título, descripción y el comienzo), SOLO en esta PC (~/.config/jarvis/navegador-recuerdos.json).
// Así puedes preguntar «Jarvis, ¿dónde vi unos tenis rojos?» aunque no recuerdes el nombre de la página.
// Nunca se guardan pestañas privadas, páginas con contraseñas, ni sitios de bancos/correo.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ARCH = path.join(os.homedir(), '.config', 'jarvis', 'navegador-recuerdos.json');
const MAX = 3000;
let lista = null; let guardarT = null;

function cargar() {
  if (lista) return lista;
  try { const j = JSON.parse(fs.readFileSync(ARCH, 'utf8')); lista = Array.isArray(j) ? j.filter((x) => x && x.url) : []; } catch { lista = []; }
  return lista;
}
function guardarLuego() {
  clearTimeout(guardarT);
  guardarT = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(ARCH), { recursive: true }); fs.writeFileSync(ARCH, JSON.stringify(lista), { mode: 0o600 }); } catch { /* */ }
  }, 4000);
}
const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const SENSIBLE = /(^|\.)(bank|banco|banking|paypal|mail\.google|outlook\.live|outlook\.office|accounts\.google|login\.|signin\.|auth\.)|chase\.com|bankofamerica|wellsfargo|popular\.com|bancopopular|coinbase|binance/i;
const QUITAR = [/\b(?:\d[ -]?){13,19}\b/g, /\b\d{3}-?\d{2}-?\d{4}\b/g, /\b(sk|pk|AIza|ghp|xox[bp])[-_A-Za-z0-9]{12,}/g];

// lo que se le pide a la página (sin nada si tiene un campo de contraseña)
const JS_PAGINA = `(() => {
  if (document.querySelector('input[type=password]')) return null;
  const m = (n) => { const e = document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]'); return e ? e.content : ''; };
  const alts = [...document.images].map((i) => i.alt).filter((a) => a && a.length > 3).slice(0, 25).join(' · ');
  const texto = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 2500);
  return { titulo: document.title, desc: m('description') || m('og:description'), alts, texto };
})()`;

function anotar(url, d) {
  if (!d || !/^https?:/.test(url)) return;
  let host = ''; try { host = new URL(url).hostname; } catch { return; }
  if (SENSIBLE.test(host)) return;
  cargar();
  let texto = [d.desc, d.alts, d.texto].filter(Boolean).join(' · ').slice(0, 3000);
  for (const r of QUITAR) texto = texto.replace(r, '…');
  const limpio = url.split('#')[0];
  lista = lista.filter((x) => x.url !== limpio);
  lista.push({ url: limpio, titulo: String(d.titulo || '').slice(0, 200), texto, t: Date.now() });
  if (lista.length > MAX) lista = lista.slice(lista.length - MAX);
  guardarLuego();
}

// búsqueda por palabras (y sus comienzos: «zapat» encuentra «zapatos»); lo más parecido y reciente primero
function buscar(consulta, max = 12) {
  cargar();
  const palabras = [...new Set(normal(consulta).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2))];
  if (!palabras.length) return lista.slice(-max).reverse().map(salida(''));
  const res = [];
  for (const x of lista) {
    const ti = normal(x.titulo); const te = normal(x.texto); const u = normal(x.url);
    let p = 0;
    for (const w of palabras) {
      const raiz = w.length > 5 ? w.slice(0, w.length - 2) : w;
      if (ti.includes(raiz)) p += 3;
      if (te.includes(raiz)) p += 1 + Math.min(2, te.split(raiz).length - 2) * 0.3;
      if (u.includes(raiz)) p += 1;
    }
    if (p > 0) res.push([p + (x.t / 1e13), x]);
  }
  return res.sort((a, b) => b[0] - a[0]).slice(0, max).map(([, x]) => salida(palabras)(x));
}
function salida(palabras) {
  return (x) => {
    let trozo = x.texto.slice(0, 220);
    if (palabras && palabras.length) {
      const n = normal(x.texto); const w = palabras.find((p) => n.includes(p.length > 5 ? p.slice(0, -2) : p));
      if (w) { const i = n.indexOf(w.length > 5 ? w.slice(0, -2) : w); trozo = x.texto.slice(Math.max(0, i - 90), i + 160); }
    }
    return { cuando: new Date(x.t).toLocaleString(), titulo: x.titulo, url: x.url, trozo };
  };
}
function borrar(desde = 0) { cargar(); lista = desde ? lista.filter((x) => x.t < desde) : []; guardarLuego(); }
function total() { return cargar().length; }

module.exports = { JS_PAGINA, anotar, buscar, borrar, total };
