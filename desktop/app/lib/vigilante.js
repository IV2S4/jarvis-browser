'use strict';
// Vigilante de páginas [04-nov]
// Guarda la lista en ~/.config/jarvis/navegador-vigilancias.json. Mientras el navegador está abierto,
// revisa cada página cada cierto tiempo (en una ventana invisible) y avisa: notificación de Windows + JARVIS lo dice.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ARCHIVO = path.join(os.homedir(), '.config', 'jarvis', 'navegador-vigilancias.json');
let lista = [];
try { lista = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); if (!Array.isArray(lista)) lista = []; } catch { /* primera vez */ }
const guardar = () => { try { fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true }); fs.writeFileSync(ARCHIVO, JSON.stringify(lista, null, 1), { mode: 0o600 }); } catch { /* */ } };

// huella del contenido: sin números ni fechas sueltas, para no avisar por «hace 3 minutos»
const huella = (t) => crypto.createHash('sha1').update(String(t || '').toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 3000)).digest('hex');

function agregar({ url, titulo, tipo, precio, objetivo, texto, cada, moneda }) {
  if (!/^https?:/.test(url || '')) return null;
  const ya = lista.find((v) => v.url === url && v.tipo === tipo);
  if (ya) { if (objetivo) ya.objetivo = Number(objetivo); guardar(); return ya; }
  const v = { id: crypto.randomBytes(4).toString('hex'), url, titulo: String(titulo || url).slice(0, 120), tipo: tipo === 'cambios' ? 'cambios' : 'precio',
    moneda: moneda || '$', cada: Math.max(15, Number(cada) || 60), creado: Date.now(), revisado: Date.now(), precio: precio || null, precioInicial: precio || null,
    objetivo: objetivo ? Number(objetivo) : null, historial: precio ? [{ t: Date.now(), p: precio }] : [], huella: texto ? huella(texto) : '', resumen: String(texto || '').slice(0, 1500), avisos: 0, error: '' };
  lista.push(v); guardar();
  return v;
}
function quitar(id) { lista = lista.filter((v) => v.id !== id); guardar(); return true; }
const todas = () => lista;

// leer(url) → { precio, texto, titulo } | null · avisar(v, mensaje) · juzgar(viejo, nuevo) → frase o '' (IA opcional)
async function revisar(v, { leer, avisar, juzgar }) {
  let r = null;
  try { r = await leer(v.url); } catch (e) { r = null; v.error = String(e.message || e).slice(0, 120); }
  v.revisado = Date.now();
  if (!r) { v.error = v.error || 'No pude abrir la página'; guardar(); return; }
  v.error = '';
  if (r.titulo) v.titulo = String(r.titulo).slice(0, 120);
  if (r.moneda && !v.moneda) v.moneda = r.moneda;
  if (v.tipo === 'precio') {
    if (!r.precio) { v.error = 'No encontré el precio esta vez'; guardar(); return; }
    const antes = v.precio;
    v.precio = r.precio;
    v.historial = [...(v.historial || []), { t: Date.now(), p: r.precio }].slice(-40);
    if (antes && r.precio < antes - 0.009) {
      v.avisos++;
      avisar(v, { clase: v.objetivo && r.precio <= v.objetivo ? 'objetivo' : 'bajo', antes, ahora: r.precio });
    }
  } else {
    const h = huella(r.texto);
    if (v.huella && h !== v.huella) {
      let frase = '';
      try { frase = juzgar ? await juzgar(v.resumen, String(r.texto || '').slice(0, 1500), v.titulo) : '-'; } catch { frase = '-'; }
      if (frase) { v.avisos++; avisar(v, { clase: 'cambio', frase }); }
    }
    v.huella = h; v.resumen = String(r.texto || '').slice(0, 1500);
  }
  guardar();
}

let reloj = null;
let ocupado = false;
// cada 5 minutos revisa las que ya tocan (de una en una); pausa: () => true mientras juegas
function iniciar(opciones, pausa) {
  if (reloj) return;
  const vuelta = async () => {
    if (ocupado || pausa()) return;
    ocupado = true;
    try {
      for (const v of lista.filter((x) => Date.now() - (x.revisado || 0) >= x.cada * 60000)) {
        if (pausa()) break;
        await revisar(v, opciones);
      }
    } finally { ocupado = false; }
  };
  reloj = setInterval(vuelta, 5 * 60000);
  setTimeout(vuelta, 2 * 60000);
}
async function revisarYa(id, opciones) {
  const v = lista.find((x) => x.id === id);
  if (!v) return null;
  await revisar(v, opciones);
  return v;
}

module.exports = { agregar, quitar, todas, iniciar, revisarYa, huella };
