'use strict';
// Bloqueador de anuncios completo (listas EasyList/uBlock vía Ghostery) [2026-10-28]
// Se suma a la lista propia de proteccion.js: bloquea anuncios, rastreadores y oculta los huecos que dejan.
// Las listas se bajan una vez y quedan guardadas en ~/.config/jarvis/navegador-anuncios.bin.
const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE = path.join(os.homedir(), '.config', 'jarvis', 'navegador-anuncios.bin');
let motor = null;
let bloqueados = 0;
let cosmeticaLista = false;

async function iniciar() {
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    // caché de una semana: luego se vuelve a bajar
    let viejo = false; try { viejo = Date.now() - fs.statSync(CACHE).mtimeMs > 7 * 864e5; } catch { /* */ }
    if (viejo) { try { fs.unlinkSync(CACHE); } catch { /* */ } }
    motor = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: CACHE, read: (p) => fs.promises.readFile(p), write: (p, b) => fs.promises.writeFile(p, b),
    });
    return true;
  } catch { motor = null; return false; }
}

// ocultar los huecos de anuncios (CSS) en cada página de la sesión
function cosmetica(ses, ipcMain, activo) {
  if (!motor) return;
  try {
    if (!cosmeticaLista) {
      cosmeticaLista = true;
      ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (e, url, msg) => (activo() && motor ? motor.onInjectCosmeticFilters(e, url, msg) : undefined));
      ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', () => (activo() && motor ? motor.config.enableMutationObserver : false));
    }
    ses.registerPreloadScript({ type: 'frame', filePath: require.resolve('@ghostery/adblocker-electron-preload') });
  } catch { /* versión de Electron sin esto */ }
}

// se llama desde el filtro de proteccion.js; true = ya respondió
function filtrar(d, cb) {
  if (!motor || d.resourceType === 'mainFrame') return false;
  try {
    motor.onBeforeRequest(d, (r) => { if (r && (r.cancel || r.redirectURL)) bloqueados++; cb(r || {}); });
    return true;
  } catch { return false; }
}

module.exports = { iniciar, cosmetica, filtrar, listo: () => Boolean(motor), bloqueados: () => bloqueados };
