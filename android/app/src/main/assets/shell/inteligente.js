'use strict';
// 🚀 Funciones inteligentes del teléfono [09-nov] — cada una se apaga en Ajustes › Funciones inteligentes.
//   🧠 Memoria del navegador: un pedacito del texto de cada página (solo en el teléfono) para encontrarla después.
//   🗣 Doblaje en vivo: lee en voz alta, con la voz NATIVA del idioma (la de Google/Samsung), los subtítulos traducidos.
//   📸 Busca lo que ves: la cámara de atrás; apuntas, tocas el botón y JARVIS te dice qué es y lo busca.

// ═══════════ 🧠 memoria del navegador ═══════════
let recuerdos = []; let recuerdosT = 0; let recordarT = 0;
Datos.cargar('recuerdos', []).then((v) => { recuerdos = Array.isArray(v) ? v : []; });
const SENSIBLE = /(^|\.)(bank|banco|banking|paypal|mail\.google|outlook\.live|accounts\.google|login\.|signin\.|auth\.)|chase\.com|bankofamerica|wellsfargo|popular\.com|bancopopular|coinbase|binance/i;
const JS_RECUERDO = `(() => {
  if (document.querySelector('input[type=password]')) return null;
  const m = (n) => { const e = document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]'); return e ? e.content : ''; };
  const alts = [...document.images].map((i) => i.alt).filter((a) => a && a.length > 3).slice(0, 25).join(' · ');
  return { url: location.href, titulo: document.title, desc: m('description') || m('og:description'), alts, texto: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 2500) };
})()`;
const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
nav.en('navegado', (h) => {
  if (cfg.memoriaNavegador === false || !cfg.guardarHistorial || !h || !/^https?:/.test(h.url) || E.privada) return;
  let host = ''; try { host = new URL(h.url).hostname; } catch { return; }
  if (SENSIBLE.test(host)) return;
  clearTimeout(recordarT);
  recordarT = setTimeout(async () => {
    if (E.privada) return;
    const d = await enPagina(JS_RECUERDO); if (!d || !d.url || d.url.split('#')[0] !== h.url.split('#')[0]) return;
    let texto = [d.desc, d.alts, d.texto].filter(Boolean).join(' · ').slice(0, 3000);
    for (const r of [/\b(?:\d[ -]?){13,19}\b/g, /\b\d{3}-?\d{2}-?\d{4}\b/g]) texto = texto.replace(r, '…');
    const url = d.url.split('#')[0];
    recuerdos = recuerdos.filter((x) => x.url !== url); recuerdos.push({ url, titulo: String(d.titulo || '').slice(0, 200), texto, t: Date.now() });
    if (recuerdos.length > 1500) recuerdos = recuerdos.slice(-1500);
    clearTimeout(recuerdosT); recuerdosT = setTimeout(() => Datos.guardar('recuerdos', recuerdos), 3000);
  }, 3500);
});
function buscarRecuerdos(consulta, max = 12) {
  const palabras = [...new Set(normal(consulta).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2))].map((w) => (w.length > 5 ? w.slice(0, -2) : w));
  const res = [];
  for (const x of recuerdos) {
    const ti = normal(x.titulo); const te = normal(x.texto); const u = normal(x.url); let p = 0;
    for (const w of palabras) { if (ti.includes(w)) p += 3; if (te.includes(w)) p += 1; if (u.includes(w)) p += 1; }
    if (p > 0 || !palabras.length) res.push([p + x.t / 1e13, x]);
  }
  return res.sort((a, b) => b[0] - a[0]).slice(0, max).map(([, x]) => {
    const n = normal(x.texto); const w = palabras.find((q) => n.includes(q)); const i = w ? n.indexOf(w) : 0;
    return { cuando: new Date(x.t).toLocaleString(), titulo: x.titulo, url: x.url, trozo: x.texto.slice(Math.max(0, i - 90), i + 160) };
  });
}
function borrarRecuerdos() { recuerdos = []; Datos.guardar('recuerdos', recuerdos); }

