'use strict';
// Idioma de JARVIS OS para las apps de Electron (barra, dock, lanzador, Ajustes, navegador). [2026-10-28]
// Los textos están escritos en español; aquí se carga el diccionario del idioma elegido en
// ~/.config/jarvis/preferencias.json ("idioma") y se le pasa a cada ventana, que traduce lo que muestra.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = [path.join(__dirname), '/opt/jarvis/idiomas'].find((d) => fs.existsSync(path.join(d, 'catalogo.json'))) || __dirname;
const PREFS = path.join(os.homedir(), '.config', 'jarvis', 'preferencias.json');

function leerJSON(p, def) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; } }
function catalogo() { return leerJSON(path.join(DIR, 'catalogo.json'), { es: { nombre: 'Español' } }); }

function actual() {
  const cat = catalogo();
  let cod = String((leerJSON(PREFS, {}) || {}).idioma || '').toLowerCase();
  if (!cod) cod = String(process.env.LANG || 'es').slice(0, 2).toLowerCase();
  return cat[cod] ? cod : 'es';
}

let cache = { cod: null, datos: null };
function diccionario(cod = actual()) {
  if (cache.cod === cod && cache.datos) return cache.datos;
  let datos = { lang: cod, exactas: {}, patrones: [] };
  if (cod !== 'es') {
    const cat = catalogo();
    const fuente = (cat[cod] && cat[cod].completo) ? cod : 'en';   // idiomas sin traducción completa: menús en inglés
    const d = leerJSON(path.join(DIR, `${fuente}.json`), {});
    for (const sec of ['ui', 'backend']) {
      for (const [es, tr] of Object.entries(d[sec] || {})) {
        if (typeof tr !== 'string' || !tr.trim() || tr === es) continue;
        if (/\{\w+\}/.test(es)) {
          // «{0} de {1}» casaría con cualquier frase: solo plantillas con texto de verdad [28-oct]
          if ((es.replace(/\{\w+\}/g, '').match(/[A-Za-zÀ-ÿ]/g) || []).length >= 6) datos.patrones.push([es, tr]);
        }
        else if (!(es.trim().toLowerCase() in datos.exactas)) datos.exactas[es.trim().toLowerCase()] = tr;
      }
    }
    const fijo = (k) => k.replace(/\{\w+\}/g, '').length;
    datos.patrones.sort((a, b) => fijo(b[0]) - fijo(a[0]));   // primero las más concretas
  }
  cache = { cod, datos };
  return datos;
}

// Para textos del proceso principal (avisos, diálogos)
function t(texto) {
  const d = diccionario();
  if (d.lang === 'es' || !texto) return texto;
  const limpio = String(texto).trim();
  const e = d.exactas[limpio.toLowerCase()];
  if (e) return e;
  for (const [es, tr] of d.patrones) {
    const nombres = es.match(/\{\w+\}/g) || [];
    const rx = new RegExp('^' + es.split(/(\{\w+\})/).map((p) => (/^\{\w+\}$/.test(p) ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$', 's');
    const m = limpio.match(rx);
    if (m) { let o = tr; nombres.forEach((n, i) => { o = o.split(n).join(m[i + 1]); }); return o; }
  }
  return texto;
}

// Avisa cuando cambia el idioma (Ajustes o «Jarvis, cambia el idioma a…») para recargar las ventanas.
function alCambiar(fn) {
  let previo = actual();
  fs.watchFile(PREFS, { interval: 1500 }, () => {
    const ahora = actual();
    if (ahora !== previo) { previo = ahora; cache = { cod: null, datos: null }; fn(ahora); }
  });
}

module.exports = { actual, catalogo, diccionario, t, alCambiar };
