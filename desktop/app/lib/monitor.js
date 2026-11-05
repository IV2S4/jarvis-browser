'use strict';
// Monitor del sistema [04-nov]: CPU, RAM, GPU (NVIDIA) e internet, cada 2 s, solo mientras el navegador está a la vista.
const os = require('os');
const { execFile } = require('child_process');

let previoCpu = null;
function cpu() {
  const t = os.cpus().reduce((a, c) => { for (const k in c.times) a[k] = (a[k] || 0) + c.times[k]; return a; }, {});
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const libre = t.idle;
  let pct = 0;
  if (previoCpu) { const dt = total - previoCpu.total; pct = dt > 0 ? Math.round(100 * (1 - (libre - previoCpu.libre) / dt)) : 0; }
  previoCpu = { total, libre };
  return Math.max(0, Math.min(100, pct));
}
const ram = () => Math.round(100 * (1 - os.freemem() / os.totalmem()));

const correr = (cmd, args) => new Promise((ok) => execFile(cmd, args, { windowsHide: true, timeout: 4000 }, (e, s) => ok(e ? '' : String(s))));
let sinNvidia = false;
async function gpu() {
  if (sinNvidia || process.platform !== 'win32') return null;
  const s = await correr('nvidia-smi', ['--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total', '--format=csv,noheader,nounits']);
  if (!s) { sinNvidia = true; return null; }
  const [uso, temp, usada, total] = s.split('\n')[0].split(',').map((x) => Number(x.trim()));
  return { uso, temp, vram: total ? Math.round((100 * usada) / total) : 0 };
}
let previoRed = null;
async function red() {
  if (process.platform !== 'win32') return null;
  const s = await correr('netstat', ['-e']);
  const linea = s.split('\n').find((l) => /^\s*(Bytes|Bytes recibidos|Octets)\b/i.test(l) || /^\s*\S+\s+\d{4,}\s+\d{4,}\s*$/.test(l));
  if (!linea) return null;
  const n = linea.trim().split(/\s+/).filter((x) => /^\d+$/.test(x)).map(Number);
  if (n.length < 2) return null;
  const ahora = Date.now(); let out = null;
  if (previoRed) { const dt = (ahora - previoRed.t) / 1000; if (dt > 0) out = { bajada: Math.max(0, (n[0] - previoRed.rx) / dt), subida: Math.max(0, (n[1] - previoRed.tx) / dt) }; }
  previoRed = { t: ahora, rx: n[0], tx: n[1] };
  return out;
}

let reloj = null;
// enviar(datos) · activo() → true mientras hay que medir
function iniciar(enviar, activo) {
  if (reloj) return;
  let ocupado = false;
  reloj = setInterval(async () => {
    if (ocupado || !activo()) { previoRed = null; return; }
    ocupado = true;
    try { const [g, r] = await Promise.all([gpu(), red()]); enviar({ cpu: cpu(), ram: ram(), gpu: g, red: r }); }
    finally { ocupado = false; }
  }, 2000);
}

module.exports = { iniciar };