// ═══════════ 🗣 doblaje en vivo ═══════════
function jsDoblaje(on) {
  return `(() => {
    const D = window.__jarvisDoblaje || (window.__jarvisDoblaje = { salida: [], ultimo: '', buf: '', bufT: 0, vol: null, reloj: 0, activo: false });
    const vid = () => document.querySelector('#movie_player video') || [...document.querySelectorAll('video')].find((v) => !v.paused) || document.querySelector('video');
    if (!${Boolean(on)}) { D.activo = false; clearInterval(D.reloj); D.reloj = 0; const v = vid(); if (v && D.vol != null) v.volume = D.vol; D.vol = null; D.salida = []; D.buf = ''; D.ultimo = ''; return 'apagado'; }
    const v0 = vid(); if (!v0) return 'sin-video';
    D.activo = true;
    const leer = () => {
      const v = vid(); let t = [...document.querySelectorAll('.ytp-caption-segment')].map((e) => e.textContent).join(' ');
      if (!t) { const l = document.querySelectorAll('.caption-visual-line'); t = [...(l.length ? l : document.querySelectorAll('.captions-text'))].map((e) => e.textContent).join(' '); }
      if (!t && v && v.textTracks) for (const tr of v.textTracks) { if (tr.mode === 'disabled') tr.mode = 'hidden'; if (tr.activeCues) t += ' ' + [...tr.activeCues].map((c) => c.text).join(' '); }
      return t.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
    };
    const nuevo = (antes, ahora) => { const a = antes.split(' '), b = ahora.split(' '); for (let k = Math.min(a.length, b.length); k > 0; k--) if (a.slice(a.length - k).join(' ') === b.slice(0, k).join(' ')) return b.slice(k).join(' '); return ahora; };
    clearInterval(D.reloj);
    D.reloj = setInterval(() => {
      const v = vid(); if (!D.activo || !v) return;
      if (v.volume > 0.151) { D.vol = v.volume; v.volume = 0.15; }
      const t = leer();
      if (t && t !== D.ultimo) { const n = nuevo(D.ultimo, t); D.ultimo = t; if (n) { D.buf = (D.buf ? D.buf + ' ' : '') + n; D.bufT = Date.now(); } }
      if (D.buf && (/[.!?…]$/.test(D.buf) || Date.now() - D.bufT > 1000 || D.buf.split(' ').length > 16)) { D.salida.push(D.buf); D.buf = ''; if (D.salida.length > 6) D.salida.splice(0, D.salida.length - 6); }
    }, 250);
    return 'encendido';
  })()`;
}
const JS_DOBLAJE_SACAR = `(() => { const d = window.__jarvisDoblaje; if (!d || !d.activo) return null; const v = document.querySelector('#movie_player video') || document.querySelector('video'); return { lineas: d.salida.splice(0), pausado: !v || v.paused }; })()`;
const DOB = { reloj: 0, id: 0, lang: 'es', url: '' };
const esYT = (u) => /^https:\/\/(www\.|m\.)?youtube\.com\/(watch|shorts)|^https:\/\/youtu\.be\//.test(u || '');
const hayAnuncio = () => enPagina("!!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting, .ad-showing')");
async function doblaje(on = true, lang) {
  if (cfg.doblajeEnVivo === false) return { ok: false, error: 'Live dubbing is turned off in Settings › Smart features.' };
  if (!on) { pararDoblaje(); return { ok: true, estado: 'off' }; }
  const L = String(lang || IDIOMA || 'es').slice(0, 2).toLowerCase();
  if (!(await H('tts-idioma', { lang: L }))) return { ok: false, error: `This phone has no native ${L} voice installed (Android Settings › Text-to-speech › Google › Install voice data). Only subtitles.` };
  if (esYT(E.url)) {
    if (await hayAnuncio()) {   // durante un anuncio no hay subtítulos: empieza solo al terminar
      (async () => { for (let i = 0; i < 60 && await hayAnuncio(); i++) await pausa(2000); doblaje(true, L); })();
      return { ok: true, estado: 'waiting for the ad to end', nota: 'Dubbing starts by itself when the ad ends.' };
    }
    let s = null; for (let i = 0; i < 3 && !(s && s.ok); i++) { s = await enPaginaAsync(jsSubtitulos(L, true, false)); if (!(s && s.ok)) await pausa(2500); }
    if (!(s && s.ok)) return { ok: false, error: 'This video has no subtitles (not even automatic ones).' };
  }
  const r = await enPagina(jsDoblaje(true));
  if (r === 'sin-video') return { ok: false, error: 'There is no video on this page.' };
  if (r !== 'encendido') return { ok: false, error: 'Could not start dubbing here.' };
  if (DOB.id && DOB.id !== E.activa) enPagina(jsDoblaje(false), DOB.id);
  DOB.id = E.activa; DOB.lang = L; DOB.url = E.url; clearInterval(DOB.reloj);
  DOB.reloj = setInterval(async () => {
    if (!E.pestanas.some((p) => p.id === DOB.id)) return pararDoblaje();
    const p = E.pestanas.find((x) => x.id === DOB.id);
    if (p && p.url !== DOB.url) {   // otro video en la misma pestaña: subtítulos otra vez
      DOB.url = p.url;
      if (esYT(p.url)) setTimeout(async () => { for (let i = 0; i < 60 && await hayAnuncio(); i++) await pausa(2000); enPaginaAsync(jsSubtitulos(DOB.lang, true, false), 15000, DOB.id); }, 2500);
    }
    const x = await enPagina(JS_DOBLAJE_SACAR, DOB.id);
    if (x === null) { enPagina(jsDoblaje(true), DOB.id); return; }
    if (!x) return;
    if (x.pausado) { H('tts-parar'); return; }
    for (const l of x.lineas || []) H('tts', { texto: l, lang: DOB.lang, velocidad: 1.12, cola: true, nativa: true });
  }, 400);
  toast('🗣 ' + T('Doblaje en vivo encendido', 'Live dubbing on'));
  return { ok: true, estado: 'on', idioma: L };
}
function pararDoblaje() {
  clearInterval(DOB.reloj); DOB.reloj = 0;
  if (DOB.id) enPagina(jsDoblaje(false), DOB.id);
  DOB.id = 0; H('tts-parar');
}

// ═══════════ 📸 busca lo que ves (cámara de atrás) ═══════════
function fotoConCamara() {
  return new Promise(async (resolve) => {
    if (cfg.buscaLoQueVes === false) { resolve({ ok: false, error: '«Search what you see» is turned off in Settings.' }); return; }
    if ((await H('permiso', { tipo: 'camara' })) === false) {
      await new Promise((ok) => { const f = () => ok(); nav.en('permisos', f); setTimeout(ok, 30000); });
      if ((await H('permiso', { tipo: 'camara' })) === false) { resolve({ ok: false, error: 'No camera permission.' }); return; }
    }
    let s = null;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } }); }
    catch (e) { resolve({ ok: false, error: e && e.name === 'NotAllowedError' ? 'Camera blocked' : String((e && e.message) || e) }); return; }
    H('cubrir', { on: true });
    const capa = document.createElement('div'); capa.id = 'camara-busca';
    capa.innerHTML = `<video playsinline muted autoplay></video><p>${T('Apunta a lo que quieres buscar', 'Point at what you want to search')}</p>
      <div><button class="x">✕</button><button class="disparo" aria-label="Foto">📸</button></div>`;
    document.body.appendChild(capa);
    const v = capa.querySelector('video'); v.srcObject = s; v.play().catch(() => {});
    const cerrar = (r) => { s.getTracks().forEach((t) => t.stop()); capa.remove(); if (!pilaCapas.length) H('cubrir', { on: false }); resolve(r); };
    const limite = setTimeout(() => cerrar({ ok: false, error: 'The user did not take the photo.' }), 90000);
    capa.querySelector('.x').onclick = () => { clearTimeout(limite); cerrar({ ok: false, error: 'The user cancelled the photo.' }); };
    capa.querySelector('.disparo').onclick = () => {
      clearTimeout(limite); H('vibrar', { ms: 30 });
      const c = document.createElement('canvas'); const w = v.videoWidth || 960; const h = v.videoHeight || 720; const k = Math.min(1, 1024 / Math.max(w, h));
      c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      cerrar({ ok: true, data: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
    };
  });
}


