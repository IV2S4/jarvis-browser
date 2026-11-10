'use strict';
// 🔄 Continuar en el otro dispositivo [09-nov]: la PC y el teléfono se hablan por el WiFi de la casa.
// La primera vez se emparejan con un código de 6 números que sale en la PC (dura 5 minutos); después el teléfono
// usa una llave larga y secreta. Sin esa llave nadie más puede hablar con la PC. Solo responde dentro de la red de la casa.
//   GET  /continuar/ahora     → lo que la PC está viendo (dirección, título y minuto del video)
//   POST /continuar/abrir     → abre en la PC lo que venía viendo el teléfono (y el video en el mismo minuto)
//   GET  /continuar/pendiente → lo que la PC le mandó al teléfono («Continuar en el teléfono»)
const http = require('http');
const os = require('os');
const crypto = require('crypto');

const PUERTO = 8766;
let srv = null; let codigo = null; let codigoHasta = 0; let intentos = 0; let pendiente = null;

function ipLocal() {
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const x of lista || []) if (x.family === 'IPv4' && !x.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address)) return x.address;
  }
  return '';
}
const esLocal = (ip) => /^(::ffff:)?(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(String(ip || ''));

// o: { tokens() → [], guardarToken(t), ahora() → {url,titulo,tiempo}, abrir({url,tiempo}), avisar(evento) }
function encender(o) {
  if (srv) return { ok: true, ip: ipLocal(), puerto: PUERTO };
  srv = http.createServer(async (req, res) => {
    const resp = (code, j) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (!esLocal(req.socket.remoteAddress)) return resp(403, { ok: false });
    let cuerpo = ''; req.on('data', (c) => { cuerpo += c; if (cuerpo.length > 20000) req.destroy(); });
    await new Promise((ok) => req.on('end', ok));
    let d = {}; try { d = cuerpo ? JSON.parse(cuerpo) : {}; } catch { /* */ }
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/continuar/emparejar' && req.method === 'POST') {
      if (!codigo || Date.now() > codigoHasta || intentos >= 5) return resp(403, { ok: false, error: 'codigo-vencido' });
      if (String(d.codigo || '') !== codigo) { intentos++; return resp(403, { ok: false, error: 'codigo-mal' }); }
      const token = crypto.randomBytes(24).toString('hex'); codigo = null;
      o.guardarToken(token, String(d.nombre || 'Teléfono').slice(0, 40)); o.avisar({ emparejado: String(d.nombre || 'Teléfono').slice(0, 40) });
      return resp(200, { ok: true, token, pc: os.hostname() });
    }
    const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const validos = o.tokens();
    if (!t || !validos.some((v) => v.length === t.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(t)))) return resp(401, { ok: false, error: 'sin-permiso' });
    if (u.pathname === '/continuar/ahora') return resp(200, { ok: true, ...(await o.ahora()) });
    if (u.pathname === '/continuar/abrir' && req.method === 'POST') {
      if (!/^https?:\/\//.test(String(d.url || ''))) return resp(400, { ok: false });
      o.abrir({ url: String(d.url), tiempo: Number(d.tiempo) || 0, titulo: String(d.titulo || '').slice(0, 200) });
      return resp(200, { ok: true });
    }
    if (u.pathname === '/continuar/pendiente') { const p = pendiente; pendiente = null; return resp(200, { ok: true, pendiente: p }); }
    resp(404, { ok: false });
  });
  srv.on('error', () => { srv = null; });
  srv.listen(PUERTO, '0.0.0.0');
  return { ok: true, ip: ipLocal(), puerto: PUERTO };
}
function apagar() { if (srv) { try { srv.close(); } catch { /* */ } srv = null; } codigo = null; }
function nuevoCodigo() { codigo = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); codigoHasta = Date.now() + 5 * 60000; intentos = 0; return { codigo, ip: ipLocal(), puerto: PUERTO, vence: codigoHasta }; }
function mandarAlTelefono(x) { pendiente = { ...x, t: Date.now() }; }
module.exports = { encender, apagar, nuevoCodigo, mandarAlTelefono, ipLocal, PUERTO };
