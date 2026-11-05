'use strict';
// Escáner de amenazas y mapa de conexiones [04-nov]
// · Por cada pestaña cuenta lo que se bloqueó (rastreadores y anuncios), con qué servidores habla y si es segura.
// · Le pone un nivel de riesgo con pistas conocidas de estafas (phishing): dominios raros, letras disfrazadas,
//   contraseñas en páginas sin HTTPS, marcas famosas en dominios que no son suyos…
// · Para el mapa: los servidores → su IP → su país/ciudad (ip-api.com: solo se envían las IP de los servidores).
const dns = require('dns').promises;

const porPestana = new Map();   // webContentsId → datos de la página actual
function nuevo(url) { return { url, inicio: Date.now(), rastreadores: 0, anuncios: 0, vistos: new Set(), hosts: new Map(), certError: false, password: false, formularioInseguro: false }; }
function de(id) { return porPestana.get(id); }

function navegacion(id, url) { porPestana.set(id, nuevo(url)); }
function peticion(id, url, bloqueo) {   // bloqueo: '' | 'rastreador' | 'anuncio'
  const d = porPestana.get(id); if (!d) return;
  let h = ''; try { h = new URL(url).hostname.replace(/^www\./, ''); } catch { return; }
  if (!h) return;
  const x = d.hosts.get(h) || { n: 0, bloqueado: '' };
  x.n++; if (bloqueo) x.bloqueado = bloqueo; d.hosts.set(h, x);
  // cada cosa bloqueada cuenta una vez (hay anuncios que reintentan cientos de veces)
  if (bloqueo) { const clave = url.split('?')[0]; if (!d.vistos.has(clave) && d.vistos.size < 5000) { d.vistos.add(clave); if (bloqueo === 'rastreador') d.rastreadores++; else d.anuncios++; } }
}
function certificado(id) { const d = porPestana.get(id); if (d) d.certError = true; }
function formularios(id, info) { const d = porPestana.get(id); if (d && info) { d.password = Boolean(info.password); d.formularioInseguro = Boolean(info.inseguro); } }
function olvidar(id) { porPestana.delete(id); }

// ── nivel de riesgo ──
const MARCAS = ['paypal', 'apple', 'icloud', 'microsoft', 'outlook', 'office365', 'google', 'gmail', 'amazon', 'netflix', 'facebook', 'instagram', 'whatsapp', 'bankofamerica', 'chase', 'wellsfargo', 'banco', 'popular', 'evertec', 'steam', 'epicgames', 'roblox', 'binance', 'coinbase', 'metamask', 'ebay', 'usps', 'fedex', 'dhl', 'irs'];
const TLD_RAROS = /\.(zip|mov|xyz|top|tk|ml|ga|cf|gq|click|country|kim|work|rest|fit|buzz|cyou|icu|sbs|cfd|monster|lol|quest)$/i;
function dominioBase(h) { const p = h.split('.'); return p.slice(-2).join('.'); }
function riesgo(url, d) {
  const pistas = []; let puntos = 0;
  let u; try { u = new URL(url); } catch { return { nivel: 'bajo', puntos: 0, pistas }; }
  const h = u.hostname.toLowerCase();
  if (u.protocol === 'http:') { puntos += 2; pistas.push('sin-https'); }
  if (d && d.certError) { puntos += 4; pistas.push('certificado'); }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) { puntos += 3; pistas.push('ip'); }
  if (h.includes('xn--')) { puntos += 3; pistas.push('letras-disfrazadas'); }
  if (TLD_RAROS.test(h)) { puntos += 2; pistas.push('dominio-raro'); }
  if (h.split('.').length > 4) { puntos += 1; pistas.push('muchos-subdominios'); }
  if ((h.match(/-/g) || []).length >= 3) { puntos += 1; pistas.push('muchos-guiones'); }
  const base = dominioBase(h);
  const marca = MARCAS.find((m) => h.includes(m) && !base.startsWith(m + '.') && !base.includes(m));
  if (marca) { puntos += 3; pistas.push('marca:' + marca); }
  if (d && d.password && u.protocol === 'http:') { puntos += 4; pistas.push('password-sin-https'); }
  if (d && d.formularioInseguro) { puntos += 2; pistas.push('formulario-inseguro'); }
  if (/^(localhost|127\.|10\.|192\.168\.)/.test(h)) { puntos = 0; pistas.length = 0; }
  return { nivel: puntos >= 5 ? 'alto' : puntos >= 2 ? 'medio' : 'bajo', puntos, pistas };
}

function resumen(id, url) {
  const d = porPestana.get(id) || nuevo(url);
  let propio = ''; try { propio = dominioBase(new URL(url).hostname); } catch { /* */ }
  const hosts = [...d.hosts.entries()].map(([host, x]) => ({ host, n: x.n, bloqueado: x.bloqueado, propio: dominioBase(host) === propio }))
    .sort((a, b) => Number(b.propio) - Number(a.propio) || b.n - a.n);
  return { url, https: /^https:/.test(url || ''), rastreadores: d.rastreadores, anuncios: d.anuncios, terceros: hosts.filter((x) => !x.propio).length,
    hosts: hosts.slice(0, 40), ...riesgo(url, d) };
}

// ── geolocalización de servidores (caché en memoria) ──
const geo = new Map();   // ip → { pais, cc, ciudad, lat, lon, org }
let yo = null;
async function ips(hosts) {
  const out = new Map();
  await Promise.all(hosts.slice(0, 30).map(async (h) => { try { const r = await dns.lookup(h, { family: 4 }); out.set(h, r.address); } catch { /* */ } }));
  return out;
}
async function ubicar(hosts) {
  const mapa = await ips(hosts);
  const faltan = [...new Set([...mapa.values()].filter((ip) => !geo.has(ip) && !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)))];
  if (faltan.length) {
    try {
      const r = await fetch('http://ip-api.com/batch?fields=status,query,country,countryCode,city,lat,lon,org', { method: 'POST', body: JSON.stringify(faltan.slice(0, 100)), signal: AbortSignal.timeout(8000) });
      for (const x of await r.json()) if (x.status === 'success') geo.set(x.query, { pais: x.country, cc: x.countryCode, ciudad: x.city, lat: x.lat, lon: x.lon, org: x.org });
    } catch { /* sin mapa esta vez */ }
  }
  if (!yo) {
    try { const r = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,city,lat,lon', { signal: AbortSignal.timeout(6000) }); const x = await r.json(); if (x.status === 'success') yo = { pais: x.country, cc: x.countryCode, ciudad: x.city, lat: x.lat, lon: x.lon }; } catch { /* */ }
  }
  return { yo, servidores: hosts.map((h) => { const ip = mapa.get(h); const g = ip && geo.get(ip); return g ? { host: h, ip, ...g } : null; }).filter(Boolean) };
}

module.exports = { navegacion, peticion, certificado, formularios, olvidar, resumen, ubicar, riesgo, de };