// ═══════════ 🛡 detector de estafas · 💰 comparador de precios · 🎬 pregúntale al video [09-nov] ═══════════
const JS_TIENDA = `(() => {
  const txt = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ');
  const bajo = txt.toLowerCase();
  const precios = (txt.match(/(?:US\\$|\\$|€|£|USD|MXN)\\s?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2})?/g) || []).length;
  const carrito = /(add to cart|añadir al carrito|agregar al carrito|comprar ahora|buy now|checkout|pagar ahora|añadir a la cesta|add to bag)/i.test(txt);
  let producto = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent); const lista = [].concat(j['@graph'] || j);
      for (const x of lista) {
        const tipo = [].concat(x['@type'] || []).join(',');
        if (/Product/.test(tipo)) {
          const of = [].concat(x.offers || [])[0] || {};
          const oferta = of.offers ? [].concat(of.offers)[0] : of;
          const precio = Number(oferta.price || oferta.lowPrice || of.lowPrice || 0);
          producto = { nombre: x.name, marca: (x.brand && (x.brand.name || x.brand)) || '', modelo: x.gtin13 || x.gtin12 || x.gtin || x.mpn || x.sku || x.model || '', precio, moneda: oferta.priceCurrency || of.priceCurrency || '' };
          break;
        }
      }
    } catch (e) { }
    if (producto) break;
  }
  if (!producto) {   // Amazon y tiendas sin datos estándar: título y precio visibles
    const q = (s) => { const e = document.querySelector(s); return e ? (e.content || e.textContent || '').trim() : ''; };
    const num = (t) => { const x = String(t || '').replace(/[^0-9.,]/g, ''); if (!x) return 0; const n = Number(/,\\d{2}$/.test(x) ? x.replace(/\\./g, '').replace(',', '.') : x.replace(/,/g, '')); return n > 0 && n < 1e6 ? n : 0; };
    const nombre = q('#productTitle') || q('[itemprop="name"]') || q('h1[data-testid*="title" i]') || q('h1');
    let precio = 0; let precioTxt = '';
    for (const e of document.querySelectorAll('#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, #apex_desktop .a-offscreen, #price_inside_buybox, #usedBuySection .a-color-price, #buybox .a-offscreen, .a-price .a-offscreen, [itemprop="price"], [data-testid*="price" i]')) {
      precioTxt = (e.content || e.textContent || '').trim(); precio = num(precioTxt); if (precio) break;
    }
    if (!precio) { const w = q('.a-price-whole'); const f = q('.a-price-fraction'); precio = num(w + (f ? '.' + f : '')); }
    if (nombre && precio > 0 && (document.querySelector('#add-to-cart-button, #buy-now-button, [name="submit.add-to-cart"], [data-testid*="add-to-cart" i]') || /amazon\./.test(location.hostname))) {
      producto = { nombre: nombre.slice(0, 200), marca: q('#bylineInfo').replace(/^(Visit the|Brand:|Visita la tienda de|Marca:)\\s*/i, '').replace(/\\s*Store$/i, ''), modelo: '', precio, moneda: q('[itemprop="priceCurrency"]') || (/€/.test(precioTxt) ? 'EUR' : /£/.test(precioTxt) ? 'GBP' : 'USD'),
        foto: (document.querySelector('#landingImage, #imgTagWrapperId img') || {}).src || '',
        estado: /used|usado|renewed|reacondicionado/i.test(q('#usedBuySection') + q('#buybox')) ? 'used' : 'new' };
    }
  }
  if (!producto) {
    const m = (p) => { const e = document.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]'); return e ? e.content : ''; };
    const precio = Number(m('product:price:amount') || m('og:price:amount') || 0);
    if (precio && (m('og:type') || '').includes('product')) producto = { nombre: m('og:title') || document.title, marca: m('product:brand'), modelo: '', precio, moneda: m('product:price:currency') || m('og:price:currency') };
  }
  if (producto && !producto.foto) { const og = document.querySelector('meta[property="og:image"]'); producto.foto = og ? og.content : ''; }
  return {
    url: location.href, titulo: document.title, precios, carrito, producto,
    contacto: /(contact us|contáctanos|contacto|customer service|servicio al cliente|atención al cliente)/i.test(txt),
    devoluciones: /(return policy|refund|política de devoluci|devoluciones|reembolso)/i.test(txt),
    descuentos: (bajo.match(/-\\s?(7\\d|8\\d|9\\d)\\s?%|(7\\d|8\\d|9\\d)\\s?% off/g) || []).length,
    soloTransferencia: /(zelle|western union|bank transfer only|solo transferencia|crypto only|bitcoin only|gift card)/i.test(txt),
    texto: txt.slice(0, 6000),
  };
})()`;
const MARCAS_TIENDA = ['amazon', 'walmart', 'bestbuy', 'target', 'ebay', 'apple', 'nike', 'adidas', 'paypal', 'samsung', 'microsoft', 'netflix', 'costco', 'shein', 'temu', 'aliexpress', 'mercadolibre', 'playstation', 'xbox', 'steam'];
const TLD_RIESGO = /\.(shop|top|xyz|store|online|site|buzz|click|icu|cfd|sbs|cyou|live|vip|fun|rest|bond|lol|today|monster)$/i;
const raizDominio = (host) => host.replace(/^www\./, '').split('.').slice(-2).join('.');
const sinNumeros = (s) => s.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/@/g, 'a');

// edad del dominio en días (registro público RDAP); null si no se sabe
const edades = new Map();
async function edadDominio(host) {
  const d = raizDominio(host);
  if (edades.has(d)) return edades.get(d);
  let dias = null;
  try {
    const r = await Cerebro.fetchN(`https://rdap.org/domain/${encodeURIComponent(d)}`, { timeout: 8000, headers: { Accept: 'application/rdap+json' } });
    if (r.ok) {
      const j = await r.json();
      const ev = (j.events || []).find((e) => e.eventAction === 'registration');
      if (ev && ev.eventDate) dias = Math.floor((Date.now() - Date.parse(ev.eventDate)) / 864e5);
    }
  } catch { /* sin internet o el registro no responde */ }
  edades.set(d, dias);
  return dias;
}

// suma señales; devuelve { puntos, senales, motivos }
async function revisarSenales(host, d) {
  const senales = {}; const motivos = []; let puntos = 0;
  const dominio = raizDominio(host); const nombre = dominio.split('.')[0];
  const dias = await edadDominio(host); senales.edadDias = dias;
  if (dias != null && dias < 90) { puntos += 3; motivos.push({ es: `El dominio se creó hace solo ${dias} días`, en: `The domain was created only ${dias} days ago` }); }
  else if (dias != null && dias < 365) { puntos += 1; motivos.push({ es: 'El dominio tiene menos de un año', en: 'The domain is less than a year old' }); }
  const marca = MARCAS_TIENDA.find((m) => sinNumeros(nombre).includes(m) && nombre !== m);
  if (marca) { puntos += 3; senales.imitaMarca = marca; motivos.push({ es: `El nombre imita a «${marca}» pero no es su web oficial`, en: `The name imitates "${marca}" but it is not its official site` }); }
  if (TLD_RIESGO.test(dominio)) { puntos += 1; senales.terminacion = dominio.split('.').pop(); motivos.push({ es: `Terminación de dominio muy usada en estafas (.${senales.terminacion})`, en: `Domain ending often used by scams (.${senales.terminacion})` }); }
  if (!d.contacto) { puntos += 1; motivos.push({ es: 'No se ve forma de contacto ni servicio al cliente', en: 'No contact or customer service info visible' }); }
  if (!d.devoluciones) { puntos += 0.5; }
  if (d.descuentos >= 3) { puntos += 1; motivos.push({ es: 'Descuentos exagerados (70–90 %) por todas partes', en: 'Huge discounts (70–90%) everywhere' }); }
  if (d.soloTransferencia) { puntos += 2; motivos.push({ es: 'Pide pagos difíciles de reclamar (transferencia, Zelle, cripto o tarjetas regalo)', en: 'Asks for hard-to-dispute payments (wire, Zelle, crypto or gift cards)' }); }
  Object.assign(senales, { contacto: d.contacto, devoluciones: d.devoluciones, descuentosExagerados: d.descuentos, pagosRaros: d.soloTransferencia });
  return { puntos, senales, motivos, dias };
}

