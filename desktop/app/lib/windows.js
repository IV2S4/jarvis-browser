'use strict';
// Navegador JARVIS en Windows [04-nov]: registrarse como navegador (para poder ser el predeterminado)
// y entender lo que Windows le pasa al abrir un enlace o un archivo. Sacado de main.js al ordenar el código.
const fs = require('fs');

// lo que Windows le pasa al abrir un enlace o un archivo .html/.pdf con este navegador
function urlsDeArgs(argv) {
  const { pathToFileURL } = require('url');
  return argv.slice(1).map((a) => {
    if (/^(https?:|file:|www\.)/i.test(a)) return a;
    if (/\.(html?|pdf|xhtml|svg|txt)$/i.test(a)) { try { if (fs.existsSync(a)) return pathToFileURL(a).href; } catch { /* */ } }
    return null;
  }).filter(Boolean);
}
const NOMBRE_REG = 'NavegadorJARVIS';
function reg(args) { return new Promise((ok) => require('child_process').execFile('reg.exe', args, { windowsHide: true, timeout: 15000 }, (e, s) => ok(e ? null : String(s)))); }
// se registra como navegador en Windows (solo para tu usuario); elegirlo como predeterminado lo haces tú en Configuración de Windows
async function registrarNavegador() {
  if (process.platform !== 'win32') return { ok: false };
  const exe = process.execPath; const abrir = `"${exe}" "%1"`; const icono = `"${exe}",0`;
  const base = `HKCU\\Software\\Clients\\StartMenuInternet\\${NOMBRE_REG}`;
  const pasos = [
    [base, '/ve', '/d', 'Navegador JARVIS'],
    [`${base}\\DefaultIcon`, '/ve', '/d', icono],
    [`${base}\\shell\\open\\command`, '/ve', '/d', `"${exe}"`],
    [`${base}\\Capabilities`, '/v', 'ApplicationName', '/d', 'Navegador JARVIS'],
    [`${base}\\Capabilities`, '/v', 'ApplicationDescription', '/d', 'JARVIS Browser'],
    [`${base}\\Capabilities`, '/v', 'ApplicationIcon', '/d', icono],
    ...['http', 'https'].map((p) => [`${base}\\Capabilities\\URLAssociations`, '/v', p, '/d', 'JarvisURL']),
    ...['.htm', '.html', '.pdf', '.xhtml', '.svg'].map((x) => [`${base}\\Capabilities\\FileAssociations`, '/v', x, '/d', 'JarvisHTML']),
    ['HKCU\\Software\\RegisteredApplications', '/v', NOMBRE_REG, '/d', `Software\\Clients\\StartMenuInternet\\${NOMBRE_REG}\\Capabilities`],
    ['HKCU\\Software\\Classes\\JarvisURL', '/ve', '/d', 'Navegador JARVIS URL'],
    ['HKCU\\Software\\Classes\\JarvisURL', '/v', 'URL Protocol', '/d', ''],
    ['HKCU\\Software\\Classes\\JarvisURL\\DefaultIcon', '/ve', '/d', icono],
    ['HKCU\\Software\\Classes\\JarvisURL\\shell\\open\\command', '/ve', '/d', abrir],
    ['HKCU\\Software\\Classes\\JarvisHTML', '/ve', '/d', 'Navegador JARVIS HTML'],
    ['HKCU\\Software\\Classes\\JarvisHTML\\DefaultIcon', '/ve', '/d', icono],
    ['HKCU\\Software\\Classes\\JarvisHTML\\shell\\open\\command', '/ve', '/d', abrir],
  ];
  for (const p of pasos) { const [clave, ...resto] = p; if ((await reg(['add', clave, ...resto, '/f'])) === null) return { ok: false, error: `reg ${clave}` }; }
  return { ok: true };
}
async function esPredeterminado() {
  if (process.platform !== 'win32') return false;
  const s = await reg(['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId']);
  return Boolean(s && /JarvisURL/.test(s));
}

module.exports = { urlsDeArgs, registrarNavegador, esPredeterminado, NOMBRE_REG };
