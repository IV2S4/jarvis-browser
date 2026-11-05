'use strict';
// Escáner de descargas [04-nov]: cada archivo que bajas pasa por
//  · Windows Defender (MpCmdRun, dentro de tu PC, sin internet) — no lo borra ni lo mueve: solo dice si es peligroso
//  · VirusTotal (si pusiste tu llave gratis): solo se envía la huella SHA-256 del archivo, nunca el archivo
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

function huella(ruta) {
  return new Promise((ok, mal) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(ruta).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', mal);
  });
}

function mpCmdRun() {
  const cand = [];
  const plat = 'C:\\ProgramData\\Microsoft\\Windows Defender\\Platform';
  try { for (const v of fs.readdirSync(plat).sort().reverse()) cand.push(path.join(plat, v, 'MpCmdRun.exe')); } catch { /* */ }
  cand.push('C:\\Program Files\\Windows Defender\\MpCmdRun.exe');
  return cand.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || '';
}

// → { motor:'defender', estado:'limpio'|'amenaza'|'no-disponible', amenaza? }
function defender(ruta) {
  return new Promise((ok) => {
    if (process.platform !== 'win32') return ok({ motor: 'defender', estado: 'no-disponible' });
    const exe = mpCmdRun();
    if (!exe) return ok({ motor: 'defender', estado: 'no-disponible' });
    execFile(exe, ['-Scan', '-ScanType', '3', '-File', ruta, '-DisableRemediation'], { windowsHide: true, timeout: 180000 }, (e, salida) => {
      const s = String(salida || '');
      const codigo = e ? e.code : 0;
      if (codigo === 0 || /found no threats/i.test(s)) return ok({ motor: 'defender', estado: 'limpio' });
      if (codigo === 2 || /Threat\s+:/i.test(s)) {
        const n = /Threat\s+:\s*(.+)/i.exec(s);
        return ok({ motor: 'defender', estado: 'amenaza', amenaza: n ? n[1].trim().slice(0, 80) : '' });
      }
      ok({ motor: 'defender', estado: 'no-disponible', detalle: s.trim().split('\n').pop().slice(0, 120) });
    });
  });
}

// → { motor:'virustotal', estado:'limpio'|'amenaza'|'sospechoso'|'desconocido'|'error', malos, total }
async function virustotal(sha, llave) {
  if (!llave) return null;
  try {
    const r = await fetch(`https://www.virustotal.com/api/v3/files/${sha}`, { headers: { 'x-apikey': llave }, signal: AbortSignal.timeout(20000) });
    if (r.status === 404) return { motor: 'virustotal', estado: 'desconocido' };
    if (!r.ok) return { motor: 'virustotal', estado: 'error', detalle: `HTTP ${r.status}` };
    const j = await r.json();
    const st = j?.data?.attributes?.last_analysis_stats || {};
    const malos = (st.malicious || 0); const sosp = (st.suspicious || 0);
    const total = Object.values(st).reduce((a, b) => a + (Number(b) || 0), 0);
    return { motor: 'virustotal', estado: malos >= 3 ? 'amenaza' : (malos || sosp) ? 'sospechoso' : 'limpio', malos, sospechosos: sosp, total,
      enlace: `https://www.virustotal.com/gui/file/${sha}` };
  } catch (e) { return { motor: 'virustotal', estado: 'error', detalle: String(e.message || e).slice(0, 80) }; }
}

// veredicto final: peligroso si alguno lo ve peligroso
async function revisar(ruta, llaveVT) {
  if (!fs.existsSync(ruta)) return { veredicto: 'quitado', sha: '', motores: [] };   // Windows ya lo puso en cuarentena
  const sha = await huella(ruta).catch(() => '');
  const [d, v] = await Promise.all([defender(ruta), sha ? virustotal(sha, llaveVT) : null]);
  const motores = [d, v].filter(Boolean);
  let veredicto = 'limpio';
  if (motores.some((m) => m.estado === 'amenaza')) veredicto = 'peligroso';
  else if (motores.some((m) => m.estado === 'sospechoso')) veredicto = 'sospechoso';
  else if (!motores.some((m) => m.estado === 'limpio')) veredicto = 'sin-revisar';
  return { veredicto, sha, motores };
}

module.exports = { revisar, huella, defender, virustotal };