const esTienda = (d) => d && (d.carrito || d.producto || d.precios >= 4);
const tiendasVistas = new Set(); const preciosVistos = new Set(); let ultimoPrecioT = 0; let tiendaT = 0;
nav.en('navegado', (h) => {
  if (E.privada || !h || !/^https:/.test(h.url) || (cfg.detectorEstafas === false && cfg.comparadorPrecios === false)) return;
  clearTimeout(tiendaT); tiendaT = setTimeout(() => revisarTienda(h.url), 3000);
});
async function revisarTienda(url) {
  if (E.privada || E.url !== url) return;
  const d = await enPagina(JS_TIENDA); if (!esTienda(d)) return;
  const host = hostDe(url);
  if (cfg.detectorEstafas !== false && !tiendasVistas.has(host)) {
    tiendasVistas.add(host);
    const r = await revisarSenales(host, d);
    if (r.puntos >= 3) {
      let ia = null; try { ia = await Cerebro.analizarEstafa({ senales: r.senales, titulo: d.titulo, url, texto: d.texto }, IDIOMA); } catch { /* */ }
      if (!ia ? r.puntos >= 4 : ia.riesgo !== 'bajo') {
        const motivos = (ia && ia.motivos && ia.motivos.length ? ia.motivos : r.motivos.map((m) => T(m.es, m.en))).slice(0, 3);
        avisadoAlto = url;
        $('aviso-txt').textContent = `🛡 ${host} ${ia && ia.riesgo === 'alto' ? T('parece una ESTAFA', 'looks like a SCAM') : T('podría ser una estafa', 'might be a scam')}: ${motivos.join(' · ')}`.slice(0, 260);
        $('aviso-barra').hidden = false; H('vibrar', { ms: 60 }); hablar(T('Cuidado, señor: esta tienda podría ser una estafa.', 'Careful, sir: this store might be a scam.'));
      }
    }
  }
  if (cfg.comparadorPrecios !== false && d.producto && d.producto.precio > 0 && d.producto.nombre) {
    const clave = url.split('#')[0];
    if (preciosVistos.has(clave) || Date.now() - ultimoPrecioT < 15000) return;
    preciosVistos.add(clave); ultimoPrecioT = Date.now();
    await pausa(3000); if (E.url.split('#')[0] !== clave) return;
    let ofertas = []; try { ofertas = await Cerebro.compararPrecios({ ...d.producto, tienda: host }); } catch { return; }
    const moneda = String(d.producto.moneda || 'USD').toUpperCase();
    const mejores = ofertas.filter((o) => o.moneda.toUpperCase() === moneda && o.precio < d.producto.precio * 0.97 && hostDe(o.url) !== host).sort((a, b) => a.precio - b.precio);
    if (mejores.length) barraPrecio({ tienda: host, precio: d.producto.precio, moneda, mejor: mejores[0] });
    if (ofertas.length) tarjetasPrecios({ tienda: host, ...d.producto }, ofertas);
  }
}
async function revisarEstafaAhora() {
  const d = await enPagina(JS_TIENDA); if (!d) return { ok: false, error: 'Could not read the page.' };
  const host = hostDe(E.url); const r = await revisarSenales(host, d);
  let ia = null; try { ia = await Cerebro.analizarEstafa({ senales: r.senales, titulo: d.titulo, url: E.url, texto: d.texto }, IDIOMA); } catch { /* */ }
  return { ok: true, sitio: host, edad_dominio_dias: r.dias, puntos_de_riesgo: r.puntos, senales: r.senales, analisis: ia };
}
async function compararAhora(producto) {
  const d = await enPagina(JS_TIENDA); const host = hostDe(E.url);
  const titulo = String((d && d.titulo) || E.titulo || '').replace(/\s+[-–|]\s+(Google Search|Buscar con Google|Búsqueda de Google|Bing|DuckDuckGo).*$/i, '').trim();   // también desde Google [09-nov]
  const pr = (d && d.producto) || ((producto || titulo) ? { nombre: producto || titulo, precio: 0 } : null);
  if (!pr) return { ok: false, error: 'Ask the user which product.' };
  try {
    let ofertas = []; let fallo = null;
    // 1) los resultados de Google (rápido, sin la cuota de búsqueda de Gemini, y con la foto de cada tienda) [09-nov]
    if (!/google\.|bing\.com/.test(E.url || '')) { await H('nueva', { url: 'https://www.google.com/search?q=' + encodeURIComponent(pr.nombre + ' price') }); for (let i = 0; i < 18; i++) { await pausa(500); if (/google\./.test(E.url || '') && (await enPagina('document.readyState')) === 'complete') break; } await pausa(1500); }
    const res = await enPagina(JS_RESULTADOS);
    if (res && res.enlaces && res.enlaces.length) { try { ofertas = await Cerebro.ofertasDeResultados(pr, res.enlaces); } catch (e) { fallo = e; } }
    // 2) si no salió nada: la búsqueda de Gemini (con tiempo límite)
    if (!ofertas.length) { try { ofertas = await Promise.race([Cerebro.compararPrecios({ ...pr, tienda: host }), pausa(25000).then(() => [])]); } catch (e) { fallo = e; } }
    if (!ofertas.length && fallo) throw fallo;
    if (ofertas.length) tarjetasPrecios({ tienda: host, ...pr }, ofertas);
    return { ok: true, aqui: { tienda: host, ...pr }, ofertas, nota: 'Photo cards of each store are already shown in the chat; just summarize briefly which one is cheapest and how much they save.' };
  } catch (e) { return { ok: false, error: e.sinGemini ? 'Price comparison needs the Gemini key.' : String(e.message || e) }; }
}
// 🖼 la foto de cada oferta (imagen principal de la página de esa tienda)
async function fotoDe(url) {
  try {
    const r = await Cerebro.fetchN(url, { timeout: 9000, headers: { 'Accept-Language': 'en-US,en;q=0.9,es;q=0.8' } }); if (!r.ok) return '';
    const html = String(await r.text()).slice(0, 600000);
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i) || html.match(/"image"\s*:\s*\[?\s*"(https:[^"]+)"/i);
    return m ? m[1].replace(/&amp;/g, '&') : '';
  } catch { return ''; }
}
async function tarjetasPrecios(aqui, ofertas) {
  const lista = ofertas.slice(0, 5); await Promise.all(lista.map(async (o) => { o.foto = (await fotoDe(o.url)) || o.imagen || ''; o.web = hostDe(o.url); }));
  lista.sort((p, q) => p.precio - q.precio);
  const hay = aqui.precio > 0; const minimo = Math.min(...lista.map((o) => o.precio), hay ? aqui.precio : Infinity);
  const mon = (aqui.moneda || 'USD') === 'USD' ? '$' : ''; const f = (n) => mon + Number(n).toFixed(2) + (mon ? '' : ' ' + aqui.moneda);
  const logo = (web) => `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(web || '')}`;
  const tarjeta = (o, aquiMismo) => { const ahorro = hay ? aqui.precio - o.precio : 0; const foto = o.foto || logo(o.web);
    return `<a class="tarjeta${aquiMismo ? ' aqui' : ''}${o.precio === minimo ? ' barata' : ''}" ${aquiMismo ? '' : `data-url="${esc(o.url)}"`}><div class="foto"><img src="${esc(foto)}" alt="" referrerpolicy="no-referrer" /></div>
      <span class="web"><img src="${esc(logo(o.web))}" alt="" />${esc(o.web || o.tienda)}</span><b>${esc(o.tienda)}</b><span class="pr">${f(o.precio)}</span>
      <small>${aquiMismo ? T('aquí', 'here') + (aqui.estado === 'used' ? ' · ' + T('usado', 'used') : '') : o.precio === minimo ? '🏆 ' + T('el más barato', 'cheapest') + (hay && ahorro > 0.5 ? ' · ' + T('ahorras', 'save') + ' ' + f(ahorro) : '') : hay && ahorro > 0.5 ? T('ahorras', 'save') + ' ' + f(ahorro) : hay && ahorro < -0.5 ? '+' + f(-ahorro) : T('abrir ›', 'open ›')}</small></a>`; };
  const dv = document.createElement('div'); dv.className = 'msg j precios';
  dv.innerHTML = `<div class="cab">💰 ${T('Comparación de precios', 'Price comparison')}<small>${esc(String(aqui.nombre || '').slice(0, 90))}</small></div><div class="tarjetas">${hay ? tarjeta({ tienda: aqui.tienda, web: aqui.tienda, precio: aqui.precio, foto: aqui.foto }, true) : ''}${lista.map((o) => tarjeta(o, false)).join('')}</div>`;
  dv.querySelectorAll('.foto img').forEach((im) => im.addEventListener('error', () => { im.parentNode.textContent = '🛒'; }));
  dv.querySelectorAll('.web img').forEach((im) => im.addEventListener('error', () => { im.remove(); }));
  $('charla').appendChild(dv); $('charla').scrollTop = $('charla').scrollHeight;
}
function barraPrecio(x) {
  let b = $('precio-barra');
  if (!b) { b = document.createElement('div'); b.id = 'precio-barra'; b.innerHTML = '<span></span><button class="abrir"></button><button class="ver">💰</button><button class="x">✕</button>'; $('aviso-barra').after(b);
    b.querySelector('.x').onclick = () => { b.hidden = true; }; b.querySelector('.ver').onclick = () => { b.hidden = true; abrirPanel('chat'); }; }
  const mon = x.moneda === 'USD' ? '$' : ''; const ahorro = (x.precio - x.mejor.precio).toFixed(2);
  b.querySelector('span').textContent = `💰 ${T('Más barato en', 'Cheaper at')} ${x.mejor.tienda}: ${mon}${x.mejor.precio.toFixed(2)} (${T('ahorras', 'save')} ${mon}${ahorro})`;
  const ab = b.querySelector('.abrir'); ab.textContent = T('Abrir', 'Open'); ab.onclick = () => { b.hidden = true; H('nueva', { url: x.mejor.url }); };
  b.hidden = false; H('vibrar', { ms: 25 });
}
// ⏱ los minutos del chat saltan a ese momento del video
function irAlMinuto(s) {
  enPagina(`(() => { const p = document.getElementById('movie_player'); if (p && p.seekTo) { p.seekTo(${Number(s) || 0}, true); p.playVideo && p.playVideo(); return true; } const v = document.querySelector('video'); if (!v) return false; v.currentTime = ${Number(s) || 0}; v.play(); return true; })()`);
}

