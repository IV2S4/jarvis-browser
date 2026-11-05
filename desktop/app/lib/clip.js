'use strict';
// «Jarvis, clip that» [04-nov]: pide a NVIDIA (Alt+F10) o a la Xbox Game Bar (Win+Alt+G) que guarde la jugada,
// espera a que aparezca el video y lo devuelve (el navegador lo manda al teléfono).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const PS_TECLAS = (vks) => `Add-Type @"
using System; using System.Runtime.InteropServices;
public class Tecla { [DllImport("user32.dll")] public static extern void keybd_event(byte v, byte s, uint f, UIntPtr e); }
"@
$v = @(${vks.join(',')}); foreach ($k in $v) { [Tecla]::keybd_event([byte]$k, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30 }
Start-Sleep -Milliseconds 80; [array]::Reverse($v); foreach ($k in $v) { [Tecla]::keybd_event([byte]$k, 0, 2, [UIntPtr]::Zero); Start-Sleep -Milliseconds 20 }`;

function pulsar(metodo) {
  // NVIDIA: Alt (0x12) + F10 (0x79) · Xbox Game Bar: Win (0x5B) + Alt (0x12) + G (0x47)
  const vks = metodo === 'xbox' ? ['0x5B', '0x12', '0x47'] : ['0x12', '0x79'];
  return new Promise((ok) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_TECLAS(vks)], { windowsHide: true, timeout: 15000 }, (e) => ok(!e)));
}

function videos(dir, desde, prof = 0, out = []) {
  if (prof > 3) return out;
  let lista = []; try { lista = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of lista) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) videos(p, desde, prof + 1, out);
    else if (/\.(mp4|mkv|mov)$/i.test(e.name)) { try { const st = fs.statSync(p); if (st.mtimeMs >= desde) out.push({ ruta: p, t: st.mtimeMs, tam: st.size }); } catch { /* */ } }
  }
  return out;
}
const carpetaVideos = () => { for (const d of [path.join(os.homedir(), 'Videos'), path.join(os.homedir(), 'OneDrive', 'Videos'), path.join(os.homedir(), 'Vídeos')]) if (fs.existsSync(d)) return d; return path.join(os.homedir(), 'Videos'); };

// → { ok, ruta, tam } · el archivo debe dejar de crecer antes de devolverlo
async function guardar(metodo = 'nvidia', carpeta = '') {
  if (process.platform !== 'win32') return { ok: false, error: 'Esto funciona en Windows.' };
  const desde = Date.now() - 1500;
  if (!(await pulsar(metodo))) return { ok: false, error: 'No pude pulsar el atajo de grabación.' };
  const dir = carpeta && fs.existsSync(carpeta) ? carpeta : carpetaVideos();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const v = videos(dir, desde).sort((a, b) => b.t - a.t)[0];
    if (v) {
      let antes = -1;
      for (let j = 0; j < 10; j++) { const t = fs.statSync(v.ruta).size; if (t === antes && t > 0) break; antes = t; await new Promise((r) => setTimeout(r, 1000)); }
      return { ok: true, ruta: v.ruta, tam: fs.statSync(v.ruta).size };
    }
  }
  return { ok: false, error: metodo === 'xbox'
    ? 'No apareció el clip. Revisa que la Xbox Game Bar tenga activada «Grabar lo que pasó».'
    : 'No apareció el clip. Revisa que en NVIDIA esté activada la «Repetición instantánea» (Alt+Z › Repetición instantánea).' };
}

module.exports = { guardar, carpetaVideos };
