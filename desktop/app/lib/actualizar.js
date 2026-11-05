'use strict';
// Actualizaciones automáticas [04-nov; desde GitHub 05-nov]
// Dos fuentes, en este orden:
//  1) una carpeta local con la nota «actualizacion.json» (la que deja CONSTRUIR.ps1 al armar una versión);
//  2) la última versión publicada en GitHub (Releases), para todo el que instaló el navegador desde allí.
// La nota trae la versión y la huella SHA-256 del instalador: si el archivo no coincide, no se usa.
// Si hay una versión más nueva, el navegador la ofrece y la instala sola al cerrarse (o al momento, si lo pides).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const REPO = 'IV2S4/jarvis-browser';
const INSTALADOR = 'Navegador-JARVIS-Setup.exe';
const CONF = path.join(os.homedir(), '.config', 'jarvis', 'navegador-actualizaciones.json');
const mayor = (a, b) => { const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

function carpeta() { try { return JSON.parse(fs.readFileSync(CONF, 'utf8')).carpeta || ''; } catch { return ''; } }
function huella(ruta) {
  return new Promise((ok, mal) => { const h = crypto.createHash('sha256'); fs.createReadStream(ruta).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', mal); });
}

// 1) carpeta local → null o { version, ruta }
async function buscarLocal(versionActual) {
  const dir = carpeta(); if (!dir) return null;
  let nota; try { nota = JSON.parse(fs.readFileSync(path.join(dir, 'actualizacion.json'), 'utf8').replace(/^﻿/, '')); } catch { return null; }
  if (!nota.version || !mayor(nota.version, versionActual)) return null;
  const ruta = path.join(dir, path.basename(nota.instalador || ''));
  if (!fs.existsSync(ruta)) return null;
  if (nota.sha256 && (await huella(ruta)) !== String(nota.sha256).toLowerCase()) return null;   // a medio copiar o cambiado: no se usa
  return { version: nota.version, ruta, fecha: nota.fecha };
}

// 2) GitHub Releases → baja el instalador a una carpeta temporal y comprueba su huella
const UA = 'JARVIS-Browser-updater';
async function buscarGitHub(versionActual) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const rel = await r.json();
  const version = String(rel.tag_name || '').replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+$/.test(version) || !mayor(version, versionActual)) return null;
  const activo = (n) => (rel.assets || []).find((a) => a.name === n);
  const exe = activo(INSTALADOR), notaA = activo('actualizacion.json');
  if (!exe || !notaA) return null;
  const nota = await (await fetch(notaA.browser_download_url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })).json();
  const sha = String(nota.sha256 || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha) || String(nota.version) !== version) return null;
  const dir = path.join(os.tmpdir(), 'navegador-jarvis-actualizacion'); fs.mkdirSync(dir, { recursive: true });
  const ruta = path.join(dir, `Navegador-JARVIS-Setup-${version}.exe`);
  if (!(fs.existsSync(ruta) && (await huella(ruta)) === sha)) {
    const res = await fetch(exe.browser_download_url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15 * 60000) });
    if (!res.ok || !res.body) return null;
    const parte = ruta + '.parte';
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(parte));
    if ((await huella(parte)) !== sha) { fs.rmSync(parte, { force: true }); return null; }   // dañado o cambiado: no se usa
    fs.renameSync(parte, ruta);
  }
  return { version, ruta, fecha: rel.published_at };
}

async function buscar(versionActual) {
  const local = await buscarLocal(versionActual).catch(() => null);
  if (local) return local;
  return buscarGitHub(versionActual).catch(() => null);
}

// instala en silencio; «abrir» vuelve a abrir el navegador al terminar
function instalar(ruta, abrir) {
  const args = ['/S', ...(abrir ? ['--force-run'] : [])];
  const p = spawn(ruta, args, { detached: true, stdio: 'ignore', windowsHide: true });
  p.unref();
}

module.exports = { buscar, instalar, carpeta, mayor, REPO };