// ═══════════ 🗣 conversación en vivo (Gemini Live, nativo) [09-nov] ═══════════
const VIVO_HERR = ['play_video', 'see_page', 'click', 'type_text', 'media_control', 'open_url', 'web_search', 'tabs', 'scroll', 'navigate', 'read_page', 'summarize_page', 'translate_page', 'zoom', 'find_in_page',
  'browser_history', 'browser_memory', 'remember', 'send_to_phone', 'youtube_subtitles', 'live_dubbing', 'ask_video', 'check_scam', 'compare_prices', 'picture_in_picture', 'list_tabs'];
const VV = { on: false, tu: null, el: null, reintento: false };
function vivoBarra(estado, sub = '') {
  let b = $('vivo-barra');
  if (!b) {
    b = document.createElement('div'); b.id = 'vivo-barra';
    b.innerHTML = '<div class="orbe-vivo"><i></i><i></i><i></i></div><div class="vivo-txt"><b></b><small></small></div><button class="vivo-fin">■</button>';
    $('chips-chat').before(b); b.querySelector('.vivo-fin').onclick = () => vivoApagar();
  }
  b.hidden = !VV.on; b.querySelector('b').textContent = estado; b.querySelector('small').textContent = sub;
}
async function vivoEncender() {
  if (VV.on) return vivoApagar();
  if (cfg.conversacionVivo === false) { toast(T('La conversación en vivo está apagada en Ajustes', 'Live conversation is off in Settings')); return; }
  abrirPanel('chat');
  const herramientas = Cerebro.HERRAMIENTAS.filter((h) => VIVO_HERR.includes(h.nombre)).map((h) => ({ name: h.nombre, description: h.desc, ...(h.params ? { parameters: h.params } : {}) }));
  const sistema = Cerebro.sistemaBase(IDIOMA) + '\n\nTHIS IS A LIVE VOICE CONVERSATION on the phone (like a call): answer in short, natural spoken sentences, no markdown, no lists, no URLs read aloud. The user may interrupt you. You can control the browser with your tools while you talk: open sites, search, scroll, read the page, click, type, play/pause videos… To play a YouTube video ALWAYS use play_video (with query to search, and n for the 1st, 2nd… result) — never see_page for that. To click other things: call see_page ONCE to get the numbered clickable elements, then click by id (or by visible text); never call see_page twice in a row. To play, pause, skip or rewind use media_control. Never say you cannot click: you can. Briefly say what you are doing.'
    + (!E.privada && E.url && !E.inicio ? `\nThe user is now on: ${E.titulo || ''} — ${E.url}` : '');
  VV.on = true; vivoBarra(T('Conectando…', 'Connecting…'));
  const r = await H('vivo', { on: true, sistema, herramientas });
  if (r && r.ok) return;
  VV.on = false; vivoBarra('');
  if (r && r.error === 'permiso' && !VV.reintento) { VV.reintento = true; toast(T('Dale permiso al micrófono y vuelve a tocar 🗣', 'Allow the microphone and tap 🗣 again')); return; }
  msg('j', r && r.error === 'sin-gemini' ? T('🗣 La conversación en vivo necesita tu llave de Gemini (Ajustes › Cerebro).', '🗣 Live conversation needs your Gemini key (Settings › Brain).') : T('🗣 No pude empezar la conversación en vivo.', "🗣 Couldn't start the live conversation."));
}
function vivoApagar(error) {
  const estaba = VV.on; VV.on = false; VV.tu = VV.el = null; VV.reconex = 0;
  H('vivo', { on: false }); vivoBarra('');
  if (error) msg('j', '🗣 ' + error); else if (estaba) msg('j', T('🗣 Conversación en vivo terminada.', '🗣 Live conversation ended.'));
}
nav.en('vivo', (ev) => {
  if (!VV.on || !ev) return;
  if (ev.estado === 'listo') { if (!VV.reconex) H('vibrar', { ms: 30 }); vivoBarra(T('Te escucho…', 'Listening…'), T('Habla cuando quieras · ■ para terminar', 'Speak any time · ■ to end')); return; }
  if (ev.estado === 'fin' || ev.estado === 'error') {
    if (ev.inesperado && VV.on && (VV.reconex = (VV.reconex || 0) + 1) <= 3) { vivoBarra(T('Reconectando…', 'Reconnecting…')); VV.on = false; vivoEncender().then(() => {}); return; }   // se cortó solo: reconecta [09-nov]
    vivoApagar(ev.error || (ev.inesperado && ev.motivo ? T('Gemini cortó la conversación: ', 'Gemini ended the conversation: ') + ev.motivo : '')); return;
  }
  if (ev.interrumpido) { VV.el = null; vivoBarra(T('Te escucho…', 'Listening…')); }
  if (ev.habla) vivoBarra(T('JARVIS habla…', 'JARVIS speaking…'), T('Puedes interrumpirlo', 'You can interrupt'));
  if (ev.tu) { if (!VV.tu) VV.tu = msg('u', ''); VV.tu.textContent += ev.tu; VV.el = null; }
  if (ev.jarvis) { if (!VV.el) VV.el = msg('j', ''); VV.el.textContent += ev.jarvis; VV.tu = null; }
  if (ev.turno) { VV.tu = VV.el = null; vivoBarra(T('Te escucho…', 'Listening…'), T('Habla cuando quieras · ■ para terminar', 'Speak any time · ■ to end')); }
  $('charla').scrollTop = $('charla').scrollHeight;
});
nav.en('vivo-herramienta', async (x) => {   // JARVIS usa una herramienta mientras hablan
  if (!x) return;
  const p = msg('j', '⚙ ' + String(x.nombre || '').replace(/_/g, ' ')); p.style.opacity = '.6';
  VV.seguidos = x.nombre === VV.ultima ? (VV.seguidos || 0) + 1 : 1; VV.ultima = x.nombre;
  let r = null;
  if (x.nombre === 'see_page' && VV.seguidos > 2) r = { salida: { ok: false, error: 'You already called see_page several times. Stop: use click with an id from the list you already got, or play_video for YouTube.' } };   // anti-bucle
  else { try { r = await herramienta(x.nombre, x.args || {}); } catch (e) { r = { salida: { ok: false, error: String(e.message || e) } }; } }
  H('vivo-respuesta', { id: x.id, nombre: x.nombre, salida: (r && r.salida !== undefined ? r.salida : r) || { ok: true } });
});
document.addEventListener('visibilitychange', () => { if (document.hidden && VV.on) vivoApagar(); });   // sales de la app: se corta

// ═══════════ 🕵 investigador en segundo plano [09-nov] ═══════════
// 🌐 plan B sin la búsqueda de Gemini (cuando se acaba su cuota) [09-nov]: busca en DuckDuckGo y lee las 3 primeras páginas
const sinHtml = (h) => String(h || '').replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#?[a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
async function traerWeb(url) {
  const r = await Nativo.fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' }, timeout: 15000 });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.text()).slice(0, 800000);
}
async function buscarEnWeb(q) {
  const html = await traerWeb('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q));
  const res = [];
  for (const m of html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)) {
    let u = m[1].replace(/&amp;/g, '&'); const g = /[?&]uddg=([^&]+)/.exec(u); if (g) u = decodeURIComponent(g[1]); if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:/.test(u) || /duckduckgo\.com\/y\.js|bing\.com\/aclick/.test(u) || res.some((x) => x.url === u)) continue;
    res.push({ titulo: sinHtml(m[2]).slice(0, 120), url: u, texto: sinHtml(m[3]).slice(0, 400) });
    if (res.length >= 8) break;
  }
  if (!res.length) throw new Error('no web results');
  const paginas = [];
  for (const r of res.slice(0, 5)) {   // las 3 primeras que se dejen leer
    if (paginas.length >= 3) break;
    try { const t = sinHtml(await traerWeb(r.url)); if (t.length > 400 && !/just a moment|access denied|verify you are human|enable javascript/i.test(t.slice(0, 300))) paginas.push(`### ${r.titulo} (${r.url})\n${t.slice(0, 3500)}`); } catch { /* esa no */ }
  }
  return { texto: res.map((r) => `- ${r.titulo}: ${r.texto} (${r.url})`).join('\n') + '\n\n' + paginas.join('\n\n'), fuentes: res.map(({ titulo, url }) => ({ titulo, url })) };
}
// escribir (sin buscar) con cualquier IA que tengas; si falla, con Gemini + búsqueda
async function escribirIA(texto, max) { try { return await Cerebro.pensar({ sistema: 'You are a careful research assistant.', historia: [{ rol: 'user', texto }], max }); } catch (e) { return Cerebro.buscarWeb(texto, max); } }
let investigando = 0;
function investigarFondo(tema) {
  if (cfg.investigador === false) return { ok: false, error: 'The background researcher is turned off in Settings.' };
  if (investigando >= 2) return { ok: false, error: 'There are already 2 research jobs running.' };
  investigando++;
  const m = msg('j', T(`🕵 Investigando «${tema}»… puedes seguir navegando, te aviso al terminar.`, `🕵 Researching "${tema}"… keep browsing, I'll let you know.`));
  (async () => {
    try {
      const hoy = `Today is ${new Date().toDateString()}.`;
      const plan = await escribirIA(`${hoy} I must research this for a user: "${tema}". Write 4 to 6 specific web-search questions (one per line, no numbering, no extra text) that together cover it well (current options/prices/specs, comparisons, pros and cons, expert reviews).`, 600);
      const preguntas = plan.texto.split('\n').map((x) => x.replace(/^[-*\d.)\s]+/, '').trim()).filter((x) => x.length > 8).slice(0, 6);
      const notas = []; const fuentes = new Map(); let sinCuota = false;
      for (let k = 0; k < preguntas.length; k++) {
        m.textContent = T(`🕵 Investigando «${tema}» · buscando ${k + 1}/${preguntas.length}…`, `🕵 Researching "${tema}" · searching ${k + 1}/${preguntas.length}…`);
        if (k) await pausa(2500);
        try { let r = null; if (!sinCuota) { try { r = await Cerebro.buscarWeb(`${hoy} Search the web: ${preguntas[k]}\nAnswer with concrete, current facts (names, prices, specs, dates) in bullet points, and put the source page URL in parentheses after each fact.`, 1500); } catch { sinCuota = true; } } if (!r) r = await buscarEnWeb(preguntas[k]); notas.push(`## ${preguntas[k]}\n${r.texto}`); for (const f of r.fuentes) if (fuentes.size < 20) fuentes.set(f.url, f); } catch { /* */ }
      }
      if (!notas.length) throw new Error(T('No pude buscar en internet.', "Couldn't search the web."));
      m.textContent = T(`🕵 Investigando «${tema}» · escribiendo el informe…`, `🕵 Researching "${tema}" · writing the report…`);
      const final = await escribirIA(`${hoy} Using ONLY these research notes, write a clear report in ${Cerebro.idiomaDe(IDIOMA)} about: "${tema}". Start with a 2-sentence summary; then a markdown comparison table of the main options (price, key specs, pros, cons…); then "My recommendation". Markdown only, no preamble.\nNOTES:\n${notas.join('\n\n').slice(0, 50000)}`, 4000);
      m.className = 'msg j'; m.innerHTML = md(`🕵 **${tema}**\n\n${final.texto}\n\n**${T('Fuentes', 'Sources')}:**\n${[...fuentes.values()].map((f) => `- [${f.titulo}](${f.url})`).join('\n')}`);
      H('notificar', { titulo: '🕵 JARVIS', texto: T(`Tu informe está listo: ${tema}`, `Your report is ready: ${tema}`) }); hablar(T(`Señor, su informe sobre ${tema} está listo.`, `Sir, your report on ${tema} is ready.`));
    } catch (e) { m.textContent = '🕵 ' + T('No pude terminar la investigación: ', "Couldn't finish the research: ") + String(e.message || e); }
    finally { investigando--; }
  })();
  return { ok: true, nota: 'Research started in the background (1–3 minutes). Tell the user they can keep browsing; the report will appear in the chat with a notification.' };
}

// ═══════════ 🔄 continuar en la PC (WiFi de casa) [09-nov] ═══════════
const pcBase = () => { const a = String(cfg.continuarPC || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''); return a ? `http://${a.includes(':') ? a : a + ':8766'}` : ''; };
async function pcPedir(ruta, cuerpo) {
  if (cfg.continuarDispositivo === false) return { ok: false, error: T('Está apagado en Ajustes.', 'It is turned off in Settings.') };
  if (!cfg.continuarToken || !pcBase()) return { ok: false, error: T('Primero empareja la PC en Ajustes › Continuar en la PC.', 'First pair the PC in Settings › Continue on PC.') };
  try {
    const r = await Cerebro.fetchN(pcBase() + ruta, { method: cuerpo ? 'POST' : 'GET', timeout: 6000, headers: { Authorization: 'Bearer ' + cfg.continuarToken, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : null });
    if (r.status === 401) return { ok: false, error: T('La PC ya no reconoce este teléfono: empareja de nuevo.', 'The PC no longer knows this phone: pair again.') };
    if (!r.ok) return { ok: false, error: T('No encuentro la PC en el WiFi (¿está encendida con JARVIS Browser abierto?).', "Can't find the PC on WiFi (is it on with JARVIS Browser open?).") };
    return await r.json();
  } catch { return { ok: false, error: T('No encuentro la PC en el WiFi (¿está encendida con JARVIS Browser abierto?).', "Can't find the PC on WiFi (is it on with JARVIS Browser open?).") }; }
}
async function tiempoVideo() { return (await enPagina("(() => { const v = document.querySelector('#movie_player video') || document.querySelector('video'); return v && v.currentTime > 2 ? Math.floor(v.currentTime) : 0; })()")) || 0; }
async function seguirEnPC() {
  if (E.privada || !/^https?:/.test(E.url || '')) return { ok: false, error: T('Abre primero una página normal (no privada).', 'Open a normal (non-private) page first.') };
  const tiempo = await tiempoVideo(); if (tiempo) enPagina("(() => { const v = document.querySelector('video'); if (v) v.pause(); })()");
  return pcPedir('/continuar/abrir', { url: E.url, titulo: E.titulo || '', tiempo });
}
function urlConTiempo(u, s) {
  if (!s) return u;
  try { const x = new URL(u); if (/(^|\.)youtube\.com$|youtu\.be$/.test(x.hostname)) { x.searchParams.set('t', `${s}s`); return x.href; } } catch { /* */ }
  return u;
}
async function abrirConTiempo(u, s) {
  await H('nueva', { url: urlConTiempo(u, s) });
  if (s && !/youtu/.test(u)) setTimeout(() => enPagina(`(() => { const v = document.querySelector('video'); if (v) { v.currentTime = ${Number(s)}; v.play(); } })()`), 4000);
}
async function traerDePC() {
  const r = await pcPedir('/continuar/ahora'); if (!r.ok) return r;
  if (!/^https?:/.test(r.url || '')) return { ok: false, error: T('En la PC no hay ninguna página abierta.', 'There is no page open on the PC.') };
  await abrirConTiempo(r.url, r.tiempo); return { ok: true };
}
// lo que la PC te manda («📱 Seguir en el teléfono»): se revisa cada 5 s con la app abierta
setInterval(async () => {
  if (document.hidden || cfg.continuarDispositivo === false || !cfg.continuarToken) return;
  const r = await pcPedir('/continuar/pendiente'); const p = r && r.ok && r.pendiente; if (!p || !p.url) return;
  let b = $('pc-barra');
  if (!b) { b = document.createElement('div'); b.id = 'pc-barra'; b.innerHTML = '<span></span><button class="abrir"></button><button class="x">✕</button>'; $('aviso-barra').after(b); b.querySelector('.x').onclick = () => { b.hidden = true; }; }
  b.querySelector('span').textContent = '💻 ' + T('La PC te mandó: ', 'Your PC sent: ') + (p.titulo || hostDe(p.url));
  const ab = b.querySelector('.abrir'); ab.textContent = T('Abrir', 'Open'); ab.onclick = () => { b.hidden = true; abrirConTiempo(p.url, p.tiempo); };
  b.hidden = false; H('vibrar', { ms: 40 });
}, 5000);
// emparejar desde Ajustes
document.addEventListener('click', async (e) => {
  if (e.target.id === 'aj-cont-emparejar') {
    const pc = $('aj-cont-pc').value.trim(); const codigo = $('aj-cont-cod').value.trim();
    if (!pc || !/^\d{6}$/.test(codigo)) { toast(T('Escribe la dirección de la PC y el código de 6 números', 'Type the PC address and the 6-digit code')); return; }
    guardarCfg({ continuarPC: pc });
    try {
      const r = await Cerebro.fetchN(pcBase() + '/continuar/emparejar', { method: 'POST', timeout: 6000, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, nombre: 'Galaxy' }) });
      const j = await r.json().catch(() => null);
      if (j && j.ok && j.token) { guardarCfg({ continuarToken: j.token }); $('aj-cont-estado').textContent = '💻 ' + T('Emparejado con', 'Paired with') + ' ' + (j.pc || pc); toast('🔄 ' + T('¡Emparejado con la PC!', 'Paired with the PC!')); }
      else toast(T('Código incorrecto o vencido: pide uno nuevo en la PC', 'Wrong or expired code: get a new one on the PC'));
    } catch { toast(T('No encuentro la PC en esa dirección (mismo WiFi y JARVIS Browser abierto)', "Can't find the PC at that address (same WiFi, JARVIS Browser open)")); }
  }
  if (e.target.id === 'aj-cont-olvidar') { guardarCfg({ continuarToken: '' }); $('aj-cont-estado').textContent = T('Sin emparejar', 'Not paired'); toast(T('PC olvidada', 'PC forgotten')); }
});

// ▶ poner un video de YouTube sin tener que «ver» la página [09-nov]
const JS_PRIMER_VIDEO = `(() => { const n = %N%; const vistos = new Set(); const lista = [];
  for (const a of document.querySelectorAll('a[href*="/watch?v="]')) {
    let v = ''; try { v = new URL(a.href, location.href).searchParams.get('v'); } catch (e) { }
    if (!v || vistos.has(v)) continue;
    if (a.closest('ytd-ad-slot-renderer, ytm-promoted-video-renderer, ytd-promoted-video-renderer, ytm-companion-slot, [is-ad], .ad-container')) continue;
    const t = (a.getAttribute('title') || a.getAttribute('aria-label') || a.innerText || '').trim();
    vistos.add(v); lista.push({ v, t });
  }
  const x = lista[n - 1] || lista[0]; if (!x) return null;
  location.href = 'https://' + location.host + '/watch?v=' + x.v; return { titulo: x.t.split(String.fromCharCode(10))[0].slice(0, 120), total: lista.length };
})()`;
async function ponerVideo(query, n) {
  n = Math.max(1, Math.min(20, Number(n) || 1));
  if (query) { await H('ir', { url: 'https://m.youtube.com/results?search_query=' + encodeURIComponent(String(query)) }); await esperarCarga(); await pausa(2500); }
  if (!/youtube\.com|youtu\.be/.test(E.url || (await H('estado')).url)) return { ok: false, error: 'Not on YouTube: pass a query to search it.' };
  let r = null; for (let i = 0; i < 5 && !r; i++) { r = await enPagina(JS_PRIMER_VIDEO.replace('%N%', n)); if (!r) await pausa(1200); }
  if (!r) return { ok: false, error: 'No videos found on this page.' };
  await esperarCarga(); await pausa(1500);
  enPagina("(() => { const v = document.querySelector('video'); if (v && v.paused) v.play(); })()");
  return { ok: true, reproduciendo: r.titulo };
}

const JS_RESULTADOS = `(() => { const out = []; const vistos = new Set();
  const hostDe = (u) => { try { return new URL(u).hostname.replace(/^www\\./, ''); } catch (e) { return ''; } };
  const real = (a) => { let x = null; try { x = new URL(a.href); } catch (e) { return ''; } if (/(^|\\.)(google|gstatic|googleusercontent|bing|duckduckgo|youtube)\\./.test(x.hostname)) { const q = x.searchParams.get('url') || x.searchParams.get('q') || x.searchParams.get('adurl'); return q && /^https?:/.test(q) ? q : ''; } return a.href; };
  for (const a of document.querySelectorAll('a[href^="http"]')) {
    const u = real(a); const h = u && hostDe(u); if (!h || vistos.has(u)) continue; vistos.add(u);
    // la caja del resultado: se sube mientras siga siendo solo de esa tienda, así entra el texto con el PRECIO [09-nov]
    let caja = a;
    for (let k = 0; k < 10 && caja.parentElement; k++) {
      const p = caja.parentElement; const webs = new Set();
      for (const b of p.querySelectorAll('a[href^="http"]')) { const v = real(b); const hv = v && hostDe(v); if (hv) webs.add(hv); if (webs.size > 1) break; }
      if (webs.size > 1 || String(p.innerText || '').length > 1500) break;
      caja = p;
    }
    // la foto del producto: la imagen más grande de esa caja (no el iconito de la web)
    let foto = ''; let mejor = 0;
    for (const im of caja.querySelectorAll('img')) { const r = im.getBoundingClientRect(); const s = r.width * r.height; if (r.width >= 50 && r.height >= 50 && s > mejor) { mejor = s; foto = im.currentSrc || im.src || ''; } }
    if (foto.length > 60000) foto = '';
    out.push({ i: out.length, url: u, web: h, texto: String(caja.innerText || a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400), foto });
    if (out.length >= 40) break;
  }
  return { titulo: document.title, enlaces: out };
})()
`;
